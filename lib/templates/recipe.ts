import { formatDeskType, type DeskType } from "@/lib/accounts/model";
import {
  dcaAveragingKind,
  dcaIntervalParts,
  parseDcaPlaybookForm,
  type DcaPlaybookConfig,
} from "@/lib/dca/playbook";
import type { PaperEngineLayer } from "@/lib/engine/decide";
import { parsePaperRulesForm, type PaperLayerFormValues } from "@/lib/engine/rules";
import {
  parseFuturesAutomationForm,
  writeAutomationExitsToForm,
  type FuturesAutomationFormValues,
  type FuturesAutomationRule,
} from "@/lib/futures/automation";

export const TEMPLATE_RECIPE_VERSION = 1;
export const TEMPLATE_NAME_MAX = 80;
export const RECIPE_NAME_MAX = 40;

export const TEMPLATE_DESK_TYPES = ["dca", "perps", "cash_and_carry"] as const;
export type TemplateDeskType = (typeof TEMPLATE_DESK_TYPES)[number];

export function templateFitsDesk(
  templateDeskType: TemplateDeskType,
  deskType: DeskType,
): boolean {
  if (templateDeskType === "perps") {
    return deskType === "perps_bots";
  }
  return deskType === templateDeskType;
}

export function formatTemplateDeskType(deskType: TemplateDeskType): string {
  return deskType === "perps" ? "Perps bots" : formatDeskType(deskType);
}
export const TEMPLATE_VISIBILITIES = ["user", "platform", "backtested"] as const;
export type TemplateVisibility = (typeof TEMPLATE_VISIBILITIES)[number];

export function parseTemplateVisibility(value: unknown): TemplateVisibility {
  if (value === "platform") {
    return "platform";
  }
  if (value === "backtested") {
    return "backtested";
  }
  return "user";
}

export function templateIsLibraryRow(visibility: TemplateVisibility): boolean {
  return visibility === "user" || visibility === "platform";
}

export const STALE_TEMPLATE_ERROR =
  "This template is from an older app version. Re-save it from a bot.";

export type DcaTemplateRecipe = {
  kind: "dca";
  name: string;
  symbol: string;
  direction: DcaPlaybookConfig["direction"];
  startKind: DcaPlaybookConfig["startKind"];
  dcaMode: DcaPlaybookConfig["dcaMode"];
  clipSize: number;
  sizeUnit: DcaPlaybookConfig["sizeUnit"];
  maxClips: number | null;
  maxValue: number | null;
  maxValueKind: DcaPlaybookConfig["maxValueKind"];
  dipPct: number | null;
  intervalMinutes: number | null;
  sizeMultiplier: number;
  deviationMultiplier: number;
  takeProfitPct: number | null;
  stopLossPct: number | null;
  takeProfitBasis: DcaPlaybookConfig["takeProfitBasis"];
  stopLossBasis: DcaPlaybookConfig["stopLossBasis"];
  takeProfitOrderType: DcaPlaybookConfig["takeProfitOrderType"];
  breakevenActivationPct: number | null;
  breakevenOffsetPct: number | null;
  trailingTriggerPct: number | null;
  trailingPct: number | null;
  armTrigger: DcaPlaybookConfig["armTrigger"];
  indicatorKind: DcaPlaybookConfig["indicatorKind"];
  indicatorTimeframe: DcaPlaybookConfig["indicatorTimeframe"];
  indicatorCompare: DcaPlaybookConfig["indicatorCompare"];
  indicatorLevel: number | null;
};

export type PerpsTemplateRecipe = {
  kind: "perps";
  name: string;
  symbol: string;
  formAction: FuturesAutomationFormValues["formAction"];
  orderType: FuturesAutomationFormValues["orderType"];
  sizeUnit: FuturesAutomationFormValues["sizeUnit"];
  size: string;
  limitPrice: string;
  entrySource: FuturesAutomationFormValues["entrySource"];
  triggerBy: FuturesAutomationFormValues["triggerBy"];
  triggerCompare: FuturesAutomationFormValues["triggerCompare"];
  triggerPrice: string;
  skipIfOpen: boolean;
  tpsl: FuturesAutomationFormValues["tpsl"];
  trailing: FuturesAutomationFormValues["trailing"];
};

