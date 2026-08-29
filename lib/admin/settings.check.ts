import assert from "node:assert/strict";
import { parseAutoTickEnabled } from "./settings";

assert.equal(parseAutoTickEnabled(undefined), false);
assert.equal(parseAutoTickEnabled("1"), true);
assert.equal(parseAutoTickEnabled(""), false);
assert.equal(parseAutoTickEnabled("0"), false);

console.log("admin settings checks passed");
