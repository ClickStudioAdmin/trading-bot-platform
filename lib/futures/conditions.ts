import {
  dcaFilterMet,
  dcaFilterNeedsBars,
  filterColumns,
  filterFromRow,
  parseDcaFilterForm,
  parseDcaFilterSpec,
  seriesForFilter,
  writeDcaFilterFormFields,
  type DcaFilterSpec,
} from "@/lib/dca/filters";
import {
  exitActionTimeframes,
  exitActionsFromJson,
  exitActionsToJson,
  parseExitActionsField,
} from "@/lib/strategy/exit-actions";
import {
  parseProtectionSpec,
  protectionMet,
  type ProtectionReading,
} from "@/lib/strategy/protection";
import { parseRsiDivergenceSettings } from "@/lib/strategy/rsi-divergence";
import {
  parseRetraceFrom,
  parseRetraceLookback,
  parseRetracePct,
  parseRetraceSource,
  parseRetraceSpec,
  positionRetraceMet,
  retraceMet,
  windowRetraceSpec,
  type PositionRetraceContext,
  type RetraceSpec,
} from "@/lib/strategy/retrace";
import {
  hardExitDraftFromStored,
  hardExitSignalFromJson,
  hardExitSignalToJson,
  isTemplateParseWebhookId,
  parseHardExitForm,
  TEMPLATE_EXIT_WEBHOOK_ID,
  writeHardExitFormFields,
  type HardExitDraft,
  type HardExitSignal,
} from "@/lib/dca/hard-exit";
import {
  exitStackNeedsWideBars,
  hardExitAnchor,
  hardExitTriggerTimeframe,
  parseExitStackForm,
  writeExitStackFormFields,
} from "@/lib/dca/exit-stack";
import { closedLiveIndicatorBars } from "@/lib/market/desk-klines";
import type { CandleBar } from "@/lib/market/candles";
import {
  dcaPnlPct,
  dcaSeriesStartEval,
  parseDcaIndicatorKind,
  parseDcaIndicatorStartFields,
  parseOptionalNonNegative,
  parseOptionalPositive,
  type DcaIndicatorStart,
} from "@/lib/dca/playbook";
import {
  parseDcaIndicatorCompare,
  parseDcaIndicatorMultiplier,
  parseDcaIndicatorPeriod,
  parseDcaIndicatorTimeframe,
  type DcaIndicatorTimeframe,
  type SupertrendBar,
} from "@/lib/dca/indicators";
import { dcaBreakevenPrice, dcaTighterStopPrice } from "@/lib/dca/grid";
import { indicatorClaim, priceClaim } from "@/lib/strategy/conflicts";
import {
  confirmFromEntryStack,
  emptyEntryStack,
  entryStackConflictMessage,
  entryStackError,
  entryExprMetaFromJson,
  entryExprToJson,
  entryStackFromJson,
  entryStackMet,
  entryStackTimeframes,
  entryStackToJson,
  legacyEntryStack,
  resolveEntryStack,
  webhookActionMatches,
  type EntryConflictSlot,
  type EntryStack,
  type StrategyLeaf,
} from "@/lib/strategy/expr";
import { triggerPrice, type FuturesTpsl } from "./tpsl";
import type { FuturesTrailing } from "./trailing";
import type { FuturesTrigger } from "./model";
import type { FuturesAction, FuturesSide } from "./model";

/** The short leg of a Both rule. Single-side rules leave this null. */
export type PerpsEntryLeg = {
  entrySource: FuturesAutomationEntry;
  webhookId: string | null;
  triggerBy: FuturesTrigger;
  triggerCompare: "gte" | "lte";
  triggerPrice: number;
  skipIfOpen: boolean;
  indicator: DcaIndicatorStart | null;
  retrace?: RetraceSpec | null;
  confirm: DcaFilterSpec | null;
  entryStack: EntryStack;
  /** Flex additional-order conditions. Sizing stays on the form. */
  addStack?: EntryStack | null;
  /**
   * Short entry order. Absent means this side still uses the long size,
   * unit, and order. A stored order is independent of the long columns.
   */
  size?: number | null;
  sizeUnit?: "qty" | "usdt" | null;
  orderType?: "market" | "limit" | null;
  limitPrice?: number | null;
  /** Custom exit for the short leg. Absent means the short leg uses the long exit. */
  exitIf?: DcaFilterSpec | null;
  exitHard?: HardExitSignal | null;
  exitStack?: EntryStack | null;
  /**
   * Take profit, trailing stop, and stop loss for the short leg.
   * Absent means this side still shares the long classic exits.
   */
  classic?: PerpsShortClassic | null;
  /** Short-side exit actions. Null keeps the column exit. */
  actions?: import("@/lib/strategy/exit-actions").StoredExitAction[] | null;
};

export type PerpsShortClassic = {
  tpsl: FuturesTpsl | null;
  trailing: FuturesTrailing | null;
  breakevenActivationPct: number | null;
  breakevenOffsetPct: number | null;
};

export function perpsLegHasOwnExit(
  leg:
    | {
        exitIf?: DcaFilterSpec | null;
        exitHard?: HardExitSignal | null;
        exitStack?: EntryStack | null;
      }
    | null
    | undefined,
): boolean {
  if (!leg) {
    return false;
  }
  return Boolean(
    leg.exitIf ||
      leg.exitHard ||
      (leg.exitStack && leg.exitStack.leaves.length > 0),
  );
}

export function perpsExitForSide(
  rule: {
    direction?: string | null;
    exitIf?: DcaFilterSpec | null;
    exitHard?: HardExitSignal | null;
    exitStack?: EntryStack | null;
    shortEntry?:
      | {
          exitIf?: DcaFilterSpec | null;
          exitHard?: HardExitSignal | null;
          exitStack?: EntryStack | null;
        }
      | null;
  },
  side: FuturesSide,
): {
  exitIf: DcaFilterSpec | null;
  exitHard: HardExitSignal | null;
  exitStack: EntryStack;
} {
  if (
    side === "short" &&
    rule.direction === "both" &&
    perpsLegHasOwnExit(rule.shortEntry)
  ) {
    const leg = rule.shortEntry;
    return {
      exitIf: leg?.exitIf ?? null,
      exitHard: leg?.exitHard ?? null,
      exitStack: leg?.exitStack ?? emptyEntryStack(),
    };
  }
  return {
    exitIf: rule.exitIf ?? null,
    exitHard: rule.exitHard ?? null,
    exitStack: rule.exitStack ?? emptyEntryStack(),
  };
}

export type { EntryStack };

export type FuturesAutomationEntry =
  | "price"
  | "webhook"
  | "indicator"
  | "trend"
  | "retrace";

export function futuresIndicatorFieldNames(prefix: string): {
  kind: string;
  timeframe: string;
  compare: string;
  level: string;
  period: string;
  slowPeriod: string;
  multiplier: string;
} {
  return {
    kind: `${prefix}indicatorKind`,
    timeframe: `${prefix}indicatorTimeframe`,
    compare: `${prefix}indicatorCompare`,
    level: `${prefix}indicatorLevel`,
    period: `${prefix}indicatorPeriod`,
    slowPeriod: `${prefix}indicatorSlowPeriod`,
    multiplier: `${prefix}indicatorMultiplier`,
  };
}

