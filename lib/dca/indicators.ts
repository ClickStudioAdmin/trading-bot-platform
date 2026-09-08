import type { FuturesSide } from "@/lib/futures/model";

export type DcaIndicatorKind =
  | "rsi"
  | "macd"
  | "ema_cross"
  | "ema"
  | "sma"
  | "sma_cross"
  | "bb";
export type DcaIndicatorCompare = "gte" | "lte" | "cross_gte" | "cross_lte";
export const DEFAULT_DCA_MA_PERIOD = 21;
export const DEFAULT_DCA_CROSS_FAST_PERIOD = 9;
export const DEFAULT_DCA_CROSS_SLOW_PERIOD = 21;
export const DEFAULT_DCA_BB_PERIOD = 20;
export const DCA_BB_STDDEV = 2;
export const DCA_INDICATOR_PERIOD_MIN = 2;
export const DCA_INDICATOR_PERIOD_MAX = 400;
export const DCA_INDICATOR_TIMEFRAMES = [
  "5",
  "15",
  "30",
  "60",
  "120",
  "240",
  "360",
  "720",
  "D",
] as const;
export type DcaIndicatorTimeframe = (typeof DCA_INDICATOR_TIMEFRAMES)[number];
export const DCA_INDICATOR_TIMEFRAME_LABELS: Record<
  DcaIndicatorTimeframe,
  string
> = {
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1h",
  "120": "2h",
  "240": "4h",
  "360": "6h",
  "720": "12h",
  D: "Daily",
};

export function parseDcaIndicatorTimeframe(
  value: unknown,
): DcaIndicatorTimeframe | null {
  const raw = String(value ?? "").trim();
  return (DCA_INDICATOR_TIMEFRAMES as readonly string[]).includes(raw)
    ? (raw as DcaIndicatorTimeframe)
    : null;
}

export function parseDcaIndicatorCompare(
  value: unknown,
): DcaIndicatorCompare | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "gte" || raw === "lte" || raw === "cross_gte" || raw === "cross_lte") {
    return raw;
  }
  return null;
}

export function parseDcaIndicatorPeriod(value: unknown): number | null {
  if (value == null || String(value).trim() === "") {
    return null;
  }
  const period = Math.trunc(Number(value));
  if (
    !Number.isFinite(period) ||
    period < DCA_INDICATOR_PERIOD_MIN ||
    period > DCA_INDICATOR_PERIOD_MAX
  ) {
    return null;
  }
  return period;
}

export function dcaIndicatorUsesPeriod(kind: DcaIndicatorKind): boolean {
  return kind === "ema" || kind === "sma" || kind === "bb";
}

export function dcaIndicatorUsesPairPeriods(kind: DcaIndicatorKind): boolean {
  return kind === "ema_cross" || kind === "sma_cross";
}

export function defaultDcaIndicatorPeriod(kind: DcaIndicatorKind): number {
  if (kind === "bb") {
    return DEFAULT_DCA_BB_PERIOD;
  }
  if (dcaIndicatorUsesPairPeriods(kind)) {
    return DEFAULT_DCA_CROSS_FAST_PERIOD;
  }
  return DEFAULT_DCA_MA_PERIOD;
}

export function defaultDcaIndicatorSlowPeriod(
  kind: DcaIndicatorKind,
): number | null {
  return dcaIndicatorUsesPairPeriods(kind)
    ? DEFAULT_DCA_CROSS_SLOW_PERIOD
    : null;
}

export function dcaPairCrossPeriods(
  period: number | null | undefined,
  slowPeriod: number | null | undefined,
): { fast: number; slow: number } {
  return {
    fast: period ?? DEFAULT_DCA_CROSS_FAST_PERIOD,
    slow: slowPeriod ?? DEFAULT_DCA_CROSS_SLOW_PERIOD,
  };
}

export function dcaIndicatorHasLevel(
  level: string | number | null | undefined,
): boolean {
  if (level == null || level === "") {
    return false;
  }
  const n = typeof level === "number" ? level : Number(String(level).replace(/,/g, ""));
  return Number.isFinite(n) && n > 0;
}

export function dcaIndicatorIsLegacyEmaPrice(
  kind: DcaIndicatorKind,
  compare: string | null | undefined,
  level?: string | number | null,
): boolean {
  if (kind !== "ema_cross") {
    return false;
  }
  if (compare === "legacy") {
    return true;
  }
  return (
    (compare === "cross_gte" || compare === "cross_lte") &&
    dcaIndicatorHasLevel(level)
  );
}

