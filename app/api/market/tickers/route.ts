import {
  fetchBybitTicker,
  fetchBybitTickers,
} from "@/lib/exchanges/bybit/client";
import { parseTickerSymbolsQuery } from "@/lib/market/tickers";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";
import { loadHyperliquidTickerMap } from "@/lib/venues/hyperliquid/market";

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

function quoteFrom(ticker: {
  lastPrice?: string;
  markPrice?: string;
  bid1Price?: string;
  ask1Price?: string;
}): Quote {
  return {
    lastPrice: ticker.lastPrice,
    markPrice: ticker.markPrice,
    bid1Price: ticker.bid1Price,
    ask1Price: ticker.ask1Price,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = parseTickerSymbolsQuery(url.searchParams.get("symbols"));
  if (symbols.length === 0) {
    return Response.json({ tickers: {} });
  }
  const env = hyperliquidInfoEnvironment(url.searchParams.get("env"));
  const key = `${env}:${symbols.join(",")}`;
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) {
    return Response.json({ tickers: cache.tickers });
  }
  const usdt = symbols.filter((symbol) => symbol.endsWith("USDT"));
  const coins = symbols.filter((symbol) => !symbol.endsWith("USDT"));
  const tickers: Record<string, Quote> = {};
  try {
    if (usdt.length > 0) {
      if (usdt.length <= 8) {
        const rows = await Promise.all(
          usdt.map((symbol) => fetchBybitTicker("linear", symbol)),
        );
        for (const [index, row] of rows.entries()) {
          const symbol = usdt[index];
          if (row && symbol) {
            tickers[symbol] = quoteFrom(row);
          }
        }
      } else {
        const all = await fetchBybitTickers("linear");
        for (const symbol of usdt) {
          const row = all.get(symbol);
          if (row) {
            tickers[symbol] = quoteFrom(row);
          }
        }
      }
    }
    if (coins.length > 0) {
      const mids = await loadHyperliquidTickerMap(env);
      for (const symbol of coins) {
        const row = mids.get(symbol);
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
