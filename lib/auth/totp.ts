import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SEC = 30;
export const TOTP_WINDOW = 1;
export const TOTP_ISSUER = "Trading Bot Platform";
export const RECOVERY_CODE_COUNT = 10;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

export function decodeBase32(input: string): Buffer | null {
  const raw = input.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  if (!raw || raw.length % 8 === 1) {
    return null;
  }
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of raw) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) {
      return null;
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function newTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function totpOtpauthUrl(
  account: string,
  secret: string,
  issuer = TOTP_ISSUER,
): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const query = [
    `secret=${secret}`,
    `issuer=${encodeURIComponent(issuer)}`,
    "algorithm=SHA1",
    `digits=${TOTP_DIGITS}`,
    `period=${TOTP_PERIOD_SEC}`,
  ].join("&");
  return `otpauth://totp/${label}?${query}`;
}

function hotp(secret: Buffer, counter: bigint): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(counter);
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    (hmac[offset + 1]! << 16) |
    (hmac[offset + 2]! << 8) |
    hmac[offset + 3]!;
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function totpCodeAt(
  secret: string,
  nowMs = Date.now(),
  periodSec = TOTP_PERIOD_SEC,
): { code: string; step: number } {
  const key = decodeBase32(secret);
  if (!key) {
    throw new Error("Invalid TOTP secret.");
  }
  const step = Math.floor(nowMs / 1000 / periodSec);
  return { code: hotp(key, BigInt(step)), step };
}

export function normalizeTotpCode(value: string): string | null {
  const digits = value.replace(/\s+/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

export function verifyTotpCode(
  secret: string,
  code: string,
  options: { nowMs?: number; lastStep?: number | null; window?: number } = {},
): { step: number } | null {
  const expected = normalizeTotpCode(code);
  const key = decodeBase32(secret);
  if (!expected || !key) {
    return null;
  }
  const nowMs = options.nowMs ?? Date.now();
  const window = options.window ?? TOTP_WINDOW;
  const lastStep = options.lastStep ?? null;
  const current = Math.floor(nowMs / 1000 / TOTP_PERIOD_SEC);
  for (let delta = -window; delta <= window; delta += 1) {
    const step = current + delta;
    if (step < 0 || (lastStep != null && step === lastStep)) {
      continue;
    }
    const actual = hotp(key, BigInt(step));
    if (
      actual.length === expected.length &&
      timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    ) {
      return { step };
    }
  }
  return null;
}

export function formatRecoveryCode(rawHex: string): string {
  const hex = rawHex.toLowerCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export function normalizeRecoveryCode(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function hashRecoveryCode(value: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(value)).digest("hex");
}

export function newRecoveryCodes(
  count = RECOVERY_CODE_COUNT,
): { display: string[]; hashes: string[] } {
  const display: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const code = formatRecoveryCode(randomBytes(4).toString("hex"));
    display.push(code);
    hashes.push(hashRecoveryCode(code));
  }
  return { display, hashes };
}

export function consumeRecoveryCode(
  hashes: string[],
  value: string,
): string[] | null {
  const expected = hashRecoveryCode(value);
  const index = hashes.findIndex((hash) => {
    if (hash.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
  });
  if (index < 0) {
    return null;
  }
  return hashes.filter((_, i) => i !== index);
}