export function indicatorColumns(
  start: DcaIndicatorStart | null | undefined,
): Record<string, unknown> {
  return {
    indicator_kind: start?.kind ?? null,
    indicator_timeframe: start?.timeframe ?? null,
    indicator_compare: start?.compare ?? null,
    indicator_level: start?.level ?? null,
    indicator_period: start?.period ?? null,
    indicator_slow_period: start?.slowPeriod ?? null,
    indicator_multiplier: start?.multiplier ?? null,
  };
}

export function indicatorStartFromRow(
  row: Record<string, unknown>,
): DcaIndicatorStart | null {
  const form = new FormData();
  const names = futuresIndicatorFieldNames("");
  form.set(names.kind, String(row.indicator_kind ?? ""));
  form.set(names.timeframe, String(row.indicator_timeframe ?? ""));
  form.set(names.compare, String(row.indicator_compare ?? ""));
  if (row.indicator_level != null) {
    form.set(names.level, String(row.indicator_level));
  }
  if (row.indicator_period != null) {
    form.set(names.period, String(row.indicator_period));
  }
  if (row.indicator_slow_period != null) {
    form.set(names.slowPeriod, String(row.indicator_slow_period));
  }
  if (row.indicator_multiplier != null) {
    form.set(names.multiplier, String(row.indicator_multiplier));
  }
  if (String(row.indicator_kind ?? "") === "rsi_divergence") {
    const divergence = entryExprMetaFromJson(row.entry_expr).divergence;
    const base = names.kind.endsWith("Kind")
      ? names.kind.slice(0, -4)
      : names.kind;
    if (divergence) {
      form.set(`${base}DivergenceWhen`, divergence.when);
      form.set(`${base}DivergenceStyle`, divergence.style);
      form.set(`${base}PivotBars`, String(divergence.pivotBars));
      form.set(`${base}Span`, String(divergence.span));
      if (divergence.minPricePct != null) {
        form.set(`${base}MinPricePct`, String(divergence.minPricePct));
      }
      if (divergence.minRsi != null) {
        form.set(`${base}MinRsi`, String(divergence.minRsi));
      }
    }
  }
  const family =
    String(row.indicator_kind ?? "") === "supertrend" ? "trend" : "indicator";
  const parsed = parseDcaIndicatorStartFields(form, names, true, "", family);
  return parsed.ok ? parsed.start : null;
}

export function parseFuturesIndicatorStart(
  form: FormData,
  prefix: string,
  entrySource: FuturesAutomationEntry,
):
  | { ok: true; start: DcaIndicatorStart | null }
  | { ok: false; error: string } {
  const family =
    entrySource === "trend"
      ? "trend"
      : entrySource === "indicator"
        ? "indicator"
        : null;
  if (!family) {
    return { ok: true, start: null };
  }
  return parseDcaIndicatorStartFields(
    form,
    futuresIndicatorFieldNames(prefix),
    true,
    "",
    family,
  );
}

export function parseFuturesBreakevenFields(
  form: FormData,
  prefix: string,
  required: boolean,
):
  | {
      ok: true;
      activationPct: number | null;
      offsetPct: number | null;
    }
  | { ok: false; error: string } {
  const activation = parseOptionalPositive(
    form.get(`${prefix}breakevenActivationPct`),
  );
  if (!activation.ok) {
    return activation;
  }
  const offset = parseOptionalNonNegative(
    form.get(`${prefix}breakevenOffsetPct`),
  );
  if (!offset.ok) {
    return offset;
  }
  if (required && activation.value == null) {
    return { ok: false, error: "Enter a breakeven activation percent." };
  }
  if (activation.value == null) {
    return { ok: true, activationPct: null, offsetPct: null };
  }
  return {
    ok: true,
    activationPct: activation.value,
    offsetPct: offset.value ?? 0,
  };
}

function parsePriceEntryLeaf(
  form: FormData,
  prefix: string,
): { ok: true; leaf: StrategyLeaf } | { ok: false; error: string } {
  const triggerBy = String(form.get(`${prefix}TriggerBy`) ?? "last");
  if (triggerBy !== "last" && triggerBy !== "mark" && triggerBy !== "index") {
    return { ok: false, error: "Choose a price source." };
  }
  const compare = String(form.get(`${prefix}TriggerCompare`) ?? "gte");
  if (compare !== "gte" && compare !== "lte") {
    return { ok: false, error: "Choose a price comparison." };
  }
  const price = Number(
    String(form.get(`${prefix}TriggerPrice`) ?? "").replace(/,/g, "").trim(),
  );
  if (!(price > 0)) {
    return { ok: false, error: "Enter a price." };
  }
  return {
    ok: true,
    leaf: { kind: "price", triggerBy, compare, price },
  };
}

function parseRetraceEntryLeaf(
  form: FormData,
  prefix: string,
): { ok: true; leaf: StrategyLeaf } | { ok: false; error: string } {
  const source = parseRetraceSource(form.get(`${prefix}RetraceSource`) ?? "last");
  const from = parseRetraceFrom(form.get(`${prefix}RetraceFrom`) ?? "high");
  const pct = parseRetracePct(form.get(`${prefix}RetracePct`));
  const lookback = parseRetraceLookback(
    form.get(`${prefix}RetraceLookback`) ?? "20",
  );
  const timeframe = parseDcaIndicatorTimeframe(
    form.get(`${prefix}RetraceTimeframe`) ?? "15",
  );
  if (!source || !from || pct == null || lookback == null || !timeframe) {
    return { ok: false, error: "Enter the retrace percent, lookback, and timeframe." };
  }
  return {
    ok: true,
    leaf: { kind: "retrace", source, from, pct, lookback, timeframe },
  };
}

function parseProtectionEntryLeaf(
  form: FormData,
  prefix: string,
): { ok: true; leaf: StrategyLeaf } | { ok: false; error: string } {
  const spec = parseProtectionSpec({
    is: form.get(`${prefix}ProtectionIs`) ?? "protected",
    amount: form.get(`${prefix}ProtectionAmount`) ?? "entire",
    pct: form.get(`${prefix}ProtectionPct`),
  });
  if (!spec) {
    return { ok: false, error: "Enter how much of the position must be protected." };
  }
  return { ok: true, leaf: { kind: "protection", ...spec } };
}

