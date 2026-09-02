import { listTradingAccounts } from "@/lib/accounts/store";
import type { TradingAccount } from "@/lib/accounts/model";
import { deskAllowsPerpsRecipes, deskAllowsTemplateApply } from "@/lib/accounts/model";
import {
  dcaConfigMaxOrderError,
  dcaPlaybookConflict,
  type DcaPlaybook,
  type DcaPlaybookConfig,
} from "@/lib/dca/playbook";
import { lastPriceFor } from "@/lib/dca/run";
import { saveDcaPlaybook, listDcaPlaybooksForAccount } from "@/lib/dca/store";
import { parseHyperliquidSymbol } from "@/lib/venues/hyperliquid/symbol";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";
import { loadHyperliquidLinearPerps } from "@/lib/venues/hyperliquid/market";
import { paperLayerToRow, paperConfigToFormValues, parsePaperRulesRow, type PaperLayerFormValues } from "@/lib/engine/rules";
import { loadUsdtLinearPerps } from "@/lib/exchanges/bybit/perp";
import {
  futuresAutomationToRow,
  futuresRuleToForm,
  parseFuturesAutomationRow,
  type FuturesAutomationFormValues,
  type FuturesAutomationRule,
} from "@/lib/futures/automation";
import { loadFuturesAutomationRules } from "@/lib/futures/automation-load";
import { createServiceClient } from "@/lib/supabase/admin";
import type { PaperEngineLayer } from "@/lib/engine/decide";
import {
  dcaRecipeToConfig,
  paperRecipeToLayer,
  perpsRecipeToRule,
  uniqueAppliedName,
  templateFitsDesk,
  type TemplateDeskType,
  type TemplateRecipe,
} from "./recipe";
import { loadSetById, loadTemplateById, setIsSharedWith, templateIsSharedWith, type AutomationTemplate } from "./store";

export type ApplyItemInput = {
  templateId: string;
  skip?: boolean;
  symbol?: string;
  webhookId?: string | null;
};

export type AppliedDeskItem =
  | { deskType: "dca"; playbook: DcaPlaybook }
  | { deskType: "perps"; rule: FuturesAutomationFormValues }
  | { deskType: "cash_and_carry"; layer: PaperLayerFormValues };

export type ApplyItemResult = {
  templateId: string;
  name: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
  code?: "symbol_taken" | "desk_type" | "forbidden";
  notes: string[];
  symbol?: string;
  applied?: AppliedDeskItem;
};

async function ownedDesk(
  userId: string,
  accountId: string,
): Promise<TradingAccount | null> {
  const desks = await listTradingAccounts(userId);
  return desks.find((desk) => desk.id === accountId) ?? null;
}

async function canReadTemplate(
  template: AutomationTemplate,
  userId: string,
): Promise<boolean> {
  if (template.visibility === "platform" || template.userId === userId) {
    return true;
  }
  if (template.visibility === "backtested" && template.userId === null) {
    return true;
  }
  return templateIsSharedWith(userId, template.id);
}

function remapTemplateSymbol(symbol: string, venue: string): string {
  if (venue !== "hyperliquid") {
    return symbol;
  }
  const parsed = parseHyperliquidSymbol(symbol);
  return parsed.ok ? parsed.symbol : symbol;
}

async function rejectDcaMaxOrder(
  config: DcaPlaybookConfig,
  desk: TradingAccount,
): Promise<string | null> {
  const pairs =
    desk.venue === "hyperliquid"
      ? await loadHyperliquidLinearPerps(
          hyperliquidInfoEnvironment(desk.venueEnvironment),
        ).catch(() => [])
      : await loadUsdtLinearPerps().catch(() => []);
  const pair = pairs.find((row) => row.symbol === config.symbol);
  if (!pair) {
    return "That contract is not available.";
  }
  const lastPrice = await lastPriceFor(config.symbol, desk);
  return dcaConfigMaxOrderError({
    config,
    lastPrice,
    maxQty: pair.maxQty,
    maxMktQty: pair.maxMktQty,
    baseCoin: pair.baseCoin,
  });
}

