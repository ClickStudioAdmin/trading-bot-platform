import assert from "node:assert/strict";
import {
  claimEngineDesksFromState,
  type DeskLease,
} from "./lease";
import { deskKindsFromTypes, mergeHotAccountIds } from "./hot-desks";

assert.deepEqual(mergeHotAccountIds(["b", "a", ""], ["a", null]), ["a", "b"]);
assert.deepEqual(deskKindsFromTypes(["dca", "perps"]), {
  cashAndCarry: false,
  linear: true,
});
assert.deepEqual(deskKindsFromTypes(["cash_and_carry"]), {
  cashAndCarry: true,
  linear: false,
});
assert.deepEqual(deskKindsFromTypes(["signal_follower"]), {
  cashAndCarry: false,
  linear: false,
});

const leases: DeskLease[] = [
  { accountId: "cold-1", workerId: null, leasedUntilMs: 0 },
  { accountId: "hot-1", workerId: null, leasedUntilMs: 0 },
  { accountId: "cold-2", workerId: null, leasedUntilMs: 0 },
];
const hotFirst = claimEngineDesksFromState({
  leases,
  workerId: "a",
  nowMs: 1_000,
  ttlMs: 45_000,
  limit: 1,
  preferAccountIds: ["hot-1"],
});
assert.deepEqual(hotFirst.claimed, ["hot-1"]);

const skipDone = claimEngineDesksFromState({
  leases,
  workerId: "a",
  nowMs: 1_000,
  ttlMs: 45_000,
  limit: 1,
  preferAccountIds: ["hot-1"],
  excludeAccountIds: ["hot-1"],
});
assert.deepEqual(skipDone.claimed, ["cold-1"]);

console.log("engine hot-desk checks passed");
