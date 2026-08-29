import {
  fetchBybitTicker,
  fetchBybitTickers,
} from "@/lib/exchanges/bybit/client";
import {
  hyperliquidInfoEnvironment,
} from "@/lib/venues/hyperliquid/desk";
import {
  loadHyperliquidTicker,
  loadHyperliquidTickerMap,
} from "@/lib/venues/hyperliquid/market";

export type DeskTickerQuote = {
  symbol?: string;
  lastPrice?: string;
  markPrice?: string;
  bid1Price?: string;
  ask1Price?: string;
};

export async function loadDeskTickerMap(
  venue: string,
  venueEnvironment: string | null,
): Promise<Map<string, DeskTickerQuote>> {
  if (venue === "hyperliquid") {
    return loadHyperliquidTickerMap(
      hyperliquidInfoEnvironment(venueEnvironment),
    );
  }
  return fetchBybitTickers("linear");
}

export async function loadDeskTicker(
  venue: string,
  venueEnvironment: string | null,
  symbol: string,
): Promise<DeskTickerQuote | null> {
  if (venue === "hyperliquid") {
    return loadHyperliquidTicker(
      hyperliquidInfoEnvironment(venueEnvironment),
      symbol,
    );
  }
  return fetchBybitTicker("linear", symbol);
}
