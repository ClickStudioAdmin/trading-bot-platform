import assert from "node:assert/strict";
import { sweepReceiptSucceeded } from "./sweep-receipt";

assert.equal(sweepReceiptSucceeded("success"), true);
assert.equal(sweepReceiptSucceeded("reverted"), false);
assert.equal(sweepReceiptSucceeded(""), false);

console.log("membership sweep checks passed");
