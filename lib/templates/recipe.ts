import { formatDeskType, type DeskType } from "@/lib/accounts/model";
import {
  parseDcaFilterSpec,
  writeDcaFilterFormFields,
  type DcaFilterSpec,
} from "@/lib/dca/filters";
import {
  applyExitStackWebhook,
  exitStackDropEmptyWebhooks,
  exitStackForEditor,
  exitStackNeedsWebhook,
  exitStackWebhookIds,
  templateExitStack,
  writeExitStackFormFields,
} from "@/lib/dca/exit-stack";
import {
  hardExitDraftFromTemplate,
  hardExitSignalFromJson,
  hardExitWebhookId,
  templateHardExit,
  templateHardExitNeedsWebhook,
  writeTemplateHardExitFields,
  type TemplateHardExitSignal,
} from "@/lib/dca/hard-exit";
import {
  oppositeRsiCompare,
  oppositeRsiLevel,
} from "@/lib/dca/indicators";
import {
  dcaAveragingKind,
  dcaClassicToJson,
  dcaIntervalParts,
  dcaShortClassicFromJson,
  IDLE_DCA_LEG,
  parseDcaPlaybookForm,
  type DcaClassicExit,
  type DcaPlaybook,
  type DcaPlaybookConfig,
} from "@/lib/dca/playbook";
import type { PaperEngineLayer } from "@/lib/engine/decide";
import { parsePaperRulesForm, type PaperLayerFormValues } from "@/lib/engine/rules";
import {
  defaultFuturesAutomationForm,
  parseFuturesAutomationForm,
  writeAutomationExitsToForm,
  writePerpsShortEntryFields,
  type FuturesAutomationFormValues,
  type FuturesAutomationRule,
} from "@/lib/futures/automation";
import { venueAllowsPerpsBoth } from "@/lib/futures/perps-direction";
import {
  shortEntryFromJson,
  writeEntryStackFormFields,
  writeFuturesConditionFormFields,
  type PerpsEntryLeg,
} from "@/lib/futures/conditions";
import {
  confirmFromEntryStack,
  entryStackFromJson,
  entryStackIsLegacy,
  legacyEntryStack,
  resolveEntryStack,
  type EntryStack,
} from "@/lib/strategy/expr";
import { parseDeskFuturesSymbol } from "@/lib/venues/hyperliquid/symbol";

export const TEMPLATE_RECIPE_VERSION = 1;
export const TEMPLATE_NAME_MAX = 80;
export const RECIPE_NAME_MAX = 40;

export const TEMPLATE_DESK_TYPES = ["dca", "flex", "cash_and_carry"] as const;
export type TemplateDeskType = (typeof TEMPLATE_DESK_TYPES)[number];

export function templateFitsDesk(
  templateDeskType: TemplateDeskType,
  deskType: DeskType,
): boolean {
  return deskType === templateDeskType;
}

export function formatTemplateDeskType(deskType: TemplateDeskType): string {
  return formatDeskType(deskType);
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
  /** Direction Both. Absent means the short leg still shares startKind. */
  shortStartKind?: DcaPlaybookConfig["shortStartKind"];
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
  spacingKind?: DcaPlaybookConfig["spacingKind"];
  atrPeriod?: number | null;
  atrSpacingMult?: number | null;
  takeProfitKind?: DcaPlaybookConfig["takeProfitKind"];
  takeProfitAtrMult?: number | null;
  takeProfitPct: number | null;
  stopLossPct: number | null;
  takeProfitBasis: DcaPlaybookConfig["takeProfitBasis"];
  stopLossBasis: DcaPlaybookConfig["stopLossBasis"];
  takeProfitOrderType: DcaPlaybookConfig["takeProfitOrderType"];
  breakevenActivationPct: number | null;
  breakevenOffsetPct: number | null;
  trailingTriggerPct: number | null;
  trailingPct: number | null;
  /** Direction Both. Absent means the short leg still shares the long classics. */
  shortClassic?: DcaClassicExit | null;
  armTrigger: DcaPlaybookConfig["armTrigger"];
  shortArmTrigger?: DcaPlaybookConfig["shortArmTrigger"];
  indicatorKind: DcaPlaybookConfig["indicatorKind"];
  indicatorTimeframe: DcaPlaybookConfig["indicatorTimeframe"];
  indicatorCompare: DcaPlaybookConfig["indicatorCompare"];
  indicatorLevel: number | null;
  indicatorPeriod?: number | null;
  indicatorSlowPeriod?: number | null;
  indicatorMultiplier?: number | null;
  shortIndicatorKind?: DcaPlaybookConfig["shortIndicatorKind"];
  shortIndicatorTimeframe?: DcaPlaybookConfig["shortIndicatorTimeframe"];
  shortIndicatorCompare?: DcaPlaybookConfig["shortIndicatorCompare"];
  shortIndicatorLevel?: number | null;
  shortIndicatorPeriod?: number | null;
  shortIndicatorSlowPeriod?: number | null;
  shortIndicatorMultiplier?: number | null;
  confirm?: DcaFilterSpec | null;
  shortConfirm?: DcaFilterSpec | null;
  entryStack?: EntryStack | null;
  shortEntryStack?: EntryStack | null;
  exitIf?: DcaFilterSpec | null;
  shortExitIf?: DcaFilterSpec | null;
  exitHard?: TemplateHardExitSignal | null;
  shortExitHard?: TemplateHardExitSignal | null;
  exitStack?: EntryStack | null;
  shortExitStack?: EntryStack | null;
};