export type PaperTemplateRecipe = {
  kind: "cash_and_carry";
  name: string;
  sizeType: PaperEngineLayer["sizeType"];
  exitSizeType: PaperEngineLayer["exitSizeType"];
  notionalUsdt: number;
  minNetApr: number | null;
  minDte: number | null;
  maxDte: number | null;
  minCapacityUsdt: number | null;
  minSizeUsdt: number | null;
  maxOpenCount: number | null;
  maxOpenNotionalUsdt: number | null;
  closeMaxDte: number | null;
  closeMinNetApr: number | null;
  takeProfitPct: number | null;
  stopLossPct: number | null;
};

export type TemplateRecipe =
  | DcaTemplateRecipe
  | PerpsTemplateRecipe
  | PaperTemplateRecipe;

export function isTemplateDeskType(value: unknown): value is TemplateDeskType {
  return (
    value === "dca" || value === "perps" || value === "cash_and_carry"
  );
}

export function parseTemplateName(
  raw: unknown,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 1) {
    return { ok: false, error: "Enter a template name." };
  }
  if (name.length > TEMPLATE_NAME_MAX) {
    return { ok: false, error: "Name must be 80 characters or fewer." };
  }
  return { ok: true, name };
}

export function parseTemplateDescription(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (text === "") {
    return null;
  }
  return text.slice(0, 500);
}

export function recipePreview(recipe: TemplateRecipe): string {
  if (recipe.kind === "cash_and_carry") {
    return recipe.name;
  }
  return `${recipe.name} · ${recipe.symbol}`;
}

export function recipesMatchForBacktest(
  current: TemplateRecipe,
  saved: TemplateRecipe,
): boolean {
  if (current.kind !== saved.kind) {
    return false;
  }
  const left = { ...current, name: "" };
  const right = { ...saved, name: "" };
  return JSON.stringify(left) === JSON.stringify(right);
}

export function recipesMatchReplayFields(
  current: TemplateRecipe,
  saved: TemplateRecipe,
): boolean {
  if (current.kind !== saved.kind) {
    return false;
  }
  const left = { ...current, name: "", symbol: "" };
  const right = { ...saved, name: "", symbol: "" };
  return JSON.stringify(left) === JSON.stringify(right);
}

export function snapshotDcaRecipe(config: DcaPlaybookConfig): DcaTemplateRecipe {
  return {
    kind: "dca",
    name: config.name,
    symbol: config.symbol,
    direction: config.direction,
    startKind: config.startKind,
    dcaMode: config.dcaMode,
    clipSize: config.clipSize,
    sizeUnit: config.sizeUnit,
    maxClips: config.maxClips,
    maxValue: config.maxValue,
    maxValueKind: config.maxValueKind,
    dipPct: config.dipPct,
    intervalMinutes: config.intervalMinutes,
    sizeMultiplier: config.sizeMultiplier,
    deviationMultiplier: config.deviationMultiplier,
    takeProfitPct: config.takeProfitPct,
    stopLossPct: config.stopLossPct,
    takeProfitBasis: config.takeProfitBasis,
    stopLossBasis: config.stopLossBasis,
    takeProfitOrderType: config.takeProfitOrderType,
    breakevenActivationPct: config.breakevenActivationPct,
    breakevenOffsetPct: config.breakevenOffsetPct,
    trailingTriggerPct: config.trailingTriggerPct,
    trailingPct: config.trailingPct,
    armTrigger: config.armTrigger,
    indicatorKind: config.indicatorKind,
    indicatorTimeframe: config.indicatorTimeframe,
    indicatorCompare: config.indicatorCompare,
    indicatorLevel: config.indicatorLevel,
  };
}

export function snapshotPerpsRecipe(
  rule: Pick<
    FuturesAutomationRule,
    | "name"
    | "symbol"
    | "action"
    | "closeSide"
    | "orderType"
    | "sizeUnit"
    | "size"
    | "limitPrice"
    | "entrySource"
    | "triggerBy"
    | "triggerCompare"
    | "triggerPrice"
    | "skipIfOpen"
    | "tpsl"
    | "trailing"
  >,
): PerpsTemplateRecipe {
  const formAction =
    rule.action === "flatten"
      ? rule.closeSide === "short"
        ? "close_short"
        : "close_long"
      : rule.action === "sell"
        ? "sell"
        : "buy";
  return {
    kind: "perps",
    name: rule.name,
    symbol: rule.symbol,
    formAction,
    orderType: rule.orderType,
    sizeUnit: rule.sizeUnit,
    size: rule.size == null ? "" : String(rule.size),
    limitPrice: rule.limitPrice == null ? "" : String(rule.limitPrice),
    entrySource: rule.entrySource,
    triggerBy: rule.triggerBy,
    triggerCompare: rule.triggerCompare,
    triggerPrice: String(rule.triggerPrice),
    skipIfOpen: rule.skipIfOpen,
    tpsl: rule.tpsl,
    trailing: rule.trailing,
  };
}

