import assert from "node:assert/strict";
import {
  applyUsableBookShare,
  pairCapacityUsdt,
  parseUsableBookShare,
  usableBookShareToInput,
  usableBookUsdt,
  walkNotional,
} from "./capacity";

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
  Math.min(100 * 2 + 100.04 * 3, 102 * 1 + 101.96 * 2),
);
assert.equal(usableBookUsdt(10_000, 0.25), 2_500);
assert.equal(usableBookUsdt(10_000, 1), 10_000);
assert.deepEqual(
  applyUsableBookShare([{ capacityUsdt: 8_000 }], 0.25),
  [{ capacityUsdt: 2_000 }],
);
assert.equal(parseUsableBookShare("25"), 0.25);
assert.equal(parseUsableBookShare(""), 0.25);
assert.equal(usableBookShareToInput(0.25), "25");
assert.equal(
  (parseUsableBookShare("0") as { error: string }).error.includes("1 and 100"),
  true,
);

assert.equal(walkNotional([], "buy", 0.0005, 5), 0);

console.log("capacity checks passed");
