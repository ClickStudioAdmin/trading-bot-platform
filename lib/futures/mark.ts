import type { FuturesDeskPosition } from "./list";
import { futuresPnlUsdt, markFromTicker } from "./math";

export type MarkedFutures = FuturesDeskPosition & {
  baseCoin: string;
  mark: number | null;
  last: number | null;
  unrealizedUsdt: number | null;
  leverage: number | null;
  liqPrice: number | null;
};

export function markFuturesOpen(
  rows: FuturesDeskPosition[],
  tickers: Map<string, { lastPrice?: string; bid1Price?: string; ask1Price?: string }>,
  baseCoinFor: (symbol: string) => string,
): MarkedFutures[] {
  return rows.map((row) => {
    const ticker = tickers.get(row.symbol) ?? {};
    const mark = markFromTicker(ticker);
    const lastRaw = Number(ticker.lastPrice ?? "");
    const last = lastRaw > 0 ? lastRaw : mark;
    return {
      ...row,
      baseCoin: baseCoinFor(row.symbol),
      mark,
      last,
      unrealizedUsdt:
        mark === null
          ? null
          : futuresPnlUsdt({
              side: row.side,
              qty: row.qty,
              entryPrice: row.entryPrice,
              exitPrice: mark,
            }),
      leverage: null,
      liqPrice: null,
    };
  });
}

export type LiveTickerQuote = {
  lastPrice?: string;
  markPrice?: string;
  bid1Price?: string;
  ask1Price?: string;
};

export function applyLiveMarks(
  rows: readonly MarkedFutures[],
  tickers: ReadonlyMap<string, LiveTickerQuote> | null,
): MarkedFutures[] {
  if (!tickers || tickers.size === 0) {
    return [...rows];
  }
  return rows.map((row) => {
    const ticker = tickers.get(row.symbol);
    if (!ticker) {
      return row;
    }
    const mark = markFromTicker(ticker);
    if (mark === null) {
      return row;
    }
    const lastRaw = Number(ticker.lastPrice ?? "");
    const last = lastRaw > 0 ? lastRaw : mark;
    return {
      ...row,
      mark,
      last,
      unrealizedUsdt: futuresPnlUsdt({
        side: row.side,
        qty: row.qty,
        entryPrice: row.entryPrice,
        exitPrice: mark,
      }),
    };
  });
}