export function snapshotPaperRecipe(layer: PaperEngineLayer): PaperTemplateRecipe {
  return {
    kind: "cash_and_carry",
    name: layer.name,
    sizeType: layer.sizeType,
    exitSizeType: layer.exitSizeType,
    notionalUsdt: layer.notionalUsdt,
    minNetApr: layer.minNetApr,
    minDte: layer.minDte,
    maxDte: layer.maxDte,
    minCapacityUsdt: layer.minCapacityUsdt,
    minSizeUsdt: layer.minSizeUsdt,
    maxOpenCount: layer.maxOpenCount,
    maxOpenNotionalUsdt: layer.maxOpenNotionalUsdt,
    closeMaxDte: layer.closeMaxDte,
    closeMinNetApr: layer.closeMinNetApr,
    takeProfitPct: layer.takeProfitPct,
    stopLossPct: layer.stopLossPct,
  };
}

export function parseTemplateRecipe(
  raw: unknown,
  deskType: TemplateDeskType,
  recipeVersion: number,
): { ok: true; recipe: TemplateRecipe } | { ok: false; error: string } {
  if (recipeVersion !== TEMPLATE_RECIPE_VERSION) {
    return { ok: false, error: STALE_TEMPLATE_ERROR };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: STALE_TEMPLATE_ERROR };
  }
  const row = raw as Record<string, unknown>;
  const kind = row.kind === undefined ? deskType : row.kind;
  if (kind !== deskType) {
    return { ok: false, error: STALE_TEMPLATE_ERROR };
  }
  if (deskType === "dca") {
    return parseDcaTemplateRecipe(row);
  }
  if (deskType === "perps") {
    return parsePerpsTemplateRecipe(row);
  }
  return parsePaperTemplateRecipe(row);
}

function parseDcaTemplateRecipe(
  row: Record<string, unknown>,
): { ok: true; recipe: DcaTemplateRecipe } | { ok: false; error: string } {
  if (typeof row.symbol !== "string" || typeof row.clipSize !== "number") {
    return { ok: false, error: STALE_TEMPLATE_ERROR };
  }
  const placeholderWebhook =
    String(row.startKind) === "webhook"
      ? "11111111-1111-4111-8111-111111111111"
      : undefined;
  const built = dcaRecipeToConfig(row as unknown as DcaTemplateRecipe, {
    webhookId: placeholderWebhook,
  });
  if (!built.ok) {
    return built;
  }
  return { ok: true, recipe: snapshotDcaRecipe(built.config) };
}

function parsePerpsTemplateRecipe(
  row: Record<string, unknown>,
): { ok: true; recipe: PerpsTemplateRecipe } | { ok: false; error: string } {
  if (typeof row.symbol !== "string" || typeof row.name !== "string") {
    return { ok: false, error: STALE_TEMPLATE_ERROR };
  }
  const recipe: PerpsTemplateRecipe = {
    kind: "perps",
    name: String(row.name),
    symbol: String(row.symbol),
    formAction: (row.formAction as PerpsTemplateRecipe["formAction"]) ?? "buy",
    orderType: (row.orderType as PerpsTemplateRecipe["orderType"]) ?? "market",
    sizeUnit: row.sizeUnit === "usdt" ? "usdt" : "qty",
    size: String(row.size ?? ""),
    limitPrice: String(row.limitPrice ?? ""),
    entrySource: row.entrySource === "webhook" ? "webhook" : "price",
    triggerBy:
      row.triggerBy === "mark" || row.triggerBy === "index"
        ? row.triggerBy
        : "last",
    triggerCompare: row.triggerCompare === "lte" ? "lte" : "gte",
    triggerPrice: String(row.triggerPrice ?? ""),
    skipIfOpen: row.skipIfOpen !== false,
    tpsl: (row.tpsl as PerpsTemplateRecipe["tpsl"]) ?? null,
    trailing: (row.trailing as PerpsTemplateRecipe["trailing"]) ?? null,
  };
  const built = perpsRecipeToRule(recipe, { sortOrder: 0 });
  if (!built.ok) {
    return built;
  }
  return { ok: true, recipe: snapshotPerpsRecipe(built.rule) };
}

