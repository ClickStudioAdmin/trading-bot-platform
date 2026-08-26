import assert from "node:assert/strict";
import { floorToStep, maxStep, qtyFromNotionalUsdt, stepDecimals } from "./qty";
import { floorCarryQty, qtyForCarryLegs, sizeVenueCloseQty } from "./orders";

assert.equal(stepDecimals(0.001), 3);
assert.equal(floorToStep(0.1234, 0.001), 0.123);
assert.equal(floorToStep(0.0004, 0.001), 0);

const sized = qtyFromNotionalUsdt({
  notionalUsdt: 10_000,
  price: 50_000,
  step: 0.001,
  minQty: 0.001,
});
assert.equal(sized.ok, true);
if (sized.ok) {
  assert.equal(sized.qty, 0.2);
  assert.equal(sized.text, "0.200");
}

const tooSmall = qtyFromNotionalUsdt({
  notionalUsdt: 10,
  price: 50_000,
  step: 0.001,
  minQty: 0.001,
});
assert.equal(tooSmall.ok, false);

const tooLarge = qtyFromNotionalUsdt({
  notionalUsdt: 200_000,
  price: 50_000,
  step: 0.001,
  minQty: 0.001,
  maxQty: 1,
});
assert.equal(tooLarge.ok, false);

assert.equal(maxStep(0.001, 0.01), 0.01);

const legs = qtyForCarryLegs({
  notionalUsdt: 10_000,
  spotAsk: 100_000,
  spot: {
    symbol: "BTCUSDT",
    status: "Trading",
    baseCoin: "BTC",
    quoteCoin: "USDT",
    lotSizeFilter: { qtyStep: "0.0001", minOrderQty: "0.0001" },
  },
  future: {
    symbol: "BTCUSDT-25JUN27",
    status: "Trading",
    baseCoin: "BTC",
    quoteCoin: "USDT",
    lotSizeFilter: { qtyStep: "0.001", minOrderQty: "0.001" },
  },
});
assert.equal(legs.ok, true);
if (legs.ok) {
  assert.equal(legs.qty, 0.1);
}

const spot = {
  symbol: "BTCUSDT",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  lotSizeFilter: { qtyStep: "0.0001", minOrderQty: "0.0001" },
};
const future = {
  symbol: "BTCUSDT-25JUN27",
  status: "Trading",
  baseCoin: "BTC",
  quoteCoin: "USDT",
  lotSizeFilter: { qtyStep: "0.001", minOrderQty: "0.001" },
};
const clipped = floorCarryQty(0.0015, spot, future);
assert.equal(clipped.ok, true);
if (clipped.ok) {
  assert.equal(clipped.qty, 0.001);
  assert.equal(clipped.text, "0.001");
}

const belowMin = floorCarryQty(0.0004, spot, future);
assert.equal(belowMin.ok, false);

const flatten = sizeVenueCloseQty({
  rawQty: 0.083,
  remainingQty: 0.083,
  flatten: true,
  step: 0.001,
  minQty: 0.001,
});
assert.equal(flatten.ok, true);
if (flatten.ok) {
  assert.equal(flatten.text, "0.083");
}

const thinUnwind = sizeVenueCloseQty({
  rawQty: 0.0004,
  remainingQty: 0.083,
  flatten: false,
  step: 0.001,
  minQty: 0.001,
});
assert.equal(thinUnwind.ok, false);

const dust = sizeVenueCloseQty({
  rawQty: 0.0004,
  remainingQty: 0.0004,
  flatten: false,
  step: 0.001,
  minQty: 0.001,
});
assert.equal(dust.ok, true);
if (dust.ok) {
  assert.equal(dust.text, "0.0004");
}

console.log("bybit qty checks passed");
