import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "tbp_session";
export const SESSION_DAYS = 14;

export function sessionSecret(): string | null {
  const secret =
    process.env.SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return secret ? secret : null;
}

export function signSessionToken(userId: string, expiresAtMs: number): string {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error("Session secret is not configured.");
  }
  const body = `v1.${userId}.${expiresAtMs}`;
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function parseSessionToken(
  token: string,
): { userId: string; expiresAtMs: number } | null {
  const secret = sessionSecret();
  if (!secret) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    return null;
  }
  const userId = parts[1] ?? "";
  const expiresAtMs = Number(parts[2]);
  const sig = parts[3] ?? "";
  if (!userId || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return null;
  }
  const body = `v1.${userId}.${expiresAtMs}`;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (expected.length !== sig.length) {
    return null;
  }
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    return null;
  }
  return { userId, expiresAtMs };
}
