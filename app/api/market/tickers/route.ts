import {
  fetchBybitTicker,
  fetchBybitTickers,
  type BybitTicker,
} from "@/lib/exchanges/bybit/client";
import { parseTickerSymbolsQuery } from "@/lib/market/tickers";

export const maxDuration = 10;

type Quote = {
  lastPrice?: string;
  markPrice?: string;
  bid1Price?: string;
  ask1Price?: string;
};

let cache: { key: string; at: number; tickers: Record<string, Quote> } | null =
  null;
const CACHE_MS = 1_500;

function quoteFrom(ticker: BybitTicker): Quote {
  return {
    lastPrice: ticker.lastPrice,
    markPrice: ticker.markPrice,
    bid1Price: ticker.bid1Price,
    ask1Price: ticker.ask1Price,
  };
}

export async function GET(request: Request) {
  const symbols = parseTickerSymbolsQuery(
    new URL(request.url).searchParams.get("symbols"),
  );
  if (symbols.length === 0) {
    return Response.json({ tickers: {} });
  }
  const key = symbols.join(",");
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) {
    return Response.json({ tickers: cache.tickers });
  }
  const tickers: Record<string, Quote> = {};
  try {
    if (symbols.length <= 8) {
      const rows = await Promise.all(
        symbols.map((symbol) => fetchBybitTicker("linear", symbol)),
      );
      for (const [index, row] of rows.entries()) {
        const symbol = symbols[index];
        if (row && symbol) {
          tickers[symbol] = quoteFrom(row);
        }
      }
    } else {
      const all = await fetchBybitTickers("linear");
      for (const symbol of symbols) {
        const row = all.get(symbol);
        if (row) {
          tickers[symbol] = quoteFrom(row);
        }
      }
    }
  } catch {
    return Response.json({ error: "Could not read marks." }, { status: 502 });
  }
  cache = { key, at: Date.now(), tickers };
  return Response.json({ tickers });
}
