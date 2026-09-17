import assert from "node:assert/strict";
import {
  consumeRecoveryCode,
  decodeBase32,
  encodeBase32,
  hashRecoveryCode,
  normalizeRecoveryCode,
  totpCodeAt,
  totpOtpauthUrl,
  verifyTotpCode,
} from "./totp";

const rfcSecret = encodeBase32(Buffer.from("12345678901234567890"));
assert.equal(decodeBase32(rfcSecret)?.equals(Buffer.from("12345678901234567890")), true);
assert.equal(totpCodeAt(rfcSecret, 0).code, "755224");
assert.equal(totpCodeAt(rfcSecret, 29_999).code, "755224");
assert.equal(totpCodeAt(rfcSecret, 30_000).code, "287082");

const atZero = totpCodeAt(rfcSecret, 0);
assert.deepEqual(verifyTotpCode(rfcSecret, atZero.code, { nowMs: 0 }), {
  step: 0,
});
assert.equal(
  verifyTotpCode(rfcSecret, atZero.code, { nowMs: 0, lastStep: 0 }),
  null,
);
assert.equal(verifyTotpCode(rfcSecret, "000000", { nowMs: 0 }), null);
assert.deepEqual(
  verifyTotpCode(rfcSecret, "287082", { nowMs: 0, window: 1 }),
  { step: 1 },
);

const otpauth = totpOtpauthUrl("click@example.com", rfcSecret);
assert.equal(otpauth.startsWith("otpauth://totp/"), true);
assert.equal(otpauth.includes("issuer=Trading%20Bot%20Platform"), true);
const renamed = totpOtpauthUrl("click@example.com", rfcSecret, "Alpha Desks");
assert.equal(renamed.includes("issuer=Alpha%20Desks"), true);
assert.equal(otpauth.includes("digits=6"), true);
assert.equal(otpauth.includes("period=30"), true);

assert.equal(normalizeRecoveryCode("Ab12-Cd34"), "ab12cd34");
const hashes = [hashRecoveryCode("ab12-cd34"), hashRecoveryCode("zzzz-yyyy")];
assert.deepEqual(consumeRecoveryCode(hashes, "AB12-CD34"), [
  hashRecoveryCode("zzzz-yyyy"),
]);
assert.equal(consumeRecoveryCode(hashes, "nope-code"), null);

console.log("totp checks passed");
