import assert from "node:assert/strict";
import {
  DESK_DELETE_FAILED,
  DESK_DELETE_TIMED_OUT,
  deleteRowsInBatches,
  deskDeleteErrorMessage,
} from "./desk-delete";

assert.equal(
  deskDeleteErrorMessage("canceling statement due to statement timeout"),
  DESK_DELETE_TIMED_OUT,
);
assert.equal(
  deskDeleteErrorMessage("duplicate key value violates unique constraint"),
  DESK_DELETE_FAILED,
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

console.log("desk delete checks passed");
}

main();
