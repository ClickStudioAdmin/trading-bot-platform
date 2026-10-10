import assert from "node:assert/strict";
import {
  clampVerifyCodeDigits,
  VERIFY_CODE_DIGIT_LIMIT,
} from "./verify-code-digits";
import {
  AUTH_MAIL_COOLDOWN_MS,
  authMailIsCoolingDown,
  decideEmailVerifyCode,
  EMAIL_VERIFY_CODE_LENGTH,
  EMAIL_VERIFY_CODE_MAX_ATTEMPTS,
  emailTokenTtlMs,
  emailVerifyCodeError,
  hashEmailToken,
  newEmailVerifyCode,
  normalizeEmailVerifyCode,
  parseEmailTokenPurpose,
  RESET_TTL_MS,
  VERIFY_TTL_MS,
  type EmailVerifyCodeRow,
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

assert.equal(EMAIL_VERIFY_CODE_LENGTH, 6);
assert.equal(VERIFY_CODE_DIGIT_LIMIT, 6);
assert.equal(clampVerifyCodeDigits("4821937"), "482193");
assert.equal(clampVerifyCodeDigits("482 193 extra"), "482193");
assert.equal(clampVerifyCodeDigits("12ab345678"), "123456");
assert.equal(clampVerifyCodeDigits("123"), "123");
assert.equal(clampVerifyCodeDigits(""), "");
assert.equal(EMAIL_VERIFY_CODE_MAX_ATTEMPTS, 5);
for (let i = 0; i < 30; i += 1) {
  assert.match(newEmailVerifyCode(), /^\d{6}$/);
}
assert.equal(normalizeEmailVerifyCode("482193"), "482193");
assert.equal(normalizeEmailVerifyCode(" 482 193 "), "482193");
assert.equal(normalizeEmailVerifyCode("482-193"), "482193");
assert.equal(normalizeEmailVerifyCode("012345"), "012345");
assert.equal(normalizeEmailVerifyCode("4821931"), null);
assert.equal(normalizeEmailVerifyCode("482a193"), null);
assert.equal(normalizeEmailVerifyCode(""), null);

const codeNow = Date.parse("2026-09-16T12:00:00.000Z");
const openRow: EmailVerifyCodeRow = {
  codeHash: hashEmailToken("482193"),
  attempts: 0,
  expiresAt: "2026-09-17T12:00:00.000Z",
  usedAt: null,
};
assert.deepEqual(decideEmailVerifyCode(openRow, "482 193", codeNow), {
  ok: true,
});
assert.deepEqual(decideEmailVerifyCode(openRow, "000000", codeNow), {
  ok: false,
  reason: "invalid",
  countAttempt: true,
});
assert.deepEqual(decideEmailVerifyCode(openRow, "12", codeNow), {
  ok: false,
  reason: "invalid",
  countAttempt: false,
});
assert.deepEqual(
  decideEmailVerifyCode({ ...openRow, attempts: 5 }, "482193", codeNow),
  { ok: false, reason: "locked", countAttempt: false },
);
assert.deepEqual(
  decideEmailVerifyCode(
    { ...openRow, expiresAt: "2026-09-16T12:00:00.000Z" },
    "482193",
    codeNow,
  ),
  { ok: false, reason: "expired", countAttempt: false },
);
assert.deepEqual(
  decideEmailVerifyCode(
    { ...openRow, usedAt: "2026-09-16T01:00:00.000Z" },
    "482193",
    codeNow,
  ),
  { ok: false, reason: "invalid", countAttempt: false },
);
assert.deepEqual(decideEmailVerifyCode(null, "482193", codeNow), {
  ok: false,
  reason: "invalid",
  countAttempt: false,
});
assert.deepEqual(
  decideEmailVerifyCode({ ...openRow, codeHash: null }, "482193", codeNow),
  { ok: false, reason: "invalid", countAttempt: false },
);
assert.equal(emailVerifyCodeError("invalid").includes("not valid"), true);
assert.equal(emailVerifyCodeError("expired").includes("expired"), true);
assert.equal(emailVerifyCodeError("locked").includes("Too many"), true);
assert.equal(emailVerifyCodeError("unavailable").includes("could not"), true);
assert.notEqual(hashEmailToken("482193"), hashEmailToken("secret-token"));

console.log("email token checks passed");