export type PerpsTemplateRecipe = {
  kind: "flex";
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
  indicator?: FuturesAutomationFormValues["indicator"];
  confirm?: DcaFilterSpec | null;
  entryStack?: EntryStack | null;
  exitIf?: DcaFilterSpec | null;
  exitHard?: TemplateHardExitSignal | null;
  exitStack?: EntryStack | null;
  breakevenActivationPct?: number | null;
  breakevenOffsetPct?: number | null;
  direction: "long" | "short" | "both";
  shortEntry?: PerpsEntryLeg | null;
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
    value === "dca" || value === "flex" || value === "cash_and_carry"
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

/** Templates do not store a bot name. The preview is the contract, when there is one. */
export function recipePreview(recipe: TemplateRecipe): string {
  if (recipe.kind === "cash_and_carry") {
    return "";
  }
  return recipe.symbol;
}

/** Drop the bot name before a recipe is written onto a template row. */
export function storedTemplateRecipe<T extends TemplateRecipe>(recipe: T): T {
  return { ...recipe, name: "" };
}

/** New bots created from a template use the template name, within the bot name limit. */
export function botNameFromTemplate(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  return (trimmed || "Template").slice(0, RECIPE_NAME_MAX);
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

export function findMatchingLibraryTemplate(
  recipe: TemplateRecipe | null | undefined,
  templates: readonly {
    name: string;
    recipe: TemplateRecipe;
    visibility?: string;
  }[],
  visibility: TemplateVisibility,
): { name: string } | null {
  if (!recipe) {
    return null;
  }
  const match = templates.find(
    (row) =>
      row.visibility === visibility &&
      recipesMatchForBacktest(recipe, row.recipe),
  );
  return match ? { name: match.name } : null;
}

export function recipesMatchReplayFields(
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

export function dcaFormMatchesPlaybook(
  saved: DcaPlaybookConfig,
  next: DcaPlaybookConfig | null,
): boolean {
  if (!next) {
    return false;
  }
  return (
    saved.webhookId === next.webhookId &&
    (saved.shortWebhookId ?? null) === (next.shortWebhookId ?? null) &&
    hardExitWebhookId(saved.exitHard) === hardExitWebhookId(next.exitHard) &&
    hardExitWebhookId(saved.shortExitHard) ===
      hardExitWebhookId(next.shortExitHard) &&
    JSON.stringify(exitStackWebhookIds(saved.exitStack)) ===
      JSON.stringify(exitStackWebhookIds(next.exitStack)) &&
    JSON.stringify(exitStackWebhookIds(saved.shortExitStack)) ===
      JSON.stringify(exitStackWebhookIds(next.shortExitStack)) &&
    JSON.stringify(snapshotDcaRecipe(saved)) ===
      JSON.stringify(snapshotDcaRecipe(next))
  );
}

export function snapshotDcaRecipe(config: DcaPlaybookConfig): DcaTemplateRecipe {
  return {
    kind: "dca",
    name: config.name,
    symbol: config.symbol,
    direction: config.direction,
    startKind: config.startKind,
    ...(config.direction === "both"
      ? {
          shortStartKind: config.shortStartKind ?? config.startKind,
        }
      : {}),
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
    spacingKind: config.spacingKind ?? "percent",
    atrPeriod: config.atrPeriod ?? null,
    atrSpacingMult: config.atrSpacingMult ?? null,
    takeProfitKind: config.takeProfitKind ?? "percent",
    takeProfitAtrMult: config.takeProfitAtrMult ?? null,
    takeProfitPct: config.takeProfitPct,
    stopLossPct: config.stopLossPct,
    takeProfitBasis: config.takeProfitBasis,
    stopLossBasis: config.stopLossBasis,
    takeProfitOrderType: config.takeProfitOrderType,
    breakevenActivationPct: config.breakevenActivationPct,
    breakevenOffsetPct: config.breakevenOffsetPct,
    trailingTriggerPct: config.trailingTriggerPct,
    trailingPct: config.trailingPct,
    ...(config.direction === "both" && config.shortClassic
      ? { shortClassic: dcaShortClassicFromJson(dcaClassicToJson(config.shortClassic)) }
      : {}),
    armTrigger: config.armTrigger,
    shortArmTrigger: config.shortArmTrigger ?? null,
    indicatorKind: config.indicatorKind,
    indicatorTimeframe: config.indicatorTimeframe,
    indicatorCompare: config.indicatorCompare,
    indicatorLevel: config.indicatorLevel,
    indicatorPeriod: config.indicatorPeriod,
    indicatorSlowPeriod: config.indicatorSlowPeriod,
    indicatorMultiplier: config.indicatorMultiplier,
    shortIndicatorKind: config.shortIndicatorKind ?? null,
    shortIndicatorTimeframe: config.shortIndicatorTimeframe ?? null,
    shortIndicatorCompare: config.shortIndicatorCompare ?? null,
    shortIndicatorLevel: config.shortIndicatorLevel ?? null,
    shortIndicatorPeriod: config.shortIndicatorPeriod ?? null,
    shortIndicatorSlowPeriod: config.shortIndicatorSlowPeriod ?? null,
    shortIndicatorMultiplier: config.shortIndicatorMultiplier ?? null,
    confirm: config.confirm ?? null,
    shortConfirm: config.shortConfirm ?? null,
    ...(config.entryStack && !entryStackIsLegacy(config.entryStack)
      ? { entryStack: config.entryStack }
      : {}),
    ...(config.direction === "both" &&
    config.shortEntryStack &&
    !entryStackIsLegacy(config.shortEntryStack)
      ? { shortEntryStack: config.shortEntryStack }
      : {}),
    exitIf: config.exitHard ? null : (config.exitIf ?? null),
    shortExitIf: config.shortExitHard ? null : (config.shortExitIf ?? null),
    ...(templateHardExit(config.exitHard)
      ? { exitHard: templateHardExit(config.exitHard) }
      : {}),
    ...(templateHardExit(config.shortExitHard)
      ? { shortExitHard: templateHardExit(config.shortExitHard) }
      : {}),
    ...(templateExitStack(config.exitStack)
      ? { exitStack: templateExitStack(config.exitStack) }
      : {}),
    ...(config.direction === "both" && templateExitStack(config.shortExitStack)
      ? { shortExitStack: templateExitStack(config.shortExitStack) }
      : {}),
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
  > &
    Partial<
      Pick<
        FuturesAutomationRule,
        | "indicator"
        | "confirm"
        | "entryStack"
        | "exitIf"
        | "exitHard"
        | "exitStack"
        | "breakevenActivationPct"
        | "breakevenOffsetPct"
        | "direction"
        | "shortEntry"
      >
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
  const hasStack = rule.entryStack != null;
  const stack = resolveEntryStack(rule.entryStack, rule.confirm);
  const legacyStack = entryStackIsLegacy(stack);
  return {
    kind: "flex",
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
    indicator: rule.indicator ?? null,
    confirm:
      hasStack || !legacyStack
        ? confirmFromEntryStack(stack)
        : (rule.confirm ?? null),
    ...(legacyStack ? {} : { entryStack: stack }),
    exitIf: rule.exitHard ? null : (rule.exitIf ?? null),
    ...(templateHardExit(rule.exitHard)
      ? { exitHard: templateHardExit(rule.exitHard) }
      : {}),
    ...(templateExitStack(rule.exitStack)
      ? { exitStack: templateExitStack(rule.exitStack) }
      : {}),
    breakevenActivationPct: rule.breakevenActivationPct ?? null,
    breakevenOffsetPct: rule.breakevenOffsetPct ?? null,
    direction:
      rule.direction ??
      (formAction === "sell" || formAction === "close_short" ? "short" : "long"),
    ...(rule.direction === "both" && rule.shortEntry
      ? { shortEntry: rule.shortEntry }
      : {}),
  };
}

export function dcaRecipePlaybookSeed(recipe: DcaTemplateRecipe): DcaPlaybook {
  return {
    id: "",
    userId: "",
    accountId: "",
    updatedAtMs: 0,
    name: recipe.name,
    symbol: recipe.symbol,
    direction: recipe.direction,
    startKind: recipe.startKind,
    shortStartKind:
      recipe.direction === "both"
        ? (recipe.shortStartKind ?? recipe.startKind)
        : null,
    webhookId: null,
    shortWebhookId: null,
    dcaMode: recipe.dcaMode,
    clipSize: recipe.clipSize,
    sizeUnit: recipe.sizeUnit,
    maxClips: recipe.maxClips,
    maxValue: recipe.maxValue,
    maxValueKind: recipe.maxValueKind,
    dipPct: recipe.dipPct,
    intervalMinutes: recipe.intervalMinutes,
    sizeMultiplier: recipe.sizeMultiplier,
    deviationMultiplier: recipe.deviationMultiplier,
    spacingKind: recipe.spacingKind ?? "percent",
    atrPeriod: recipe.atrPeriod ?? null,
    atrSpacingMult: recipe.atrSpacingMult ?? null,
    takeProfitKind: recipe.takeProfitKind ?? "percent",
    takeProfitAtrMult: recipe.takeProfitAtrMult ?? null,
    takeProfitPct: recipe.takeProfitPct,
    stopLossPct: recipe.stopLossPct,
    takeProfitBasis: recipe.takeProfitBasis,
    stopLossBasis: recipe.stopLossBasis,
    takeProfitOrderType: recipe.takeProfitOrderType,
    stopLossOrderType: "market",
    breakevenActivationPct: recipe.breakevenActivationPct,
    breakevenOffsetPct: recipe.breakevenOffsetPct,
    trailingTriggerPct: recipe.trailingTriggerPct,
    trailingPct: recipe.trailingPct,
    shortClassic:
      recipe.direction === "both"
        ? dcaShortClassicFromJson(recipe.shortClassic)
        : null,
    armTrigger: recipe.armTrigger,
    shortArmTrigger: recipe.shortArmTrigger ?? null,
    disarmTrigger: null,
    indicatorKind: recipe.indicatorKind,
    indicatorTimeframe: recipe.indicatorTimeframe,
    indicatorCompare: recipe.indicatorCompare,
    indicatorLevel: recipe.indicatorLevel,
    indicatorPeriod: recipe.indicatorPeriod ?? null,
    indicatorSlowPeriod: recipe.indicatorSlowPeriod ?? null,
    indicatorMultiplier: recipe.indicatorMultiplier ?? null,
    shortIndicatorKind: recipe.shortIndicatorKind ?? null,
    shortIndicatorTimeframe: recipe.shortIndicatorTimeframe ?? null,
    shortIndicatorCompare: recipe.shortIndicatorCompare ?? null,
    shortIndicatorLevel: recipe.shortIndicatorLevel ?? null,
    shortIndicatorPeriod: recipe.shortIndicatorPeriod ?? null,
    shortIndicatorSlowPeriod: recipe.shortIndicatorSlowPeriod ?? null,
    shortIndicatorMultiplier: recipe.shortIndicatorMultiplier ?? null,
    confirm: recipe.confirm ?? null,
    shortConfirm: recipe.shortConfirm ?? null,
    entryStack: recipe.entryStack ?? null,
    shortEntryStack:
      recipe.direction === "both" ? (recipe.shortEntryStack ?? null) : null,
    exitIf: recipe.exitHard ? null : (recipe.exitIf ?? null),
    shortExitIf: recipe.shortExitHard ? null : (recipe.shortExitIf ?? null),
    exitHard: hardExitSignalFromJson(recipe.exitHard),
    shortExitHard: hardExitSignalFromJson(recipe.shortExitHard),
    exitStack: exitStackForEditor(recipe.exitStack),
    shortExitStack: exitStackForEditor(recipe.shortExitStack),
    long: IDLE_DCA_LEG,
    short: IDLE_DCA_LEG,
    armConditionTrue: false,
    disarmConditionTrue: false,
    longIndicatorTrue: false,
    shortIndicatorTrue: false,
  };
}

export function perpsRecipeFormSeed(
  recipe: PerpsTemplateRecipe,
): FuturesAutomationFormValues {
  return {
    ...defaultFuturesAutomationForm(0, recipe.symbol),
    name: recipe.name,
    symbol: recipe.symbol,
    formAction: recipe.formAction,
    orderType: recipe.orderType,
    sizeUnit: recipe.sizeUnit,
    size: recipe.size,
    limitPrice: recipe.limitPrice,
    entrySource: recipe.entrySource,
    triggerBy: recipe.triggerBy,
    triggerCompare: recipe.triggerCompare,
    triggerPrice: recipe.triggerPrice,
    skipIfOpen: recipe.skipIfOpen,
    tpsl: recipe.tpsl,
    trailing: recipe.trailing,
    indicator: recipe.indicator ?? null,
    confirm: recipe.confirm ?? null,
    entryStack: recipe.entryStack ?? legacyEntryStack(recipe.confirm ?? null),
    exitIf: recipe.exitHard ? null : (recipe.exitIf ?? null),
    exitHard: hardExitSignalFromJson(recipe.exitHard),
    exitStack: exitStackForEditor(recipe.exitStack),
    exitDraft: hardExitDraftFromTemplate(recipe.exitIf, recipe.exitHard),
    direction: recipe.direction,
    shortEntry: recipe.direction === "both" ? (recipe.shortEntry ?? null) : null,
    breakevenActivationPct:
      recipe.breakevenActivationPct == null
        ? ""
        : String(recipe.breakevenActivationPct),
    breakevenOffsetPct:
      recipe.breakevenOffsetPct == null ? "" : String(recipe.breakevenOffsetPct),
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

/** Bybit pairs stay Bybit. A coin such as ETH is a Hyperliquid contract when the caller did not name a venue. */
function venueForRecipeSymbol(symbol: unknown, venue?: string): string {
  if (venue) {
    return venue;
  }
  if (parseDeskFuturesSymbol("bybit", symbol).ok) {
    return "bybit";
  }
  if (parseDeskFuturesSymbol("hyperliquid", symbol).ok) {
    return "hyperliquid";
  }
  return "bybit";
}

export function parseTemplateRecipe(
  raw: unknown,
  deskType: TemplateDeskType,
  recipeVersion: number,
  venue?: string,
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
    return parseDcaTemplateRecipe(row, venue);
  }
  if (deskType === "flex") {
    return parsePerpsTemplateRecipe(row, venue);
  }
  return parsePaperTemplateRecipe(row);
}

function parseDcaTemplateRecipe(
  row: Record<string, unknown>,
  venue?: string,
): { ok: true; recipe: DcaTemplateRecipe } | { ok: false; error: string } {
  if (typeof row.symbol !== "string" || typeof row.clipSize !== "number") {
    return { ok: false, error: STALE_TEMPLATE_ERROR };
  }
  const placeholderWebhook =
    String(row.startKind) === "webhook" ||
    String(row.shortStartKind) === "webhook" ||
    templateHardExitNeedsWebhook(row.exitHard) ||
    templateHardExitNeedsWebhook(row.shortExitHard) ||
    exitStackNeedsWebhook(entryStackFromJson(row.exitStack)) ||
    exitStackNeedsWebhook(entryStackFromJson(row.shortExitStack))
      ? "11111111-1111-4111-8111-111111111111"
      : undefined;
  const built = dcaRecipeToConfig(row as unknown as DcaTemplateRecipe, {
    webhookId: placeholderWebhook,
    venue: venueForRecipeSymbol(row.symbol, venue),
  });
  if (!built.ok) {
    return built;
  }
  return {
    ok: true,
    recipe: keepStoredRecipeName(snapshotDcaRecipe(built.config), row.name),
  };
}

function parsePerpsTemplateRecipe(
  row: Record<string, unknown>,
  venue?: string,
): { ok: true; recipe: PerpsTemplateRecipe } | { ok: false; error: string } {
  if (typeof row.symbol !== "string") {
    return { ok: false, error: STALE_TEMPLATE_ERROR };
  }
  const recipe: PerpsTemplateRecipe = {
    kind: "flex",
    name: typeof row.name === "string" ? row.name : "",
    symbol: String(row.symbol),
    formAction: (row.formAction as PerpsTemplateRecipe["formAction"]) ?? "buy",
    orderType: (row.orderType as PerpsTemplateRecipe["orderType"]) ?? "market",
    sizeUnit: row.sizeUnit === "usdt" ? "usdt" : "qty",
    size: String(row.size ?? ""),
    limitPrice: String(row.limitPrice ?? ""),
    entrySource:
      row.entrySource === "webhook" ||
      row.entrySource === "indicator" ||
      row.entrySource === "trend"
        ? row.entrySource
        : "price",
    triggerBy:
      row.triggerBy === "mark" || row.triggerBy === "index"
        ? row.triggerBy
        : "last",
    triggerCompare: row.triggerCompare === "lte" ? "lte" : "gte",
    triggerPrice: String(row.triggerPrice ?? ""),
    skipIfOpen: row.skipIfOpen !== false,
    tpsl: (row.tpsl as PerpsTemplateRecipe["tpsl"]) ?? null,
    trailing: (row.trailing as PerpsTemplateRecipe["trailing"]) ?? null,
    indicator: (row.indicator as PerpsTemplateRecipe["indicator"]) ?? null,
    confirm: filterSpecFromRecipe(row.confirm),
    entryStack: entryStackFromJson(row.entryStack) ?? undefined,
    exitIf: filterSpecFromRecipe(row.exitIf),
    exitHard: (row.exitHard as PerpsTemplateRecipe["exitHard"]) ?? null,
    exitStack: entryStackFromJson(row.exitStack) ?? undefined,
    breakevenActivationPct: asNullableNumber(row.breakevenActivationPct),
    breakevenOffsetPct: asNullableNumber(row.breakevenOffsetPct),
    direction:
      row.direction === "short" || row.direction === "both"
        ? row.direction
        : row.direction === "long" ||
            (row.formAction !== "sell" && row.formAction !== "close_short")
          ? "long"
          : "short",
    shortEntry: shortEntryFromJson(row.shortEntry),
  };
  const built = perpsRecipeToRule(recipe, {
    sortOrder: 0,
    webhookId:
      templateHardExitNeedsWebhook(recipe.exitHard) ||
      exitStackNeedsWebhook(recipe.exitStack)
        ? "11111111-1111-4111-8111-111111111111"
        : undefined,
    venue: venueForRecipeSymbol(recipe.symbol, venue),
  });
  if (!built.ok) {
    return built;
  }
  return {
    ok: true,
    recipe: keepStoredRecipeName(snapshotPerpsRecipe(built.rule), row.name),
  };
}

function parsePaperTemplateRecipe(
  row: Record<string, unknown>,
): { ok: true; recipe: PaperTemplateRecipe } | { ok: false; error: string } {
  if (typeof row.notionalUsdt !== "number") {
    return { ok: false, error: STALE_TEMPLATE_ERROR };
  }
  const recipe: PaperTemplateRecipe = {
    kind: "cash_and_carry",
    name: typeof row.name === "string" ? row.name : "",
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
  return {
    ok: true,
    recipe: keepStoredRecipeName(snapshotPaperRecipe(built.layer), row.name),
  };
}

function keepStoredRecipeName<T extends TemplateRecipe>(
  recipe: T,
  stored: unknown,
): T {
  const name = typeof stored === "string" ? stored.trim() : "";
  if (name) {
    return recipe;
  }
  return { ...recipe, name: "" };
}

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function filterSpecFromRecipe(value: unknown): DcaFilterSpec | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  return parseDcaFilterSpec({
    kind: row.kind,
    timeframe: row.timeframe,
    compare: row.compare,
    level: row.level,
    levelTo: row.levelTo,
    period: row.period,
    multiplier: row.multiplier,
  });
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
  const startKind = String(recipe.startKind ?? "indicator");
  const webhookId = options.webhookId?.trim() || "";
  let appliedStart = startKind;
  if (startKind === "webhook" && !webhookId) {
    appliedStart = "indicator";
    notes.push(
      "Signal start needs a webhook on this desk. Applied as Indicator.",
    );
  } else if (startKind === "immediate") {
    appliedStart = "indicator";
    notes.push("Manual start is retired. Applied as Indicator.");
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
  if (String(form.get("direction")) === "both") {
    const shortKind = String(recipe.shortStartKind ?? appliedStart);
    let appliedShort = shortKind;
    const shortHook = webhookId;
    if (shortKind === "webhook" && !shortHook) {
      appliedShort = "indicator";
      notes.push(
        "Short signal start needs a webhook on this desk. Applied as Indicator.",
      );
    } else if (shortKind === "immediate") {
      appliedShort = "indicator";
      notes.push("Short manual start is retired. Applied as Indicator.");
    }
    form.set("shortStartKind", appliedShort);
    if (appliedShort === "webhook") {
      form.set("shortWebhookId", shortHook);
    }
  }
  const averaging = dcaAveragingKind({
    dcaMode: recipe.dcaMode === "order" ? "order" : "position",
    dipPct: asNullableNumber(recipe.dipPct),
    intervalMinutes: asNullableNumber(recipe.intervalMinutes),
  });
  if (
    averaging === "interval" ||
    recipe.dipPct != null ||
    recipe.dcaMode === "order"
  ) {
    form.set("averaging", averaging);
  }
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
      : recipe.maxValueKind === "percent" || recipe.maxValueKind === "margin"
        ? recipe.maxValueKind
        : "usdt",
  );
  if (recipe.dipPct != null) {
    form.set("dipPct", String(recipe.dipPct));
  }
  form.set("spacingKind", String(recipe.spacingKind ?? "percent"));
  if (recipe.atrPeriod != null) {
    form.set("atrPeriod", String(recipe.atrPeriod));
  }
  if (recipe.atrSpacingMult != null) {
    form.set("atrSpacingMult", String(recipe.atrSpacingMult));
  }
  form.set("takeProfitKind", String(recipe.takeProfitKind ?? "percent"));
  if (recipe.takeProfitAtrMult != null) {
    form.set("takeProfitAtrMult", String(recipe.takeProfitAtrMult));
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
  const shortClassic = dcaShortClassicFromJson(recipe.shortClassic);
  if (String(form.get("direction")) === "both" && shortClassic) {
    form.set("shortClassic", "on");
    form.set("shortTakeProfitKind", shortClassic.takeProfitKind);
    form.set("shortTakeProfitBasis", shortClassic.takeProfitBasis);
    form.set("shortTakeProfitOrderType", shortClassic.takeProfitOrderType);
    form.set("shortStopLossBasis", shortClassic.stopLossBasis);
    if (shortClassic.takeProfitKind === "atr" && shortClassic.takeProfitAtrMult != null) {
      form.set("shortTpOn", "on");
      form.set("shortTakeProfitAtrMult", String(shortClassic.takeProfitAtrMult));
      if (shortClassic.atrPeriod != null) {
        form.set("shortAtrPeriod", String(shortClassic.atrPeriod));
      }
    } else if (shortClassic.takeProfitPct != null) {
      form.set("shortTpOn", "on");
      form.set("shortTakeProfitPct", String(shortClassic.takeProfitPct));
    }
    if (shortClassic.stopLossPct != null) {
      form.set("shortSlOn", "on");
      form.set("shortStopLossPct", String(shortClassic.stopLossPct));
    }
    if (shortClassic.breakevenActivationPct != null) {
      form.set("shortSlOn", "on");
      form.set("shortBreakeven", "on");
      form.set("shortBreakevenActivationPct", String(shortClassic.breakevenActivationPct));
      if (shortClassic.breakevenOffsetPct != null) {
        form.set("shortBreakevenOffsetPct", String(shortClassic.breakevenOffsetPct));
      }
    }
    if (shortClassic.trailingPct != null && shortClassic.trailingTriggerPct != null) {
      form.set("shortTrailOn", "on");
      form.set("shortTrailingPct", String(shortClassic.trailingPct));
      form.set("shortTrailingTriggerPct", String(shortClassic.trailingTriggerPct));
    }
  }
  const arm = recipe.armTrigger as DcaPlaybookConfig["armTrigger"] | undefined;
  if (arm) {
    form.set("armTriggerBy", arm.triggerBy);
    form.set("armCompare", arm.compare);
    form.set("armPrice", String(arm.price));
  }
  const shortArmStored = recipe.shortArmTrigger as
    | DcaPlaybookConfig["shortArmTrigger"]
    | undefined;
  const shortArm =
    shortArmStored ??
    (direction === "both" && appliedStart === "price" && arm
      ? {
          triggerBy: arm.triggerBy,
          compare: arm.compare === "gte" ? "lte" : "gte",
          price: arm.price,
        }
      : null);
  if (shortArm) {
    form.set("shortArmTriggerBy", shortArm.triggerBy);
    form.set("shortArmCompare", shortArm.compare);
    form.set("shortArmPrice", String(shortArm.price));
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
  if (recipe.indicatorPeriod != null) {
    form.set("indicatorPeriod", String(recipe.indicatorPeriod));
  }
  if (recipe.indicatorSlowPeriod != null) {
    form.set("indicatorSlowPeriod", String(recipe.indicatorSlowPeriod));
  }
  if (recipe.indicatorMultiplier != null) {
    form.set("indicatorMultiplier", String(recipe.indicatorMultiplier));
  }
  if (appliedStart === "indicator" && !form.get("indicatorKind")) {
    form.set("indicatorKind", "rsi");
    form.set("indicatorTimeframe", String(form.get("indicatorTimeframe") || "15"));
    form.set("indicatorCompare", String(form.get("indicatorCompare") || "cross_lte"));
    form.set("indicatorLevel", String(form.get("indicatorLevel") || "30"));
    if (direction === "both" && !form.get("shortIndicatorKind")) {
      form.set("shortIndicatorKind", "rsi");
      form.set(
        "shortIndicatorTimeframe",
        String(form.get("shortIndicatorTimeframe") || "15"),
      );
      form.set("shortIndicatorCompare", "cross_gte");
      form.set("shortIndicatorLevel", "70");
    }
  }
  const shortKind =
    recipe.shortIndicatorKind ??
    (direction === "both" &&
    (appliedStart === "indicator" || appliedStart === "trend")
      ? recipe.indicatorKind
      : null);
  if (shortKind) {
    form.set("shortIndicatorKind", String(shortKind));
  }
  if (
    recipe.shortIndicatorTimeframe ??
    (shortKind ? recipe.indicatorTimeframe : null)
  ) {
    form.set(
      "shortIndicatorTimeframe",
      String(recipe.shortIndicatorTimeframe ?? recipe.indicatorTimeframe),
    );
  }
  const shortCompare =
    recipe.shortIndicatorCompare ??
    (shortKind && recipe.indicatorKind === "rsi"
      ? oppositeRsiCompare(String(recipe.indicatorCompare ?? "cross_lte"))
      : recipe.shortIndicatorKind
        ? recipe.shortIndicatorCompare
        : recipe.indicatorCompare);
  if (shortCompare) {
    form.set("shortIndicatorCompare", String(shortCompare));
  }
  const shortLevel =
    asNullableNumber(recipe.shortIndicatorLevel) ??
    (shortKind && recipe.indicatorKind === "rsi"
      ? oppositeRsiLevel(asNullableNumber(recipe.indicatorLevel))
      : asNullableNumber(recipe.indicatorLevel));
  if (shortLevel != null) {
    form.set("shortIndicatorLevel", String(shortLevel));
  }
  const shortPeriod =
    recipe.shortIndicatorPeriod ??
    (shortKind ? recipe.indicatorPeriod : null);
  if (shortPeriod != null) {
    form.set("shortIndicatorPeriod", String(shortPeriod));
  }
  const shortSlowPeriod =
    recipe.shortIndicatorSlowPeriod ??
    (shortKind ? recipe.indicatorSlowPeriod : null);
  if (shortSlowPeriod != null) {
    form.set("shortIndicatorSlowPeriod", String(shortSlowPeriod));
  }
  const shortMultiplier =
    recipe.shortIndicatorMultiplier ??
    (shortKind ? recipe.indicatorMultiplier : null);
  if (shortMultiplier != null) {
    form.set("shortIndicatorMultiplier", String(shortMultiplier));
  }
  if (
    form.get("shortStartKind") === "indicator" &&
    !form.get("shortIndicatorKind")
  ) {
    form.set("shortIndicatorKind", "rsi");
    form.set(
      "shortIndicatorTimeframe",
      String(form.get("shortIndicatorTimeframe") || "15"),
    );
    form.set(
      "shortIndicatorCompare",
      String(form.get("shortIndicatorCompare") || "cross_gte"),
    );
    form.set(
      "shortIndicatorLevel",
      String(form.get("shortIndicatorLevel") || "70"),
    );
  }
  const entryStack = entryStackFromJson(
    "entryStack" in recipe ? recipe.entryStack : null,
  );
  if (entryStack && entryStack.leaves.length > 0) {
    writeEntryStackFormFields(form, "", entryStack);
  }
  const shortEntryStack = entryStackFromJson(
    "shortEntryStack" in recipe ? recipe.shortEntryStack : null,
  );
  if (direction === "both" && shortEntryStack && shortEntryStack.leaves.length > 0) {
    writeEntryStackFormFields(form, "short_", shortEntryStack);
  }
  writeDcaFilterFormFields(form, "confirm", filterSpecFromRecipe(recipe.confirm));
  writeDcaFilterFormFields(
    form,
    "shortConfirm",
    filterSpecFromRecipe(recipe.shortConfirm),
  );
  const exitWebhookId = options.webhookId?.trim() || "";
  writeTemplateHardExitFields(
    form,
    "exitIf",
    filterSpecFromRecipe(recipe.exitIf),
    recipe.exitHard,
    exitWebhookId,
    notes,
    "Hard Exit",
  );
  writeTemplateHardExitFields(
    form,
    "shortExitIf",
    filterSpecFromRecipe(recipe.shortExitIf),
    recipe.shortExitHard,
    exitWebhookId,
    notes,
    "Short Hard Exit",
  );
  writeAppliedExitStack(
    form,
    "exitIf",
    entryStackFromJson("exitStack" in recipe ? recipe.exitStack : null),
    exitWebhookId,
    notes,
  );
  if (direction === "both") {
    writeAppliedExitStack(
      form,
      "shortExitIf",
      entryStackFromJson(
        "shortExitStack" in recipe ? recipe.shortExitStack : null,
      ),
      exitWebhookId,
      notes,
    );
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
  const direction =
    recipe.direction ??
    (recipe.formAction === "sell" || recipe.formAction === "close_short"
      ? "short"
      : "long");
  if (direction === "both" && !venueAllowsPerpsBoth(venue)) {
    form.set("r0_direction", "long");
    form.set("r0_action", "buy");
    notes.push("Hyperliquid is one-way. Applied as Long.");
  } else {
    form.set("r0_direction", direction);
    form.set(
      "r0_action",
      direction === "both" ? "buy" : recipe.formAction,
    );
  }
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
  const exitDraft = hardExitDraftFromTemplate(recipe.exitIf, recipe.exitHard);
  if (exitDraft?.trigger === "webhook") {
    if (!webhookId) {
      notes.push(
        "Hard Exit signal needs a webhook on this desk. Hard Exit was left off.",
      );
    } else {
      exitDraft.webhookId = webhookId;
    }
  }
  const exitKept = !(exitDraft?.trigger === "webhook" && !exitDraft.webhookId);
  const exitStack = exitKept
    ? appliedExitStack(recipe.exitStack, webhookId, notes)
    : null;
  writeFuturesConditionFormFields(form, "r0_", {
    indicator: recipe.indicator,
    confirm: recipe.confirm,
    entryStack: recipe.entryStack,
    exitIf: exitKept ? recipe.exitIf : null,
    exitStack,
    exitDraft: exitKept ? exitDraft : null,
    breakevenActivationPct: recipe.breakevenActivationPct,
    breakevenOffsetPct: recipe.breakevenOffsetPct,
  });
  if (
    direction === "both" &&
    venueAllowsPerpsBoth(venue) &&
    recipe.shortEntry
  ) {
    writePerpsShortEntryFields(form, "r0_short_", recipe.shortEntry);
  }
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
  shortStartKind?: string;
  shortWebhookId?: string;
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
  spacingKind?: string;
  atrPeriod?: string;
  atrSpacingMult?: string;
  takeProfitKind?: string;
  takeProfitAtrMult?: string;
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
  indicatorPeriod?: string;
  indicatorSlowPeriod?: string;
  indicatorMultiplier?: string;
  shortIndicatorKind?: string;
  shortIndicatorTimeframe?: string;
  shortIndicatorCompare?: string;
  shortIndicatorLevel?: string;
  shortIndicatorPeriod?: string;
  shortIndicatorSlowPeriod?: string;
  shortIndicatorMultiplier?: string;
  armTriggerBy?: string;
  armCompare?: string;
  armPrice?: string;
  shortArmTriggerBy?: string;
  shortArmCompare?: string;
  shortArmPrice?: string;
  trailingTriggerPct?: string;
  trailingPct?: string;
  breakevenActivationPct?: string;
  breakevenOffsetPct?: string;
  tpOn?: string;
  slOn?: string;
  trailOn?: string;
  breakeven?: string;
  shortClassic?: string;
  shortTakeProfitKind?: string;
  shortTakeProfitAtrMult?: string;
  shortTakeProfitPct?: string;
  shortTakeProfitBasis?: string;
  shortTakeProfitOrderType?: string;
  shortAtrPeriod?: string;
  shortStopLossPct?: string;
  shortStopLossBasis?: string;
  shortTrailingTriggerPct?: string;
  shortTrailingPct?: string;
  shortBreakevenActivationPct?: string;
  shortBreakevenOffsetPct?: string;
  shortTpOn?: string;
  shortSlOn?: string;
  shortTrailOn?: string;
  shortBreakeven?: string;
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
  form.set(
    "r0_direction",
    layer.direction ??
      (layer.formAction === "sell" || layer.formAction === "close_short"
        ? "short"
        : "long"),
  );
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
  if (layer.direction === "both" && layer.shortEntry) {
    writePerpsShortEntryFields(form, "r0_short_", layer.shortEntry);
  }
  writeFuturesConditionFormFields(form, "r0_", {
    indicator: layer.indicator,
    confirm: layer.confirm,
    entryStack: layer.entryStack,
    exitIf: layer.exitIf,
    exitHard: layer.exitHard,
    exitStack: layer.exitStack,
    exitDraft: layer.exitDraft,
    breakevenActivationPct:
      layer.breakevenActivationPct.trim() === ""
        ? null
        : Number(layer.breakevenActivationPct),
    breakevenOffsetPct:
      layer.breakevenOffsetPct.trim() === ""
        ? null
        : Number(layer.breakevenOffsetPct),
  });
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

function appliedExitStack(
  stack: EntryStack | null | undefined,
  webhookId: string,
  notes: string[],
): EntryStack | null {
  const filled = applyExitStackWebhook(stack, webhookId);
  if (!exitStackNeedsWebhook(filled)) {
    return filled.leaves.length > 0 ? filled : null;
  }
  notes.push("Hard Exit signal needs a webhook on this desk.");
  const dropped = exitStackDropEmptyWebhooks(filled);
  return dropped.leaves.length > 0 ? dropped : null;
}

function writeAppliedExitStack(
  form: FormData,
  prefix: string,
  stack: EntryStack | null | undefined,
  webhookId: string,
  notes: string[],
): void {
  if (form.get(`${prefix}Trigger`) == null) {
    return;
  }
  const next = appliedExitStack(stack, webhookId, notes);
  if (next) {
    writeExitStackFormFields(form, prefix, next);
  }
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