function parseTriggerEntryLeaf(
  form: FormData,
  prefix: string,
  source: string,
): { ok: true; leaf: StrategyLeaf } | { ok: false; error: string } {
  if (source === "retrace") {
    return parseRetraceEntryLeaf(form, prefix);
  }
  if (source === "protection") {
    return parseProtectionEntryLeaf(form, prefix);
  }
  if (source === "price") {
    return parsePriceEntryLeaf(form, prefix);
  }
  if (source === "webhook") {
    const webhookId = String(form.get(`${prefix}WebhookId`) ?? "").trim();
    if (!webhookId) {
      return { ok: false, error: "Pick a webhook." };
    }
    return { ok: true, leaf: { kind: "webhook", webhookId } };
  }
  if (source === "indicator" || source === "trend") {
    const parsed = parseDcaIndicatorStartFields(
      form,
      futuresIndicatorFieldNames(prefix),
      true,
      "entry condition",
      source,
    );
    if (!parsed.ok) {
      return parsed;
    }
    if (!parsed.start) {
      return { ok: false, error: "Enter an entry condition." };
    }
    return { ok: true, leaf: { kind: source, start: parsed.start } };
  }
  const parsed = parseDcaFilterForm(form, prefix, true, "entry condition");
  if (!parsed.ok) {
    return parsed;
  }
  if (!parsed.spec) {
    return { ok: false, error: "Enter an entry condition." };
  }
  return { ok: true, leaf: { kind: "filter", spec: parsed.spec } };
}

export function parseEntryStackForm(
  form: FormData,
  prefix: string,
  triggerTimeframe: DcaIndicatorTimeframe | null,
  trigger?: EntryConflictSlot,
):
  | { ok: true; present: boolean; stack: EntryStack }
  | { ok: false; error: string } {
  if (form.get(`${prefix}entryCount`) == null) {
    return { ok: true, present: false, stack: emptyEntryStack() };
  }
  const count = Number(String(form.get(`${prefix}entryCount`)));
  if (!Number.isInteger(count) || count < 0) {
    return { ok: false, error: "Entry conditions are incomplete." };
  }
  const leaves: EntryStack["leaves"] = [];
  const joins: EntryStack["joins"] = [];
  for (let index = 0; index < count; index += 1) {
    const joinRaw = String(form.get(`${prefix}entry${index}Join`) ?? "and");
    const source = String(form.get(`${prefix}entry${index}Source`) ?? "").trim();
    const parsed = parseTriggerEntryLeaf(
      form,
      `${prefix}entry${index}`,
      source,
    );
    if (!parsed.ok) {
      return parsed;
    }
    leaves.push(parsed.leaf);
    joins.push(joinRaw === "or" ? "or" : "and");
  }
  const stack: EntryStack = { leaves, joins };
  const error = entryStackError({ stack, triggerTimeframe });
  if (error) {
    return { ok: false, error };
  }
  if (trigger) {
    const conflict = entryStackConflictMessage({ trigger, stack });
    if (conflict) {
      return { ok: false, error: conflict };
    }
  }
  return { ok: true, present: true, stack };
}

export function writeEntryStackFormFields(
  form: FormData,
  prefix: string,
  stack: EntryStack,
): void {
  form.set(`${prefix}entryCount`, String(stack.leaves.length));
  stack.leaves.forEach((leaf, index) => {
    const row = `${prefix}entry${index}`;
    form.set(`${row}Join`, stack.joins[index] ?? "and");
    form.set(`${row}Source`, leaf.kind);
    if (leaf.kind === "filter") {
      writeDcaFilterFormFields(form, row, leaf.spec);
      return;
    }
    if (leaf.kind === "price") {
      form.set(`${row}TriggerBy`, leaf.triggerBy);
      form.set(`${row}TriggerCompare`, leaf.compare);
      form.set(`${row}TriggerPrice`, String(leaf.price));
      return;
    }
    if (leaf.kind === "webhook") {
      form.set(`${row}WebhookId`, leaf.webhookId);
      return;
    }
    if (leaf.kind === "retrace") {
      form.set(`${row}RetraceSource`, leaf.source);
      form.set(`${row}RetraceFrom`, leaf.from);
      form.set(`${row}RetracePct`, String(leaf.pct));
      form.set(`${row}RetraceLookback`, String(leaf.lookback ?? ""));
      form.set(`${row}RetraceTimeframe`, leaf.timeframe ?? "");
      return;
    }
    if (leaf.kind === "protection") {
      form.set(`${row}ProtectionIs`, leaf.is);
      form.set(`${row}ProtectionAmount`, leaf.amount);
      if (leaf.pct != null) {
        form.set(`${row}ProtectionPct`, String(leaf.pct));
      }
      return;
    }
    const names = futuresIndicatorFieldNames(row);
    form.set(names.kind, leaf.start.kind);
    form.set(names.timeframe, leaf.start.timeframe);
    if (leaf.start.compare) {
      form.set(names.compare, leaf.start.compare);
    }
    if (leaf.start.level != null) {
      form.set(names.level, String(leaf.start.level));
    }
    if (leaf.start.period != null) {
      form.set(names.period, String(leaf.start.period));
    }
    if (leaf.start.slowPeriod != null) {
      form.set(names.slowPeriod, String(leaf.start.slowPeriod));
    }
    if (leaf.start.multiplier != null) {
      form.set(names.multiplier, String(leaf.start.multiplier));
    }
  });
}

