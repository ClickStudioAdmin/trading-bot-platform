import assert from "node:assert/strict";
import {
  parseFuturesAction,
  parseFuturesLimitPrice,
  parseFuturesNotional,
  parseFuturesOrderType,
  parseFuturesQty,
  parseFuturesSizeUnit,
  parseFuturesSymbol,
} from "./model";

const cleaned = parseFuturesSymbol("btc-usdt");
assert.equal(cleaned.ok, true);
if (cleaned.ok) {
  assert.equal(cleaned.symbol, "BTCUSDT");
}
assert.equal(parseFuturesSymbol("BTCUSDT").ok, true);
assert.equal(parseFuturesSymbol("BTCUSD").ok, false);
assert.equal(parseFuturesSymbol("xx").ok, false);

assert.equal(parseFuturesQty("0.001").ok, true);
assert.equal(parseFuturesQty("0").ok, false);
assert.equal(parseFuturesQty("abc").ok, false);

assert.equal(parseFuturesSizeUnit("").ok, true);
assert.equal(parseFuturesSizeUnit("qty").ok, true);
assert.equal(parseFuturesSizeUnit("USDT").ok, true);
assert.equal(parseFuturesSizeUnit("usdc").ok, true);
assert.equal(parseFuturesSizeUnit("shares").ok, false);
const usdtUnit = parseFuturesSizeUnit("USDC");
assert.equal(usdtUnit.ok, true);
if (usdtUnit.ok) {
  assert.equal(usdtUnit.unit, "usdt");
}

assert.equal(parseFuturesNotional("100").ok, true);
assert.equal(parseFuturesNotional("0").ok, false);

assert.equal(parseFuturesAction("Buy").ok, true);
assert.equal(parseFuturesAction("flatten").ok, true);
assert.equal(parseFuturesAction("close").ok, true);
const closed = parseFuturesAction("Close");
assert.equal(closed.ok, true);
if (closed.ok) {
  assert.equal(closed.action, "flatten");
}
assert.equal(parseFuturesAction("flip").ok, false);

assert.equal(parseFuturesOrderType("").ok, true);
assert.equal(parseFuturesOrderType("Limit").ok, true);
const limitType = parseFuturesOrderType("limit");
assert.equal(limitType.ok, true);
if (limitType.ok) {
  assert.equal(limitType.orderType, "limit");
}
assert.equal(parseFuturesOrderType("stop").ok, false);
assert.equal(parseFuturesLimitPrice("80123.4").ok, true);
assert.equal(parseFuturesLimitPrice("0").ok, false);

console.log("futures model checks passed");
