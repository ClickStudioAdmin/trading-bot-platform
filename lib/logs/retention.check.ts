import assert from "node:assert/strict";
import {
  EVENT_LOG_RETENTION_BATCH,
  EVENT_LOG_RETENTION_DAYS,
  eventLogExpired,
  eventLogIdsToDelete,
  eventLogRetentionBatch,
  eventLogRetentionCutoffIso,
  eventLogRetentionCutoffMs,
} from "./retention";

const nowMs = Date.UTC(2026, 9, 15, 8, 0, 0);
const cutoffMs = eventLogRetentionCutoffMs(nowMs);

assert.equal(EVENT_LOG_RETENTION_DAYS, 60);
assert.equal(EVENT_LOG_RETENTION_BATCH, 1_000);
assert.equal(cutoffMs, nowMs - 60 * 24 * 60 * 60 * 1000);
assert.equal(eventLogRetentionCutoffIso(nowMs), new Date(cutoffMs).toISOString());
assert.equal(eventLogExpired(cutoffMs, cutoffMs), false);
assert.equal(eventLogExpired(cutoffMs - 1, cutoffMs), true);
assert.equal(eventLogExpired(cutoffMs + 1, cutoffMs), false);
assert.equal(eventLogExpired(Number.NaN, cutoffMs), false);

assert.equal(eventLogRetentionBatch(), 1_000);
assert.equal(eventLogRetentionBatch(2_500), 1_000);
assert.equal(eventLogRetentionBatch(0), 1);
assert.equal(eventLogRetentionBatch(40), 40);

assert.deepEqual(
  eventLogIdsToDelete([1, 1, 0, 2.5, -3, 4, 5, 6], 3),
  [1, 4, 5],
);
assert.equal(eventLogIdsToDelete([1, 2, 3]).length, 3);

console.log("event log retention ok");