async function applyDcaTemplate(input: {
  userId: string;
  accountId: string;
  template: AutomationTemplate;
  symbol?: string;
  webhookId?: string | null;
  desk: TradingAccount;
}): Promise<ApplyItemResult> {
  const recipe = input.template.recipe;
  if (recipe.kind !== "dca") {
    return {
      templateId: input.template.id,
      name: input.template.name,
      ok: false,
      error: "This template is not a DCA bot.",
      notes: [],
    };
  }
  const built = dcaRecipeToConfig(recipe, {
    symbol: remapTemplateSymbol(input.symbol ?? recipe.symbol, input.desk.venue),
    webhookId: input.webhookId,
    venue: input.desk.venue,
  });
  if (!built.ok) {
    return {
      templateId: input.template.id,
      name: input.template.name,
      ok: false,
      error: built.error,
      notes: [],
    };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return {
      templateId: input.template.id,
      name: input.template.name,
      ok: false,
      error: "Database is not configured.",
      notes: [],
    };
  }
  const siblings = await listDcaPlaybooksForAccount(input.accountId, supabase);
  if (dcaPlaybookConflict(siblings, { symbol: built.config.symbol })) {
    return {
      templateId: input.template.id,
      name: input.template.name,
      ok: false,
      error: "A bot already covers that contract.",
      code: "symbol_taken",
      notes: built.notes,
      symbol: built.config.symbol,
    };
  }
  const sizeError = await rejectDcaMaxOrder(built.config, input.desk);
  if (sizeError) {
    return {
      templateId: input.template.id,
      name: input.template.name,
      ok: false,
      error: sizeError,
      notes: built.notes,
    };
  }
  const saved = await saveDcaPlaybook({
    supabase,
    userId: input.userId,
    accountId: input.accountId,
    config: { ...built.config, webhookId: built.config.webhookId },
  });
  if (!saved.ok) {
    const taken = saved.error.includes("already covers");
    return {
      templateId: input.template.id,
      name: input.template.name,
      ok: false,
      error: saved.error,
      code: taken ? "symbol_taken" : undefined,
      notes: built.notes,
      symbol: built.config.symbol,
    };
  }
  return {
    templateId: input.template.id,
    name: input.template.name,
    ok: true,
    notes: built.notes,
    symbol: built.config.symbol,
    applied: { deskType: "dca", playbook: saved.playbook },
  };
}

async function applyPerpsTemplate(input: {
  userId: string;
  accountId: string;
  template: AutomationTemplate;
  webhookId?: string | null;
  desk: TradingAccount;
}): Promise<ApplyItemResult> {
  const recipe = input.template.recipe;
  if (!deskAllowsPerpsRecipes(input.desk)) {
    return {
      templateId: input.template.id,
      name: input.template.name,
      ok: false,
      error: "Perps bot templates apply to a Perps bots desk.",
      notes: [],
    };
  }
  if (recipe.kind !== "perps") {
    return {
      templateId: input.template.id,
      name: input.template.name,
      ok: false,
      error: "This template is not a Perps bot.",
      notes: [],
    };
  }
  const existing = await loadFuturesAutomationRules(input.accountId);
  const built = perpsRecipeToRule(recipe, {
    sortOrder: existing.length,
    webhookId: input.webhookId,
    venue: input.desk.venue,
    symbol: remapTemplateSymbol(recipe.symbol, input.desk.venue),
  });
  if (!built.ok) {
    return {
      templateId: input.template.id,
      name: input.template.name,
      ok: false,
      error: built.error,
      notes: [],
    };
  }
  const rule: FuturesAutomationRule = {
    ...built.rule,
    name: uniqueAppliedName(
      built.rule.name,
      existing.map((row) => row.name),
    ),
    mode: "disabled",
    id: null,
    conditionTrue: false,
    lastFiredAtMs: null,
  };
  const supabase = createServiceClient();
  if (!supabase) {
    return {
      templateId: input.template.id,
      name: input.template.name,
      ok: false,
      error: "Database is not configured.",
      notes: [],
    };
  }
  const { data, error } = await supabase
    .from("futures_automation_rules")
    .insert(futuresAutomationToRow(input.userId, input.accountId, rule))
    .select("*")
    .single();
  if (error || !data) {
    return {
      templateId: input.template.id,
      name: input.template.name,
      ok: false,
      error: error?.message ?? "Could not apply the template.",
      notes: built.notes,
    };
  }
  return {
    templateId: input.template.id,
    name: input.template.name,
    ok: true,
    notes: built.notes,
    applied: {
      deskType: "perps",
      rule: futuresRuleToForm(parseFuturesAutomationRow(data as Record<string, unknown>)),
    },
  };
}

