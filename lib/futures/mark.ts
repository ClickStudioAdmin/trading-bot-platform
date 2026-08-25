import type { FuturesDeskPosition } from "./list";
import { futuresPnlUsdt, markFromTicker } from "./math";

export type MarkedFutures = FuturesDeskPosition & {
  baseCoin: string;
  mark: number | null;
  unrealizedUsdt: number | null;
};

export function markFuturesOpen(
  rows: FuturesDeskPosition[],
  tickers: Map<string, { lastPrice?: string; bid1Price?: string; ask1Price?: string }>,
  baseCoinFor: (symbol: string) => string,
): MarkedFutures[] {
  return rows.map((row) => {
    const mark = markFromTicker(tickers.get(row.symbol) ?? {});
    return {
      ...row,
      baseCoin: baseCoinFor(row.symbol),
      mark,
      unrealizedUsdt:
        mark === null
          ? null
          : futuresPnlUsdt({
              side: row.side,
              qty: row.qty,
              entryPrice: row.entryPrice,
              exitPrice: mark,
            }),
    };
  });
}
