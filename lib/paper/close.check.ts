import assert from "node:assert/strict";
import { closeClipPlan } from "./close";

const partial = closeClipPlan({
  remainingUsdt: 10_000,
  clipUsdt: 2_500,
  priorCloses: [],
  entryBasis: 0.02,
  exitBasis: 0.01,
  feeRate: 0.002,
  openedAtMs: 0,
  closedAtMs: 86_400_000,
});
assert.deepEqual(partial, { kind: "partial", remainingUsdt: 7_500 });

const flat = closeClipPlan({
  remainingUsdt: 2_500,
  clipUsdt: 2_500,
  priorCloses: [
    { notionalUsdt: 7_500, fillBasis: 0.012, feeRate: 0.002 },
  ],
  entryBasis: 0.02,
  exitBasis: 0.01,
  feeRate: 0.002,
  openedAtMs: 0,
  closedAtMs: 86_400_000,
});
assert.equal(flat.kind, "flat");
if (flat.kind === "flat") {
  assert.equal(flat.openedNotionalUsdt, 10_000);
}

assert.throws(() =>
  closeClipPlan({
    remainingUsdt: 1_000,
    clipUsdt: 2_000,
    priorCloses: [],
    entryBasis: 0.02,
    exitBasis: 0.01,
    feeRate: 0.002,
    openedAtMs: 0,
    closedAtMs: 86_400_000,
  }),
);

console.log("paper close checks passed");
