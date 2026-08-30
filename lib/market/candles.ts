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

export function parseCandleLimit(raw: unknown, fallback = 200): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1500, Math.max(1, Math.floor(value)));
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
