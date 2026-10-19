import assert from "node:assert/strict";
import {
  formatMaxLeverage,
  formatSymbolLot,
  formatSymbolPrice,
  formatSymbolSpread,
  symbolQuotesFromTickers,
  symbolSpreadTicks,
} from "./symbol-details";

assert.equal(
  symbolSpreadTicks({ bid: 57.509, ask: 57.538, tickSize: 0.001 }),
  29,
);
assert.equal(symbolSpreadTicks({ bid: 100, ask: 100, tickSize: 0.1 }), 0);
assert.equal(symbolSpreadTicks({ bid: null, ask: 1, tickSize: 0.1 }), null);
assert.equal(symbolSpreadTicks({ bid: 2, ask: 1, tickSize: 0.1 }), null);

assert.equal(formatSymbolPrice(57.509, 0.001), "57.509");
assert.equal(formatSymbolPrice(57.538, 0.001), "57.538");
assert.equal(formatSymbolPrice(67000.5, 0.1), "67,000.5");
assert.equal(formatSymbolPrice(null, 0.001), "—");

assert.equal(formatSymbolLot(0.01), "0.01");
assert.equal(formatSymbolLot(20), "20");
assert.equal(formatSymbolLot(0), "—");

assert.equal(formatMaxLeverage(100), "100.00");
assert.equal(formatMaxLeverage(null), "—");
assert.equal(formatSymbolSpread(29), "29");
assert.equal(formatSymbolSpread(null), "—");

assert.deepEqual(
  symbolQuotesFromTickers([
    ["SOLUSDT", { bid1Price: "57.509", ask1Price: "57.538" }],
    ["BTCUSDT", { bid1Price: "0", ask1Price: "" }],
  ]),
  {
    SOLUSDT: { bid: 57.509, ask: 57.538 },
    BTCUSDT: { bid: null, ask: null },
  },
);

console.log("symbol details checks passed");
