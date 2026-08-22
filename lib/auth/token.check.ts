import assert from "node:assert/strict";
import { parseSessionToken, signSessionToken } from "./token";

const previous = process.env.SESSION_SECRET;
process.env.SESSION_SECRET = "test-session-secret";

const expires = Date.now() + 60_000;
const token = signSessionToken("user-1", expires);
const parsed = parseSessionToken(token);
assert.equal(parsed?.userId, "user-1");
assert.equal(parsed?.expiresAtMs, expires);
assert.equal(parseSessionToken(`${token}x`), null);
assert.equal(parseSessionToken(signSessionToken("user-1", Date.now() - 1)), null);

process.env.SESSION_SECRET = previous;

console.log("session token checks passed");