export function parseFuturesConditionForm(
  form: FormData,
  prefix: string,
  input: {
    entrySource: FuturesAutomationEntry;
    closing: boolean;
  },
):
  | {
      ok: true;
      indicator: DcaIndicatorStart | null;
      confirm: DcaFilterSpec | null;
      entryStack: EntryStack;
      exitIf: DcaFilterSpec | null;
      exitHard: HardExitSignal | null;
      exitStack: EntryStack;
      exitActions: import("@/lib/strategy/exit-actions").StoredExitAction[] | null;
      breakevenActivationPct: number | null;
      breakevenOffsetPct: number | null;
      retrace: RetraceSpec | null;
      addStack: EntryStack | null;
    }
  | { ok: false; error: string } {
  if (input.closing) {
    return {
      ok: true,
      indicator: null,
      confirm: null,
      entryStack: emptyEntryStack(),
      exitIf: null,
      exitHard: null,
      exitStack: emptyEntryStack(),
      exitActions: null,
      breakevenActivationPct: null,
      breakevenOffsetPct: null,
      retrace: null,
      addStack: null,
    };
  }
  const indicator = parseFuturesIndicatorStart(
    form,
    prefix,
    input.entrySource,
  );
  if (!indicator.ok) {
    return indicator;
  }
  const triggerTimeframe =
    indicator.start &&
    (input.entrySource === "indicator" || input.entrySource === "trend")
      ? indicator.start.timeframe
      : null;
  const triggerClaim =
    input.entrySource === "price"
      ? priceClaim({
          source: form.get(`${prefix}triggerBy`),
          compare: form.get(`${prefix}triggerCompare`),
          price: form.get(`${prefix}triggerPrice`),
        })
      : indicator.start
        ? indicatorClaim({
            surface: "entry",
            kind: indicator.start.kind,
            timeframe: indicator.start.timeframe,
            compare: indicator.start.compare,
            level: indicator.start.level,
            period: indicator.start.period,
            slowPeriod: indicator.start.slowPeriod,
            multiplier: indicator.start.multiplier,
          })
        : null;
  const stacked = parseEntryStackForm(form, prefix, triggerTimeframe, {
    kind: input.entrySource,
    join: "and",
    webhookId: String(form.get(`${prefix}webhookId`) ?? "").trim() || null,
    claim: triggerClaim,
  });
  if (!stacked.ok) {
    return stacked;
  }
  const confirm = parseDcaFilterForm(form, `${prefix}confirm`, false, "confirm");
  if (!confirm.ok) {
    return confirm;
  }
  const exitIf = parseHardExitForm(form, `${prefix}exitIf`, "Hard Exit");
  if (!exitIf.ok) {
    return exitIf;
  }
  const exitDraft = hardExitDraftFromStored(exitIf.filter, exitIf.signal);
  const exitStacked = parseExitStackForm(
    form,
    `${prefix}exitIf`,
    hardExitAnchor(exitDraft),
    hardExitTriggerTimeframe(exitDraft),
  );
  if (!exitStacked.ok) {
    return exitStacked;
  }
  const breakevenOn =
    form.get(`${prefix}breakeven`) === "on" ||
    String(form.get(`${prefix}breakevenActivationPct`) ?? "").trim() !== "";
  const breakeven = parseFuturesBreakevenFields(form, prefix, breakevenOn);
  if (!breakeven.ok) {
    return breakeven;
  }
  const entryStack = stacked.present
    ? stacked.stack
    : legacyEntryStack(confirm.spec);
  const exitActions = parseExitActionsField(form, `${prefix}exitActions`);
  if (!exitActions.ok) {
    return exitActions;
  }
  const retrace =
    input.entrySource === "retrace"
      ? parseRetraceSpec({
          source: form.get(`${prefix}RetraceSource`) ?? "last",
          from: form.get(`${prefix}RetraceFrom`),
          pct: form.get(`${prefix}RetracePct`),
          lookback: form.get(`${prefix}RetraceLookback`) ?? "20",
          timeframe: form.get(`${prefix}RetraceTimeframe`) ?? "15",
        })
      : null;
  if (input.entrySource === "retrace" && !retrace) {
    return { ok: false, error: "Enter the retrace percent, lookback, and timeframe." };
  }
  const addRaw = String(form.get(`${prefix}addExpr`) ?? "").trim();
  let addStack: EntryStack | null = null;
  if (addRaw) {
    try {
      addStack = entryStackFromJson(JSON.parse(addRaw));
    } catch {
      return { ok: false, error: "Additional order conditions are incomplete." };
    }
  }
  return {
    ok: true,
    indicator: indicator.start,
    confirm: stacked.present
      ? confirmFromEntryStack(entryStack)
      : confirm.spec,
    entryStack,
    exitIf: exitIf.filter,
    exitHard: exitIf.signal,
    exitStack: exitStacked.stack,
    exitActions: exitActions.actions,
    breakevenActivationPct: breakeven.activationPct,
    breakevenOffsetPct: breakeven.offsetPct,
    retrace,
    addStack,
  };
}

export function conditionsFromRow(row: Record<string, unknown>): {
  indicator: DcaIndicatorStart | null;
  confirm: DcaFilterSpec | null;
  entryStack: EntryStack;
  exitIf: DcaFilterSpec | null;
  exitHard: HardExitSignal | null;
  exitStack: EntryStack;
  exitActions: import("@/lib/strategy/exit-actions").StoredExitAction[] | null;
  breakevenActivationPct: number | null;
  breakevenOffsetPct: number | null;
  retrace: RetraceSpec | null;
  addStack: EntryStack | null;
} {
  const activation = Number(row.breakeven_activation_pct);
  const offsetRaw = row.breakeven_offset_pct;
  const offset =
    offsetRaw == null || offsetRaw === "" ? null : Number(offsetRaw);
  const stored = entryStackFromJson(row.entry_expr);
  const meta = entryExprMetaFromJson(row.entry_expr);
  const confirm = filterFromRow(row, "confirm");
  const entryStack = stored ?? legacyEntryStack(confirm);
  const exitHard = hardExitSignalFromJson(row.exit_hard);
  const indicator = indicatorStartFromRow(row);
  return {
    indicator:
      indicator && indicator.kind === "rsi_divergence"
        ? { ...indicator, divergence: meta.divergence }
        : indicator,
    retrace: meta.retrace,
    addStack: meta.add,
    confirm: stored ? confirmFromEntryStack(stored) : confirm,
    entryStack,
    exitIf: exitHard ? null : filterFromRow(row, "exit_if"),
    exitHard,
    exitStack: entryStackFromJson(row.exit_expr) ?? emptyEntryStack(),
    exitActions: exitActionsFromJson(row.exit_actions),
    breakevenActivationPct: activation > 0 ? activation : null,
    breakevenOffsetPct:
      offset != null && Number.isFinite(offset) && offset >= 0 ? offset : null,
  };
}

export function conditionColumns(rule: {
  indicator?: DcaIndicatorStart | null;
  confirm?: DcaFilterSpec | null;
  entryStack?: EntryStack | null;
  exitIf?: DcaFilterSpec | null;
  exitHard?: HardExitSignal | null;
  exitStack?: EntryStack | null;
  breakevenActivationPct?: number | null;
  breakevenOffsetPct?: number | null;
  exitActions?: import("@/lib/strategy/exit-actions").StoredExitAction[] | null;
  retrace?: RetraceSpec | null;
  addStack?: EntryStack | null;
}): Record<string, unknown> {
  const stack =
    rule.entryStack != null
      ? rule.entryStack
      : legacyEntryStack(rule.confirm);
  const confirm =
    rule.entryStack != null
      ? confirmFromEntryStack(rule.entryStack)
      : (rule.confirm ?? null);
  return {
    ...indicatorColumns(rule.indicator),
    ...filterColumns("confirm", confirm),
    ...filterColumns("exit_if", rule.exitHard ? null : rule.exitIf),
    exit_hard: hardExitSignalToJson(rule.exitHard),
    exit_expr:
      rule.exitStack && rule.exitStack.leaves.length > 0
        ? entryStackToJson(rule.exitStack)
        : null,
    exit_actions: exitActionsToJson(rule.exitActions),
    entry_expr: (() => {
      const divergence =
        rule.indicator?.kind === "rsi_divergence"
          ? (rule.indicator.divergence ?? null)
          : null;
      const hasMeta = Boolean(
        rule.retrace || divergence || (rule.addStack && rule.addStack.leaves.length > 0),
      );
      if (stack.leaves.length === 0 && !hasMeta) {
        return null;
      }
      return entryExprToJson(stack, {
        retrace: rule.retrace,
        divergence,
        add: rule.addStack,
      });
    })(),
    breakeven_activation_pct: rule.breakevenActivationPct ?? null,
    breakeven_offset_pct:
      rule.breakevenActivationPct != null
        ? (rule.breakevenOffsetPct ?? 0)
        : null,
  };
}