async function applyPaperTemplate(input: {
  userId: string;
  accountId: string;
  template: AutomationTemplate;
}): Promise<ApplyItemResult> {
  const recipe = input.template.recipe;
  if (recipe.kind !== "cash_and_carry") {
    return {
      templateId: input.template.id,
      name: input.template.name,
      ok: false,
      error: "This template is not a Cash and Carry bot.",
      notes: [],
    };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return {
      templateId: input.template.id,
      name: input.template.name,
      ok: false,
      error: "Database is not configured.",
      notes: [],
    };
  }
  const { data: rows } = await supabase
    .from("paper_rules")
    .select("name, sort_order")
    .eq("account_id", input.accountId)
    .order("sort_order", { ascending: true });
  const names = (rows ?? []).map((row) => String((row as { name?: string }).name ?? ""));
  const nextOrder =
    (rows ?? []).reduce(
      (max, row) => Math.max(max, Number((row as { sort_order?: number }).sort_order) || 0),
      -1,
    ) + 1;
  const built = paperRecipeToLayer(recipe, { sortOrder: nextOrder });
  if (!built.ok) {
    return {
      templateId: input.template.id,
      name: input.template.name,
      ok: false,
      error: built.error,
      notes: [],
    };
  }
  const layer: PaperEngineLayer = {
    ...built.layer,
    name: uniqueAppliedName(built.layer.name, names),
    mode: "disabled",
    id: null,
    sortOrder: nextOrder,
  };
  const { data, error } = await supabase
    .from("paper_rules")
    .insert(paperLayerToRow(input.userId, layer, input.accountId))
    .select("*")
    .single();
  if (error || !data) {
    return {
      templateId: input.template.id,
      name: input.template.name,
      ok: false,
      error: error?.message ?? "Could not apply the template.",
      notes: built.notes,
    };
  }
  const savedLayer = parsePaperRulesRow(
    data as Record<string, unknown>,
    nextOrder,
  );
  const formLayer = paperConfigToFormValues({
    enabled: false,
    layers: [savedLayer],
  }).layers[0];
  if (!formLayer) {
    return {
      templateId: input.template.id,
      name: input.template.name,
      ok: false,
      error: "Could not apply the template.",
      notes: built.notes,
    };
  }
  return {
    templateId: input.template.id,
    name: input.template.name,
    ok: true,
    notes: built.notes,
    applied: { deskType: "cash_and_carry", layer: formLayer },
  };
}

export async function applyTemplateToDesk(input: {
  userId: string;
  accountId: string;
  templateId: string;
  symbol?: string;
  webhookId?: string | null;
  skip?: boolean;
}): Promise<ApplyItemResult> {
  if (input.skip) {
    return {
      templateId: input.templateId,
      name: "Skipped",
      ok: true,
      skipped: true,
      notes: [],
    };
  }
  const desk = await ownedDesk(input.userId, input.accountId);
  if (!desk) {
    return {
      templateId: input.templateId,
      name: "Template",
      ok: false,
      error: "That desk was not found.",
      code: "forbidden",
      notes: [],
    };
  }
  const template = await loadTemplateById(input.templateId);
  if (!template || !(await canReadTemplate(template, input.userId))) {
    return {
      templateId: input.templateId,
      name: "Template",
      ok: false,
      error: "That template was not found.",
      code: "forbidden",
      notes: [],
    };
  }
  return applyLoadedTemplate({
    userId: input.userId,
    accountId: input.accountId,
    desk,
    template,
    symbol: input.symbol,
    webhookId: input.webhookId,
  });
}

