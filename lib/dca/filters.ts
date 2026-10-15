import type { FuturesSide } from "@/lib/futures/model";
import {
  DEFAULT_DCA_ATR_BAND_MULT,
  DEFAULT_DCA_BB_PERIOD,
  DEFAULT_DCA_CROSS_FAST_PERIOD,
  DEFAULT_DCA_CROSS_SLOW_PERIOD,
  DEFAULT_DCA_MA_PERIOD,
  DEFAULT_DCA_RSI_PERIOD,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DEFAULT_DCA_SUPERTREND_PERIOD,
  DCA_INDICATOR_TIMEFRAME_LABELS,
  atrBandMet,
  bollingerBands,
  formatDcaIndicatorStartLabel,
  indicatorStartMet,
  rsiValue,
  parseDcaIndicatorMultiplier,
  parseDcaIndicatorPeriod,
  parseDcaIndicatorTimeframe,
  type DcaIndicatorCompare,
  type DcaIndicatorTimeframe,
  type SupertrendBar,
} from "./indicators";

export { atrBandMet, DEFAULT_DCA_ATR_BAND_MULT };

export const DCA_FILTER_KINDS = [
  "rsi",
  "macd",
  "sma",
  "ema",
  "sma_cross",
  "ema_cross",
  "bb",
  "atr_band",
  "supertrend",
] as const;
export type DcaFilterKind = (typeof DCA_FILTER_KINDS)[number];
export const DCA_FILTER_COMPARES = [
  "gte",
  "lte",
  "inside",
  "between",
  "cross_gte",
  "cross_lte",
] as const;
export type DcaFilterCompare = (typeof DCA_FILTER_COMPARES)[number];

export type DcaFilterSpec = {
  kind: DcaFilterKind;
  timeframe: DcaIndicatorTimeframe;
  compare: DcaFilterCompare;
  level: number | null;
  levelTo?: number | null;
  period: number | null;
  slowPeriod?: number | null;
  multiplier: number | null;
};

export const DCA_FILTER_KIND_OPTIONS: {
  value: DcaFilterKind;
  label: string;
}[] = [
  { value: "rsi", label: "RSI" },
  { value: "macd", label: "MACD" },
  { value: "sma", label: "Price vs SMA" },
  { value: "ema", label: "Price vs EMA" },
  { value: "sma_cross", label: "SMA Cross" },
  { value: "ema_cross", label: "EMA Cross" },
  { value: "bb", label: "Price vs BB" },
  { value: "atr_band", label: "ATR band" },
  { value: "supertrend", label: "Supertrend" },
];

export const DCA_CONFIRM_FIELD_LABEL =
  "Secondary Condition (must be true for the entry trigger to execute)";

export function dcaFilterComplete(
  spec: DcaFilterSpec | null | undefined,
): boolean {
  if (!spec) {
    return false;
  }
  if (spec.kind === "macd") {
    return spec.level != null && Number.isFinite(spec.level);
  }
  if (spec.kind === "ema_cross" || spec.kind === "sma_cross") {
    return (
      spec.period != null &&
      spec.slowPeriod != null &&
      spec.period > 0 &&
      spec.slowPeriod > 0 &&
      spec.period !== spec.slowPeriod
    );
  }
  if (spec.kind === "rsi") {
    if (spec.level == null) {
      return false;
    }
    if (spec.compare === "between") {
      return spec.levelTo != null && spec.level < spec.levelTo;
    }
  }
  return spec.period != null && spec.period > 0;
}

export function parseDcaFilterKind(value: unknown): DcaFilterKind | null {
  const raw = String(value ?? "").trim();
  return (DCA_FILTER_KINDS as readonly string[]).includes(raw)
    ? (raw as DcaFilterKind)
    : null;
}

export function defaultDcaFilterPeriod(kind: DcaFilterKind): number {
  if (kind === "rsi") {
    return DEFAULT_DCA_RSI_PERIOD;
  }
  if (kind === "bb") {
    return DEFAULT_DCA_BB_PERIOD;
  }
  if (kind === "supertrend" || kind === "atr_band") {
    return DEFAULT_DCA_SUPERTREND_PERIOD;
  }
  if (kind === "ema_cross" || kind === "sma_cross") {
    return DEFAULT_DCA_CROSS_FAST_PERIOD;
  }
  if (kind === "macd") {
    return DEFAULT_DCA_MA_PERIOD;
  }
  return DEFAULT_DCA_MA_PERIOD;
}

