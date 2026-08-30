import assert from "node:assert/strict";
import {
  claimEngineDesksFromState,
  releaseEngineDeskFromState,
  tryClaimEngineDeskFromState,
  tryClaimEngineScanFromState,
  venueSlotWaitMs,
  engineLoopMs,
  type DeskLease,
} from "./lease";

function desks(count: number): DeskLease[] {
  return Array.from({ length: count }, (_, i) => ({
    accountId: `desk-${String(i + 1).padStart(2, "0")}`,
    workerId: null,
    leasedUntilMs: 0,
  }));
}

const first = claimEngineDesksFromState({
  leases: desks(1),
  workerId: "a",
  nowMs: 1_000,
  ttlMs: 45_000,
  limit: 4,
});
assert.deepEqual(first.claimed, ["desk-01"]);
const second = claimEngineDesksFromState({
  leases: first.leases,
  workerId: "b",
  nowMs: 1_000,
  ttlMs: 45_000,
  limit: 4,
});
assert.deepEqual(second.claimed, []);

const wave = claimEngineDesksFromState({
  leases: desks(20),
  workerId: "a",
  nowMs: 1_000,
  ttlMs: 45_000,
  limit: 10,
});
assert.equal(wave.claimed.length, 10);
const rest = claimEngineDesksFromState({
  leases: wave.leases,
  workerId: "b",
  nowMs: 1_000,
  ttlMs: 45_000,
  limit: 10,
});
assert.equal(rest.claimed.length, 10);
assert.equal(new Set([...wave.claimed, ...rest.claimed]).size, 20);
for (const id of wave.claimed) {
  assert.equal(rest.claimed.includes(id), false);
}

const held = claimEngineDesksFromState({
  leases: desks(1),
  workerId: "a",
  nowMs: 1_000,
  ttlMs: 45_000,
  limit: 1,
});
const stale = claimEngineDesksFromState({
  leases: held.leases,
  workerId: "b",
  nowMs: 50_000,
  ttlMs: 45_000,
  limit: 1,
});
assert.deepEqual(stale.claimed, ["desk-01"]);
assert.equal(stale.leases[0]?.workerId, "b");

const locked = tryClaimEngineDeskFromState({
  leases: first.leases,
  accountId: "desk-01",
  workerId: "save",
  nowMs: 1_000,
  ttlMs: 20_000,
});
assert.equal(locked.ok, false);

const own = tryClaimEngineDeskFromState({
  leases: first.leases,
  accountId: "desk-01",
  workerId: "a",
  nowMs: 1_000,
  ttlMs: 20_000,
});
assert.equal(own.ok, true);

const released = releaseEngineDeskFromState({
  leases: first.leases,
  accountId: "desk-01",
  workerId: "a",
});
const afterRelease = claimEngineDesksFromState({
  leases: released,
  workerId: "b",
  nowMs: 1_000,
  ttlMs: 45_000,
  limit: 1,
});
assert.deepEqual(afterRelease.claimed, ["desk-01"]);

const scanA = tryClaimEngineScanFromState({
  leases: [],
  scanKey: "public_market",
  workerId: "a",
  nowMs: 1_000,
  ttlMs: 18_000,
});
assert.equal(scanA.ok, true);
const scanB = tryClaimEngineScanFromState({
  leases: scanA.leases,
  scanKey: "public_market",
  workerId: "b",
  nowMs: 1_000,
  ttlMs: 18_000,
});
assert.equal(scanB.ok, false);
const scanExpired = tryClaimEngineScanFromState({
  leases: scanA.leases,
  scanKey: "public_market",
  workerId: "b",
  nowMs: 20_000,
  ttlMs: 18_000,
});
assert.equal(scanExpired.ok, true);

assert.equal(venueSlotWaitMs(1_200, 1_000), 200);
assert.equal(venueSlotWaitMs(1_000, 1_000), 0);
assert.equal(venueSlotWaitMs(8_000, 1_000), 0);

assert.equal(engineLoopMs({ indicatorArmed: false }), 20_000);
assert.equal(engineLoopMs({ indicatorArmed: true }), 8_000);
assert.equal(
  engineLoopMs({ indicatorArmed: true, idleMs: 20_000, indicatorMs: 8_000 }),
  8_000,
);

console.log("engine lease checks passed");
