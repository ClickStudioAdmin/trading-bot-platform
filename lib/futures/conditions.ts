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
import { closedLiveIndicatorBars } from "@/lib/market/desk-klines";
import type { CandleBar } from "@/lib/market/candles";
import {
  dcaPnlPct,
  dcaSeriesStartEval,
  parseDcaIndicatorStartFields,
  parseOptionalNonNegative,
  parseOptionalPositive,
  type DcaIndicatorStart,
} from "@/lib/dca/playbook";
import type { DcaIndicatorTimeframe, SupertrendBar } from "@/lib/dca/indicators";
import { dcaBreakevenPrice, dcaTighterStopPrice } from "@/lib/dca/grid";
import type { FuturesAction, FuturesSide } from "./model";

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
      exitIf: DcaFilterSpec | null;
      breakevenActivationPct: number | null;
      breakevenOffsetPct: number | null;
    }
  | { ok: false; error: string } {
  if (input.closing) {
    return {
      ok: true,
      indicator: null,
      confirm: null,
      exitIf: null,
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
  const confirm = parseDcaFilterForm(form, `${prefix}confirm`, false, "confirm");
  if (!confirm.ok) {
    return confirm;
  }
  const exitIf = parseDcaFilterForm(form, `${prefix}exitIf`, false, "Hard Exit");
  if (!exitIf.ok) {
    return exitIf;
  }
  const breakevenOn =
    String(form.get(`${prefix}breakevenActivationPct`) ?? "").trim() !== "";
  const breakeven = parseFuturesBreakevenFields(form, prefix, breakevenOn);
  if (!breakeven.ok) {
    return breakeven;
  }
  return {
    ok: true,
    indicator: indicator.start,
    confirm: confirm.spec,
    exitIf: exitIf.spec,
    breakevenActivationPct: breakeven.activationPct,
    breakevenOffsetPct: breakeven.offsetPct,
  };
}

export function conditionsFromRow(row: Record<string, unknown>): {
  indicator: DcaIndicatorStart | null;
  confirm: DcaFilterSpec | null;
  exitIf: DcaFilterSpec | null;
  breakevenActivationPct: number | null;
  breakevenOffsetPct: number | null;
} {
  const activation = Number(row.breakeven_activation_pct);
  const offset = Number(row.breakeven_offset_pct);
  return {
    indicator: indicatorStartFromRow(row),
    confirm: filterFromRow(row, "confirm"),
    exitIf: filterFromRow(row, "exit_if"),
    breakevenActivationPct: activation > 0 ? activation : null,
    breakevenOffsetPct: Number.isFinite(offset) && offset >= 0 ? offset : null,
  };
}

export function conditionColumns(rule: {
  indicator?: DcaIndicatorStart | null;
  confirm?: DcaFilterSpec | null;
  exitIf?: DcaFilterSpec | null;
  breakevenActivationPct?: number | null;
  breakevenOffsetPct?: number | null;
}): Record<string, unknown> {
  return {
    ...indicatorColumns(rule.indicator),
    ...filterColumns("confirm", rule.confirm),
    ...filterColumns("exit_if", rule.exitIf),
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
    exitIf?: DcaFilterSpec | null;
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
  writeDcaFilterFormFields(form, `${prefix}confirm`, rule.confirm);
  writeDcaFilterFormFields(form, `${prefix}exitIf`, rule.exitIf);
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
  exitIf?: DcaFilterSpec | null;
}): DcaIndicatorTimeframe[] {
  const rows: DcaIndicatorTimeframe[] = [];
  if (
    (rule.entrySource === "indicator" || rule.entrySource === "trend") &&
    rule.indicator &&
    !rows.includes(rule.indicator.timeframe)
  ) {
    rows.push(rule.indicator.timeframe);
  }
  for (const spec of [rule.confirm, rule.exitIf]) {
    if (spec && !rows.includes(spec.timeframe)) {
      rows.push(spec.timeframe);
    }
  }
  return rows;
}

export function futuresAutomationNeedsBars(rule: {
  entrySource: FuturesAutomationEntry;
  indicator?: DcaIndicatorStart | null;
  confirm?: DcaFilterSpec | null;
  exitIf?: DcaFilterSpec | null;
}): boolean {
  return futuresAutomationTimeframes(rule).length > 0;
}

export function futuresAutomationNeedsWideBars(rule: {
  entrySource: FuturesAutomationEntry;
  indicator?: DcaIndicatorStart | null;
  confirm?: DcaFilterSpec | null;
  exitIf?: DcaFilterSpec | null;
}): boolean {
  return (
    rule.indicator?.kind === "supertrend" ||
    dcaFilterNeedsBars(rule.confirm) ||
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
}): boolean {
  if (input.entrySource === "webhook") {
    return true;
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

export function futuresEntryConditionMet(input: {
  rule: {
    entrySource: FuturesAutomationEntry;
    indicator?: DcaIndicatorStart | null;
    confirm?: DcaFilterSpec | null;
    triggerCompare: "gte" | "lte";
    triggerPrice: number;
    action?: FuturesAction;
    closeSide?: FuturesSide | null;
  };
  side: FuturesSide;
  price: number | null;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
}): boolean {
  const start = futuresStartMet({
    entrySource: input.rule.entrySource,
    indicator: input.rule.indicator,
    side: input.side,
    price: input.price,
    triggerCompare: input.rule.triggerCompare,
    triggerPrice: input.rule.triggerPrice,
    barsByTimeframe: input.barsByTimeframe,
  });
  if (!start) {
    return false;
  }
  return futuresFilterMet({
    spec: input.rule.confirm,
    side: input.side,
    barsByTimeframe: input.barsByTimeframe,
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
