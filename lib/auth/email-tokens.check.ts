import assert from "node:assert/strict";
import {
  AUTH_MAIL_COOLDOWN_MS,
  authMailIsCoolingDown,
  emailTokenTtlMs,
  hashEmailToken,
  parseEmailTokenPurpose,
  RESET_TTL_MS,
  VERIFY_TTL_MS,
} from "./email-tokens";

assert.equal(parseEmailTokenPurpose("verify"), "verify");
assert.equal(parseEmailTokenPurpose("reset"), "reset");
assert.equal(parseEmailTokenPurpose("inbox"), null);
assert.equal(emailTokenTtlMs("verify"), VERIFY_TTL_MS);
assert.equal(emailTokenTtlMs("reset"), RESET_TTL_MS);
assert.equal(VERIFY_TTL_MS, 24 * 60 * 60 * 1000);
assert.equal(RESET_TTL_MS, 60 * 60 * 1000);
assert.equal(AUTH_MAIL_COOLDOWN_MS, 2 * 60 * 1000);

const hash = hashEmailToken("secret-token");
assert.equal(hash.length, 64);
assert.equal(hashEmailToken("secret-token"), hash);
assert.notEqual(hashEmailToken("other"), hash);

const now = Date.parse("2026-09-16T00:05:00.000Z");
assert.equal(authMailIsCoolingDown(null, now), false);
assert.equal(
  authMailIsCoolingDown("2026-09-16T00:04:00.000Z", now),
  true,
);
assert.equal(
  authMailIsCoolingDown("2026-09-16T00:02:00.000Z", now),
  false,
);

console.log("email token checks passed");