export function writeFuturesConditionFormFields(
  form: FormData,
  prefix: string,
  rule: {
    indicator?: DcaIndicatorStart | null;
    confirm?: DcaFilterSpec | null;
    entryStack?: EntryStack | null;
    exitIf?: DcaFilterSpec | null;
    exitHard?: HardExitSignal | null;
    exitDraft?: HardExitDraft | null;
    exitStack?: EntryStack | null;
    breakevenActivationPct?: number | null;
    breakevenOffsetPct?: number | null;
    retrace?: RetraceSpec | null;
    addStack?: EntryStack | null;
  },
): void {
  const start = rule.indicator;
  const names = futuresIndicatorFieldNames(prefix);
  if (start) {
    form.set(names.kind, start.kind);
    form.set(names.timeframe, start.timeframe);
    if (start.compare) {
      form.set(names.compare, start.compare);
    }
    if (start.level != null) {
      form.set(names.level, String(start.level));
    }
    if (start.period != null) {
      form.set(names.period, String(start.period));
    }
    if (start.slowPeriod != null) {
      form.set(names.slowPeriod, String(start.slowPeriod));
    }
    if (start.multiplier != null) {
      form.set(names.multiplier, String(start.multiplier));
    }
    if (start.kind === "rsi_divergence" && start.divergence) {
      const base = names.kind.endsWith("Kind")
        ? names.kind.slice(0, -4)
        : names.kind;
      form.set(`${base}DivergenceWhen`, start.divergence.when);
      form.set(`${base}DivergenceStyle`, start.divergence.style);
      form.set(`${base}PivotBars`, String(start.divergence.pivotBars));
      form.set(`${base}Span`, String(start.divergence.span));
      if (start.divergence.minPricePct != null) {
        form.set(`${base}MinPricePct`, String(start.divergence.minPricePct));
      }
      if (start.divergence.minRsi != null) {
        form.set(`${base}MinRsi`, String(start.divergence.minRsi));
      }
    }
  }
  if (rule.retrace) {
    form.set(`${prefix}RetraceSource`, rule.retrace.source);
    form.set(`${prefix}RetraceFrom`, rule.retrace.from);
    form.set(`${prefix}RetracePct`, String(rule.retrace.pct));
    form.set(`${prefix}RetraceLookback`, String(rule.retrace.lookback));
    form.set(`${prefix}RetraceTimeframe`, rule.retrace.timeframe);
  }
  if (rule.addStack && rule.addStack.leaves.length > 0) {
    form.set(`${prefix}addExpr`, JSON.stringify(entryStackToJson(rule.addStack)));
  }
  if (rule.entryStack) {
    writeEntryStackFormFields(form, prefix, rule.entryStack);
  }
  writeDcaFilterFormFields(
    form,
    `${prefix}confirm`,
    rule.entryStack != null
      ? confirmFromEntryStack(rule.entryStack)
      : rule.confirm,
  );
  if (rule.exitDraft !== undefined) {
    writeHardExitFormFields(form, `${prefix}exitIf`, rule.exitDraft);
  } else if (rule.exitHard) {
    writeHardExitFormFields(
      form,
      `${prefix}exitIf`,
      hardExitDraftFromStored(null, rule.exitHard),
    );
  } else {
    writeHardExitFormFields(
      form,
      `${prefix}exitIf`,
      hardExitDraftFromStored(rule.exitIf, null),
    );
  }
  if (rule.exitDraft !== undefined || rule.exitStack) {
    writeExitStackFormFields(form, `${prefix}exitIf`, rule.exitStack);
  }
  if (rule.breakevenActivationPct != null) {
    form.set(
      `${prefix}breakevenActivationPct`,
      String(rule.breakevenActivationPct),
    );
    form.set(
      `${prefix}breakevenOffsetPct`,
      String(rule.breakevenOffsetPct ?? 0),
    );
  }
}

export function futuresAutomationTimeframes(rule: {
  entrySource: FuturesAutomationEntry;
  indicator?: DcaIndicatorStart | null;
  retrace?: RetraceSpec | null;
  addStack?: EntryStack | null;
  confirm?: DcaFilterSpec | null;
  entryStack?: EntryStack | null;
  exitIf?: DcaFilterSpec | null;
  exitStack?: EntryStack | null;
  exitActions?: import("@/lib/strategy/exit-actions").StoredExitAction[] | null;
  shortEntry?: PerpsEntryLeg | null;
}): DcaIndicatorTimeframe[] {
  const rows: DcaIndicatorTimeframe[] = [];
  function add(timeframe: DcaIndicatorTimeframe | null | undefined) {
    if (timeframe && !rows.includes(timeframe)) {
      rows.push(timeframe);
    }
  }
  if (
    (rule.entrySource === "indicator" || rule.entrySource === "trend") &&
    rule.indicator
  ) {
    add(rule.indicator.timeframe);
  }
  if (rule.entrySource === "retrace" && rule.retrace) {
    add(rule.retrace.timeframe);
  }
  if (rule.addStack) {
    for (const timeframe of entryStackTimeframes(rule.addStack)) {
      add(timeframe);
    }
  }
  const stack = resolveEntryStack(rule.entryStack, rule.confirm);
  for (const timeframe of entryStackTimeframes(stack)) {
    add(timeframe);
  }
  const short = rule.shortEntry;
  if (short) {
    if (
      (short.entrySource === "indicator" || short.entrySource === "trend") &&
      short.indicator
    ) {
      add(short.indicator.timeframe);
    }
    if (short.entrySource === "retrace" && short.retrace) {
      add(short.retrace.timeframe);
    }
    if (short.addStack) {
      for (const timeframe of entryStackTimeframes(short.addStack)) {
        add(timeframe);
      }
    }
    const shortStack = resolveEntryStack(short.entryStack, short.confirm);
    for (const timeframe of entryStackTimeframes(shortStack)) {
      add(timeframe);
    }
  }
  add(rule.exitIf?.timeframe);
  for (const timeframe of entryStackTimeframes(rule.exitStack ?? emptyEntryStack())) {
    add(timeframe);
  }
  if (rule.shortEntry && perpsLegHasOwnExit(rule.shortEntry)) {
    add(rule.shortEntry.exitIf?.timeframe);
    for (const timeframe of entryStackTimeframes(
      rule.shortEntry.exitStack ?? emptyEntryStack(),
    )) {
      add(timeframe);
    }
  }
  for (const timeframe of exitActionTimeframes(rule.exitActions)) {
    add(timeframe as DcaIndicatorTimeframe);
  }
  for (const timeframe of exitActionTimeframes(rule.shortEntry?.actions)) {
    add(timeframe as DcaIndicatorTimeframe);
  }
  return rows;
}

export function futuresAutomationNeedsBars(rule: {
  entrySource: FuturesAutomationEntry;
  indicator?: DcaIndicatorStart | null;
  confirm?: DcaFilterSpec | null;
  entryStack?: EntryStack | null;
  exitIf?: DcaFilterSpec | null;
}): boolean {
  return futuresAutomationTimeframes(rule).length > 0;
}