function parsePaperTemplateRecipe(
  row: Record<string, unknown>,
): { ok: true; recipe: PaperTemplateRecipe } | { ok: false; error: string } {
  if (typeof row.name !== "string" || typeof row.notionalUsdt !== "number") {
    return { ok: false, error: STALE_TEMPLATE_ERROR };
  }
  const recipe: PaperTemplateRecipe = {
    kind: "cash_and_carry",
    name: String(row.name),
    sizeType: row.sizeType === "fixed" ? "fixed" : "dynamic",
    exitSizeType: row.exitSizeType === "fixed" ? "fixed" : "dynamic",
    notionalUsdt: row.notionalUsdt,
    minNetApr: asNullableNumber(row.minNetApr),
    minDte: asNullableNumber(row.minDte),
    maxDte: asNullableNumber(row.maxDte),
    minCapacityUsdt: asNullableNumber(row.minCapacityUsdt),
    minSizeUsdt: asNullableNumber(row.minSizeUsdt),
    maxOpenCount: asNullableNumber(row.maxOpenCount),
    maxOpenNotionalUsdt: asNullableNumber(row.maxOpenNotionalUsdt),
    closeMaxDte: asNullableNumber(row.closeMaxDte),
    closeMinNetApr: asNullableNumber(row.closeMinNetApr),
    takeProfitPct: asNullableNumber(row.takeProfitPct),
    stopLossPct: asNullableNumber(row.stopLossPct),
  };
  const built = paperRecipeToLayer(recipe, { sortOrder: 0 });
  if (!built.ok) {
    return built;
  }
  return { ok: true, recipe: snapshotPaperRecipe(built.layer) };
}

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function dcaRecipeToConfig(
  recipe: DcaTemplateRecipe | Record<string, unknown>,
  options: { symbol?: string; webhookId?: string | null; venue?: string },
):
  | { ok: true; config: DcaPlaybookConfig; notes: string[] }
  | { ok: false; error: string } {
  const notes: string[] = [];
  const form = new FormData();
  const venue = options.venue ?? "bybit";
  const startKind = String(recipe.startKind ?? "immediate");
  const webhookId = options.webhookId?.trim() || "";
  let appliedStart = startKind;
  if (startKind === "webhook" && !webhookId) {
    appliedStart = "immediate";
    notes.push(
      "Signal start needs a webhook on this desk. Applied as Manual.",
    );
  }
  form.set("name", String(recipe.name ?? "DCA"));
  form.set("deskVenue", venue);
  form.set("symbol", String(options.symbol ?? recipe.symbol ?? ""));
  const direction = String(recipe.direction ?? "long");
  if (venue === "hyperliquid" && direction === "both") {
    form.set("direction", "long");
    notes.push("Hyperliquid is one-way. Applied as Long.");
  } else {
    form.set("direction", direction);
  }
  form.set("startKind", appliedStart);
  if (appliedStart === "webhook") {
    form.set("webhookId", webhookId);
  }
  const averaging = dcaAveragingKind({
    dcaMode: recipe.dcaMode === "order" ? "order" : "position",
    dipPct: asNullableNumber(recipe.dipPct),
    intervalMinutes: asNullableNumber(recipe.intervalMinutes),
  });
  form.set("averaging", averaging);
  if (recipe.dcaMode === "order") {
    form.set("restGrid", "1");
  }
  form.set("sizeUnit", String(recipe.sizeUnit ?? "qty"));
  form.set("clipSize", String(recipe.clipSize ?? ""));
  const maxClips = asNullableNumber(recipe.maxClips);
  const maxValue = asNullableNumber(recipe.maxValue);
  if (maxClips != null && maxValue == null) {
    form.set("maxType", "orders");
  } else if (maxClips == null && maxValue != null) {
    form.set("maxType", "value");
  }
  if (maxClips != null) {
    form.set("maxClips", String(maxClips));
  }
  if (maxValue != null) {
    form.set("maxValue", String(maxValue));
  }
  form.set(
    "maxValueKind",
    maxValue == null
      ? "none"
      : recipe.maxValueKind === "percent"
        ? "percent"
        : "usdt",
  );
  if (recipe.dipPct != null) {
    form.set("dipPct", String(recipe.dipPct));
  }
  const interval = dcaIntervalParts(asNullableNumber(recipe.intervalMinutes));
  form.set("intervalUnit", interval.unit);
  form.set("intervalValue", interval.value);
  form.set("sizeMultiplier", String(recipe.sizeMultiplier ?? 1));
  form.set("deviationMultiplier", String(recipe.deviationMultiplier ?? 1));
  if (recipe.takeProfitPct != null) {
    form.set("takeProfitPct", String(recipe.takeProfitPct));
  }
  if (recipe.stopLossPct != null) {
    form.set("stopLossPct", String(recipe.stopLossPct));
  }
  form.set("takeProfitBasis", String(recipe.takeProfitBasis ?? "average"));
  form.set("stopLossBasis", String(recipe.stopLossBasis ?? "average"));
  form.set(
    "takeProfitOrderType",
    String(recipe.takeProfitOrderType ?? "market"),
  );
  if (recipe.breakevenActivationPct != null) {
    form.set("breakevenActivationPct", String(recipe.breakevenActivationPct));
  }
  if (recipe.breakevenOffsetPct != null) {
    form.set("breakevenOffsetPct", String(recipe.breakevenOffsetPct));
  }
  if (recipe.trailingTriggerPct != null) {
    form.set("trailingTriggerPct", String(recipe.trailingTriggerPct));
  }
  if (recipe.trailingPct != null) {
    form.set("trailingPct", String(recipe.trailingPct));
  }
  const arm = recipe.armTrigger as DcaPlaybookConfig["armTrigger"] | undefined;
  if (arm) {
    form.set("armTriggerBy", arm.triggerBy);
    form.set("armCompare", arm.compare);
    form.set("armPrice", String(arm.price));
  }
  if (recipe.indicatorKind) {
    form.set("indicatorKind", String(recipe.indicatorKind));
  }
  if (recipe.indicatorTimeframe) {
    form.set("indicatorTimeframe", String(recipe.indicatorTimeframe));
  }
  if (recipe.indicatorCompare) {
    form.set("indicatorCompare", String(recipe.indicatorCompare));
  }
  if (recipe.indicatorLevel != null) {
    form.set("indicatorLevel", String(recipe.indicatorLevel));
  }
  const parsed = parseDcaPlaybookForm(form, venue);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, config: parsed.config, notes };
}