export function sitDcaFilterCompare(
  compare: DcaIndicatorCompare | null | undefined,
): "gte" | "lte" {
  return compare === "lte" || compare === "cross_lte" ? "lte" : "gte";
}

export function parseDcaFilterCompare(value: unknown): DcaFilterCompare | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (
    raw === "inside" ||
    raw === "between" ||
    raw === "cross_gte" ||
    raw === "cross_lte" ||
    raw === "gte" ||
    raw === "lte"
  ) {
    return raw;
  }
  return null;
}

function filterCompareForKind(
  kind: DcaFilterKind,
  compare: DcaFilterCompare,
  side: FuturesSide,
): DcaFilterCompare {
  if (kind === "macd") {
    if (
      compare === "gte" ||
      compare === "lte" ||
      compare === "cross_gte" ||
      compare === "cross_lte"
    ) {
      return compare;
    }
    return defaultDcaFilterCompare(kind, side);
  }
  if (kind === "ema_cross" || kind === "sma_cross") {
    return compare === "cross_lte" ? "cross_lte" : "cross_gte";
  }
  if (kind === "atr_band") {
    if (compare === "gte" || compare === "lte" || compare === "inside") {
      return compare;
    }
    return defaultDcaFilterCompare(kind, side);
  }
  if (compare === "inside" && kind !== "bb") {
    return defaultDcaFilterCompare(kind, side);
  }
  if (compare === "between" && kind !== "rsi") {
    return defaultDcaFilterCompare(kind, side);
  }
  if (compare === "cross_gte") {
    return "gte";
  }
  if (compare === "cross_lte") {
    return "lte";
  }
  return compare;
}

export function defaultDcaFilterCompare(
  kind: DcaFilterKind,
  side: FuturesSide,
): DcaFilterCompare {
  if (kind === "macd" || kind === "ema_cross" || kind === "sma_cross") {
    return side === "short" ? "cross_lte" : "cross_gte";
  }
  if (kind === "rsi") {
    return side === "short" ? "gte" : "lte";
  }
  if (kind === "supertrend" || kind === "atr_band") {
    return side === "short" ? "lte" : "gte";
  }
  return side === "short" ? "lte" : "gte";
}

export function defaultDcaFilterLevel(
  kind: DcaFilterKind,
  side: FuturesSide,
): number | null {
  if (kind === "rsi") {
    return side === "short" ? 70 : 30;
  }
  if (kind === "macd") {
    return 0;
  }
  return null;
}

export function defaultDcaFilterSpec(side: FuturesSide): DcaFilterSpec {
  return dcaFilterSpecForKind("ema", side);
}

export function dcaFilterSpecForKind(
  kind: DcaFilterKind,
  side: FuturesSide,
): DcaFilterSpec {
  const pair = kind === "ema_cross" || kind === "sma_cross";
  return {
    kind,
    timeframe: "240",
    compare: defaultDcaFilterCompare(kind, side),
    level: defaultDcaFilterLevel(kind, side),
    levelTo: null,
    period:
      kind === "macd"
        ? null
        : pair
          ? DEFAULT_DCA_CROSS_FAST_PERIOD
          : defaultDcaFilterPeriod(kind),
    slowPeriod: pair ? DEFAULT_DCA_CROSS_SLOW_PERIOD : null,
    multiplier:
      kind === "supertrend"
        ? DEFAULT_DCA_SUPERTREND_MULTIPLIER
        : kind === "atr_band"
          ? DEFAULT_DCA_ATR_BAND_MULT
          : null,
  };
}

