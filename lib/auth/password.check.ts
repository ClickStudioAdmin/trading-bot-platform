import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password";

const hash = hashPassword("correct-horse");
assert.equal(verifyPassword("correct-horse", hash), true);
assert.equal(verifyPassword("wrong-password", hash), false);
assert.equal(verifyPassword("correct-horse", "not-a-hash"), false);
assert.notEqual(hash, hashPassword("correct-horse"));

console.log("password checks passed");