export function dcaIndicatorShowsLevel(
  kind: DcaIndicatorKind,
  compare: string | null | undefined,
  level?: string | number | null,
): boolean {
  if (kind === "rsi" || kind === "macd") {
    return true;
  }
  return dcaIndicatorIsLegacyEmaPrice(kind, compare, level);
}

export function defaultDcaIndicatorLevel(
  kind: DcaIndicatorKind,
): number | null {
  if (kind === "rsi") {
    return 30;
  }
  if (kind === "macd") {
    return 0;
  }
  return null;
}

export function macdHistogramLevel(level: number | null | undefined): number {
  return level == null || !Number.isFinite(level) ? 0 : level;
}

export function dcaIndicatorWhenOptions(
  kind: DcaIndicatorKind,
  _side: "long" | "short",
  includeLegacyEmaPrice: boolean,
): { value: string; label: string }[] {
  if (kind === "rsi") {
    return [
      { value: "cross_lte", label: "Crosses below" },
      { value: "lte", label: "At or below" },
      { value: "cross_gte", label: "Crosses above" },
      { value: "gte", label: "At or above" },
    ];
  }
  if (kind === "macd") {
    return [
      { value: "cross_gte", label: "Crosses above" },
      { value: "cross_lte", label: "Crosses below" },
      { value: "gte", label: "Is above" },
      { value: "lte", label: "Is below" },
    ];
  }
  if (kind === "ema" || kind === "sma") {
    return [
      { value: "cross_gte", label: "Crosses above" },
      { value: "cross_lte", label: "Crosses below" },
    ];
  }
  if (kind === "bb") {
    return [
      { value: "gte", label: "Above top BB" },
      { value: "lte", label: "Below bottom BB" },
    ];
  }
  if (kind === "ema_cross" || kind === "sma_cross") {
    const options = [
      { value: "cross_gte", label: "Crosses above" },
      { value: "cross_lte", label: "Crosses below" },
    ];
    if (kind === "ema_cross" && includeLegacyEmaPrice) {
      options.push({ value: "legacy", label: "EMA 21 crosses" });
    }
    return options;
  }
  return [];
}

export function dcaIndicatorWhenValue(
  kind: DcaIndicatorKind,
  side: "long" | "short",
  compare: string | null | undefined,
  level?: string | number | null,
): string {
  if (dcaIndicatorIsLegacyEmaPrice(kind, compare, level)) {
    return "legacy";
  }
  return indicatorCompareForDirection(side, kind, compare ?? "");
}

export function formatDcaIndicatorStartLabel(input: {
  kind: DcaIndicatorKind | null | undefined;
  compare: string | null | undefined;
  level?: number | null;
  period?: number | null;
  slowPeriod?: number | null;
  timeframe?: DcaIndicatorTimeframe | null;
  side: "long" | "short";
}): string {
  const timeframe = input.timeframe
    ? ` · ${DCA_INDICATOR_TIMEFRAME_LABELS[input.timeframe] ?? input.timeframe}`
    : "";
  if (input.kind === "macd") {
    const level = macdHistogramLevel(input.level);
    const when =
      input.compare === "lte"
        ? `histogram is below ${level}`
        : input.compare === "gte"
          ? `histogram is above ${level}`
          : input.compare === "cross_lte"
            ? `histogram crosses below ${level}`
            : `histogram crosses above ${level}`;
    return `MACD ${when}${timeframe}`;
  }
  if (input.kind === "bb") {
    const period = input.period ?? DEFAULT_DCA_BB_PERIOD;
    const when =
      input.compare === "lte" ? "Below bottom BB" : "Above top BB";
    return `${when} ${period}${timeframe}`;
  }
  if (input.kind === "ema" || input.kind === "sma") {
    const name = input.kind === "sma" ? "SMA" : "EMA";
    const period = input.period ?? DEFAULT_DCA_MA_PERIOD;
    const when =
      input.compare === "cross_lte"
        ? "Price crosses below"
        : "Price crosses above";
    return `${when} ${name} ${period}${timeframe}`;
  }
  if (input.kind === "ema_cross" || input.kind === "sma_cross") {
    const name = input.kind === "sma_cross" ? "SMA" : "EMA";
    if (dcaIndicatorIsLegacyEmaPrice(input.kind, input.compare, input.level)) {
      const level = input.level != null ? ` ${input.level}` : "";
      return `EMA 21 crosses${level}${timeframe}`;
    }
    const { fast, slow } = dcaPairCrossPeriods(input.period, input.slowPeriod);
    if (
      input.compare === "cross_lte" ||
      ((input.compare === "pair" ||
        input.compare == null ||
        input.compare === "") &&
        input.side === "short")
    ) {
      return `${name} ${fast} crosses below ${slow}${timeframe}`;
    }
    return `${name} ${fast} crosses above ${slow}${timeframe}`;
  }
  if (input.kind === "rsi") {
    const when =
      input.compare === "cross_lte"
        ? "crosses below"
        : input.compare === "cross_gte"
          ? "crosses above"
          : input.compare === "lte"
            ? "at or below"
            : input.compare === "gte"
              ? "at or above"
              : (input.compare ?? "");
    const level = input.level != null ? ` ${input.level}` : "";
    return `RSI ${when}${level}${timeframe}`.trim();
  }
  return `Indicator${timeframe}`.trim();
}