export function parseDcaFilterSpec(input: {
  kind: unknown;
  timeframe: unknown;
  compare: unknown;
  level: unknown;
  levelTo?: unknown;
  period: unknown;
  slowPeriod?: unknown;
  multiplier: unknown;
}): DcaFilterSpec | null {
  const kind = parseDcaFilterKind(input.kind);
  const timeframe = parseDcaIndicatorTimeframe(input.timeframe);
  if (!kind || !timeframe) {
    return null;
  }
  const posted =
    parseDcaFilterCompare(input.compare) ?? defaultDcaFilterCompare(kind, "long");
  const compare = filterCompareForKind(kind, posted, "long");
  const pair = kind === "ema_cross" || kind === "sma_cross";
  const period = parseDcaIndicatorPeriod(input.period);
  const slowPeriod = parseDcaIndicatorPeriod(input.slowPeriod);
  const multiplier = parseDcaIndicatorMultiplier(input.multiplier);
  const levelRaw =
    input.level == null || String(input.level).trim() === ""
      ? null
      : Number(input.level);
  const level =
    levelRaw != null && Number.isFinite(levelRaw) ? levelRaw : null;
  const storedHigh =
    input.levelTo == null || String(input.levelTo).trim() === ""
      ? input.multiplier
      : input.levelTo;
  const levelToRaw =
    storedHigh == null || String(storedHigh).trim() === ""
      ? null
      : Number(storedHigh);
  const levelTo =
    levelToRaw != null && Number.isFinite(levelToRaw) ? levelToRaw : null;
  return {
    kind,
    timeframe,
    compare,
    level:
      kind === "rsi"
        ? level
        : kind === "macd"
          ? (level ?? 0)
          : null,
    levelTo: kind === "rsi" && compare === "between" ? levelTo : null,
    period:
      kind === "macd"
        ? null
        : pair
          ? (period ?? DEFAULT_DCA_CROSS_FAST_PERIOD)
          : (period ?? defaultDcaFilterPeriod(kind)),
    slowPeriod: pair ? (slowPeriod ?? DEFAULT_DCA_CROSS_SLOW_PERIOD) : null,
    multiplier:
      kind === "supertrend"
        ? (multiplier ?? DEFAULT_DCA_SUPERTREND_MULTIPLIER)
        : kind === "atr_band"
          ? (multiplier ?? DEFAULT_DCA_ATR_BAND_MULT)
          : null,
  };
}

export function parseDcaFilterForm(
  form: FormData,
  prefix: string,
  required: boolean,
  label: string,
): { ok: true; spec: DcaFilterSpec | null } | { ok: false; error: string } {
  const kindRaw = String(form.get(`${prefix}Kind`) ?? "").trim();
  if (!kindRaw) {
    if (required) {
      return { ok: false, error: `Choose a ${label} filter.` };
    }
    return { ok: true, spec: null };
  }
  const spec = parseDcaFilterSpec({
    kind: kindRaw,
    timeframe: form.get(`${prefix}Timeframe`),
    compare: form.get(`${prefix}Compare`),
    level: form.get(`${prefix}Level`),
    levelTo: form.get(`${prefix}LevelTo`),
    period: form.get(`${prefix}Period`),
    slowPeriod: form.get(`${prefix}SlowPeriod`),
    multiplier: form.get(`${prefix}Multiplier`),
  });
  if (!spec) {
    return { ok: false, error: `Enter a valid ${label} filter.` };
  }
  if (spec.kind === "rsi" && spec.compare === "between") {
    if (spec.level == null || spec.levelTo == null) {
      return { ok: false, error: `Enter both RSI levels for ${label}.` };
    }
    if (!(spec.level < spec.levelTo)) {
      return { ok: false, error: `RSI from must be below RSI to for ${label}.` };
    }
  } else if (spec.kind === "rsi" && spec.level == null) {
    return { ok: false, error: `Enter an RSI level for ${label}.` };
  }
  return { ok: true, spec };
}

