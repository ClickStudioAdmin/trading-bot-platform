import { fetchBybitKlines } from "@/lib/exchanges/bybit/client";
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";
import { loadHyperliquidCandles } from "@/lib/exchanges/hyperliquid/info";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";

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