export function perpsRecipeToRule(
  recipe: PerpsTemplateRecipe,
  options: {
    sortOrder: number;
    webhookId?: string | null;
    venue?: string;
    symbol?: string;
  },
):
  | { ok: true; rule: FuturesAutomationRule; notes: string[] }
  | { ok: false; error: string } {
  const notes: string[] = [];
  const form = new FormData();
  const venue = options.venue ?? "bybit";
  const webhookId = options.webhookId?.trim() || "";
  let entrySource = recipe.entrySource;
  if (entrySource === "webhook" && !webhookId) {
    entrySource = "price";
    notes.push(
      "Signal entry needs a webhook on this desk. Applied as a price rule.",
    );
  }
  form.set("deskVenue", venue);
  form.set("ruleCount", "1");
  form.set("r0_name", recipe.name);
  form.set("r0_mode", "disabled");
  form.set("r0_symbol", options.symbol ?? recipe.symbol);
  form.set("r0_action", recipe.formAction);
  form.set("r0_orderType", recipe.orderType);
  form.set("r0_sizeUnit", recipe.sizeUnit);
  form.set("r0_size", recipe.size);
  form.set("r0_limitPrice", recipe.limitPrice);
  form.set("r0_entrySource", entrySource);
  if (entrySource === "webhook") {
    form.set("r0_webhookId", webhookId);
  }
  form.set("r0_triggerBy", recipe.triggerBy);
  form.set("r0_triggerCompare", recipe.triggerCompare);
  form.set("r0_triggerPrice", recipe.triggerPrice);
  if (recipe.skipIfOpen) {
    form.set("r0_skipIfOpen", "on");
  }
  writeAutomationExitsToForm(form, "r0_", recipe.tpsl, recipe.trailing);
  const parsed = parseFuturesAutomationForm(form, venue);
  if (!parsed.ok) {
    return parsed;
  }
  const rule = parsed.rules[0];
  if (!rule) {
    return { ok: false, error: STALE_TEMPLATE_ERROR };
  }
  rule.id = null;
  rule.mode = "disabled";
  rule.conditionTrue = false;
  rule.lastFiredAtMs = null;
  rule.sortOrder = options.sortOrder;
  return { ok: true, rule, notes };
}

