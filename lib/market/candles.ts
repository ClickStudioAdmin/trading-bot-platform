import {
  DCA_INDICATOR_TIMEFRAMES,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";

export type CandleBar = {
  timeMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type CandleVenue = "bybit" | "hyperliquid";

export function parseCandleVenue(raw: unknown): CandleVenue | null {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "bybit" || value === "hyperliquid") {
    return value;
  }
  return null;
}

export function parseCandleInterval(raw: unknown): DcaIndicatorTimeframe | null {
  const value = String(raw ?? "").trim();
  return (DCA_INDICATOR_TIMEFRAMES as readonly string[]).includes(value)
    ? (value as DcaIndicatorTimeframe)
    : null;
}

export function parseCandleSymbol(raw: unknown): string | null {
  const symbol = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (symbol.length < 2 || symbol.length > 32) {
    return null;
  }
  return symbol;
}

export function parseOptionalMs(raw: unknown): number | null {
  if (raw == null || raw === "") {
    return null;
  }
  const ms = Number(raw);
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : null;
}

export const DESK_CANDLE_LIMIT = 1500;
export const RANGED_CANDLE_LIMIT = 20_000;
export const BACKTEST_CHART_FETCH_LIMIT = 80_000;

export function parseCandleLimit(raw: unknown, fallback = 200): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(DESK_CANDLE_LIMIT, Math.max(1, Math.floor(value)));
}

export function parseRangedCandleLimit(
  raw: unknown,
  fallback = RANGED_CANDLE_LIMIT,
): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(RANGED_CANDLE_LIMIT, Math.max(1, Math.floor(value)));
}

export function mergeCandleBars(pages: CandleBar[][]): CandleBar[] {
  const byTime = new Map<number, CandleBar>();
  for (const page of pages) {
    for (const row of page) {
      if (row.timeMs > 0 && row.close > 0) {
        byTime.set(row.timeMs, row);
      }
    }
  }
  return [...byTime.values()].sort((a, b) => a.timeMs - b.timeMs);
}

export function clipCandlesToWindow(
  candles: CandleBar[],
  fromMs: number,
  toMs: number,
): CandleBar[] {
  if (candles.length === 0 || !(toMs >= fromMs)) {
    return candles;
  }
  let start = 0;
  while (start < candles.length && candles[start].timeMs < fromMs) {
    start += 1;
  }
  if (start > 0) {
    start -= 1;
  }
  let end = candles.length - 1;
  while (end > start && candles[end].timeMs > toMs) {
    end -= 1;
  }
  if (end < candles.length - 1) {
    end += 1;
  }
  return candles.slice(start, end + 1);
}

export function isValidCandleBar(row: CandleBar): boolean {
  return (
    row.timeMs > 0 &&
    row.open > 0 &&
    row.high > 0 &&
    row.low > 0 &&
    row.close > 0 &&
    row.high >= row.low
  );
}
