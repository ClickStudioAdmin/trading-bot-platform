import assert from "node:assert/strict";
import { applyLiveMarks, type MarkedFutures } from "./mark";

const row = {
  symbol: "BTCUSDT",
  side: "long",
  qty: 0.002,
  entryPrice: 100,
  mark: 100,
  last: 100,
  unrealizedUsdt: 0,
  notionalUsdt: 0.2,
} as MarkedFutures;

const same = applyLiveMarks([row], null);
assert.equal(same[0]?.mark, 100);

const live = applyLiveMarks(
  [row],
  new Map([["BTCUSDT", { lastPrice: "110" }]]),
);
assert.equal(live[0]?.mark, 110);
assert.equal(live[0]?.last, 110);
assert.equal(live[0]?.unrealizedUsdt, 0.02);

console.log("futures mark checks passed");
