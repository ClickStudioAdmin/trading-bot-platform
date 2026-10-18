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
};

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

/** Latest confirmed pair. Drawn even when the minimums fail. */
export function rsiDivergenceLine(input: {
  bars: readonly RsiDivergenceBar[];
  period?: number | null;
  settings: RsiDivergenceSettings;
}): RsiDivergenceLine | null {
  const bars = input.bars;
  const period = input.period ?? DEFAULT_DCA_RSI_PERIOD;
  const settings = input.settings;
  if (bars.length < settings.pivotBars * 2 + 2) {
    return null;
  }
  const rsi = rsiSeries(
    bars.map((bar) => bar.close),
    period,
  );
  const field = settings.when === "bullish" ? "low" : "high";
  const pivots = swingIndexes(bars, settings.pivotBars, field).filter(
    (index) => index >= bars.length - settings.span,
  );
  for (let newerAt = pivots.length - 1; newerAt >= 1; newerAt -= 1) {
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
      if (!shapeMatches(settings, olderPrice, newerPrice, olderRsi, newerRsi)) {
        continue;
      }
      return {
        olderIndex,
        newerIndex,
        olderPrice,
        newerPrice,
        olderRsi,
        newerRsi,
        confirmIndex: newerIndex + settings.pivotBars,
        minsPass: minsPass(settings, olderPrice, newerPrice, olderRsi, newerRsi),
      };
    }
  }
  return null;
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
