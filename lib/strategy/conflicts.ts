import { DEFAULT_DCA_ATR_BAND_MULT } from "@/lib/dca/filters";
import {
  DEFAULT_DCA_BB_PERIOD,
  DEFAULT_DCA_MA_PERIOD,
  DEFAULT_DCA_RSI_PERIOD,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DEFAULT_DCA_SUPERTREND_PERIOD,
  dcaIndicatorIsLegacyEmaPrice,
  dcaPairCrossPeriods,
  macdHistogramLevel,
} from "@/lib/dca/indicators";

/** One row's series and the test it applies on the latest check. */
export type ConflictClaim = {
  key: string;
  pred: ConflictPred;
};

type ConflictPred =
  | { type: "cross_up"; level: number }
  | { type: "cross_down"; level: number }
  | { type: "gt"; level: number }
  | { type: "lt"; level: number }
  | { type: "gte"; level: number }
  | { type: "lte"; level: number }
  | { type: "range"; from: number; to: number }
  | { type: "above_line" }
  | { type: "below_line" }
  | { type: "cross_above_line" }
  | { type: "cross_below_line" }
  | { type: "above_top" }
  | { type: "below_bottom" }
  | { type: "cross_above_top" }
  | { type: "cross_below_bottom" }
  | { type: "at_or_above_top" }
  | { type: "at_or_below_bottom" }
  | { type: "inside" }
  | { type: "bull" }
  | { type: "bear" }
  | { type: "turn_bull" }
  | { type: "turn_bear" };

type Interval = {
  lo: number;
  hi: number;
  loInc: boolean;
  hiInc: boolean;
};

const INF = Number.POSITIVE_INFINITY;

export const SERIES_CONFLICT_MESSAGE =
  "These conditions cannot be true at the same time.";

