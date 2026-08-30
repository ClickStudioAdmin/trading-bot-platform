import assert from "node:assert/strict";
import { unwindClipUsdt } from "./clip";

assert.equal(unwindClipUsdt(10_000, 2_500, null), 2_500);
assert.equal(unwindClipUsdt(1_000, 2_500, null), 1_000);
assert.equal(unwindClipUsdt(10_000, 0, null), null);
assert.equal(unwindClipUsdt(10_000, 4_000, 5_000), null);
assert.equal(unwindClipUsdt(4_000, 1_000, 5_000), 4_000);
assert.equal(unwindClipUsdt(0, 2_000, null), null);

console.log("engine clip checks passed");
