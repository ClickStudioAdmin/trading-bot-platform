import {
  dcaFilterMet,
  dcaFilterNeedsBars,
  filterColumns,
  filterFromRow,
  parseDcaFilterForm,
  seriesForFilter,
  writeDcaFilterFormFields,
  type DcaFilterSpec,
} from "@/lib/dca/filters";
import {
  hardExitDraftFromStored,
  hardExitSignalFromJson,
  hardExitSignalToJson,
  parseHardExitForm,
  writeHardExitFormFields,
  type HardExitDraft,
  type HardExitSignal,
} from "@/lib/dca/hard-exit";
import {
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
  entryStackFromJson,
  entryStackMet,
  entryStackTimeframes,
  entryStackToJson,
  legacyEntryStack,
  resolveEntryStack,
  type EntryConflictSlot,
  type EntryStack,
  type StrategyLeaf,
} from "@/lib/strategy/expr";
import { triggerPrice } from "./tpsl";
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
  confirm: DcaFilterSpec | null;
  entryStack: EntryStack;
};

export type { EntryStack };

export type FuturesAutomationEntry =
  | "price"
  | "webhook"
  | "indicator"
  | "trend";

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

function parseTriggerEntryLeaf(
  form: FormData,
  prefix: string,
  source: string,
): { ok: true; leaf: StrategyLeaf } | { ok: false; error: string } {
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
      breakevenActivationPct: number | null;
      breakevenOffsetPct: number | null;
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
      breakevenActivationPct: null,
      breakevenOffsetPct: null,
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
    String(form.get(`${prefix}breakevenActivationPct`) ?? "").trim() !== "";
  const breakeven = parseFuturesBreakevenFields(form, prefix, breakevenOn);
  if (!breakeven.ok) {
    return breakeven;
  }
  const entryStack = stacked.present
    ? stacked.stack
    : legacyEntryStack(confirm.spec);
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
    breakevenActivationPct: breakeven.activationPct,
    breakevenOffsetPct: breakeven.offsetPct,
  };
}

export function conditionsFromRow(row: Record<string, unknown>): {
  indicator: DcaIndicatorStart | null;
  confirm: DcaFilterSpec | null;
  entryStack: EntryStack;
  exitIf: DcaFilterSpec | null;
  exitHard: HardExitSignal | null;
  exitStack: EntryStack;
  breakevenActivationPct: number | null;
  breakevenOffsetPct: number | null;
} {
  const activation = Number(row.breakeven_activation_pct);
  const offset = Number(row.breakeven_offset_pct);
  const stored = entryStackFromJson(row.entry_expr);
  const confirm = filterFromRow(row, "confirm");
  const entryStack = stored ?? legacyEntryStack(confirm);
  const exitHard = hardExitSignalFromJson(row.exit_hard);
  return {
    indicator: indicatorStartFromRow(row),
    confirm: stored ? confirmFromEntryStack(stored) : confirm,
    entryStack,
    exitIf: exitHard ? null : filterFromRow(row, "exit_if"),
    exitHard,
    exitStack: entryStackFromJson(row.exit_expr) ?? emptyEntryStack(),
    breakevenActivationPct: activation > 0 ? activation : null,
    breakevenOffsetPct: Number.isFinite(offset) && offset >= 0 ? offset : null,
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
    entry_expr: stack.leaves.length > 0 ? entryStackToJson(stack) : null,
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
  confirm?: DcaFilterSpec | null;
  entryStack?: EntryStack | null;
  exitIf?: DcaFilterSpec | null;
  exitStack?: EntryStack | null;
  shortEntry?: {
    entrySource: FuturesAutomationEntry;
    indicator?: DcaIndicatorStart | null;
    confirm?: DcaFilterSpec | null;
    entryStack?: EntryStack | null;
  } | null;
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
    const shortStack = resolveEntryStack(short.entryStack, short.confirm);
    for (const timeframe of entryStackTimeframes(shortStack)) {
      add(timeframe);
    }
  }
  add(rule.exitIf?.timeframe);
  for (const timeframe of entryStackTimeframes(rule.exitStack ?? emptyEntryStack())) {
    add(timeframe);
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
  shortEntry?: {
    indicator?: DcaIndicatorStart | null;
    confirm?: DcaFilterSpec | null;
    entryStack?: EntryStack | null;
  } | null;
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
    dcaFilterNeedsBars(rule.exitIf)
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
  side: FuturesSide;
  price: number | null;
  triggerCompare: "gte" | "lte";
  triggerPrice: number;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
  webhookId?: string | null;
  /** Undefined keeps a webhook trigger true. Null means this tick is not that webhook. */
  firedWebhookId?: string | null;
}): boolean {
  if (input.entrySource === "webhook") {
    if (input.firedWebhookId === undefined) {
      return true;
    }
    return (
      input.firedWebhookId != null && input.firedWebhookId === input.webhookId
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
    return input.firedWebhookId != null && input.firedWebhookId === leaf.webhookId;
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
    webhookId?: string | null;
    action?: FuturesAction;
    closeSide?: FuturesSide | null;
  };
  side: FuturesSide;
  price: number | null;
  prices?: { last: number | null; mark: number | null; index: number | null } | null;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
  firedWebhookId?: string | null;
}): boolean {
  const start = futuresStartMet({
    entrySource: input.rule.entrySource,
    indicator: input.rule.indicator,
    side: input.side,
    price: input.price,
    triggerCompare: input.rule.triggerCompare,
    triggerPrice: input.rule.triggerPrice,
    barsByTimeframe: input.barsByTimeframe,
    webhookId: input.rule.webhookId,
    firedWebhookId: input.firedWebhookId,
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
  return {
    kind,
    timeframe,
    compare,
    level,
    period,
    slowPeriod,
    multiplier,
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
        }
      : null,
    entryStack: entryStackToJson(leg.entryStack),
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
    source !== "webhook"
  ) {
    return null;
  }
  const webhookId = String(row.webhookId ?? "").trim() || null;
  if (source === "webhook" && !webhookId) {
    return null;
  }
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
  const stack =
    row.entryStack == null
      ? emptyEntryStack()
      : entryStackFromJson(row.entryStack);
  if (!stack) {
    return null;
  }
  return {
    entrySource: source,
    webhookId: source === "webhook" ? webhookId : null,
    triggerBy,
    triggerCompare,
    triggerPrice: triggerPrice > 0 ? triggerPrice : 1,
    skipIfOpen: row.skipIfOpen === true,
    indicator,
    confirm: confirmFromEntryStack(stack),
    entryStack: stack,
  };
}