function stackNeedsWideBars(stack: EntryStack): boolean {
  return stack.leaves.some((leaf) => {
    if (leaf.kind === "trend") {
      return true;
    }
    if (leaf.kind === "indicator" && leaf.start.kind === "atr_band") {
      return true;
    }
    if (leaf.kind === "filter") {
      return dcaFilterNeedsBars(leaf.spec);
    }
    return false;
  });
}

export function futuresAutomationNeedsWideBars(rule: {
  entrySource: FuturesAutomationEntry;
  indicator?: DcaIndicatorStart | null;
  confirm?: DcaFilterSpec | null;
  entryStack?: EntryStack | null;
  exitIf?: DcaFilterSpec | null;
  exitStack?: EntryStack | null;
  shortEntry?: PerpsEntryLeg | null;
}): boolean {
  const stack = resolveEntryStack(rule.entryStack, rule.confirm);
  const short = rule.shortEntry;
  const shortStack = short
    ? resolveEntryStack(short.entryStack, short.confirm)
    : emptyEntryStack();
  return (
    rule.indicator?.kind === "supertrend" ||
    rule.indicator?.kind === "atr_band" ||
    short?.indicator?.kind === "supertrend" ||
    short?.indicator?.kind === "atr_band" ||
    stackNeedsWideBars(stack) ||
    stackNeedsWideBars(shortStack) ||
    dcaFilterNeedsBars(rule.exitIf) ||
    exitStackNeedsWideBars(rule.exitStack) ||
    dcaFilterNeedsBars(short?.exitIf) ||
    exitStackNeedsWideBars(short?.exitStack)
  );
}

function barsForTimeframe(
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>,
  timeframe: DcaIndicatorTimeframe,
): SupertrendBar[] {
  return closedLiveIndicatorBars(
    barsByTimeframe.get(timeframe) ?? [],
    timeframe,
  );
}

export function futuresStartMet(input: {
  entrySource: FuturesAutomationEntry;
  indicator?: DcaIndicatorStart | null;
  retrace?: RetraceSpec | null;
  side: FuturesSide;
  price: number | null;
  prices?: { last: number | null; mark: number | null; index: number | null } | null;
  triggerCompare: "gte" | "lte";
  triggerPrice: number;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
  webhookId?: string | null;
  /** Undefined keeps a webhook trigger true. Null means this tick is not that webhook. */
  firedWebhookId?: string | null;
  /** Buy is long, sell is short. Undefined keeps an id match. Null arms every side. */
  signalSide?: FuturesSide | null;
}): boolean {
  if (input.entrySource === "webhook") {
    if (input.firedWebhookId === undefined) {
      return true;
    }
    return (
      input.firedWebhookId != null &&
      input.firedWebhookId === input.webhookId &&
      webhookActionMatches({
        role: "entry",
        side: input.side,
        signalSide: input.signalSide,
      })
    );
  }
  if (input.entrySource === "price") {
    if (!(input.price != null && input.price > 0)) {
      return false;
    }
    return input.triggerCompare === "gte"
      ? input.price >= input.triggerPrice
      : input.price <= input.triggerPrice;
  }
  if (input.entrySource === "retrace") {
    const spec = input.retrace;
    if (!spec) {
      return false;
    }
    const quoted = input.prices
      ? triggerPrice(spec.source, input.prices)
      : input.price;
    const bars = barsForTimeframe(input.barsByTimeframe, spec.timeframe);
    return retraceMet({ spec, price: quoted, bars });
  }
  const start = input.indicator;
  if (!start) {
    return false;
  }
  const bars = barsForTimeframe(input.barsByTimeframe, start.timeframe);
  return dcaSeriesStartEval({
    startKind: input.entrySource,
    side: input.side,
    indicatorKind: start.kind,
    indicatorCompare: start.compare,
    indicatorLevel: start.level,
    indicatorPeriod: start.period,
    indicatorSlowPeriod: start.slowPeriod,
    indicatorMultiplier: start.multiplier,
    divergence: start.divergence,
    clipsFilled: 0,
    closes: bars.map((row) => row.close),
    bars,
  }).now;
}

export function futuresFilterMet(input: {
  spec: DcaFilterSpec | null | undefined;
  side: FuturesSide;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
}): boolean {
  if (!input.spec) {
    return true;
  }
  const bars = barsForTimeframe(input.barsByTimeframe, input.spec.timeframe);
  const series = seriesForFilter(input.spec, bars);
  return dcaFilterMet({
    spec: input.spec,
    side: input.side,
    closes: series.closes,
    bars: series.bars,
  });
}

function quotedPrice(
  triggerBy: FuturesTrigger,
  price: number | null,
  prices?: { last: number | null; mark: number | null; index: number | null } | null,
): number | null {
  if (prices) {
    return triggerPrice(triggerBy, prices);
  }
  return price;
}

export function entryLeafMet(input: {
  leaf: StrategyLeaf;
  side: FuturesSide;
  price: number | null;
  prices?: { last: number | null; mark: number | null; index: number | null } | null;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
  firedWebhookId?: string | null;
  /** Buy is long, sell is short. Undefined keeps an id match. */
  signalSide?: FuturesSide | null;
  /** Open size and protective coverage. Flat stays unmet. */
  protection?: ProtectionReading | null;
  /**
   * Additional orders test retrace against the open position.
   * Without a memory the leaf stays unmet, including saved lookback rows.
   */
  positionRetrace?: PositionRetraceContext | null;
}): boolean {
  const leaf = input.leaf;
  if (leaf.kind === "filter") {
    return futuresFilterMet({
      spec: leaf.spec,
      side: input.side,
      barsByTimeframe: input.barsByTimeframe,
    });
  }
  if (leaf.kind === "price") {
    const level = quotedPrice(leaf.triggerBy, input.price, input.prices);
    if (!(level != null && level > 0)) {
      return false;
    }
    return leaf.compare === "gte" ? level >= leaf.price : level <= leaf.price;
  }
  if (leaf.kind === "webhook") {
    return (
      input.firedWebhookId != null &&
      input.firedWebhookId === leaf.webhookId &&
      webhookActionMatches({
        role: "entry",
        side: input.side,
        signalSide: input.signalSide,
      })
    );
  }
  if (leaf.kind === "retrace") {
    const price = quotedPrice(leaf.source, input.price, input.prices);
    if (input.positionRetrace) {
      return positionRetraceMet({
        spec: leaf,
        side: input.side,
        price,
        average: input.positionRetrace.average,
        memory: input.positionRetrace.memory,
      });
    }
    if (input.positionRetrace === null) {
      return false;
    }
    const spec = windowRetraceSpec(leaf);
    if (!spec) {
      return false;
    }
    const bars = barsForTimeframe(input.barsByTimeframe, spec.timeframe);
    return retraceMet({ spec, price, bars });
  }
  if (leaf.kind === "protection") {
    return protectionMet({
      spec: leaf,
      openQty: input.protection?.openQty ?? null,
      provenPct: input.protection?.provenPct ?? null,
      noLossProvenPct: input.protection?.noLossProvenPct ?? null,
    });
  }
  const bars = barsForTimeframe(input.barsByTimeframe, leaf.start.timeframe);
  return dcaSeriesStartEval({
    startKind: leaf.kind,
    side: input.side,
    indicatorKind: leaf.start.kind,
    indicatorCompare: leaf.start.compare,
    indicatorLevel: leaf.start.level,
    indicatorPeriod: leaf.start.period,
    indicatorSlowPeriod: leaf.start.slowPeriod,
    indicatorMultiplier: leaf.start.multiplier,
    divergence: leaf.start.divergence,
    clipsFilled: 0,
    closes: bars.map((row) => row.close),
    bars,
  }).now;
}