export function writeDcaFilterFormFields(
  form: FormData,
  prefix: string,
  spec: DcaFilterSpec | null | undefined,
): void {
  if (!spec) {
    form.delete(`${prefix}Kind`);
    form.delete(`${prefix}Timeframe`);
    form.delete(`${prefix}Compare`);
    form.delete(`${prefix}Level`);
    form.delete(`${prefix}LevelTo`);
    form.delete(`${prefix}Period`);
    form.delete(`${prefix}SlowPeriod`);
    form.delete(`${prefix}Multiplier`);
    return;
  }
  form.set(`${prefix}Kind`, spec.kind);
  form.set(`${prefix}Timeframe`, spec.timeframe);
  form.set(`${prefix}Compare`, spec.compare);
  if (spec.level != null) {
    form.set(`${prefix}Level`, String(spec.level));
  } else {
    form.delete(`${prefix}Level`);
  }
  if (spec.kind === "rsi" && spec.compare === "between" && spec.levelTo != null) {
    form.set(`${prefix}LevelTo`, String(spec.levelTo));
  } else {
    form.delete(`${prefix}LevelTo`);
  }
  if (spec.period != null) {
    form.set(`${prefix}Period`, String(spec.period));
  } else {
    form.delete(`${prefix}Period`);
  }
  if (spec.slowPeriod != null) {
    form.set(`${prefix}SlowPeriod`, String(spec.slowPeriod));
  } else {
    form.delete(`${prefix}SlowPeriod`);
  }
  if (spec.multiplier != null) {
    form.set(`${prefix}Multiplier`, String(spec.multiplier));
  } else {
    form.delete(`${prefix}Multiplier`);
  }
}

export function dcaFilterForSide(
  playbook: {
    confirm?: DcaFilterSpec | null;
    shortConfirm?: DcaFilterSpec | null;
    exitIf?: DcaFilterSpec | null;
    shortExitIf?: DcaFilterSpec | null;
  },
  side: FuturesSide,
  which: "confirm" | "exitIf",
): DcaFilterSpec | null {
  if (which === "confirm") {
    if (side === "short" && playbook.shortConfirm) {
      return playbook.shortConfirm;
    }
    return playbook.confirm ?? null;
  }
  if (side === "short" && playbook.shortExitIf) {
    return playbook.shortExitIf;
  }
  return playbook.exitIf ?? null;
}

export function dcaFilterTimeframes(playbook: {
  confirm?: DcaFilterSpec | null;
  shortConfirm?: DcaFilterSpec | null;
  exitIf?: DcaFilterSpec | null;
  shortExitIf?: DcaFilterSpec | null;
}): DcaIndicatorTimeframe[] {
  const rows: DcaIndicatorTimeframe[] = [];
  for (const spec of [
    playbook.confirm,
    playbook.shortConfirm,
    playbook.exitIf,
    playbook.shortExitIf,
  ]) {
    if (spec && !rows.includes(spec.timeframe)) {
      rows.push(spec.timeframe);
    }
  }
  return rows;
}

export function dcaFilterNeedsBars(spec: DcaFilterSpec | null | undefined): boolean {
  return spec != null && (spec.kind === "supertrend" || spec.kind === "atr_band");
}

export function dcaPlaybookFilterNeedsWideBars(playbook: {
  confirm?: DcaFilterSpec | null;
  shortConfirm?: DcaFilterSpec | null;
  exitIf?: DcaFilterSpec | null;
  shortExitIf?: DcaFilterSpec | null;
}): boolean {
  return (
    dcaFilterNeedsBars(playbook.confirm) ||
    dcaFilterNeedsBars(playbook.shortConfirm) ||
    dcaFilterNeedsBars(playbook.exitIf) ||
    dcaFilterNeedsBars(playbook.shortExitIf)
  );
}

export function seriesForFilter(
  spec: DcaFilterSpec | null | undefined,
  bars: SupertrendBar[] | null | undefined,
): { closes: number[] | null; bars: SupertrendBar[] | null } {
  if (!spec || !bars || bars.length === 0) {
    return { closes: null, bars: null };
  }
  return {
    closes: bars.map((row) => row.close),
    bars,
  };
}

export function dcaFilterWhenOptions(kind: DcaFilterKind, _side?: FuturesSide) {
  if (kind === "macd") {
    return [
      { value: "cross_gte", label: "Crosses above" },
      { value: "cross_lte", label: "Crosses below" },
      { value: "gte", label: "Is above" },
      { value: "lte", label: "Is below" },
    ];
  }
  if (kind === "ema_cross" || kind === "sma_cross") {
    return [
      { value: "cross_gte", label: "Crosses above" },
      { value: "cross_lte", label: "Crosses below" },
    ];
  }
  if (kind === "rsi") {
    return [
      { value: "lte", label: "At or below" },
      { value: "gte", label: "At or above" },
      { value: "between", label: "Between" },
    ];
  }
  if (kind === "bb") {
    return [
      { value: "gte", label: "Price is above top" },
      { value: "lte", label: "Price is below bottom" },
      { value: "inside", label: "Price is inside" },
    ];
  }
  if (kind === "supertrend") {
    return [
      { value: "gte", label: "Is bullish" },
      { value: "lte", label: "Is bearish" },
    ];
  }
  if (kind === "atr_band") {
    return [
      { value: "gte", label: "Price is above upper band" },
      { value: "lte", label: "Price is below lower band" },
      { value: "inside", label: "Price is inside" },
    ];
  }
  return [
    { value: "gte", label: "Price is above" },
    { value: "lte", label: "Price is below" },
  ];
}

