import assert from "node:assert/strict";
import { decryptTotpSecret, encryptTotpSecret } from "./totp-encrypt";

const previous = process.env.EXCHANGE_CREDENTIALS_KEY;
process.env.EXCHANGE_CREDENTIALS_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const once = encryptTotpSecret("JBSWY3DPEHPK3PXP");
const twice = encryptTotpSecret("JBSWY3DPEHPK3PXP");
assert.notEqual(once.nonce.equals(twice.nonce), true);
assert.equal(decryptTotpSecret(once.ciphertext, once.nonce), "JBSWY3DPEHPK3PXP");
assert.equal(decryptTotpSecret(twice.ciphertext, twice.nonce), "JBSWY3DPEHPK3PXP");

const tampered = Buffer.from(once.ciphertext);
tampered[tampered.length - 1] ^= 1;
assert.equal(decryptTotpSecret(tampered, once.nonce), null);

process.env.EXCHANGE_CREDENTIALS_KEY = "short";
assert.throws(() => encryptTotpSecret("JBSWY3DPEHPK3PXP"));

process.env.EXCHANGE_CREDENTIALS_KEY = previous;

console.log("totp encrypt checks passed");
