import assert from "node:assert/strict";
import { pairCapacityUsdt, walkNotional } from "./capacity";

const asks = [
  { price: 100, size: 2 },
  { price: 100.04, size: 3 },
  { price: 100.2, size: 10 },
];

assert.equal(walkNotional(asks, "buy", 0.0005, 5), 100 * 2 + 100.04 * 3);

const bids = [
  { price: 102, size: 1 },
  { price: 101.96, size: 2 },
  { price: 101, size: 8 },
];

assert.equal(walkNotional(bids, "sell", 0.0005, 5), 102 * 1 + 101.96 * 2);

assert.equal(
  pairCapacityUsdt(asks, bids),
  Math.min(100 * 2 + 100.04 * 3, 102 * 1 + 101.96 * 2) * 0.25,
);

assert.equal(walkNotional([], "buy", 0.0005, 5), 0);

console.log("capacity checks passed");
