import assert from "node:assert/strict";
import {
  parseChallengeToken,
  parseRecoveryFlash,
  parseSessionToken,
  signChallengeToken,
  signRecoveryFlash,
  signSessionToken,
} from "./token";

const previous = process.env.SESSION_SECRET;
process.env.SESSION_SECRET = "test-session-secret";

const expires = Date.now() + 60_000;
const token = signSessionToken("user-1", expires);
const parsed = parseSessionToken(token);
assert.equal(parsed?.userId, "user-1");
assert.equal(parsed?.expiresAtMs, expires);
assert.equal(parseSessionToken(`${token}x`), null);
assert.equal(parseSessionToken(signSessionToken("user-1", Date.now() - 1)), null);

const challenge = signChallengeToken("user-2", expires);
assert.equal(parseChallengeToken(challenge)?.userId, "user-2");
assert.equal(parseSessionToken(challenge), null);
assert.equal(parseChallengeToken(token), null);

const flash = signRecoveryFlash(["abcd-efgh"], expires);
assert.deepEqual(parseRecoveryFlash(flash), ["abcd-efgh"]);
assert.equal(parseRecoveryFlash(signRecoveryFlash(["x"], Date.now() - 1)), null);

process.env.SESSION_SECRET = previous;

console.log("session token checks passed");
