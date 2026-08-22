import assert from "node:assert/strict";
import {
  isDatedLinearFuture,
  pairCarryUniverse,
  type BybitInstrument,
} from "./universe";

const spotBtc: BybitInstrument = {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
};

const futureBtc: BybitInstrument = {
  symbol: "BTCUSDT-25SEP26",
  contractType: "LinearFutures",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  settleCoin: "USDT",
  deliveryTime: "1788000000000",
};

const perpBtc: BybitInstrument = {
  symbol: "BTCUSDT",
  contractType: "LinearPerpetual",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  settleCoin: "USDT",
  deliveryTime: "0",
};

assert.equal(isDatedLinearFuture(futureBtc), true);
assert.equal(isDatedLinearFuture(perpBtc), false);

const pairs = pairCarryUniverse(
  [futureBtc, perpBtc],
  [spotBtc],
  0,
);
assert.equal(pairs.length, 1);
assert.equal(pairs[0]?.spotSymbol, "BTCUSDT");
assert.equal(pairs[0]?.futureSymbol, "BTCUSDT-25SEP26");
assert.ok((pairs[0]?.daysToExpiry ?? 0) > 0);

assert.equal(pairCarryUniverse([futureBtc], [], 0).length, 0);

console.log("bybit universe checks passed");
