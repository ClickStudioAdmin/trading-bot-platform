import { hyperliquidCoin } from "@/lib/exchanges/hyperliquid/wire";

export function parseHyperliquidSymbol(
  raw: unknown,
): { ok: true; symbol: string } | { ok: false; error: string } {
  const symbol = hyperliquidCoin(String(raw ?? ""));
  if (!/^[A-Z0-9]{2,16}$/.test(symbol)) {
    return { ok: false, error: "Enter a Hyperliquid coin, for example BTC." };
  }
  return { ok: true, symbol };
}

export function parseDeskFuturesSymbol(
  venue: string,
  raw: unknown,
): { ok: true; symbol: string } | { ok: false; error: string } {
  if (venue === "hyperliquid") {
    return parseHyperliquidSymbol(raw);
  }
  const symbol = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (symbol.length < 4 || symbol.length > 32) {
    return { ok: false, error: "Enter a USDT perpetual symbol, for example BTCUSDT." };
  }
  if (!symbol.endsWith("USDT")) {
    return { ok: false, error: "Use a USDT linear perpetual, for example BTCUSDT." };
  }
  return { ok: true, symbol };
}
