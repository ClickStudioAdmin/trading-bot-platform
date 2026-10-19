import type { ConflictClaim } from "@/lib/strategy/conflicts";
import {
  parseDcaIndicatorPeriod,
  parseDcaIndicatorTimeframe,
  rsiSeries,
  DEFAULT_DCA_RSI_PERIOD,
} from "@/lib/dca/indicators";
import type { FuturesSide } from "@/lib/futures/model";

export const DEFAULT_RSI_PIVOT_BARS = 5;
export const DEFAULT_RSI_SPAN = 50;
export const RSI_PIVOT_MIN = 1;
export const RSI_PIVOT_MAX = 50;
export const RSI_SPAN_MIN = 2;
export const RSI_SPAN_MAX = 400;

export type RsiDivergenceWhen = "bullish" | "bearish";
export type RsiDivergenceStyle = "regular" | "hidden";

export type RsiDivergenceSettings = {
  when: RsiDivergenceWhen;
  style: RsiDivergenceStyle;
  pivotBars: number;
  span: number;
  minPricePct: number | null;
  minRsi: number | null;
};

export type RsiDivergenceBar = { high: number; low: number; close: number };

export type RsiDivergenceLine = {
  olderIndex: number;
  newerIndex: number;
  olderPrice: number;
  newerPrice: number;
  olderRsi: number;
  newerRsi: number;
  confirmIndex: number;
  minsPass: boolean;
  when: RsiDivergenceWhen;
  style: RsiDivergenceStyle;
};

/** Indicator paint. Regular bullish, hidden bullish, regular bearish, hidden bearish. */
export const RSI_DIVERGENCE_LINE_COLOR = {
  regularBullish: "#34D399",
  hiddenBullish: "#22D3EE",
  regularBearish: "#F07167",
  hiddenBearish: "#F5B942",
} as const;

const CHART_SHAPES: readonly {
  when: RsiDivergenceWhen;
  style: RsiDivergenceStyle;
}[] = [
  { when: "bullish", style: "regular" },
  { when: "bullish", style: "hidden" },
  { when: "bearish", style: "regular" },
  { when: "bearish", style: "hidden" },
];

export function rsiDivergenceLineColor(
  when: RsiDivergenceWhen,
  style: RsiDivergenceStyle,
): string {
  if (when === "bullish") {
    return style === "hidden"
      ? RSI_DIVERGENCE_LINE_COLOR.hiddenBullish
      : RSI_DIVERGENCE_LINE_COLOR.regularBullish;
  }
  return style === "hidden"
    ? RSI_DIVERGENCE_LINE_COLOR.hiddenBearish
    : RSI_DIVERGENCE_LINE_COLOR.regularBearish;
}

export function defaultRsiDivergenceWhen(side: FuturesSide): RsiDivergenceWhen {
  return side === "short" ? "bearish" : "bullish";
}

export function blankRsiDivergenceSettings(
  side: FuturesSide,
): RsiDivergenceSettings {
  return {
    when: defaultRsiDivergenceWhen(side),
    style: "regular",
    pivotBars: DEFAULT_RSI_PIVOT_BARS,
    span: DEFAULT_RSI_SPAN,
    minPricePct: null,
    minRsi: null,
  };
}

export function parseRsiDivergenceWhen(value: unknown): RsiDivergenceWhen | null {
  const raw = String(value ?? "").trim();
  if (raw === "bullish" || raw === "bearish") {
    return raw;
  }
  return null;
}

export function parseRsiDivergenceStyle(value: unknown): RsiDivergenceStyle | null {
  const raw = String(value ?? "").trim();
  if (raw === "regular" || raw === "hidden") {
    return raw;
  }
  return null;
}

function boundedInt(
  value: unknown,
  min: number,
  max: number,
): number | null {
  if (value == null || String(value).trim() === "") {
    return null;
  }
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

function optionalPositive(value: unknown): number | null {
  if (value == null || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(parsed) || !(parsed > 0)) {
    return null;
  }
  return parsed;
}

export function parseRsiDivergenceSettings(
  raw: unknown,
): RsiDivergenceSettings | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const when = parseRsiDivergenceWhen(row.when);
  const style = parseRsiDivergenceStyle(row.style) ?? "regular";
  const pivotBars = boundedInt(row.pivotBars, RSI_PIVOT_MIN, RSI_PIVOT_MAX);
  const span = boundedInt(row.span, RSI_SPAN_MIN, RSI_SPAN_MAX);
  if (!when || pivotBars == null || span == null) {
    return null;
  }
  const minPricePct =
    row.minPricePct == null || String(row.minPricePct).trim() === ""
      ? null
      : optionalPositive(row.minPricePct);
  if (
    row.minPricePct != null &&
    String(row.minPricePct).trim() !== "" &&
    minPricePct == null
  ) {
    return null;
  }
  const minRsi =
    row.minRsi == null || String(row.minRsi).trim() === ""
      ? null
      : optionalPositive(row.minRsi);
  if (row.minRsi != null && String(row.minRsi).trim() !== "" && minRsi == null) {
    return null;
  }
  return { when, style, pivotBars, span, minPricePct, minRsi };
}

