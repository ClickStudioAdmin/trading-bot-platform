import assert from "node:assert/strict";
import { parseStarterPackFlag } from "./store";

assert.equal(parseStarterPackFlag("1", "platform"), true);
assert.equal(parseStarterPackFlag("on", "platform"), true);
assert.equal(parseStarterPackFlag(true, "platform"), true);
assert.equal(parseStarterPackFlag("1", "user"), false);
assert.equal(parseStarterPackFlag(true, "user"), false);
assert.equal(parseStarterPackFlag("", "platform"), false);
assert.equal(parseStarterPackFlag(undefined, "platform"), false);

console.log("template starter pack checks passed");