const DCA_INDICATOR_TIMEFRAME_MINUTES: Record<DcaIndicatorTimeframe, number> = {
  "5": 5,
  "15": 15,
  "30": 30,
  "60": 60,
  "120": 120,
  "240": 240,
  "360": 360,
  "720": 720,
  D: 1440,
};

export function finerDcaIndicatorTimeframe(
  left: DcaIndicatorTimeframe,
  right: DcaIndicatorTimeframe,
): DcaIndicatorTimeframe {
  const leftRank = DCA_INDICATOR_TIMEFRAMES.indexOf(left);
  const rightRank = DCA_INDICATOR_TIMEFRAMES.indexOf(right);
  if (leftRank < 0) {
    return right;
  }
  if (rightRank < 0 || leftRank <= rightRank) {
    return left;
  }
  return right;
}

export function resampleClosesForTimeframe(
  closes: number[],
  from: DcaIndicatorTimeframe,
  to: DcaIndicatorTimeframe,
): number[] {
  if (from === to || closes.length === 0) {
    return closes;
  }
  const step = Math.round(
    DCA_INDICATOR_TIMEFRAME_MINUTES[to] / DCA_INDICATOR_TIMEFRAME_MINUTES[from],
  );
  if (!(step > 1)) {
    return closes;
  }
  const out: number[] = [];
  for (let i = step - 1; i < closes.length; i += step) {
    out.push(closes[i] ?? 0);
  }
  return out;
}

export function oppositeRsiCompare(compare: string): string {
  if (compare === "cross_lte") {
    return "cross_gte";
  }
  if (compare === "lte") {
    return "gte";
  }
  if (compare === "cross_gte") {
    return "cross_lte";
  }
  if (compare === "gte") {
    return "lte";
  }
  return compare;
}

export function oppositeRsiLevel(level: number | null | undefined): number {
  if (level == null || !Number.isFinite(level) || level <= 0) {
    return 70;
  }
  const flipped = 100 - level;
  if (!(flipped > 0) || flipped >= 100) {
    return 70;
  }
  return flipped;
}

export function oppositeIndicatorCompare(
  kind: DcaIndicatorKind,
  compare: string | null | undefined,
): string {
  if (kind === "rsi") {
    return oppositeRsiCompare(compare ?? "cross_lte");
  }
  if (kind === "macd") {
    if (compare === "gte") {
      return "lte";
    }
    if (compare === "lte") {
      return "gte";
    }
    if (compare === "cross_lte") {
      return "cross_gte";
    }
    return "cross_lte";
  }
  if (kind === "bb") {
    return compare === "gte" ? "lte" : "gte";
  }
  return compare === "cross_lte" ? "cross_gte" : "cross_lte";
}

export function indicatorCompareForDirection(
  direction: "long" | "short",
  kind: DcaIndicatorKind,
  compare: string,
): string {
  if (kind === "macd") {
    if (
      compare === "gte" ||
      compare === "lte" ||
      compare === "cross_gte" ||
      compare === "cross_lte"
    ) {
      return compare;
    }
    return direction === "short" ? "cross_lte" : "cross_gte";
  }
  if (kind === "ema" || kind === "sma" || kind === "sma_cross") {
    if (compare === "cross_gte" || compare === "cross_lte") {
      return compare;
    }
    return direction === "short" ? "cross_lte" : "cross_gte";
  }
  if (kind === "bb") {
    if (compare === "gte" || compare === "lte") {
      return compare;
    }
    return direction === "short" ? "gte" : "lte";
  }
  if (kind === "ema_cross") {
    if (compare === "legacy") {
      return "legacy";
    }
    if (compare === "cross_gte" || compare === "cross_lte") {
      return compare;
    }
    return direction === "short" ? "cross_lte" : "cross_gte";
  }
  if (
    compare === "gte" ||
    compare === "lte" ||
    compare === "cross_gte" ||
    compare === "cross_lte"
  ) {
    return compare;
  }
  return direction === "short" ? "cross_gte" : "cross_lte";
}

