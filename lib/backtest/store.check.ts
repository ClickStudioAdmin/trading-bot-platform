import assert from "node:assert/strict";
import { canDeleteBacktestRun } from "./store";

assert.equal(canDeleteBacktestRun({ userId: "owner-1" }, "owner-1", false), true);
assert.equal(canDeleteBacktestRun({ userId: "owner-1" }, "other-2", false), false);
assert.equal(canDeleteBacktestRun({ userId: null }, "owner-1", false), false);
assert.equal(canDeleteBacktestRun({ userId: null }, "owner-1", true), true);
assert.equal(canDeleteBacktestRun({ userId: "owner-1" }, "other-2", true), true);

console.log("backtest store checks passed");
