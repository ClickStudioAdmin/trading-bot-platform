import {
  fetchBybitKlineBars,
  fetchBybitKlines,
} from "@/lib/exchanges/bybit/client";
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";
import { loadHyperliquidCandles } from "@/lib/exchanges/hyperliquid/info";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";
import type { CandleBar } from "@/lib/market/candles";

const INTERVAL_MS: Record<DcaIndicatorTimeframe, number> = {
  "5": 5 * 60_000,
  "15": 15 * 60_000,
  "30": 30 * 60_000,
  "60": 60 * 60_000,
  "120": 2 * 60 * 60_000,
  "240": 4 * 60 * 60_000,
  "360": 6 * 60 * 60_000,
  "720": 12 * 60 * 60_000,
  D: 24 * 60 * 60_000,
};

const HL_INTERVAL: Record<DcaIndicatorTimeframe, string> = {
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1h",
  "120": "2h",
  "240": "4h",
  "360": "4h",
  "720": "12h",
  D: "1d",
};

export function hyperliquidCandleInterval(
  timeframe: DcaIndicatorTimeframe,
): string {
  return HL_INTERVAL[timeframe];
}

export async function loadDeskIndicatorCloses(input: {
  venue: string;
  venueEnvironment: string | null;
  symbol: string;
  interval: DcaIndicatorTimeframe;
  limit?: number;
}): Promise<number[]> {
  if (input.venue === "hyperliquid") {
    const limit = input.limit ?? 80;
    const endTimeMs = Date.now();
    const startTimeMs = endTimeMs - INTERVAL_MS[input.interval] * limit;
    const candles = await loadHyperliquidCandles({
      environmentId: hyperliquidInfoEnvironment(input.venueEnvironment),
      symbol: input.symbol,
      interval: hyperliquidCandleInterval(input.interval),
      startTimeMs,
      endTimeMs,
    });
    return candles
      .filter((row) => row.close > 0)
      .map((row) => row.close)
      .slice(-limit);
  }
  return fetchBybitKlines({
    symbol: input.symbol,
    interval: input.interval,
    limit: input.limit,
  });
}

export const DESK_CANDLE_MAX = 1500;

function sortUniqueBars(bars: CandleBar[]): CandleBar[] {
  const byTime = new Map<number, CandleBar>();
  for (const bar of bars) {
    if (bar.timeMs > 0 && bar.close > 0) {
      byTime.set(bar.timeMs, bar);
    }
  }
  return [...byTime.values()].sort((a, b) => a.timeMs - b.timeMs);
}

export async function loadBacktestCandles(input: {
  venue: string;
  venueEnvironment: string | null;
  symbol: string;
  interval: DcaIndicatorTimeframe;
  fromMs: number;
  toMs: number;
  limit: number;
}): Promise<CandleBar[]> {
  const limit = Math.min(200_000, Math.max(1, Math.floor(input.limit)));
  const endTimeMs = input.toMs;
  const startTimeMs = input.fromMs;

  if (input.venue === "hyperliquid") {
    const collected: CandleBar[] = [];
    let cursorEnd = endTimeMs;
    while (collected.length < limit && cursorEnd > startTimeMs) {
      const chunk = await loadHyperliquidCandles({
        environmentId: hyperliquidInfoEnvironment(input.venueEnvironment),
        symbol: input.symbol,
        interval: hyperliquidCandleInterval(input.interval),
        startTimeMs,
        endTimeMs: cursorEnd,
      });
      if (chunk.length === 0) {
        break;
      }
      collected.push(...chunk);
      const oldest = chunk[0]?.timeMs;
      if (oldest == null || oldest >= cursorEnd) {
        break;
      }
      if (chunk.length < 400) {
        break;
      }
      cursorEnd = oldest - 1;
    }
    return sortUniqueBars(collected)
      .filter((row) => row.timeMs >= startTimeMs && row.timeMs <= endTimeMs)
      .slice(-limit);
  }

  const collected: CandleBar[] = [];
  let cursorEnd = endTimeMs;
  while (collected.length < limit && cursorEnd > startTimeMs) {
    const chunk = await fetchBybitKlineBars({
      symbol: input.symbol,
      interval: input.interval,
      limit: Math.min(1000, limit - collected.length + 8),
      startMs: startTimeMs,
      endMs: cursorEnd,
    });
    if (chunk.length === 0) {
      break;
    }
    collected.push(...chunk);
    const oldest = chunk[0]?.timeMs;
    if (oldest == null || oldest >= cursorEnd) {
      break;
    }
    cursorEnd = oldest - 1;
    if (chunk.length < 2) {
      break;
    }
  }
  return sortUniqueBars(collected)
    .filter((row) => row.timeMs >= startTimeMs && row.timeMs <= endTimeMs)
    .slice(-limit);
}

export async function loadDeskCandles(input: {
  venue: string;
  venueEnvironment: string | null;
  symbol: string;
  interval: DcaIndicatorTimeframe;
  limit?: number;
  fromMs?: number;
  toMs?: number;
}): Promise<CandleBar[]> {
  const limit = Math.min(
    DESK_CANDLE_MAX,
    Math.max(1, Math.floor(input.limit ?? 200)),
  );
  const endTimeMs = input.toMs ?? Date.now();
  const startTimeMs =
    input.fromMs ?? endTimeMs - INTERVAL_MS[input.interval] * limit;

  if (input.venue === "hyperliquid") {
    const candles = await loadHyperliquidCandles({
      environmentId: hyperliquidInfoEnvironment(input.venueEnvironment),
      symbol: input.symbol,
      interval: hyperliquidCandleInterval(input.interval),
      startTimeMs,
      endTimeMs,
    });
    return sortUniqueBars(candles).slice(-limit);
  }

  const collected: CandleBar[] = [];
  let cursorEnd = endTimeMs;
  while (collected.length < limit && cursorEnd > startTimeMs) {
    const chunk = await fetchBybitKlineBars({
      symbol: input.symbol,
      interval: input.interval,
      limit: Math.min(1000, limit - collected.length + 8),
      startMs: startTimeMs,
      endMs: cursorEnd,
    });
    if (chunk.length === 0) {
      break;
    }
    collected.push(...chunk);
    const oldest = chunk[0]?.timeMs;
    if (oldest == null || oldest >= cursorEnd) {
      break;
    }
    cursorEnd = oldest - 1;
    if (chunk.length < 2) {
      break;
    }
  }
  return sortUniqueBars(collected).slice(-limit);
}
