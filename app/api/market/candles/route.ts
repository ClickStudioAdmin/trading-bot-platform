import { loadDeskCandles } from "@/lib/market/desk-klines";
import {
  parseCandleInterval,
  parseCandleLimit,
  parseCandleSymbol,
  parseCandleVenue,
  parseOptionalMs,
} from "@/lib/market/candles";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";

export const maxDuration = 20;

let cache: {
  key: string;
  at: number;
  candles: Awaited<ReturnType<typeof loadDeskCandles>>;
} | null = null;
const CACHE_MS = 8_000;

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
  const limit = parseCandleLimit(url.searchParams.get("limit"));
  const fromMs = parseOptionalMs(url.searchParams.get("from"));
  const toMs = parseOptionalMs(url.searchParams.get("to"));
  const env = hyperliquidInfoEnvironment(url.searchParams.get("env"));
  const key = `${venue}:${env}:${symbol}:${interval}:${limit}:${fromMs ?? ""}:${toMs ?? ""}`;
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) {
    return Response.json({ candles: cache.candles });
  }
  try {
    const candles = await loadDeskCandles({
      venue,
      venueEnvironment: venue === "hyperliquid" ? env : null,
      symbol,
      interval,
      limit,
      fromMs: fromMs ?? undefined,
      toMs: toMs ?? undefined,
    });
    cache = { key, at: Date.now(), candles };
    return Response.json({ candles });
  } catch {
    return Response.json({ error: "Could not read candles." }, { status: 502 });
  }
}