export function rsiDivergenceClaim(input: {
  when: unknown;
  period?: unknown;
  timeframe: unknown;
}): ConflictClaim | null {
  const when = parseRsiDivergenceWhen(input.when);
  const timeframe = parseDcaIndicatorTimeframe(input.timeframe);
  if (!when || !timeframe) {
    return null;
  }
  const period = parseDcaIndicatorPeriod(input.period) ?? DEFAULT_DCA_RSI_PERIOD;
  return {
    key: `rsi-div|${period}|${timeframe}`,
    pred: when === "bullish" ? { type: "bull" } : { type: "bear" },
  };
}

function swingIndexes(
  bars: readonly RsiDivergenceBar[],
  pivotBars: number,
  field: "high" | "low",
): number[] {
  const indexes: number[] = [];
  for (let index = pivotBars; index < bars.length - pivotBars; index += 1) {
    const value = bars[index]?.[field];
    if (!(value != null && value > 0)) {
      continue;
    }
    let swing = true;
    for (let side = 1; side <= pivotBars; side += 1) {
      const left = bars[index - side]?.[field];
      const right = bars[index + side]?.[field];
      const extreme =
        field === "low"
          ? value < (left ?? 0) && value < (right ?? 0)
          : value > (left ?? 0) && value > (right ?? 0);
      if (!extreme) {
        swing = false;
        break;
      }
    }
    if (swing) {
      indexes.push(index);
    }
  }
  return indexes;
}

function shapeMatches(
  settings: RsiDivergenceSettings,
  olderPrice: number,
  newerPrice: number,
  olderRsi: number,
  newerRsi: number,
): boolean {
  const priceDown = newerPrice < olderPrice;
  const priceUp = newerPrice > olderPrice;
  const rsiDown = newerRsi < olderRsi;
  const rsiUp = newerRsi > olderRsi;
  if (settings.when === "bullish" && settings.style === "regular") {
    return priceDown && rsiUp;
  }
  if (settings.when === "bearish" && settings.style === "regular") {
    return priceUp && rsiDown;
  }
  if (settings.when === "bullish" && settings.style === "hidden") {
    return priceUp && rsiDown;
  }
  return priceDown && rsiUp;
}

function minsPass(
  settings: RsiDivergenceSettings,
  olderPrice: number,
  newerPrice: number,
  olderRsi: number,
  newerRsi: number,
): boolean {
  if (settings.minPricePct != null) {
    if (!(olderPrice > 0)) {
      return false;
    }
    const moved = (Math.abs(newerPrice - olderPrice) / olderPrice) * 100;
    if (moved < settings.minPricePct) {
      return false;
    }
  }
  if (settings.minRsi != null && Math.abs(newerRsi - olderRsi) < settings.minRsi) {
    return false;
  }
  return true;
}

function collectLines(
  bars: readonly RsiDivergenceBar[],
  period: number,
  settings: RsiDivergenceSettings,
  shapes: readonly { when: RsiDivergenceWhen; style: RsiDivergenceStyle }[],
  scan: "signal" | "chart",
): RsiDivergenceLine[] {
  if (bars.length < settings.pivotBars * 2 + 2) {
    return [];
  }
  const rsi = rsiSeries(
    bars.map((bar) => bar.close),
    period,
  );
  const lines: RsiDivergenceLine[] = [];
  for (const shape of shapes) {
    const field = shape.when === "bullish" ? "low" : "high";
    const shaped: RsiDivergenceSettings = { ...settings, ...shape };
    let pivots = swingIndexes(bars, settings.pivotBars, field);
    if (scan === "signal") {
      pivots = pivots.filter((index) => index >= bars.length - settings.span);
    }
    for (let newerAt = 0; newerAt < pivots.length; newerAt += 1) {
      const newerIndex = pivots[newerAt]!;
      const newerPrice = bars[newerIndex]?.[field];
      const newerRsi = rsi[newerIndex];
      if (newerPrice == null || newerRsi == null) {
        continue;
      }
      for (let olderAt = newerAt - 1; olderAt >= 0; olderAt -= 1) {
        const olderIndex = pivots[olderAt]!;
        if (newerIndex - olderIndex > settings.span) {
          break;
        }
        const olderPrice = bars[olderIndex]?.[field];
        const olderRsi = rsi[olderIndex];
        if (olderPrice == null || olderRsi == null) {
          continue;
        }
        if (!shapeMatches(shaped, olderPrice, newerPrice, olderRsi, newerRsi)) {
          continue;
        }
        lines.push({
          olderIndex,
          newerIndex,
          olderPrice,
          newerPrice,
          olderRsi,
          newerRsi,
          confirmIndex: newerIndex + settings.pivotBars,
          minsPass: minsPass(shaped, olderPrice, newerPrice, olderRsi, newerRsi),
          when: shape.when,
          style: shape.style,
        });
        break;
      }
    }
  }
  return lines;
}

