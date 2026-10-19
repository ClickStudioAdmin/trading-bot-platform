import { stepDecimals } from "@/lib/exchanges/bybit/qty";
import { formatPerpMinQty } from "@/lib/exchanges/bybit/ticket-size";

export type SymbolQuote = {
  bid: number | null;
  ask: number | null;
};

const EMPTY = "—";

export function symbolQuotesFromTickers(
  tickers: Iterable<
    [string, { bid1Price?: string; ask1Price?: string }]
  >,
): Record<string, SymbolQuote> {
  const quotes: Record<string, SymbolQuote> = {};
  for (const [symbol, row] of tickers) {
    const bid = Number(row.bid1Price);
    const ask = Number(row.ask1Price);
    quotes[symbol] = {
      bid: bid > 0 ? bid : null,
      ask: ask > 0 ? ask : null,
    };
  }
  return quotes;
}

/** Spread in price ticks. 57.509 / 57.538 at a 0.001 tick is 29. */
export function symbolSpreadTicks(input: {
  bid: number | null;
  ask: number | null;
  tickSize: number;
}): number | null {
  const { bid, ask, tickSize } = input;
  if (
    bid == null ||
    ask == null ||
    !(bid > 0) ||
    !(ask > 0) ||
    !(tickSize > 0) ||
    ask < bid
  ) {
    return null;
  }
  return Math.round((ask - bid) / tickSize);
}

export function formatSymbolPrice(
  value: number | null,
  tickSize: number,
): string {
  if (value == null || !(value > 0) || !Number.isFinite(value)) {
    return EMPTY;
  }
  const digits =
    tickSize > 0
      ? Math.min(8, Math.max(0, stepDecimals(tickSize)))
      : value >= 1000
        ? 2
        : value >= 1
          ? 4
          : 8;
  const text = value.toFixed(digits).replace(/\.?0+$/, "");
  const [whole, frac] = text.split(".");
  const grouped = Number(whole).toLocaleString("en-US");
  return frac ? `${grouped}.${frac}` : grouped;
}

export function formatSymbolLot(value: number | null | undefined): string {
  if (value == null || !(value > 0) || !Number.isFinite(value)) {
    return EMPTY;
  }
  return formatPerpMinQty(value);
}

export function formatMaxLeverage(value: number | null | undefined): string {
  if (value == null || !(value > 0) || !Number.isFinite(value)) {
    return EMPTY;
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatSymbolSpread(ticks: number | null): string {
  if (ticks == null || !Number.isFinite(ticks) || ticks < 0) {
    return EMPTY;
  }
  return ticks.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
