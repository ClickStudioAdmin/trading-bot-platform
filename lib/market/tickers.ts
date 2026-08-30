import { parseFuturesSymbol } from "@/lib/futures/model";
import { parseHyperliquidSymbol } from "@/lib/venues/hyperliquid/symbol";

export const MARKET_TICKER_LIMIT = 24;

export function parseTickerSymbolsQuery(value: unknown): string[] {
  const raw = String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const symbols: string[] = [];
  for (const part of raw) {
    const usdt = parseFuturesSymbol(part);
    const parsed = usdt.ok ? usdt : parseHyperliquidSymbol(part);
    if (!parsed.ok || seen.has(parsed.symbol)) {
      continue;
    }
    seen.add(parsed.symbol);
    symbols.push(parsed.symbol);
    if (symbols.length >= MARKET_TICKER_LIMIT) {
      break;
    }
  }
  return symbols;
}
