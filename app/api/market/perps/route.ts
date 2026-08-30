import { parseCandleVenue } from "@/lib/market/candles";
import { loadUsdtLinearPerps } from "@/lib/exchanges/bybit/perp";
import { loadHyperliquidLinearPerps } from "@/lib/venues/hyperliquid/market";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";

export const maxDuration = 20;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const venue = parseCandleVenue(url.searchParams.get("venue")) ?? "bybit";
  try {
    const pairs =
      venue === "hyperliquid"
        ? await loadHyperliquidLinearPerps(
            hyperliquidInfoEnvironment(url.searchParams.get("env")),
          )
        : await loadUsdtLinearPerps();
    return Response.json({ pairs });
  } catch {
    return Response.json({ pairs: [] });
  }
}