export async function applyRecipeToDesk(input: {
  userId: string;
  accountId: string;
  recipe: TemplateRecipe;
  name: string;
}): Promise<ApplyItemResult> {
  const desk = await ownedDesk(input.userId, input.accountId);
  if (!desk) {
    return {
      templateId: "recipe",
      name: input.name,
      ok: false,
      error: "That desk was not found.",
      code: "forbidden",
      notes: [],
    };
  }
  const deskType =
    input.recipe.kind === "dca"
      ? "dca"
      : input.recipe.kind === "perps"
        ? "perps"
        : "cash_and_carry";
  const template: AutomationTemplate = {
    id: "recipe",
    userId: input.userId,
    visibility: "user",
    deskType,
    name: input.name,
    description: null,
    recipe: { ...input.recipe, name: input.name } as TemplateRecipe,
    recipeVersion: 1,
    createdAtMs: 0,
    updatedAtMs: 0,
    ownerEmail: null,
    sharedByEmail: null,
    sharedAtMs: null,
    sharedDirectly: false,
    sharedWith: [],
    starterPack: false,
  };
  const result = await applyLoadedTemplate({
    userId: input.userId,
    accountId: input.accountId,
    desk,
    template,
  });
  if (result.ok) {
    return {
      ...result,
      notes: [
        ...result.notes,
        "Copied idle. Enable on the desk yourself.",
      ],
    };
  }
  return result;
}

async function applyLoadedTemplate(input: {
  userId: string;
  accountId: string;
  desk: TradingAccount;
  template: AutomationTemplate;
  symbol?: string;
  webhookId?: string | null;
}): Promise<ApplyItemResult> {
  const { template, desk } = input;
  if (!deskAllowsTemplateApply(desk) || !templateFitsDesk(template.deskType, desk.deskType)) {
    return {
      templateId: template.id,
      name: template.name,
      ok: false,
      error: "This template does not match the desk type.",
      code: "desk_type",
      notes: [],
    };
  }
  const result =
    template.deskType === "dca"
      ? await applyDcaTemplate({
          userId: input.userId,
          accountId: input.accountId,
          template,
          symbol: input.symbol,
          webhookId: input.webhookId,
          desk,
        })
      : template.deskType === "perps"
        ? await applyPerpsTemplate({
            userId: input.userId,
            accountId: input.accountId,
            template,
            webhookId: input.webhookId,
            desk,
          })
        : await applyPaperTemplate({
            userId: input.userId,
            accountId: input.accountId,
            template,
          });
  if (result.ok && template.visibility === "backtested") {
    return {
      ...result,
      notes: [
        ...result.notes,
        "This was backtested. Enable on the desk yourself.",
      ],
    };
  }
  return result;
}

export async function applyTemplateSetToDesk(input: {
  userId: string;
  accountId: string;
  setId: string;
  items: ApplyItemInput[];
}): Promise<{
  ok: boolean;
  deskType: TemplateDeskType | null;
  results: ApplyItemResult[];
  error?: string;
}> {
  const desk = await ownedDesk(input.userId, input.accountId);
  if (!desk) {
    return { ok: false, deskType: null, results: [], error: "That desk was not found." };
  }
  const set = await loadSetById(input.setId);
  if (
    !set ||
    (set.visibility !== "platform" &&
      set.userId !== input.userId &&
      !(await setIsSharedWith(input.userId, set.id)))
  ) {
    return { ok: false, deskType: null, results: [], error: "That folder was not found." };
  }
  if (!deskAllowsTemplateApply(desk) || !templateFitsDesk(set.deskType, desk.deskType)) {
    return {
      ok: false,
      deskType: set.deskType,
      results: [],
      error: "This folder does not match the desk type.",
    };
  }
  const byId = new Map(input.items.map((item) => [item.templateId, item]));
  const results: ApplyItemResult[] = [];
  for (const item of set.items) {
    const override = byId.get(item.templateId);
    results.push(
      await applyTemplateToDesk({
        userId: input.userId,
        accountId: input.accountId,
        templateId: item.templateId,
        skip: override?.skip,
        symbol: override?.symbol,
        webhookId: override?.webhookId,
      }),
    );
  }
  return { ok: true, deskType: set.deskType, results };
}

export function automationsPathForDeskType(deskType: TemplateDeskType): string {
  if (deskType === "cash_and_carry") {
    return "/strategies/cash-and-carry/automations";
  }
  return "/strategies/futures/automations";
}