export function dcaFilterWhenValue(
  compare: DcaFilterCompare | DcaIndicatorCompare | null | undefined,
): DcaFilterCompare {
  if (
    compare === "inside" ||
    compare === "between" ||
    compare === "cross_gte" ||
    compare === "cross_lte" ||
    compare === "gte" ||
    compare === "lte"
  ) {
    return compare;
  }
  return sitDcaFilterCompare(compare);
}

export function dcaFilterLabel(spec: DcaFilterSpec | null | undefined): string {
  if (!spec) {
    return "Off";
  }
  const kind =
    DCA_FILTER_KIND_OPTIONS.find((row) => row.value === spec.kind)?.label ??
    spec.kind;
  const timeframe =
    DCA_INDICATOR_TIMEFRAME_LABELS[spec.timeframe] ?? spec.timeframe;
  return `${kind} · ${timeframe}`;
}

export function formatDcaFilterReason(
  spec: DcaFilterSpec,
  _side: FuturesSide = "long",
): string {
  const timeframe =
    DCA_INDICATOR_TIMEFRAME_LABELS[spec.timeframe] ?? spec.timeframe;
  const suffix = ` · ${timeframe}`;
  const period = spec.period ?? defaultDcaFilterPeriod(spec.kind);
  if (spec.kind === "rsi") {
    if (
      spec.compare === "between" &&
      spec.level != null &&
      spec.levelTo != null
    ) {
      return `RSI ${period} between ${spec.level} and ${spec.levelTo}${suffix}`;
    }
    const when = spec.compare === "gte" ? "at or above" : "at or below";
    const level = spec.level != null ? ` ${spec.level}` : "";
    return `RSI ${period} ${when}${level}${suffix}`;
  }
  if (spec.kind === "supertrend") {
    const multiplier = spec.multiplier ?? DEFAULT_DCA_SUPERTREND_MULTIPLIER;
    const when = spec.compare === "lte" ? "is bearish" : "is bullish";
    return `Supertrend ${period} × ${multiplier} ${when}${suffix}`;
  }
  if (spec.kind === "bb") {
    const when =
      spec.compare === "inside"
        ? "Price is inside BB"
        : spec.compare === "lte"
          ? "Price is below bottom BB"
          : "Price is above top BB";
    return `${when} ${period}${suffix}`;
  }
  if (spec.kind === "atr_band") {
    const multiplier = spec.multiplier ?? DEFAULT_DCA_ATR_BAND_MULT;
    const when =
      spec.compare === "inside"
        ? "Price is inside ATR band"
        : spec.compare === "lte"
          ? "Price is below lower ATR band"
          : "Price is above upper ATR band";
    return `${when} ${period} × ${multiplier}${suffix}`;
  }
  if (
    spec.kind === "macd" ||
    spec.kind === "ema_cross" ||
    spec.kind === "sma_cross"
  ) {
    return formatDcaIndicatorStartLabel({
      kind: spec.kind,
      compare: spec.compare,
      level: spec.level,
      period: spec.period,
      slowPeriod: spec.slowPeriod,
      timeframe: spec.timeframe,
      side: _side,
    });
  }
  const name = spec.kind === "sma" ? "SMA" : "EMA";
  const when =
    spec.compare === "lte" ? "Price is below" : "Price is above";
  return `${when} ${name} ${period}${suffix}`;
}