function finite(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value ?? "").replace(/,/g, "").trim();
  if (text === "") {
    return null;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function positive(value: unknown, fallback: number): number {
  const parsed = finite(value);
  return parsed != null && parsed > 0 ? parsed : fallback;
}

function timeframeOf(value: unknown): string {
  const text = String(value ?? "").trim();
  return text === "" ? "15" : text;
}

function periodFor(kind: string, period: unknown): number {
  if (kind === "rsi") {
    return positive(period, DEFAULT_DCA_RSI_PERIOD);
  }
  if (kind === "bb") {
    return positive(period, DEFAULT_DCA_BB_PERIOD);
  }
  if (kind === "supertrend" || kind === "atr_band") {
    return positive(period, DEFAULT_DCA_SUPERTREND_PERIOD);
  }
  return positive(period, DEFAULT_DCA_MA_PERIOD);
}

export function priceClaim(input: {
  source: unknown;
  compare: unknown;
  price: unknown;
}): ConflictClaim | null {
  const source = String(input.source ?? "").trim();
  if (source !== "last" && source !== "mark" && source !== "index") {
    return null;
  }
  const compare = String(input.compare ?? "");
  if (compare !== "gte" && compare !== "lte") {
    return null;
  }
  const price = finite(input.price);
  if (price == null || !(price > 0)) {
    return null;
  }
  return {
    key: `price|${source}`,
    pred: compare === "gte" ? { type: "gte", level: price } : { type: "lte", level: price },
  };
}

export function indicatorClaim(input: {
  surface: "entry" | "filter";
  kind: string;
  timeframe: unknown;
  compare: unknown;
  level?: unknown;
  levelTo?: unknown;
  period?: unknown;
  slowPeriod?: unknown;
  multiplier?: unknown;
}): ConflictClaim | null {
  const kind = input.kind;
  const timeframe = timeframeOf(input.timeframe);
  const compare = String(input.compare ?? "");
  const level = finite(input.level);
  const levelTo = finite(input.levelTo);
  if (kind === "macd") {
    const line = macdHistogramLevel(level);
    return {
      key: `macd|${timeframe}`,
      pred: macdPred(compare, line),
    };
  }
  if (kind === "rsi") {
    const period = periodFor(kind, input.period);
    if (input.surface === "filter" && compare === "between") {
      if (level == null || levelTo == null) {
        return null;
      }
      return {
        key: `rsi|${period}|${timeframe}`,
        pred: { type: "range", from: level, to: levelTo },
      };
    }
    if (level == null) {
      return null;
    }
    return {
      key: `rsi|${period}|${timeframe}`,
      pred: rsiPred(compare, level),
    };
  }
  if (kind === "ema" || kind === "sma") {
    const period = periodFor(kind, input.period);
    const pred = linePred(compare);
    if (!pred) {
      return null;
    }
    return { key: `ma|${kind}|${period}|${timeframe}`, pred };
  }
  if (kind === "ema_cross" || kind === "sma_cross") {
    if (
      kind === "ema_cross" &&
      dcaIndicatorIsLegacyEmaPrice(kind, compare, level)
    ) {
      if (level == null) {
        return null;
      }
      return {
        key: `legacy-ema|${timeframe}`,
        pred: compare === "cross_lte"
          ? { type: "cross_down", level }
          : { type: "cross_up", level },
      };
    }
    const pair = dcaPairCrossPeriods(finite(input.period), finite(input.slowPeriod));
    return {
      key: `pair|${kind}|${pair.fast}|${pair.slow}|${timeframe}`,
      pred: compare === "cross_lte"
        ? { type: "cross_below_line" }
        : { type: "cross_above_line" },
    };
  }
  if (kind === "bb") {
    const period = periodFor(kind, input.period);
    const pred = bandPred(compare, input.surface);
    if (!pred) {
      return null;
    }
    return { key: `bb|${period}|${timeframe}`, pred };
  }
  if (kind === "supertrend") {
    const period = periodFor(kind, input.period);
    const multiplier = positive(
      input.multiplier,
      DEFAULT_DCA_SUPERTREND_MULTIPLIER,
    );
    const pred = trendPred(compare);
    if (!pred) {
      return null;
    }
    return { key: `st|${period}|${multiplier}|${timeframe}`, pred };
  }
  if (kind === "atr_band") {
    const period = periodFor(kind, input.period);
    const multiplier = positive(input.multiplier, DEFAULT_DCA_ATR_BAND_MULT);
    const pred = atrPred(compare);
    if (!pred) {
      return null;
    }
    return { key: `atr|${period}|${multiplier}|${timeframe}`, pred };
  }
  return null;
}

function macdPred(compare: string, level: number): ConflictPred {
  if (compare === "cross_lte") {
    return { type: "cross_down", level };
  }
  if (compare === "lte") {
    return { type: "lt", level };
  }
  if (compare === "gte") {
    return { type: "gt", level };
  }
  return { type: "cross_up", level };
}

function rsiPred(compare: string, level: number): ConflictPred {
  if (compare === "cross_lte") {
    return { type: "cross_down", level };
  }
  if (compare === "cross_gte") {
    return { type: "cross_up", level };
  }
  if (compare === "lte") {
    return { type: "lte", level };
  }
  return { type: "gte", level };
}

function linePred(compare: string): ConflictPred | null {
  if (compare === "cross_gte") {
    return { type: "cross_above_line" };
  }
  if (compare === "cross_lte") {
    return { type: "cross_below_line" };
  }
  if (compare === "gte") {
    return { type: "above_line" };
  }
  if (compare === "lte") {
    return { type: "below_line" };
  }
  return null;
}

function bandPred(compare: string, surface: "entry" | "filter"): ConflictPred | null {
  if (compare === "inside" && surface === "filter") {
    return { type: "inside" };
  }
  if (compare === "cross_gte") {
    return { type: "cross_above_top" };
  }
  if (compare === "cross_lte") {
    return { type: "cross_below_bottom" };
  }
  if (compare === "gte") {
    return { type: "above_top" };
  }
  if (compare === "lte") {
    return { type: "below_bottom" };
  }
  return null;
}

function trendPred(compare: string): ConflictPred | null {
  if (compare === "cross_gte") {
    return { type: "turn_bull" };
  }
  if (compare === "cross_lte") {
    return { type: "turn_bear" };
  }
  if (compare === "lte") {
    return { type: "bear" };
  }
  if (compare === "gte") {
    return { type: "bull" };
  }
  return null;
}

function atrPred(compare: string): ConflictPred | null {
  if (compare === "inside") {
    return { type: "inside" };
  }
  if (compare === "lte") {
    return { type: "at_or_below_bottom" };
  }
  if (compare === "gte") {
    return { type: "at_or_above_top" };
  }
  return null;
}

export function claimsConflict(
  left: ConflictClaim | null | undefined,
  right: ConflictClaim | null | undefined,
): boolean {
  if (!left || !right || left.key !== right.key) {
    return false;
  }
  return predsConflict(left.pred, right.pred);
}

function predsConflict(left: ConflictPred, right: ConflictPred): boolean {
  if (left.type === right.type && numeric(left) && numeric(right)) {
    return !intervalsOverlap(intervalOf(left), intervalOf(right));
  }
  if (isCrossUp(left) && isCrossDown(right)) {
    return true;
  }
  if (isCrossDown(left) && isCrossUp(right)) {
    return true;
  }
  const leftNumber = numeric(left) ? intervalOf(left) : null;
  const rightNumber = numeric(right) ? intervalOf(right) : null;
  if (leftNumber && rightNumber) {
    return !intervalsOverlap(leftNumber, rightNumber);
  }
  if (isLine(left) && isLine(right)) {
    return lineConflict(left.type, right.type);
  }
  if (isBand(left) && isBand(right)) {
    return bandConflict(left.type, right.type);
  }
  if (isDir(left) && isDir(right)) {
    return dirConflict(left.type, right.type);
  }
  return false;
}

function numeric(pred: ConflictPred): boolean {
  return (
    pred.type === "cross_up" ||
    pred.type === "cross_down" ||
    pred.type === "gt" ||
    pred.type === "lt" ||
    pred.type === "gte" ||
    pred.type === "lte" ||
    pred.type === "range"
  );
}

function isCrossUp(pred: ConflictPred): boolean {
  return (
    pred.type === "cross_up" ||
    pred.type === "cross_above_line" ||
    pred.type === "cross_above_top" ||
    pred.type === "turn_bull"
  );
}

function isCrossDown(pred: ConflictPred): boolean {
  return (
    pred.type === "cross_down" ||
    pred.type === "cross_below_line" ||
    pred.type === "cross_below_bottom" ||
    pred.type === "turn_bear"
  );
}

function isLine(pred: ConflictPred): boolean {
  return (
    pred.type === "above_line" ||
    pred.type === "below_line" ||
    pred.type === "cross_above_line" ||
    pred.type === "cross_below_line"
  );
}

function isBand(pred: ConflictPred): boolean {
  return (
    pred.type === "above_top" ||
    pred.type === "below_bottom" ||
    pred.type === "cross_above_top" ||
    pred.type === "cross_below_bottom" ||
    pred.type === "at_or_above_top" ||
    pred.type === "at_or_below_bottom" ||
    pred.type === "inside"
  );
}

function isDir(pred: ConflictPred): boolean {
  return (
    pred.type === "bull" ||
    pred.type === "bear" ||
    pred.type === "turn_bull" ||
    pred.type === "turn_bear"
  );
}

function intervalOf(pred: ConflictPred): Interval {
  if (pred.type === "range") {
    if (pred.from > pred.to) {
      return { lo: 0, hi: -1, loInc: false, hiInc: false };
    }
    return { lo: pred.from, hi: pred.to, loInc: true, hiInc: true };
  }
  if (pred.type === "cross_up" || pred.type === "gte") {
    return { lo: pred.level, hi: INF, loInc: true, hiInc: false };
  }
  if (pred.type === "gt") {
    return { lo: pred.level, hi: INF, loInc: false, hiInc: false };
  }
  if (pred.type === "cross_down" || pred.type === "lte") {
    return { lo: -INF, hi: pred.level, loInc: false, hiInc: true };
  }
  if (pred.type === "lt") {
    return { lo: -INF, hi: pred.level, loInc: false, hiInc: false };
  }
  return { lo: -INF, hi: INF, loInc: false, hiInc: false };
}

function intervalsOverlap(left: Interval, right: Interval): boolean {
  if (left.lo > left.hi || right.lo > right.hi) {
    return false;
  }
  if (left.lo < right.hi && right.lo < left.hi) {
    return true;
  }
  if (left.lo === right.hi) {
    return left.loInc && right.hiInc;
  }
  if (right.lo === left.hi) {
    return right.loInc && left.hiInc;
  }
  return false;
}

function lineConflict(left: ConflictPred["type"], right: ConflictPred["type"]): boolean {
  const above = new Set(["above_line", "cross_above_line"]);
  const below = new Set(["below_line", "cross_below_line"]);
  if (above.has(left) && below.has(right)) {
    return true;
  }
  if (below.has(left) && above.has(right)) {
    return true;
  }
  return false;
}

function bandSide(type: ConflictPred["type"]): string {
  if (type === "cross_above_top") {
    return "above_top";
  }
  if (type === "cross_below_bottom") {
    return "below_bottom";
  }
  return type;
}

function bandConflict(left: ConflictPred["type"], right: ConflictPred["type"]): boolean {
  const a = bandSide(left);
  const b = bandSide(right);
  const pair = a < b ? `${a}|${b}` : `${b}|${a}`;
  return (
    pair === "above_top|below_bottom" ||
    pair === "above_top|inside" ||
    pair === "below_bottom|inside" ||
    pair === "above_top|at_or_below_bottom" ||
    pair === "at_or_above_top|below_bottom" ||
    pair === "at_or_above_top|at_or_below_bottom"
  );
}

function dirConflict(left: ConflictPred["type"], right: ConflictPred["type"]): boolean {
  const up = left === "bull" || left === "turn_bull";
  const down = left === "bear" || left === "turn_bear";
  const otherUp = right === "bull" || right === "turn_bull";
  const otherDown = right === "bear" || right === "turn_bear";
  return (up && otherDown) || (down && otherUp);
}