export function futuresEntryConditionMet(input: {
  rule: {
    entrySource: FuturesAutomationEntry;
    indicator?: DcaIndicatorStart | null;
    confirm?: DcaFilterSpec | null;
    entryStack?: EntryStack | null;
    triggerCompare: "gte" | "lte";
    triggerPrice: number;
    retrace?: RetraceSpec | null;
    webhookId?: string | null;
    action?: FuturesAction;
    closeSide?: FuturesSide | null;
  };
  side: FuturesSide;
  price: number | null;
  prices?: { last: number | null; mark: number | null; index: number | null } | null;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
  firedWebhookId?: string | null;
  signalSide?: FuturesSide | null;
}): boolean {
  const start = futuresStartMet({
    entrySource: input.rule.entrySource,
    indicator: input.rule.indicator,
    retrace: input.rule.retrace,
    side: input.side,
    price: input.price,
    prices: input.prices,
    triggerCompare: input.rule.triggerCompare,
    triggerPrice: input.rule.triggerPrice,
    barsByTimeframe: input.barsByTimeframe,
    webhookId: input.rule.webhookId,
    firedWebhookId: input.firedWebhookId,
    signalSide: input.signalSide,
  });
  const stack = resolveEntryStack(input.rule.entryStack, input.rule.confirm);
  return entryStackMet({
    trigger: start,
    joins: stack.joins,
    leaves: stack.leaves.map((leaf) =>
      entryLeafMet({
        leaf,
        side: input.side,
        price: input.price,
        prices: input.prices,
        barsByTimeframe: input.barsByTimeframe,
        firedWebhookId: input.firedWebhookId,
        signalSide: input.signalSide,
      }),
    ),
  });
}

export function futuresBreakevenDue(input: {
  side: FuturesSide;
  qty: number;
  entryPrice: number;
  mark: number;
  activationPct: number | null | undefined;
  done: boolean;
}): boolean {
  if (input.done || input.activationPct == null || !(input.activationPct > 0)) {
    return false;
  }
  const pnl = dcaPnlPct({
    side: input.side,
    qty: input.qty,
    entryPrice: input.entryPrice,
    mark: input.mark,
  });
  return pnl != null && pnl >= input.activationPct;
}

export function futuresBreakevenStop(input: {
  side: FuturesSide;
  entryPrice: number;
  currentStop: number | null;
  offsetPct: number | null | undefined;
}): number | null {
  return dcaTighterStopPrice({
    side: input.side,
    current: input.currentStop,
    candidate: dcaBreakevenPrice({
      side: input.side,
      basisPrice: input.entryPrice,
      offsetPct: input.offsetPct ?? 0,
    }),
  });
}

export function emptyBarsByTimeframe(): Map<
  DcaIndicatorTimeframe,
  CandleBar[]
> {
  return new Map();
}

function indicatorStartFromRaw(raw: unknown): DcaIndicatorStart | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const kind = parseDcaIndicatorKind(row.kind);
  const timeframe = parseDcaIndicatorTimeframe(row.timeframe);
  if (!kind || !timeframe) {
    return null;
  }
  const compareRaw = row.compare;
  const compare =
    compareRaw == null || String(compareRaw).trim() === ""
      ? null
      : parseDcaIndicatorCompare(compareRaw);
  if (compareRaw != null && String(compareRaw).trim() !== "" && !compare) {
    return null;
  }
  const level =
    row.level == null || row.level === "" ? null : Number(row.level);
  if (level != null && !Number.isFinite(level)) {
    return null;
  }
  const period = row.period == null ? null : parseDcaIndicatorPeriod(row.period);
  const slowPeriod =
    row.slowPeriod == null ? null : parseDcaIndicatorPeriod(row.slowPeriod);
  const multiplier =
    row.multiplier == null ? null : parseDcaIndicatorMultiplier(row.multiplier);
  if (row.period != null && period == null) {
    return null;
  }
  if (row.slowPeriod != null && slowPeriod == null) {
    return null;
  }
  if (row.multiplier != null && multiplier == null) {
    return null;
  }
  const divergence =
    kind === "rsi_divergence" ? parseRsiDivergenceSettings(row.divergence) : null;
  if (kind === "rsi_divergence" && !divergence) {
    return null;
  }
  return {
    kind,
    timeframe,
    compare,
    level,
    period,
    slowPeriod,
    multiplier,
    divergence,
  };
}

/** Stored short leg. Single-side rules write null instead of calling this. */
export function shortEntryToJson(leg: PerpsEntryLeg): Record<string, unknown> {
  return {
    entrySource: leg.entrySource,
    webhookId: leg.webhookId,
    triggerBy: leg.triggerBy,
    triggerCompare: leg.triggerCompare,
    triggerPrice: leg.triggerPrice,
    skipIfOpen: leg.skipIfOpen,
    indicator: leg.indicator
      ? {
          kind: leg.indicator.kind,
          timeframe: leg.indicator.timeframe,
          compare: leg.indicator.compare,
          level: leg.indicator.level,
          period: leg.indicator.period,
          slowPeriod: leg.indicator.slowPeriod,
          multiplier: leg.indicator.multiplier ?? null,
          divergence: leg.indicator.divergence ?? null,
        }
      : null,
    retrace: leg.retrace ?? null,
    add: leg.addStack && leg.addStack.leaves.length > 0
      ? entryStackToJson(leg.addStack)
      : null,
    entryStack: entryStackToJson(leg.entryStack),
    ...(perpsLegHasOwnExit(leg)
      ? {
          exit: {
            exitIf: leg.exitIf ?? null,
            exitHard: hardExitSignalToJson(leg.exitHard),
            exitStack: leg.exitStack
              ? entryStackToJson(leg.exitStack)
              : null,
          },
        }
      : {}),
    ...(leg.classic ? { classic: leg.classic } : {}),
    ...(leg.actions && leg.actions.length > 0 ? { actions: leg.actions } : {}),
    ...perpsLegOrderToJson(leg),
  };
}

