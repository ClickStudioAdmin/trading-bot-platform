import assert from "node:assert/strict";
import { isUsdtLinearPerp, qtyForPerp } from "./perp";

assert.equal(
  isUsdtLinearPerp({
    symbol: "BTCUSDT",
    status: "Trading",
    baseCoin: "BTC",
    quoteCoin: "USDT",
    settleCoin: "USDT",
    contractType: "LinearPerpetual",
    deliveryTime: "0",
  }),
  true,
);
assert.equal(
  isUsdtLinearPerp({
    symbol: "BTCUSDT-27JUN26",
    status: "Trading",
    baseCoin: "BTC",
    quoteCoin: "USDT",
    contractType: "LinearFutures",
    deliveryTime: "1780000000000",
  }),
  false,
);
assert.equal(
  isUsdtLinearPerp({
    symbol: "BTCUSDT",
    status: "Closed",
    baseCoin: "BTC",
    quoteCoin: "USDT",
    contractType: "LinearPerpetual",
  }),
  false,
);

const sized = qtyForPerp(0.00123, {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  lotSizeFilter: { qtyStep: "0.001", minOrderQty: "0.001" },
});
assert.equal(sized.ok, true);
if (sized.ok) {
  assert.equal(sized.qty, 0.001);
  assert.equal(sized.text, "0.001");
}

const tooSmall = qtyForPerp(0.0004, {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  lotSizeFilter: { qtyStep: "0.001", minOrderQty: "0.001" },
});
assert.equal(tooSmall.ok, false);

console.log("bybit perp checks passed");
