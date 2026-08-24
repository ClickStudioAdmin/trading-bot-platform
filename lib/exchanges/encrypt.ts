import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const AAD = Buffer.from("tbp.exchange.v1");

export type EncryptedCredentials = {
  ciphertext: Buffer;
  nonce: Buffer;
};

export function exchangeCredentialsKey(): Buffer | null {
  const raw = process.env.EXCHANGE_CREDENTIALS_KEY?.trim() ?? "";
  if (!raw) {
    return null;
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const fromB64 = Buffer.from(raw, "base64");
  if (fromB64.length === KEY_LEN) {
    return fromB64;
  }
  return null;
}

export function exchangeCredentialsConfigured(): boolean {
  return exchangeCredentialsKey() !== null;
}

export function encryptCredentials(
  credentials: Record<string, string>,
): EncryptedCredentials {
  const key = exchangeCredentialsKey();
  if (!key) {
    throw new Error("Exchange credentials key is not configured.");
  }
  const nonce = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(AAD);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);
  const ciphertext = Buffer.concat([
    Buffer.from([VERSION]),
    cipher.getAuthTag(),
    body,
  ]);
  return { ciphertext, nonce };
}

export function decryptCredentials(
  ciphertext: Buffer,
  nonce: Buffer,
): Record<string, string> | null {
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
    const credentials: Record<string, string> = {};
    for (const [field, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (typeof value !== "string") {
        return null;
      }
      credentials[field] = value;
    }
    return credentials;
  } catch {
    return null;
  }
}
