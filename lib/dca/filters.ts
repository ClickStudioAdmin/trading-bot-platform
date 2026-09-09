import type { FuturesSide } from "@/lib/futures/model";
import {
  DEFAULT_DCA_BB_PERIOD,
  DEFAULT_DCA_MA_PERIOD,
  DEFAULT_DCA_RSI_PERIOD,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DEFAULT_DCA_SUPERTREND_PERIOD,
  DCA_INDICATOR_TIMEFRAME_LABELS,
  dcaIndicatorWhenOptions,
  emaValues,
  indicatorStartMet,
  lastAtrValue,
  parseDcaIndicatorCompare,
  parseDcaIndicatorMultiplier,
  parseDcaIndicatorPeriod,
  parseDcaIndicatorTimeframe,
  type DcaIndicatorCompare,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
  type SupertrendBar,
} from "./indicators";

export const DCA_FILTER_KINDS = [
  "ema",
  "sma",
  "rsi",
  "bb",
  "atr_band",
  "supertrend",
] as const;
export type DcaFilterKind = (typeof DCA_FILTER_KINDS)[number];

export type DcaFilterSpec = {
  kind: DcaFilterKind;
  timeframe: DcaIndicatorTimeframe;
  compare: DcaIndicatorCompare;
  level: number | null;
  period: number | null;
  multiplier: number | null;
};

export const DCA_FILTER_KIND_OPTIONS: {
  value: DcaFilterKind;
  label: string;
}[] = [
  { value: "ema", label: "Price vs EMA" },
  { value: "sma", label: "Price vs SMA" },
  { value: "rsi", label: "RSI" },
  { value: "bb", label: "Price vs BB" },
  { value: "atr_band", label: "ATR band" },
  { value: "supertrend", label: "Supertrend" },
];

export const DEFAULT_DCA_ATR_BAND_MULT = 2;

export const DCA_CONFIRM_FIELD_LABEL =
  "Secondary Condition (must be true for the entry trigger to execute)";

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
  return DEFAULT_DCA_MA_PERIOD;
}

export function defaultDcaFilterCompare(
  kind: DcaFilterKind,
  side: FuturesSide,
): DcaIndicatorCompare {
  if (kind === "rsi") {
    return side === "short" ? "gte" : "lte";
  }
  if (kind === "supertrend") {
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
  return null;
}

export function defaultDcaFilterSpec(side: FuturesSide): DcaFilterSpec {
  return dcaFilterSpecForKind("ema", side);
}

export function dcaFilterSpecForKind(
  kind: DcaFilterKind,
  side: FuturesSide,
): DcaFilterSpec {
  return {
    kind,
    timeframe: "240",
    compare: defaultDcaFilterCompare(kind, side),
    level: defaultDcaFilterLevel(kind, side),
    period: defaultDcaFilterPeriod(kind),
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
  period: unknown;
  multiplier: unknown;
}): DcaFilterSpec | null {
  const kind = parseDcaFilterKind(input.kind);
  const timeframe = parseDcaIndicatorTimeframe(input.timeframe);
  if (!kind || !timeframe) {
    return null;
  }
  const compare =
    parseDcaIndicatorCompare(input.compare) ??
    defaultDcaFilterCompare(kind, "long");
  const period = parseDcaIndicatorPeriod(input.period);
  const multiplier = parseDcaIndicatorMultiplier(input.multiplier);
  const levelRaw =
    input.level == null || String(input.level).trim() === ""
      ? null
      : Number(input.level);
  const level =
    levelRaw != null && Number.isFinite(levelRaw) ? levelRaw : null;
  return {
    kind,
    timeframe,
    compare,
    level: kind === "rsi" ? level : null,
    period: period ?? defaultDcaFilterPeriod(kind),
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
    period: form.get(`${prefix}Period`),
    multiplier: form.get(`${prefix}Multiplier`),
  });
  if (!spec) {
    return { ok: false, error: `Enter a valid ${label} filter.` };
  }
  if (spec.kind === "rsi" && spec.level == null) {
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
    form.delete(`${prefix}Period`);
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
  if (spec.period != null) {
    form.set(`${prefix}Period`, String(spec.period));
  }
  if (spec.multiplier != null) {
    form.set(`${prefix}Multiplier`, String(spec.multiplier));
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

export function dcaFilterWhenOptions(kind: DcaFilterKind, side: FuturesSide) {
  if (kind === "atr_band") {
    return [
      { value: "gte", label: "Price is above upper band" },
      { value: "lte", label: "Price is below lower band" },
    ];
  }
  return dcaIndicatorWhenOptions(kind as DcaIndicatorKind, side, false);
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

export function atrBandMet(input: {
  bars: SupertrendBar[];
  period: number;
  multiplier: number;
  compare: DcaIndicatorCompare;
}): boolean | null {
  if (input.bars.length < input.period + 1 || !(input.multiplier > 0)) {
    return null;
  }
  const atr = lastAtrValue(input.bars, input.period);
  const mid = emaValues(
    input.bars.map((row) => row.close),
    input.period,
  ).at(-1);
  const price = input.bars.at(-1)?.close;
  if (atr == null || mid == null || price == null) {
    return null;
  }
  const upper = mid + atr * input.multiplier;
  const lower = mid - atr * input.multiplier;
  if (input.compare === "lte" || input.compare === "cross_lte") {
    return price <= lower;
  }
  return price >= upper;
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
  if (closes.length === 0 && bars.length === 0) {
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
    [`${prefix}_multiplier`]: spec?.multiplier ?? null,
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
    multiplier: row[`${prefix}_multiplier`],
  });
}