export function indicatorBothSidesHint(
  _kind: DcaIndicatorKind,
  _compare: string,
): string {
  return "Each side uses the When you set on that card.";
}

export function crossedLevel(
  prev: number,
  now: number,
  level: number,
  direction: "up" | "down",
): boolean {
  if (direction === "up") {
    return prev < level && now >= level;
  }
  return prev > level && now <= level;
}

export function emaValues(closes: number[], period: number): number[] {
  if (period < 1 || closes.length < period) {
    return [];
  }
  const k = 2 / (period + 1);
  const out: number[] = [];
  let ema =
    closes.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  out.push(ema);
  for (let i = period; i < closes.length; i += 1) {
    ema = closes[i] * k + ema * (1 - k);
    out.push(ema);
  }
  return out;
}

export function smaValues(closes: number[], period: number): number[] {
  if (period < 1 || closes.length < period) {
    return [];
  }
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < closes.length; i += 1) {
    sum += closes[i] ?? 0;
    if (i >= period) {
      sum -= closes[i - period] ?? 0;
    }
    if (i >= period - 1) {
      out.push(sum / period);
    }
  }
  return out;
}

export function bollingerBands(
  closes: number[],
  period: number,
  stddev = DCA_BB_STDDEV,
): { mid: number; upper: number; lower: number } | null {
  if (period < 2 || closes.length < period) {
    return null;
  }
  const window = closes.slice(-period);
  const mid = window.reduce((sum, value) => sum + (value ?? 0), 0) / period;
  const variance =
    window.reduce((sum, value) => {
      const delta = (value ?? 0) - mid;
      return sum + delta * delta;
    }, 0) / period;
  const band = Math.sqrt(variance) * stddev;
  return { mid, upper: mid + band, lower: mid - band };
}

export function priceCrossedAverage(
  closes: number[],
  averages: number[],
  direction: "up" | "down",
): boolean {
  if (closes.length < 2 || averages.length < 2) {
    return false;
  }
  const closePrev = closes[closes.length - 2] ?? 0;
  const closeNow = closes[closes.length - 1] ?? 0;
  const avgPrev = averages[averages.length - 2] ?? 0;
  const avgNow = averages[averages.length - 1] ?? 0;
  if (direction === "up") {
    return closePrev < avgPrev && closeNow >= avgNow;
  }
  return closePrev > avgPrev && closeNow <= avgNow;
}

export function rsiValue(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) {
    return null;
  }
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) {
      gain += delta;
    } else {
      loss -= delta;
    }
  }
  gain /= period;
  loss /= period;
  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];
    const up = delta > 0 ? delta : 0;
    const down = delta < 0 ? -delta : 0;
    gain = (gain * (period - 1) + up) / period;
    loss = (loss * (period - 1) + down) / period;
  }
  if (loss === 0) {
    return 100;
  }
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}

export function macdHistogram(closes: number[]): number | null {
  const fast = emaValues(closes, 12);
  const slow = emaValues(closes, 26);
  if (fast.length === 0 || slow.length === 0) {
    return null;
  }
  const alignedFast = fast.slice(fast.length - slow.length);
  const macdLine = alignedFast.map((value, i) => value - slow[i]);
  const signal = emaValues(macdLine, 9);
  if (signal.length === 0) {
    return null;
  }
  return macdLine[macdLine.length - 1] - signal[signal.length - 1];
}

function lastTwoOf(
  compute: (closes: number[]) => number | null,
  closes: number[],
): { prev: number; now: number } | null {
  if (closes.length < 2) {
    return null;
  }
  const now = compute(closes);
  const prev = compute(closes.slice(0, -1));
  if (now === null || prev === null) {
    return null;
  }
  return { prev, now };
}

function lastTwoEma(
  closes: number[],
  period: number,
): { prev: number; now: number } | null {
  const ema = emaValues(closes, period);
  if (ema.length < 2) {
    return null;
  }
  return { prev: ema[ema.length - 2], now: ema[ema.length - 1] };
}

export function emaCrossBullish(closes: number[]): boolean | null {
  const fast = emaValues(closes, DEFAULT_DCA_CROSS_FAST_PERIOD);
  const slow = emaValues(closes, DEFAULT_DCA_CROSS_SLOW_PERIOD);
  if (fast.length < 2 || slow.length < 2) {
    return null;
  }
  return maPairCrossed(fast, slow, "up");
}

export function dcaIndicatorStartLatches(
  kind: DcaIndicatorKind | null | undefined,
  compare: DcaIndicatorCompare | null | undefined,
): boolean {
  if (
    (kind === "ema_cross" || kind === "sma_cross") &&
    (compare === null || compare === undefined)
  ) {
    return true;
  }
  return compare === "cross_gte" || compare === "cross_lte";
}

