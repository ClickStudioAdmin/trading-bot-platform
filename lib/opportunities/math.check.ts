import assert from "node:assert/strict";
import {
  daysToExpiry,
  executableBasis,
  netApr,
  netBasis,
  rankOpportunity,
} from "./math";

function almostEqual(actual: number, expected: number, digits = 6) {
  assert.ok(
    Math.abs(actual - expected) < 10 ** -digits,
    `expected ${expected}, got ${actual}`,
  );
}

almostEqual(executableBasis(102_400, 100_000), 0.024);
almostEqual(executableBasis(101_000, 100_000), 0.01);

assert.equal(daysToExpiry(86_400_000, 0), 1);
almostEqual(daysToExpiry(90 * 86_400_000, 0), 90);

almostEqual(netBasis(0.024, 0.001, 0.0005, 0), 0.0225);
almostEqual(netBasis(0.024, 0.002, 0.0006, 0), 0.0214);

const apr = netApr(0.024, 90);
assert.ok(apr !== null);
almostEqual(apr, 0.097333, 5);

assert.equal(netApr(0.02, 0), null);
assert.equal(netApr(0.02, -1), null);

const ranked = rankOpportunity({
  futureBid: 102_400,
  spotAsk: 100_000,
  feeRate: 0.002,
  slippageRate: 0.0006,
  deliveryFeeRate: 0,
  deliveryTimeMs: 90 * 86_400_000,
  nowMs: 0,
});
almostEqual(ranked.executableBasis, 0.024);
almostEqual(ranked.daysToExpiry, 90);
almostEqual(ranked.netBasis, 0.0214);
assert.ok(ranked.netApr !== null);
almostEqual(ranked.netApr, 0.086789, 5);

assert.throws(() => executableBasis(0, 100_000));
assert.throws(() => executableBasis(100_000, 0));

console.log("opportunity math checks passed");
