import assert from "node:assert/strict";
import {
  cloidFromIdempotency,
  floatToWire,
  hyperliquidCoin,
  orderAction,
  orderWire,
} from "./wire";

assert.equal(hyperliquidCoin("BTC"), "BTC");
assert.equal(hyperliquidCoin("btcusdt"), "BTC");
assert.equal(hyperliquidCoin("ETHUSDC"), "ETH");
assert.equal(floatToWire(30000), "30000");
assert.equal(floatToWire(0.1), "0.1");
assert.equal(floatToWire(1.23000000), "1.23");
assert.equal(floatToWire(-1), null);

const cloid = cloidFromIdempotency("alert-1");
assert.equal(cloid?.startsWith("0x"), true);
assert.equal(cloid?.length, 34);
assert.equal(cloidFromIdempotency("0x0123456789abcdef0123456789abcdef"), "0x0123456789abcdef0123456789abcdef");
assert.equal(cloidFromIdempotency(""), null);

const wire = orderWire({
  asset: 0,
  isBuy: true,
  price: "30000",
  size: "0.1",
  tif: "Gtc",
});
assert.deepEqual(Object.keys(wire), ["a", "b", "p", "s", "r", "t"]);
assert.deepEqual(orderAction([wire]).grouping, "na");

console.log("hyperliquid wire checks passed");
