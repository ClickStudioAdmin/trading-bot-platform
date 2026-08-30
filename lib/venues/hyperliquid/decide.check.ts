import assert from "node:assert/strict";
import { decideHyperliquidAction, hyperliquidOppositeRow } from "./decide";
import { parseDeskFuturesSymbol, parseHyperliquidSymbol } from "./symbol";

assert.deepEqual(parseHyperliquidSymbol("btc"), { ok: true, symbol: "BTC" });
assert.deepEqual(parseHyperliquidSymbol("BTCUSDT"), { ok: true, symbol: "BTC" });
assert.equal(parseHyperliquidSymbol("x").ok, false);
assert.deepEqual(parseDeskFuturesSymbol("hyperliquid", "ethusdt"), {
  ok: true,
  symbol: "ETH",
});
assert.equal(parseDeskFuturesSymbol("bybit", "BTC").ok, false);
assert.deepEqual(parseDeskFuturesSymbol("bybit", "BTCUSDT"), {
  ok: true,
  symbol: "BTCUSDT",
});

assert.equal(
  decideHyperliquidAction({
    action: "buy",
    open: null,
    reduceOnly: false,
  }).ok,
  true,
);
assert.equal(
  decideHyperliquidAction({
    action: "sell",
    open: { side: "long", qty: 1 },
    reduceOnly: false,
  }).ok,
  false,
);
assert.equal(
  decideHyperliquidAction({
    action: "buy",
    open: { side: "long", qty: 1 },
    reduceOnly: false,
  }).ok,
  true,
);
assert.equal(
  hyperliquidOppositeRow([{ side: "short" as const }], "long")?.side,
  "short",
);

console.log("hyperliquid desk decide checks passed");