export function indicatorClosesForCross(closes: number[]): number[] {
  if (closes.length > 2) {
    return closes.slice(0, -1);
  }
  return closes;
}

export function indicatorStartMet(input: {
  kind: DcaIndicatorKind;
  side: FuturesSide;
  closes: number[];
  compare: DcaIndicatorCompare | null;
  level: number | null;
  period?: number | null;
  slowPeriod?: number | null;
  splitBySide?: boolean;
}): boolean {
  const split = Boolean(input.splitBySide);
  const cross = input.compare === "cross_gte" || input.compare === "cross_lte";
  if (input.kind === "bb") {
    const bands = bollingerBands(
      input.closes,
      input.period ?? DEFAULT_DCA_BB_PERIOD,
    );
    if (!bands) {
      return false;
    }
    const price = input.closes[input.closes.length - 1];
    if (price == null) {
      return false;
    }
    const below = split
      ? input.side === "long"
      : input.compare === "lte";
    return below ? price < bands.lower : price > bands.upper;
  }
  if (input.kind === "ema" || input.kind === "sma") {
    const period = input.period ?? DEFAULT_DCA_MA_PERIOD;
    const averages =
      input.kind === "sma"
        ? smaValues(input.closes, period)
        : emaValues(input.closes, period);
    const direction =
      split && input.compare == null
        ? input.side === "long"
          ? "up"
          : "down"
        : input.compare === "cross_lte"
          ? "down"
          : "up";
    return priceCrossedAverage(input.closes, averages, direction);
  }
  if (input.kind === "rsi") {
    if (input.level === null || !input.compare) {
      return false;
    }
    if (cross) {
      const pair = lastTwoOf(rsiValue, input.closes);
      if (!pair) {
        return false;
      }
      const direction = split
        ? input.side === "long"
          ? "down"
          : "up"
        : input.compare === "cross_gte"
          ? "up"
          : "down";
      return crossedLevel(pair.prev, pair.now, input.level, direction);
    }
    const rsi = rsiValue(input.closes);
    if (rsi === null) {
      return false;
    }
    if (split) {
      return input.side === "long" ? rsi <= input.level : rsi >= input.level;
    }
    if (input.compare === "gte") {
      return rsi >= input.level;
    }
    return rsi <= input.level;
  }
  if (input.kind === "macd") {
    const level = macdHistogramLevel(input.level);
    if (cross) {
      const pair = lastTwoOf(macdHistogram, input.closes);
      if (!pair) {
        return false;
      }
      const direction = split
        ? input.side === "long"
          ? "up"
          : "down"
        : input.compare === "cross_lte"
          ? "down"
          : "up";
      return crossedLevel(pair.prev, pair.now, level, direction);
    }
    const hist = macdHistogram(input.closes);
    if (hist === null) {
      return false;
    }
    if (split) {
      return input.side === "long" ? hist > level : hist < level;
    }
    return input.compare === "lte" ? hist < level : hist > level;
  }
  if (input.kind === "ema_cross" || input.kind === "sma_cross") {
    if (input.kind === "ema_cross" && input.level != null && cross) {
      const pair = lastTwoEma(input.closes, 21);
      if (!pair) {
        return false;
      }
      return crossedLevel(
        pair.prev,
        pair.now,
        input.level,
        input.compare === "cross_lte"
          ? "down"
          : input.compare === "cross_gte"
            ? "up"
            : input.side === "long"
              ? "up"
              : "down",
      );
    }
    const { fast, slow } = dcaPairCrossPeriods(input.period, input.slowPeriod);
    const series = input.kind === "sma_cross" ? smaValues : emaValues;
    const direction =
      split && input.compare == null
        ? input.side === "long"
          ? "up"
          : "down"
        : input.compare === "cross_lte"
          ? "down"
          : "up";
    return maPairCrossed(
      series(input.closes, fast),
      series(input.closes, slow),
      direction,
    );
  }
  return false;
}

export function maPairCrossed(
  fast: number[],
  slow: number[],
  direction: "up" | "down",
): boolean {
  if (fast.length < 2 || slow.length < 2) {
    return false;
  }
  const fastNow = fast[fast.length - 1];
  const slowNow = slow[slow.length - 1];
  const fastPrev = fast[fast.length - 2];
  const slowPrev = slow[slow.length - 2];
  if (direction === "up") {
    return fastNow > slowNow && fastPrev <= slowPrev;
  }
  return fastNow < slowNow && fastPrev >= slowPrev;
}
