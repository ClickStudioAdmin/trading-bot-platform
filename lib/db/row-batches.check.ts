import assert from "node:assert/strict";
import {
  ROW_BATCH_REMAINING,
  applyRowsInBatches,
  chunkList,
  statementTimeoutMessage,
} from "./row-batches";

assert.deepEqual(chunkList([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
assert.deepEqual(chunkList([], 3), []);
assert.deepEqual(chunkList(["a"], 0), [["a"]]);

assert.equal(
  statementTimeoutMessage(
    "canceling statement due to statement timeout",
    "timed out",
    "failed",
  ),
  "timed out",
);
assert.equal(
  statementTimeoutMessage(ROW_BATCH_REMAINING, "timed out", "failed"),
  "timed out",
);
assert.equal(
  statementTimeoutMessage("permission denied", "timed out", "failed"),
  "failed",
);

async function main() {
  const empty = await applyRowsInBatches({
    batchSize: 2,
    maxBatches: 3,
    selectIds: async () => ({ ids: [], error: null }),
    applyIds: async () => {
      throw new Error("apply should not run");
    },
  });
  assert.equal(empty, null);

  const applied: Array<Array<string | number>> = [];
  let passes = 0;
  const continued = await applyRowsInBatches({
    batchSize: 2,
    maxBatches: 3,
    selectIds: async () => {
      passes += 1;
      if (passes === 1) {
        return { ids: [1, 2], error: null };
      }
      return { ids: [3], error: null };
    },
    applyIds: async (ids) => {
      applied.push(ids);
      return { error: null };
    },
  });
  assert.equal(continued, null);
  assert.deepEqual(applied, [[1, 2], [3]]);

  const capped = await applyRowsInBatches({
    batchSize: 1,
    maxBatches: 2,
    selectIds: async () => ({ ids: ["x"], error: null }),
    applyIds: async () => ({ error: null }),
  });
  assert.equal(capped, ROW_BATCH_REMAINING);

  const failed = await applyRowsInBatches({
    batchSize: 2,
    maxBatches: 2,
    selectIds: async () => ({
      ids: [],
      error: "canceling statement due to statement timeout",
    }),
    applyIds: async () => ({ error: null }),
  });
  assert.match(String(failed), /statement timeout/);

  console.log("row batch checks passed");
}

main();
