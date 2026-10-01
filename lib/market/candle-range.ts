import { intervalMs } from "@/lib/backtest/model";
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";
import { fetchBybitKlineBars } from "@/lib/exchanges/bybit/client";
import { loadHyperliquidCandles } from "@/lib/exchanges/hyperliquid/info";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";
import {
  candleRangeError,
  candleRangesDoNotOverlap,
  candleVenueLabel,
  findEarliestCandleMs,
  intervalHistoryLabel,
  limitingCandleSpan,
  missingCandleHistoryMessage,
  type CandleSpan,
} from "@/lib/market/candle-availability";
import { hyperliquidCandleInterval } from "@/lib/market/desk-klines";

const CACHE_MS = 60 * 60 * 1000;
/** candleSnapshot keeps about 5,000 bars. A wider ask returns the oldest bar the venue will serve. */
const HL_HISTORY_BARS = 5_200;

const spanCache = new Map<string, { at: number; span: CandleSpan }>();

const HL_INTERVAL_MS: Record<string, number> = {
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "2h": 2 * 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "12h": 12 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

function cacheKey(input: {
  venue: string;
  venueEnvironment: string | null;
  symbol: string;
  interval: DcaIndicatorTimeframe;
}): string {
  return `${input.venue}:${input.venueEnvironment ?? ""}:${input.symbol}:${input.interval}`;
}

async function bybitSpan(
  symbol: string,
  interval: DcaIndicatorTimeframe,
  nowMs: number,
): Promise<CandleSpan | null> {
  const stepMs = intervalMs(interval);
  const inWindow = async (startMs: number, endMs: number, limit: number) => {
    if (!(endMs > startMs)) {
      return [];
    }
    const bars = await fetchBybitKlineBars({
      symbol,
      interval,
      limit,
      startMs,
      endMs,
    });
    return bars.filter((bar) => bar.timeMs >= startMs && bar.timeMs <= endMs);
  };
  const earliestMs = await findEarliestCandleMs({
    nowMs,
    stepMs,
    exists: async (startMs, endMs) =>
      (await inWindow(startMs, endMs, 1)).length > 0,
    oldestIn: async (startMs, endMs) => {
      const bars = await inWindow(startMs, endMs, 10);
      if (bars.length === 0) {
        return null;
      }
      return Math.min(...bars.map((bar) => bar.timeMs));
    },
  });
  const latestBars = await fetchBybitKlineBars({
    symbol,
    interval,
    limit: 1,
    endMs: nowMs,
  });
  const latestMs = latestBars.reduce<number | null>(
    (latest, bar) => (latest == null || bar.timeMs > latest ? bar.timeMs : latest),
    null,
  );
  if (earliestMs == null || latestMs == null || !(latestMs >= earliestMs)) {
    return null;
  }
  return { symbol, earliestMs, latestMs };
}

async function hyperliquidSpan(input: {
  symbol: string;
  interval: DcaIndicatorTimeframe;
  venueEnvironment: string | null;
  nowMs: number;
}): Promise<CandleSpan | null> {
  const mapped = hyperliquidCandleInterval(input.interval);
  const step = HL_INTERVAL_MS[mapped] ?? intervalMs(input.interval);
  const candles = await loadHyperliquidCandles({
    environmentId: hyperliquidInfoEnvironment(input.venueEnvironment),
    symbol: input.symbol,
    interval: mapped,
    startTimeMs: input.nowMs - step * HL_HISTORY_BARS,
    endTimeMs: input.nowMs,
  });
  if (candles.length === 0) {
    return null;
  }
  const times = candles.map((row) => row.timeMs);
  return {
    symbol: input.symbol,
    earliestMs: Math.min(...times),
    latestMs: Math.max(...times),
  };
}

export async function loadCandleSpan(input: {
  venue: string;
  venueEnvironment: string | null;
  symbol: string;
  interval: DcaIndicatorTimeframe;
  nowMs?: number;
}): Promise<CandleSpan | null> {
  const symbol = input.symbol.trim().toUpperCase();
  const nowMs = input.nowMs ?? Date.now();
  const venueEnvironment =
    input.venue === "hyperliquid"
      ? hyperliquidInfoEnvironment(input.venueEnvironment)
      : null;
  const key = cacheKey({ ...input, symbol, venueEnvironment });
  const hit = spanCache.get(key);
  if (hit && nowMs - hit.at < CACHE_MS) {
    return hit.span;
  }
  const span =
    input.venue === "hyperliquid"
      ? await hyperliquidSpan({
          symbol,
          interval: input.interval,
          venueEnvironment,
          nowMs,
        })
      : await bybitSpan(symbol, input.interval, nowMs);
  if (!span) {
    return null;
  }
  spanCache.set(key, { at: nowMs, span });
  return span;
}

export async function backtestCandleHistoryError(input: {
  venue: string;
  venueEnvironment: string | null;
  interval: DcaIndicatorTimeframe;
  fromMs: number;
  toMs: number;
  symbols: string[];
}): Promise<string | null> {
  const symbols = [
    ...new Set(
      input.symbols
        .map((row) => row.trim().toUpperCase())
        .filter((row) => row.length > 0),
    ),
  ];
  const intervalLabel = intervalHistoryLabel(input.interval);
  const venueLabel = candleVenueLabel(input.venue);
  const spans = await Promise.all(
    symbols.map((symbol) =>
      loadCandleSpan({
        venue: input.venue,
        venueEnvironment: input.venueEnvironment,
        symbol,
        interval: input.interval,
      }),
    ),
  );
  for (let index = 0; index < symbols.length; index += 1) {
    if (!spans[index]) {
      return missingCandleHistoryMessage({
        venueLabel,
        symbol: symbols[index] ?? "",
        intervalLabel,
      });
    }
  }
  const known = spans.filter((row): row is CandleSpan => row != null);
  const limit = limitingCandleSpan(known);
  if (!limit) {
    return candleRangesDoNotOverlap(intervalLabel, venueLabel);
  }
  return candleRangeError({
    fromMs: input.fromMs,
    toMs: input.toMs,
    earliestMs: limit.earliestMs,
    latestMs: limit.latestMs,
    symbol: limit.symbol,
    intervalLabel,
    venueLabel,
  });
}
