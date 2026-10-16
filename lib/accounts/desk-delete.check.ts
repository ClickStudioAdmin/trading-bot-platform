import assert from "node:assert/strict";
import {
  DESK_DELETE_BUDGET_MS,
  DESK_DELETE_FAILED,
  DESK_DELETE_HAS_COPIES,
  DESK_DELETE_MISSING,
  DESK_DELETE_TIMED_OUT,
  continueTimedDeskDelete,
  deleteRowsInBatches,
  deskDeleteErrorMessage,
  deskDeletePastBudget,
  drainDeskDeleteChunks,
  interpretDeskDeleteChunk,
} from "./desk-delete";

assert.equal(
  deskDeleteErrorMessage("canceling statement due to statement timeout"),
  DESK_DELETE_TIMED_OUT,
);
assert.equal(
  deskDeleteErrorMessage("duplicate key value violates unique constraint"),
  DESK_DELETE_FAILED,
);
assert.equal(deskDeleteErrorMessage(DESK_DELETE_TIMED_OUT), DESK_DELETE_TIMED_OUT);
assert.equal(interpretDeskDeleteChunk("more"), "more");
assert.equal(interpretDeskDeleteChunk("done"), "done");
assert.deepEqual(interpretDeskDeleteChunk("missing"), {
  error: DESK_DELETE_MISSING,
});
assert.deepEqual(interpretDeskDeleteChunk("copies"), {
  error: DESK_DELETE_HAS_COPIES,
});
assert.deepEqual(
  interpretDeskDeleteChunk("canceling statement due to statement timeout"),
  { error: DESK_DELETE_TIMED_OUT },
);

async function main() {
const empty: string[] = [];
const emptyResult = await deleteRowsInBatches({
  batchSize: 2,
  maxBatches: 3,
  selectIds: async () => ({ ids: empty, error: null }),
  deleteIds: async () => {
    throw new Error("delete should not run");
  },
});
assert.equal(emptyResult, null);

const removed: Array<Array<string | number>> = [];
const oneBatch = await deleteRowsInBatches({
  batchSize: 3,
  maxBatches: 3,
  selectIds: async () => ({ ids: ["a", "b"], error: null }),
  deleteIds: async (ids) => {
    removed.push(ids);
    return { error: null };
  },
});
assert.equal(oneBatch, null);
assert.deepEqual(removed, [["a", "b"]]);

let passes = 0;
const continued = await deleteRowsInBatches({
  batchSize: 2,
  maxBatches: 3,
  selectIds: async () => {
    passes += 1;
    if (passes === 1) {
      return { ids: [1, 2], error: null };
    }
    return { ids: [3], error: null };
  },
  deleteIds: async () => ({ error: null }),
});
assert.equal(continued, null);
assert.equal(passes, 2);

const timedOut = await deleteRowsInBatches({
  batchSize: 1,
  maxBatches: 2,
  selectIds: async () => ({ ids: ["x"], error: null }),
  deleteIds: async () => ({ error: null }),
});
assert.equal(timedOut, DESK_DELETE_TIMED_OUT);

const failed = await deleteRowsInBatches({
  batchSize: 2,
  maxBatches: 2,
  selectIds: async () => ({
    ids: [],
    error: "canceling statement due to statement timeout",
  }),
  deleteIds: async () => ({ error: null }),
});
assert.equal(failed, DESK_DELETE_TIMED_OUT);

assert.equal(deskDeletePastBudget(1_000, 21_000, 20_000), true);
assert.equal(deskDeletePastBudget(1_000, 20_999, 20_000), false);

let budgetDeletes = 0;
const budgetHit = await deleteRowsInBatches({
  batchSize: 1,
  maxBatches: 5,
  startedAt: 0,
  budgetMs: 1,
  selectIds: async () => ({ ids: ["x"], error: null }),
  deleteIds: async () => {
    budgetDeletes += 1;
    return { error: null };
  },
});
assert.equal(budgetHit, DESK_DELETE_TIMED_OUT);
assert.equal(budgetDeletes, 0);
assert.equal(DESK_DELETE_BUDGET_MS < 60_000, true);
assert.equal(deskDeletePastBudget(1_000, 1_000 + DESK_DELETE_BUDGET_MS), true);
assert.equal(
  deskDeletePastBudget(1_000, 1_000 + DESK_DELETE_BUDGET_MS - 1),
  false,
);

const calls: string[] = [];
const finished = await continueTimedDeskDelete(
  async () => {
    calls.push("run");
    return calls.length === 2 ? "done" : DESK_DELETE_TIMED_OUT;
  },
  (result) => result === DESK_DELETE_TIMED_OUT,
  4,
);
assert.equal(finished, "done");
assert.deepEqual(calls, ["run", "run"]);

calls.length = 0;
const exhausted = await continueTimedDeskDelete(
  async () => {
    calls.push("run");
    return DESK_DELETE_TIMED_OUT;
  },
  (result) => result === DESK_DELETE_TIMED_OUT,
  3,
);
assert.equal(exhausted, DESK_DELETE_TIMED_OUT);
assert.equal(calls.length, 3);

const chunkCalls: string[] = [];
const drained = await drainDeskDeleteChunks(async () => {
  chunkCalls.push("chunk");
  return chunkCalls.length < 3 ? "more" : "done";
});
assert.equal(drained, null);
assert.equal(chunkCalls.length, 3);

const stopped = await drainDeskDeleteChunks(
  async () => "copies",
  Date.now(),
);
assert.equal(stopped, DESK_DELETE_HAS_COPIES);

const chunkBudget = await drainDeskDeleteChunks(
  async () => "more",
  0,
  1,
);
assert.equal(chunkBudget, DESK_DELETE_TIMED_OUT);

await assert.rejects(
  continueTimedDeskDelete(
    async () => {
      throw new Error("NEXT_REDIRECT");
    },
    () => true,
    3,
  ),
  /NEXT_REDIRECT/,
);

console.log("desk delete checks passed");
}

main();