export function paperRecipeToLayer(
  recipe: PaperTemplateRecipe,
  options: { sortOrder: number },
):
  | { ok: true; layer: PaperEngineLayer; notes: string[] }
  | { ok: false; error: string } {
  const form = new FormData();
  form.set("ruleCount", "1");
  form.set("r0_name", recipe.name);
  form.set("r0_mode", "disabled");
  form.set("r0_sizeType", recipe.sizeType);
  form.set("r0_exitSizeType", recipe.exitSizeType);
  form.set("r0_notionalUsdt", String(recipe.notionalUsdt));
  if (recipe.minNetApr != null) {
    form.set("r0_minApr", String(recipe.minNetApr * 100));
  }
  if (recipe.minDte != null) {
    form.set("r0_minDte", String(recipe.minDte));
  }
  if (recipe.maxDte != null) {
    form.set("r0_maxDte", String(recipe.maxDte));
  }
  if (recipe.minCapacityUsdt != null) {
    form.set("r0_minCapacity", String(recipe.minCapacityUsdt));
  }
  if (recipe.minSizeUsdt != null) {
    form.set("r0_minSize", String(recipe.minSizeUsdt));
  }
  if (recipe.maxOpenCount != null) {
    form.set("r0_maxOpenCount", String(recipe.maxOpenCount));
  }
  if (recipe.maxOpenNotionalUsdt != null) {
    form.set("r0_maxOpenNotional", String(recipe.maxOpenNotionalUsdt));
  }
  if (recipe.closeMaxDte != null) {
    form.set("r0_closeMaxDte", String(recipe.closeMaxDte));
  }
  if (recipe.closeMinNetApr != null) {
    form.set("r0_closeMinApr", String(recipe.closeMinNetApr * 100));
  }
  if (recipe.takeProfitPct != null) {
    form.set("r0_takeProfit", String(recipe.takeProfitPct * 100));
  }
  if (recipe.stopLossPct != null) {
    form.set("r0_stopLoss", String(Math.abs(recipe.stopLossPct) * 100));
  }
  const parsed = parsePaperRulesForm(form);
  if (!parsed.ok) {
    return parsed;
  }
  const layer = parsed.config.layers[0];
  if (!layer) {
    return { ok: false, error: STALE_TEMPLATE_ERROR };
  }
  layer.id = null;
  layer.mode = "disabled";
  layer.sortOrder = options.sortOrder;
  return { ok: true, layer, notes: [] };
}

export function uniqueAppliedName(
  base: string,
  existing: string[],
  max = RECIPE_NAME_MAX,
): string {
  const taken = new Set(existing.map((name) => name.trim().toLowerCase()));
  const trimmed = base.trim() || "Template";
  if (!taken.has(trimmed.toLowerCase()) && trimmed.length <= max) {
    return trimmed;
  }
  const suffixFor = (n: number) =>
    n === 1 ? " (from template)" : ` (from template ${n})`;
  let n = 1;
  while (n < 100) {
    const suffix = suffixFor(n);
    const name = `${trimmed.slice(0, Math.max(1, max - suffix.length))}${suffix}`;
    if (!taken.has(name.toLowerCase())) {
      return name.slice(0, max);
    }
    n += 1;
  }
  return trimmed.slice(0, max);
}