export function dcaFilterSummaryLine(
  label: string,
  longSpec: DcaFilterSpec | null | undefined,
  shortSpec?: DcaFilterSpec | null,
  both = false,
): string | null {
  if (!longSpec && !shortSpec) {
    return null;
  }
  if (both && longSpec && shortSpec) {
    return `${label}: ${dcaFilterLabel(longSpec)} / ${dcaFilterLabel(shortSpec)}`;
  }
  if (both && shortSpec && !longSpec) {
    return `Short ${label}: ${dcaFilterLabel(shortSpec)}`;
  }
  if (!longSpec) {
    return null;
  }
  return `${label}: ${dcaFilterLabel(longSpec)}`;
}

export function dcaFilterMet(input: {
  spec: DcaFilterSpec | null | undefined;
  side: FuturesSide;
  closes: number[] | null | undefined;
  bars: SupertrendBar[] | null | undefined;
}): boolean {
  const spec = input.spec;
  if (!spec) {
    return true;
  }
  const closes = input.closes ?? [];
  const bars = input.bars ?? [];
  if (spec.kind === "atr_band") {
    return (
      atrBandMet({
        bars,
        period: spec.period ?? defaultDcaFilterPeriod("atr_band"),
        multiplier: spec.multiplier ?? DEFAULT_DCA_ATR_BAND_MULT,
        compare: spec.compare,
      }) === true
    );
  }
  if (
    spec.kind === "macd" ||
    spec.kind === "ema_cross" ||
    spec.kind === "sma_cross"
  ) {
    const compare =
      spec.compare === "gte" ||
      spec.compare === "lte" ||
      spec.compare === "cross_gte" ||
      spec.compare === "cross_lte"
        ? spec.compare
        : "cross_gte";
    return (
      indicatorStartMet({
        kind: spec.kind,
        side: input.side,
        closes,
        bars,
        compare,
        level: spec.kind === "macd" ? spec.level : null,
        period: spec.period,
        slowPeriod: spec.slowPeriod,
        splitBySide: false,
      }) === true
    );
  }
  if (closes.length === 0 && bars.length === 0) {
    return false;
  }
  if (spec.kind === "bb" && spec.compare === "inside") {
    const bands = bollingerBands(
      closes,
      spec.period ?? defaultDcaFilterPeriod("bb"),
    );
    const price = closes.at(-1);
    return Boolean(
      bands &&
        price != null &&
        price >= bands.lower &&
        price <= bands.upper,
    );
  }
  if (spec.kind === "rsi" && spec.compare === "between") {
    const rsi = rsiValue(closes, spec.period ?? defaultDcaFilterPeriod("rsi"));
    const from = spec.level;
    const to = spec.levelTo;
    return (
      rsi != null &&
      from != null &&
      to != null &&
      rsi >= from &&
      rsi <= to
    );
  }
  if (spec.compare === "inside" || spec.compare === "between") {
    return false;
  }
  return (
    indicatorStartMet({
      kind: spec.kind,
      side: input.side,
      closes,
      bars,
      compare: spec.compare,
      level: spec.level,
      period: spec.period,
      multiplier: spec.multiplier,
      splitBySide: false,
    }) === true
  );
}

export function filterColumns(
  prefix: "confirm" | "short_confirm" | "exit_if" | "short_exit_if",
  spec: DcaFilterSpec | null | undefined,
): Record<string, unknown> {
  return {
    [`${prefix}_kind`]: spec?.kind ?? null,
    [`${prefix}_timeframe`]: spec?.timeframe ?? null,
    [`${prefix}_compare`]: spec?.compare ?? null,
    [`${prefix}_level`]: spec?.level ?? null,
    [`${prefix}_period`]: spec?.period ?? null,
    [`${prefix}_slow_period`]: spec?.slowPeriod ?? null,
    [`${prefix}_multiplier`]:
      spec?.kind === "rsi" && spec.compare === "between"
        ? (spec.levelTo ?? null)
        : (spec?.multiplier ?? null),
  };
}

export function filterFromRow(
  row: Record<string, unknown>,
  prefix: "confirm" | "short_confirm" | "exit_if" | "short_exit_if",
): DcaFilterSpec | null {
  return parseDcaFilterSpec({
    kind: row[`${prefix}_kind`],
    timeframe: row[`${prefix}_timeframe`],
    compare: row[`${prefix}_compare`],
    level: row[`${prefix}_level`],
    period: row[`${prefix}_period`],
    slowPeriod: row[`${prefix}_slow_period`],
    multiplier: row[`${prefix}_multiplier`],
  });
}
