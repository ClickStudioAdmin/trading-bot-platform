import {
  BACKTEST_CHART_FETCH_LIMIT,
  RANGED_CANDLE_LIMIT,
  mergeCandleBars,
  type CandleBar,
} from "@/lib/market/candles";
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";

export async function loadBacktestDisplayCandles(input: {
  venue: string;
  venueEnvironment: string | null;
  symbol: string;
  interval: DcaIndicatorTimeframe;
  fromMs: number;
  toMs: number;
}): Promise<CandleBar[]> {
  const pages: CandleBar[][] = [];
  let cursorTo = input.toMs;
  let total = 0;

  while (total < BACKTEST_CHART_FETCH_LIMIT && cursorTo > input.fromMs) {
    const limit = Math.min(
      RANGED_CANDLE_LIMIT,
      BACKTEST_CHART_FETCH_LIMIT - total,
    );
    const params = new URLSearchParams({
      venue: input.venue,
      symbol: input.symbol,
      interval: input.interval,
      from: String(input.fromMs),
      to: String(cursorTo),
      limit: String(limit),
    });
    if (input.venueEnvironment) {
      params.set("env", input.venueEnvironment);
    }
    const response = await fetch(`/api/market/candles?${params.toString()}`);
    const body = (await response.json()) as {
      candles?: CandleBar[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(body.error || "Could not read candles.");
    }
    const rows = body.candles ?? [];
    if (rows.length === 0) {
      break;
    }
    pages.push(rows);
    total += rows.length;
    const oldest = rows.reduce(
      (min, row) => Math.min(min, row.timeMs),
      rows[0]?.timeMs ?? cursorTo,
    );
    if (oldest <= input.fromMs) {
      break;
    }
    if (rows.length < limit) {
      break;
    }
    const nextTo = oldest - 1;
    if (!(nextTo < cursorTo)) {
      break;
    }
    cursorTo = nextTo;
  }

  return mergeCandleBars(pages).filter(
    (row) => row.timeMs >= input.fromMs && row.timeMs <= input.toMs,
  );
}
