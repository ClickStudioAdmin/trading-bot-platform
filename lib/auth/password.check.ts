import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password";

const hash = hashPassword("correct-horse");
assert.equal(verifyPassword("correct-horse", hash), true);
assert.equal(verifyPassword("wrong-password", hash), false);
assert.equal(verifyPassword("correct-horse", "not-a-hash"), false);
assert.notEqual(hash, hashPassword("correct-horse"));
assert.equal(
  verifyPassword(
    "55555555",
    "scrypt$JohnDemoSalt0001$Lb8QIFMYlnaW1fVJJWGQLjqUvtBJkNA3SE0-20rlsdo",
  ),
  true,
);

console.log("password checks passed");
