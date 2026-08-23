import { timingSafeEqual } from "node:crypto";

export function authorizeCronSecret(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !authorization) {
    return false;
  }
  const expected = `Bearer ${secret.trim()}`;
  const left = Buffer.from(authorization.trim());
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