export type DcaSnapshotOverlay = {
  name?: string;
  symbol?: string;
  direction?: string;
  startKind?: string;
  averaging?: string;
  restGrid?: boolean;
  sizeUnit?: string;
  clipSize?: string;
  maxType?: string;
  maxClips?: string;
  maxValue?: string;
  maxValueKind?: string;
  dipPct?: string;
  intervalUnit?: string;
  intervalValue?: string;
  sizeMultiplier?: string;
  deviationMultiplier?: string;
  takeProfitPct?: string;
  takeProfitBasis?: string;
  takeProfitOrderType?: string;
  stopLossPct?: string;
  stopLossBasis?: string;
  webhookId?: string;
  indicatorKind?: string;
  indicatorTimeframe?: string;
  indicatorCompare?: string;
  indicatorLevel?: string;
  armTriggerBy?: string;
  armCompare?: string;
  armPrice?: string;
  trailingTriggerPct?: string;
  trailingPct?: string;
  breakevenActivationPct?: string;
  breakevenOffsetPct?: string;
};

export function readFormControl(
  form: HTMLFormElement | null,
  name: string,
): string {
  const el = form?.elements.namedItem(name);
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  ) {
    return el.value;
  }
  return "";
}

function formDataFromNamedControls(form: HTMLFormElement | null): FormData {
  const data = new FormData();
  if (!form) {
    return data;
  }
  for (const el of Array.from(form.elements)) {
    if (
      !(
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      )
    ) {
      continue;
    }
    if (!el.name || el.disabled) {
      continue;
    }
    if (el instanceof HTMLInputElement) {
      if (el.type === "submit" || el.type === "button" || el.type === "file") {
        continue;
      }
      if (el.type === "checkbox" || el.type === "radio") {
        if (el.checked) {
          data.append(el.name, el.value || "on");
        }
        continue;
      }
    }
    data.append(el.name, el.value);
  }
  return data;
}

export function dcaFormToSnapshotSource(
  form: HTMLFormElement | null,
  overlay: DcaSnapshotOverlay = {},
): FormData {
  const data = formDataFromNamedControls(form);
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) {
      continue;
    }
    if (typeof value === "boolean") {
      if (value) {
        data.set(key, "1");
      } else {
        data.delete(key);
      }
      continue;
    }
    data.set(key, value);
  }
  return data;
}

export function perpsFormToSnapshotSource(
  layer: FuturesAutomationFormValues,
  venue = "bybit",
): FormData {
  const form = new FormData();
  form.set("deskVenue", venue);
  form.set("ruleCount", "1");
  form.set("r0_name", layer.name);
  form.set("r0_mode", layer.mode);
  form.set("r0_symbol", layer.symbol);
  form.set("r0_action", layer.formAction);
  form.set("r0_orderType", layer.orderType);
  form.set("r0_sizeUnit", layer.sizeUnit);
  form.set("r0_size", layer.size);
  form.set("r0_limitPrice", layer.limitPrice);
  form.set("r0_entrySource", layer.entrySource);
  form.set("r0_webhookId", layer.webhookId);
  form.set("r0_triggerBy", layer.triggerBy);
  form.set("r0_triggerCompare", layer.triggerCompare);
  form.set("r0_triggerPrice", layer.triggerPrice);
  if (layer.skipIfOpen) {
    form.set("r0_skipIfOpen", "on");
  }
  writeAutomationExitsToForm(form, "r0_", layer.tpsl, layer.trailing);
  return form;
}

export function paperFormToSnapshotSource(
  layer: PaperLayerFormValues,
): FormData {
  const form = new FormData();
  form.set("ruleCount", "1");
  form.set("r0_name", layer.name);
  form.set("r0_mode", layer.mode);
  form.set("r0_sizeType", layer.sizeType);
  form.set("r0_exitSizeType", layer.exitSizeType);
  form.set("r0_notionalUsdt", String(layer.notionalUsdt));
  form.set("r0_minApr", layer.minApr);
  form.set("r0_minDte", layer.minDte);
  form.set("r0_maxDte", layer.maxDte);
  form.set("r0_minCapacity", layer.minCapacity);
  form.set("r0_minSize", layer.minSize);
  form.set("r0_maxOpenCount", layer.maxOpenCount);
  form.set("r0_maxOpenNotional", layer.maxOpenNotional);
  form.set("r0_closeMaxDte", layer.closeMaxDte);
  form.set("r0_closeMinApr", layer.closeMinApr);
  form.set("r0_takeProfit", layer.takeProfit);
  form.set("r0_stopLoss", layer.stopLoss);
  return form;
}

export function recipeHasRuntimeKeys(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.some((key) =>
    /webhookId|conditionTrue|lastFired|clipsFilled|armCondition|userId|accountId|^id$|^mode$/i.test(
      key,
    ),
  );
}
