import assert from "node:assert/strict";
import {
  carryPnlUsdt,
  closePaperCarry,
  daysHeld,
  realizedApr,
} from "./math";

function almostEqual(actual: number, expected: number, digits = 6) {
  assert.ok(
    Math.abs(actual - expected) < 10 ** -digits,
    `expected ${expected}, got ${actual}`,
  );
}

almostEqual(carryPnlUsdt(0.02, 0.01, 10_000, 0.002), 60);
almostEqual(carryPnlUsdt(0.02, 0.02, 10_000, 0.002), -40);
almostEqual(carryPnlUsdt(0.012, -0.001, 10_000, 0.002), 90);

assert.equal(daysHeld(0, 86_400_000), 1);
almostEqual(daysHeld(0, 45 * 86_400_000), 45);

const apr = realizedApr(90, 10_000, 45);
assert.ok(apr !== null);
almostEqual(apr, 0.073, 5);

assert.equal(realizedApr(90, 10_000, 0), null);
assert.equal(realizedApr(90, 10_000, -1), null);

const closed = closePaperCarry({
  entryBasis: 0.012,
  exitBasis: -0.001,
  notionalUsdt: 10_000,
  feeRate: 0.002,
  openedAtMs: 0,
  closedAtMs: 45 * 86_400_000,
});
almostEqual(closed.realizedUsdt, 90);
almostEqual(closed.daysHeld, 45);
assert.ok(closed.realizedApr !== null);
almostEqual(closed.realizedApr, 0.073, 5);

assert.throws(() => carryPnlUsdt(0.01, 0.009, 0, 0.002));
assert.throws(() => carryPnlUsdt(Number.NaN, 0.01, 1_000, 0.002));
assert.throws(() => carryPnlUsdt(0.01, 0.009, 1_000, -0.001));

console.log("paper carry math checks passed");
