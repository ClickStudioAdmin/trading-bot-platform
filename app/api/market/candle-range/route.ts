import { parseCandleInterval, parseCandleSymbol, parseCandleVenue } from "@/lib/market/candles";
import { intervalHistoryLabel } from "@/lib/market/candle-availability";
import { loadCandleSpan } from "@/lib/market/candle-range";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";

export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const venue = parseCandleVenue(url.searchParams.get("venue"));
  const symbol = parseCandleSymbol(url.searchParams.get("symbol"));
  const interval = parseCandleInterval(url.searchParams.get("interval"));
  if (!venue || !symbol || !interval) {
    return Response.json(
      { error: "Need venue, symbol, and interval." },
      { status: 400 },
    );
  }
  const venueEnvironment =
    venue === "hyperliquid"
      ? hyperliquidInfoEnvironment(url.searchParams.get("env"))
      : null;
  try {
    const span = await loadCandleSpan({
      venue,
      venueEnvironment,
      symbol,
      interval,
    });
    if (!span) {
      return Response.json(
        { error: `No ${intervalHistoryLabel(interval)} candles for ${symbol}.` },
        { status: 404 },
      );
    }
    return Response.json({
      symbol: span.symbol,
      interval,
      earliestMs: span.earliestMs,
      latestMs: span.latestMs,
    });
  } catch {
    return Response.json(
      { error: "Could not read candle history." },
      { status: 502 },
    );
  }
}
