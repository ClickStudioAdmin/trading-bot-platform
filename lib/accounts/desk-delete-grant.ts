import { createHmac, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "@/lib/auth/token";

export const DESK_DELETE_GRANT_COOKIE = "tbp_desk_delete";

/** Covers the follow-up passes after the authenticator code is already used. */
export const DESK_DELETE_GRANT_MS = 10 * 60 * 1000;

export function signDeskDeleteGrant(
  userId: string,
  accountId: string,
  expiresAtMs: number,
): string {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error("Session secret is not configured.");
  }
  const body = `vdesk.${userId}.${accountId}.${expiresAtMs}`;
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function parseDeskDeleteGrant(
  token: string,
  now = Date.now(),
): { userId: string; accountId: string; expiresAtMs: number } | null {
  const secret = sessionSecret();
  if (!secret) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "vdesk") {
    return null;
  }
  const userId = parts[1] ?? "";
  const accountId = parts[2] ?? "";
  const expiresAtMs = Number(parts[3]);
  const sig = parts[4] ?? "";
  if (!userId || !accountId || !Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
    return null;
  }
  const body = `vdesk.${userId}.${accountId}.${expiresAtMs}`;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (expected.length !== sig.length) {
    return null;
  }
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    return null;
  }
  return { userId, accountId, expiresAtMs };
}

export function deskDeleteGrantAllows(
  token: string | null | undefined,
  userId: string,
  accountId: string,
  now = Date.now(),
): boolean {
  if (!token || !userId || !accountId) {
    return false;
  }
  const parsed = parseDeskDeleteGrant(token, now);
  return parsed?.userId === userId && parsed.accountId === accountId;
}