export function shortEntryFromJson(raw: unknown): PerpsEntryLeg | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const source = String(row.entrySource ?? "").trim().toLowerCase();
  if (
    source !== "price" &&
    source !== "indicator" &&
    source !== "trend" &&
    source !== "webhook" &&
    source !== "retrace"
  ) {
    return null;
  }
  const storedWebhookId = String(row.webhookId ?? "").trim();
  const webhookId =
    !storedWebhookId ||
    storedWebhookId === TEMPLATE_EXIT_WEBHOOK_ID ||
    isTemplateParseWebhookId(storedWebhookId)
      ? null
      : storedWebhookId;
  const triggerBy = row.triggerBy;
  if (triggerBy !== "last" && triggerBy !== "mark" && triggerBy !== "index") {
    return null;
  }
  const triggerCompare = row.triggerCompare;
  if (triggerCompare !== "gte" && triggerCompare !== "lte") {
    return null;
  }
  const triggerPrice = Number(row.triggerPrice);
  if (source === "price" && !(triggerPrice > 0)) {
    return null;
  }
  const indicator =
    row.indicator == null ? null : indicatorStartFromRaw(row.indicator);
  if (row.indicator != null && !indicator) {
    return null;
  }
  if ((source === "indicator" || source === "trend") && !indicator) {
    return null;
  }
  const retrace = source === "retrace" ? parseRetraceSpec(row.retrace) : null;
  if (source === "retrace" && !retrace) {
    return null;
  }
  // Desk storage names the stack `add`. A backtest recipe names it `addStack`.
  const addRaw = row.add != null ? row.add : row.addStack;
  const addStack = addRaw == null ? null : entryStackFromJson(addRaw);
  const stack =
    row.entryStack == null
      ? emptyEntryStack()
      : entryStackFromJson(row.entryStack);
  if (!stack) {
    return null;
  }
  const exit = shortExitFromJson(
    row.exit ??
      (row.exitIf != null || row.exitHard != null || row.exitStack != null
        ? {
            exitIf: row.exitIf,
            exitHard: row.exitHard,
            exitStack: row.exitStack,
          }
        : null),
  );
  return {
    entrySource: source,
    webhookId: source === "webhook" ? webhookId : null,
    triggerBy,
    triggerCompare,
    triggerPrice: triggerPrice > 0 ? triggerPrice : 1,
    skipIfOpen: row.skipIfOpen === true,
    indicator,
    retrace,
    addStack,
    confirm: confirmFromEntryStack(stack),
    entryStack: stack,
    ...exit,
    classic: perpsShortClassicFromJson(row.classic),
    ...(exitActionsFromJson(row.actions)
      ? { actions: exitActionsFromJson(row.actions) }
      : {}),
    ...perpsLegOrderFromJson(row),
  };
}

function perpsLegOrderToJson(leg: PerpsEntryLeg): Record<string, unknown> {
  if (leg.size == null || !(leg.size > 0)) {
    return {};
  }
  const orderType = leg.orderType === "limit" ? "limit" : "market";
  return {
    size: leg.size,
    sizeUnit: leg.sizeUnit === "qty" ? "qty" : "usdt",
    orderType,
    limitPrice: orderType === "limit" ? (leg.limitPrice ?? null) : null,
  };
}

function perpsLegOrderFromJson(
  row: Record<string, unknown>,
): Pick<PerpsEntryLeg, "size" | "sizeUnit" | "orderType" | "limitPrice"> {
  const size = positiveOrNull(row.size);
  if (size == null) {
    return {};
  }
  const orderType = row.orderType === "limit" ? "limit" : "market";
  return {
    size,
    sizeUnit: row.sizeUnit === "qty" ? "qty" : "usdt",
    orderType,
    limitPrice: orderType === "limit" ? positiveOrNull(row.limitPrice) : null,
  };
}

function positiveOrNull(raw: unknown): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function perpsShortClassicFromJson(raw: unknown): PerpsShortClassic | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const tpslRaw =
    row.tpsl && typeof row.tpsl === "object" && !Array.isArray(row.tpsl)
      ? (row.tpsl as Record<string, unknown>)
      : null;
  const takeProfit = positiveOrNull(tpslRaw?.takeProfit);
  const stopLoss = positiveOrNull(tpslRaw?.stopLoss);
  const trigger = (value: unknown): FuturesTrigger =>
    value === "mark" || value === "index" ? value : "last";
  const tpsl =
    tpslRaw && (takeProfit != null || stopLoss != null)
      ? {
          takeProfit,
          stopLoss,
          tpKind: tpslRaw.tpKind === "percent" ? ("percent" as const) : ("price" as const),
          slKind: tpslRaw.slKind === "percent" ? ("percent" as const) : ("price" as const),
          tpTrigger: trigger(tpslRaw.tpTrigger),
          slTrigger: trigger(tpslRaw.slTrigger),
          mode: tpslRaw.mode === "partial" ? ("partial" as const) : ("full" as const),
          tpQty: positiveOrNull(tpslRaw.tpQty),
          slQty: positiveOrNull(tpslRaw.slQty),
          tpOrderType:
            tpslRaw.tpOrderType === "limit" ? ("limit" as const) : ("market" as const),
          slOrderType:
            tpslRaw.slOrderType === "limit" ? ("limit" as const) : ("market" as const),
          tpLimitPrice: positiveOrNull(tpslRaw.tpLimitPrice),
          slLimitPrice: positiveOrNull(tpslRaw.slLimitPrice),
        }
      : null;
  const trailRaw =
    row.trailing && typeof row.trailing === "object" && !Array.isArray(row.trailing)
      ? (row.trailing as Record<string, unknown>)
      : null;
  const distance = positiveOrNull(trailRaw?.distance);
  const trailing =
    distance == null
      ? null
      : {
          distance,
          activePrice: positiveOrNull(trailRaw?.activePrice),
          peak: positiveOrNull(trailRaw?.peak),
        };
  const activation = positiveOrNull(row.breakevenActivationPct);
  const offset = Number(row.breakevenOffsetPct);
  return {
    tpsl,
    trailing,
    breakevenActivationPct: activation,
    breakevenOffsetPct:
      activation == null
        ? null
        : Number.isFinite(offset) && offset >= 0
          ? offset
          : 0,
  };
}

function shortExitFromJson(raw: unknown): {
  exitIf?: DcaFilterSpec | null;
  exitHard?: HardExitSignal | null;
  exitStack?: EntryStack | null;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const row = raw as Record<string, unknown>;
  const exitHard = hardExitSignalFromJson(row.exitHard);
  const exitStack = entryStackFromJson(row.exitStack);
  const exitIf = exitFilterFromJson(row.exitIf);
  if (!exitIf && !exitHard && !(exitStack && exitStack.leaves.length > 0)) {
    return {};
  }
  return {
    exitIf,
    exitHard,
    exitStack,
  };
}

function exitFilterFromJson(raw: unknown): DcaFilterSpec | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  return parseDcaFilterSpec({
    kind: row.kind,
    timeframe: row.timeframe,
    compare: row.compare,
    level: row.level,
    levelTo: row.levelTo,
    period: row.period,
    slowPeriod: row.slowPeriod,
    multiplier: row.multiplier,
  });
}
