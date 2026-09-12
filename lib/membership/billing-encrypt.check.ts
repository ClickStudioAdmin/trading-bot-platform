import assert from "node:assert/strict";
import {
  billingCredentialsConfigured,
  decryptBillingSecret,
  encryptBillingSecret,
} from "./billing-encrypt";

const previous = process.env.BILLING_CREDENTIALS_KEY;
process.env.BILLING_CREDENTIALS_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

assert.equal(billingCredentialsConfigured(), true);

const payload = { mnemonic: "test test test test test test test test test test test junk" };
const once = encryptBillingSecret(payload);
const twice = encryptBillingSecret(payload);
assert.notEqual(once.nonce.equals(twice.nonce), true);
assert.notEqual(once.ciphertext.equals(twice.ciphertext), true);
assert.deepEqual(decryptBillingSecret(once.ciphertext, once.nonce), payload);
assert.deepEqual(decryptBillingSecret(twice.ciphertext, twice.nonce), payload);

const tampered = Buffer.from(once.ciphertext);
tampered[tampered.length - 1] ^= 1;
assert.equal(decryptBillingSecret(tampered, once.nonce), null);
assert.equal(
  decryptBillingSecret(once.ciphertext, Buffer.from("000000000000000000000000", "hex")),
  null,
);

process.env.BILLING_CREDENTIALS_KEY =
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
assert.equal(decryptBillingSecret(once.ciphertext, once.nonce), null);

process.env.BILLING_CREDENTIALS_KEY = "short";
assert.equal(billingCredentialsConfigured(), false);
assert.throws(() => encryptBillingSecret(payload));

process.env.BILLING_CREDENTIALS_KEY = previous;

console.log("membership billing encrypt checks passed");
