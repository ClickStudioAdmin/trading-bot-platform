import assert from "node:assert/strict";
import {
  parseFuturesAction,
  parseFuturesLimitPrice,
  parseFuturesNotional,
  parseCloseQty,
  parseFuturesOrderType,
  parseFuturesQty,
  parseFuturesSizeUnit,
  parseFuturesSymbol,
  parseFuturesTradeSource,
  parseFuturesPositionRow,
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

assert.deepEqual(parseCloseQty("", 1.5), { ok: true, qty: 1.5 });
assert.deepEqual(parseCloseQty("0.4", 1.5), { ok: true, qty: 0.4 });
assert.deepEqual(parseCloseQty("9", 1.5), { ok: true, qty: 1.5 });
assert.equal(parseCloseQty("0", 1.5).ok, false);

assert.equal(parseFuturesTradeSource("engine"), "engine");
assert.equal(parseFuturesTradeSource("webhook"), "webhook");
assert.equal(parseFuturesTradeSource("manual"), "manual");
assert.equal(parseFuturesTradeSource(null), "manual");

const closingRow = parseFuturesPositionRow({
  id: "p1",
  user_id: "u1",
  account_id: "a1",
  symbol: "BTCUSDT",
  side: "long",
  qty: 1,
  entry_price: 100,
  notional_usdt: 100,
  realized_usdt: 0,
  status: "closing",
  source: "manual",
  opened_at: "2026-09-10T00:00:00.000Z",
  closed_at: null,
});
assert.equal(closingRow.status, "closing");

console.log("futures model checks passed");
