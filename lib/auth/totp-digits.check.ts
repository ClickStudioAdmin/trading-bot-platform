import assert from "node:assert/strict";
import { clampTotpCode, totpDigitsComplete } from "./totp-digits";

assert.equal(clampTotpCode("123 456"), "123456");
assert.equal(clampTotpCode("abc1234567"), "123456");
assert.equal(clampTotpCode("12"), "12");
assert.equal(clampTotpCode(""), "");
assert.equal(totpDigitsComplete("123456"), true);
assert.equal(totpDigitsComplete("12345"), false);
assert.equal(totpDigitsComplete("1234567"), false);
assert.equal(totpDigitsComplete(clampTotpCode("12-34-56")), true);

console.log("totp digit checks passed");
