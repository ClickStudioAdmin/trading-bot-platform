import assert from "node:assert/strict";
import { hyperliquidTpslWires } from "./orders";
import {
  cloidFromIdempotency,
  floatToWire,
  hyperliquidCoin,
  orderAction,
  orderWire,
  priceToWire,
} from "./wire";

assert.equal(hyperliquidCoin("BTC"), "BTC");
assert.equal(hyperliquidCoin("btcusdt"), "BTC");
assert.equal(hyperliquidCoin("ETHUSDC"), "ETH");
assert.equal(floatToWire(30000), "30000");
assert.equal(floatToWire(0.1), "0.1");
assert.equal(floatToWire(1.23000000), "1.23");
assert.equal(floatToWire(-1), null);
assert.equal(priceToWire(115370.37037, 5), "115370");
assert.equal(priceToWire(1234.5678, 0), "1234.6");
assert.equal(priceToWire(1.2345678, 0), "1.2346");
assert.equal(priceToWire(-1, 5), null);

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

const [tpLimit] = hyperliquidTpslWires({
  asset: 3,
  closeIsBuy: false,
  size: "0.2",
  szDecimals: 5,
  tpsl: {
    takeProfit: "80000",
    tpOrderType: "Limit",
    tpLimitPrice: "80100",
  },
});
assert.ok(tpLimit && "trigger" in tpLimit.t);
if (tpLimit && "trigger" in tpLimit.t) {
  assert.equal(tpLimit.t.trigger.isMarket, false);
  assert.equal(tpLimit.t.trigger.triggerPx, "80000");
  assert.equal(tpLimit.p, "80100");
}

console.log("hyperliquid wire checks passed");
