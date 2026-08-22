import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, KEY_LEN).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const salt = parts[1] ?? "";
  const expected = parts[2] ?? "";
  const actual = scryptSync(password, salt, KEY_LEN).toString("base64url");
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
