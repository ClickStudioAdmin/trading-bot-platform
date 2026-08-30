import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { exchangeCredentialsKey } from "@/lib/exchanges/encrypt";

const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;
const AAD = Buffer.from("tbp.futures.webhook.v1");

export function encryptWebhookToken(token: string): {
  ciphertext: Buffer;
  nonce: Buffer;
} {
  const key = exchangeCredentialsKey();
  if (!key) {
    throw new Error("Exchange credentials key is not configured.");
  }
  const nonce = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(AAD);
  const body = Buffer.concat([
    cipher.update(JSON.stringify({ token }), "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: Buffer.concat([
      Buffer.from([VERSION]),
      cipher.getAuthTag(),
      body,
    ]),
    nonce,
  };
}

export function decryptWebhookToken(
  ciphertext: Buffer,
  nonce: Buffer,
): string | null {
  const key = exchangeCredentialsKey();
  if (!key || ciphertext.length < 1 + TAG_LEN + 1 || nonce.length !== IV_LEN) {
    return null;
  }
  if (ciphertext[0] !== VERSION) {
    return null;
  }
  const tag = ciphertext.subarray(1, 1 + TAG_LEN);
  const body = ciphertext.subarray(1 + TAG_LEN);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([
      decipher.update(body),
      decipher.final(),
    ]).toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    const token = (parsed as { token?: unknown }).token;
    return typeof token === "string" && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}