/** Latest confirmed pair in the trailing span. The signal uses this pair. */
export function rsiDivergenceLine(input: {
  bars: readonly RsiDivergenceBar[];
  period?: number | null;
  settings: RsiDivergenceSettings;
}): RsiDivergenceLine | null {
  const lines = collectLines(
    input.bars,
    input.period ?? DEFAULT_DCA_RSI_PERIOD,
    input.settings,
    [{ when: input.settings.when, style: input.settings.style }],
    "signal",
  );
  return lines.at(-1) ?? null;
}

/**
 * Every confirmed pair on the loaded candles. Span is the maximum distance
 * between the two swings. A reference study passes every shape.
 */
export function rsiDivergenceChartLines(input: {
  bars: readonly RsiDivergenceBar[];
  period?: number | null;
  settings: RsiDivergenceSettings;
  everyShape: boolean;
}): RsiDivergenceLine[] {
  return collectLines(
    input.bars,
    input.period ?? DEFAULT_DCA_RSI_PERIOD,
    input.settings,
    input.everyShape
      ? CHART_SHAPES
      : [{ when: input.settings.when, style: input.settings.style }],
    "chart",
  );
}

export type RsiDivergenceSegment = {
  olderTime: number;
  newerTime: number;
  olderPrice: number;
  newerPrice: number;
  olderRsi: number;
  newerRsi: number;
  color: string;
  marker: "up" | "down";
};

/** Price and RSI segments for the chart. Times are unix seconds. */
export function rsiDivergenceSegments(input: {
  bars: readonly (RsiDivergenceBar & { timeMs: number })[];
  period?: number | null;
  settings: RsiDivergenceSettings;
  everyShape: boolean;
}): RsiDivergenceSegment[] {
  const lines = rsiDivergenceChartLines(input);
  const segments: RsiDivergenceSegment[] = [];
  for (const line of lines) {
    const older = input.bars[line.olderIndex];
    const newer = input.bars[line.newerIndex];
    if (!older || !newer) {
      continue;
    }
    const olderTime = Math.floor(older.timeMs / 1000);
    const newerTime = Math.floor(newer.timeMs / 1000);
    if (!(newerTime > olderTime)) {
      continue;
    }
    segments.push({
      olderTime,
      newerTime,
      olderPrice: line.olderPrice,
      newerPrice: line.newerPrice,
      olderRsi: line.olderRsi,
      newerRsi: line.newerRsi,
      color: rsiDivergenceLineColor(line.when, line.style),
      marker: line.when === "bullish" ? "up" : "down",
    });
  }
  return segments;
}

/** True only on the candle that confirms the second swing, after the minimums pass. */
export function rsiDivergenceMet(input: {
  bars: readonly RsiDivergenceBar[];
  period?: number | null;
  settings: RsiDivergenceSettings | null | undefined;
}): boolean {
  if (!input.settings) {
    return false;
  }
  const line = rsiDivergenceLine({
    bars: input.bars,
    period: input.period,
    settings: input.settings,
  });
  if (!line || !line.minsPass) {
    return false;
  }
  return line.confirmIndex === input.bars.length - 1;
}

export function formatRsiDivergenceLabel(input: {
  settings: RsiDivergenceSettings;
  period?: number | null;
}): string {
  const period = input.period ?? DEFAULT_DCA_RSI_PERIOD;
  const when = input.settings.when === "bearish" ? "Bearish" : "Bullish";
  const style = input.settings.style === "hidden" ? "hidden" : "regular";
  return `RSI ${period} ${when.toLowerCase()} ${style} divergence`;
}
