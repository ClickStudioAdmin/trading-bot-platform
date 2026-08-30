import assert from "node:assert/strict";
import {
  formatPerpPairLabel,
  isUsdtLinearPerp,
  listUsdtLinearPerps,
  priceForPerp,
  qtyForPerp,
  qtyForPerpNotional,
} from "./perp";

assert.equal(
  formatPerpPairLabel({
    symbol: "BTCUSDT",
    baseCoin: "BTC",
    quoteCoin: "USDT",
  }),
  "BTC-USDT",
);
assert.equal(
  formatPerpPairLabel({
    symbol: "BTC",
    baseCoin: "BTC",
    quoteCoin: "USDC",
  }),
  "BTC-USDC",
);
assert.equal(
  formatPerpPairLabel({
    symbol: "1000PEPEUSDT",
    baseCoin: "1000PEPE",
    quoteCoin: "USDT",
  }),
  "1000PEPE-USDT",
);

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

const listed = listUsdtLinearPerps([
  {
    symbol: "PEPEUSDT",
    status: "Trading",
    baseCoin: "PEPE",
    quoteCoin: "USDT",
    contractType: "LinearPerpetual",
    deliveryTime: "0",
  },
  {
    symbol: "ETHUSDT",
    status: "Trading",
    baseCoin: "ETH",
    quoteCoin: "USDT",
    contractType: "LinearPerpetual",
    deliveryTime: "0",
  },
  {
    symbol: "BTCUSDT-27JUN26",
    status: "Trading",
    baseCoin: "BTC",
    quoteCoin: "USDT",
    contractType: "LinearFutures",
    deliveryTime: "1780000000000",
  },
  {
    symbol: "BTCUSDT",
    status: "Trading",
    baseCoin: "BTC",
    quoteCoin: "USDT",
    contractType: "LinearPerpetual",
    deliveryTime: "0",
  },
]);
assert.deepEqual(
  listed.map((row) => row.symbol),
  ["BTCUSDT", "ETHUSDT", "PEPEUSDT"],
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

const tooLarge = qtyForPerp(5, {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  lotSizeFilter: { qtyStep: "0.001", minOrderQty: "0.001", maxOrderQty: "2" },
});
assert.equal(tooLarge.ok, false);

const atMax = qtyForPerp(2, {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  lotSizeFilter: { qtyStep: "0.001", minOrderQty: "0.001", maxOrderQty: "2" },
});
assert.equal(atMax.ok, true);

const fromUsdt = qtyForPerpNotional(10_000, 50_000, {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  lotSizeFilter: {
    qtyStep: "0.001",
    minOrderQty: "0.001",
    minNotionalValue: "5",
  },
});
assert.equal(fromUsdt.ok, true);
if (fromUsdt.ok) {
  assert.equal(fromUsdt.qty, 0.2);
  assert.equal(fromUsdt.text, "0.200");
}

const notionalTooSmall = qtyForPerpNotional(1, 50_000, {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  lotSizeFilter: {
    qtyStep: "0.001",
    minOrderQty: "0.001",
    minNotionalValue: "5",
  },
});
assert.equal(notionalTooSmall.ok, false);

const priced = priceForPerp(80123.456, {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  priceFilter: { tickSize: "0.1" },
});
assert.equal(priced.ok, true);
if (priced.ok) {
  assert.equal(priced.price, 80123.4);
  assert.equal(priced.text, "80123.4");
}

console.log("bybit perp checks passed");
