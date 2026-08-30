import assert from "node:assert/strict";
import {
  decryptCredentials,
  encryptCredentials,
  exchangeCredentialsConfigured,
} from "./encrypt";

const previous = process.env.EXCHANGE_CREDENTIALS_KEY;
process.env.EXCHANGE_CREDENTIALS_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

assert.equal(exchangeCredentialsConfigured(), true);

const payload = { apiKey: "abc", apiSecret: "s3cret", passphrase: "later-ok" };
const once = encryptCredentials(payload);
const twice = encryptCredentials(payload);
assert.notEqual(once.nonce.equals(twice.nonce), true);
assert.notEqual(once.ciphertext.equals(twice.ciphertext), true);
assert.deepEqual(decryptCredentials(once.ciphertext, once.nonce), payload);
assert.deepEqual(decryptCredentials(twice.ciphertext, twice.nonce), payload);

const tampered = Buffer.from(once.ciphertext);
tampered[tampered.length - 1] ^= 1;
assert.equal(decryptCredentials(tampered, once.nonce), null);
assert.equal(decryptCredentials(once.ciphertext, randomNonce()), null);

process.env.EXCHANGE_CREDENTIALS_KEY =
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
assert.equal(decryptCredentials(once.ciphertext, once.nonce), null);

process.env.EXCHANGE_CREDENTIALS_KEY = "short";
assert.equal(exchangeCredentialsConfigured(), false);
assert.throws(() => encryptCredentials(payload));

process.env.EXCHANGE_CREDENTIALS_KEY = previous;

console.log("exchange encrypt checks passed");

function randomNonce(): Buffer {
  return Buffer.from("000000000000000000000000", "hex");
}
