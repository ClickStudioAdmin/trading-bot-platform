import assert from "node:assert/strict";
import {
  attachFuturesVenueRisk,
  formatLeverage,
  futuresVenueRiskKey,
  mapLinearPositionRisk,
} from "./venue-risk";
import type { MarkedFutures } from "./mark";

assert.equal(futuresVenueRiskKey("BTCUSDT", "long"), "BTCUSDT:1");
assert.equal(futuresVenueRiskKey("BTCUSDT", "short"), "BTCUSDT:2");

const risk = mapLinearPositionRisk([
  {
    symbol: "BTCUSDT",
    positionIdx: 1,
    leverage: 10,
    liqPrice: 81_000,
  },
  {
    symbol: "ETHUSDT",
    positionIdx: 2,
    leverage: 5,
    liqPrice: null,
  },
]);
assert.deepEqual(risk.get("BTCUSDT:1"), { leverage: 10, liqPrice: 81_000 });
assert.equal(risk.get("ETHUSDT:2")?.liqPrice, null);

const row = {
  symbol: "BTCUSDT",
  side: "long",
  leverage: null,
  liqPrice: null,
} as MarkedFutures;

const attached = attachFuturesVenueRisk([row], risk);
assert.equal(attached[0]?.leverage, 10);
assert.equal(attached[0]?.liqPrice, 81_000);

const paper = attachFuturesVenueRisk([row], new Map());
assert.equal(paper[0]?.leverage, null);
assert.equal(paper[0]?.liqPrice, null);

assert.equal(formatLeverage(null), "—");
assert.equal(formatLeverage(0), "—");
assert.equal(formatLeverage(10), "10×");
assert.equal(formatLeverage(12.5), "12.5×");
