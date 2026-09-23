import assert from "node:assert/strict";
import {
  DCA_TICK_ENTRY_BATCH,
  dcaTickWorkRank,
  orderDcaTickWork,
  sliceDcaTickEntries,
} from "./tick-order";

assert.equal(dcaTickWorkRank("close"), 0);
assert.equal(dcaTickWorkRank("flatten"), 0);
assert.ok(dcaTickWorkRank("sync") < dcaTickWorkRank("breakeven"));
assert.ok(dcaTickWorkRank("breakeven") < dcaTickWorkRank("arm"));
assert.ok(dcaTickWorkRank("arm") === dcaTickWorkRank("clip"));

const ordered = orderDcaTickWork([
  { id: "entry-a", rank: dcaTickWorkRank("arm") },
  { id: "stop", rank: dcaTickWorkRank("close") },
  { id: "sync", rank: dcaTickWorkRank("sync") },
  { id: "entry-b", rank: dcaTickWorkRank("clip") },
  { id: "breakeven", rank: dcaTickWorkRank("breakeven") },
]);

assert.deepEqual(
  ordered.items.map((row) => row.id),
  ["stop", "sync", "breakeven", "entry-a", "entry-b"],
);
assert.equal(ordered.nextEntryOffset, 0);

const burst = orderDcaTickWork(
  Array.from({ length: DCA_TICK_ENTRY_BATCH + 5 }, (_, index) => ({
    id: `arm-${index}`,
    rank: dcaTickWorkRank("arm"),
  })).concat([{ id: "stop", rank: dcaTickWorkRank("close") }]),
  DCA_TICK_ENTRY_BATCH,
);

assert.equal(burst.items[0]?.id, "stop");
assert.equal(burst.items.length, DCA_TICK_ENTRY_BATCH + 1);
assert.equal(
  burst.items[burst.items.length - 1]?.id,
  `arm-${DCA_TICK_ENTRY_BATCH - 1}`,
);
assert.equal(burst.nextEntryOffset, DCA_TICK_ENTRY_BATCH);

const rotated = sliceDcaTickEntries(
  Array.from({ length: 13 }, (_, index) => `arm-${index}`),
  DCA_TICK_ENTRY_BATCH,
  DCA_TICK_ENTRY_BATCH,
);
assert.deepEqual(rotated.taken, [
  "arm-8",
  "arm-9",
  "arm-10",
  "arm-11",
  "arm-12",
  "arm-0",
  "arm-1",
  "arm-2",
]);
assert.equal(rotated.nextOffset, 3);

console.log("dca tick order checks passed");
