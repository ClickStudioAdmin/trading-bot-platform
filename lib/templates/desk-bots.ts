import {
  deskAllowsTemplateApply,
  deskHomePath,
  type DeskType,
  type TradingAccount,
} from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import { parseDcaPlaybookRow } from "@/lib/dca/playbook";
import { parsePaperRulesRow } from "@/lib/engine/rules";
import { parseFuturesAutomationRow } from "@/lib/futures/automation";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  recipesMatchReplayFields,
  snapshotDcaRecipe,
  snapshotPaperRecipe,
  snapshotPerpsRecipe,
  templateFitsDesk,
  type TemplateDeskType,
  type TemplateRecipe,
} from "@/lib/templates/recipe";

export type TemplateDeskBot = {
  id: string;
  name: string;
  deskId: string;
  deskName: string;
  deskType: DeskType;
  recipe: TemplateRecipe;
};

export type TemplateBotLink = {
  id: string;
  deskId: string;
  name: string;
  deskName: string;
  href: string;
};

export function templateBotLinkLabel(bot: {
  deskName: string;
  name: string;
}): string {
  return `${bot.deskName} · ${bot.name}`;
}

export function templateBotLinks(
  template: { deskType: TemplateDeskType; recipe: TemplateRecipe },
  bots: readonly TemplateDeskBot[],
): TemplateBotLink[] {
  return bots
    .filter(
      (bot) =>
        templateFitsDesk(template.deskType, bot.deskType) &&
        recipesMatchReplayFields(template.recipe, bot.recipe),
    )
    .map((bot) => ({
      id: bot.id,
      deskId: bot.deskId,
      name: bot.name,
      deskName: bot.deskName,
      href: `${deskHomePath(bot.deskType, bot.deskId)}#bot-${bot.id}`,
    }))
    .sort((left, right) =>
      templateBotLinkLabel(left).localeCompare(templateBotLinkLabel(right)),
    );
}

export function templateBotLinksByTemplate(
  templates: readonly {
    id: string;
    deskType: TemplateDeskType;
    recipe: TemplateRecipe;
  }[],
  bots: readonly TemplateDeskBot[],
): Record<string, TemplateBotLink[]> {
  const links: Record<string, TemplateBotLink[]> = {};
  for (const template of templates) {
    const matches = templateBotLinks(template, bots);
    if (matches.length > 0) {
      links[template.id] = matches;
    }
  }
  return links;
}

export async function listTemplateBotLinks(
  userId: string,
  templates: readonly {
    id: string;
    deskType: TemplateDeskType;
    recipe: TemplateRecipe;
  }[],
): Promise<Record<string, TemplateBotLink[]>> {
  if (templates.length === 0) {
    return {};
  }
  const desks = (await listTradingAccounts(userId)).filter((desk) =>
    deskAllowsTemplateApply(desk),
  );
  const bots = await listTemplateDeskBots(desks);
  return templateBotLinksByTemplate(templates, bots);
}

async function listTemplateDeskBots(
  desks: readonly TradingAccount[],
): Promise<TemplateDeskBot[]> {
  const supabase = createServiceClient();
  if (!supabase || desks.length === 0) {
    return [];
  }
  const byId = new Map(desks.map((desk) => [desk.id, desk]));
  const idsFor = (deskType: DeskType) =>
    desks.filter((desk) => desk.deskType === deskType).map((desk) => desk.id);
  const [playbooks, rules, layers] = await Promise.all([
    rowsFor("dca_playbooks", idsFor("dca")),
    rowsFor("futures_automation_rules", idsFor("perps_bots")),
    rowsFor("paper_rules", idsFor("cash_and_carry")),
  ]);
  const bots: TemplateDeskBot[] = [];
  for (const row of playbooks) {
    const desk = byId.get(String(row.account_id ?? ""));
    const playbook = desk ? parseDcaPlaybookRow(row, desk.venue) : null;
    if (!desk || !playbook) {
      continue;
    }
    const recipe = snapshotDcaRecipe(playbook);
    bots.push({
      id: playbook.id,
      name: recipe.name,
      deskId: desk.id,
      deskName: desk.name,
      deskType: desk.deskType,
      recipe,
    });
  }
  for (const row of rules) {
    const desk = byId.get(String(row.account_id ?? ""));
    if (!desk) {
      continue;
    }
    const rule = parseFuturesAutomationRow(row, desk.venue);
    if (!rule.id) {
      continue;
    }
    const recipe = snapshotPerpsRecipe(rule);
    bots.push({
      id: rule.id,
      name: recipe.name,
      deskId: desk.id,
      deskName: desk.name,
      deskType: desk.deskType,
      recipe,
    });
  }
  for (const row of layers) {
    const desk = byId.get(String(row.account_id ?? ""));
    if (!desk || !Number.isFinite(Number(row.id)) || !Number.isFinite(Number(row.notional_usdt))) {
      continue;
    }
    const layer = parsePaperRulesRow(row, Number(row.sort_order) || 0);
    if (layer.id == null) {
      continue;
    }
    const recipe = snapshotPaperRecipe(layer);
    bots.push({
      id: String(layer.id),
      name: recipe.name,
      deskId: desk.id,
      deskName: desk.name,
      deskType: desk.deskType,
      recipe,
    });
  }
  return bots;
}

async function rowsFor(
  table: "dca_playbooks" | "futures_automation_rules" | "paper_rules",
  accountIds: string[],
): Promise<Record<string, unknown>[]> {
  const supabase = createServiceClient();
  const ids = [...new Set(accountIds.filter(Boolean))];
  if (!supabase || ids.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .in("account_id", ids);
  if (error || !data) {
    return [];
  }
  return data as Record<string, unknown>[];
}
