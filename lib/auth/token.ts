import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "tbp_session";
export const SESSION_DAYS = 14;
export const CHALLENGE_COOKIE = "tbp_2fa";
export const CHALLENGE_MINUTES = 10;
export const RECOVERY_FLASH_COOKIE = "tbp_2fa_codes";
export const RECOVERY_FLASH_MINUTES = 5;

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

function signHmacBody(body: string): string {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error("Session secret is not configured.");
  }
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function parseSignedParts(
  token: string,
  version: string,
  fieldCount: number,
): string[] | null {
  const secret = sessionSecret();
  if (!secret) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== fieldCount || parts[0] !== version) {
    return null;
  }
  const sig = parts[fieldCount - 1] ?? "";
  const body = parts.slice(0, fieldCount - 1).join(".");
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (expected.length !== sig.length) {
    return null;
  }
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    return null;
  }
  return parts;
}

export function signChallengeToken(userId: string, expiresAtMs: number): string {
  const body = `v2fa.${userId}.${expiresAtMs}`;
  return `${body}.${signHmacBody(body)}`;
}

export function parseChallengeToken(
  token: string,
): { userId: string; expiresAtMs: number } | null {
  const parts = parseSignedParts(token, "v2fa", 4);
  if (!parts) {
    return null;
  }
  const userId = parts[1] ?? "";
  const expiresAtMs = Number(parts[2]);
  if (!userId || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return null;
  }
  return { userId, expiresAtMs };
}

export function signRecoveryFlash(
  codes: string[],
  expiresAtMs: number,
): string {
  const payload = Buffer.from(JSON.stringify(codes), "utf8").toString(
    "base64url",
  );
  const body = `v1.${expiresAtMs}.${payload}`;
  return `${body}.${signHmacBody(body)}`;
}

export function parseRecoveryFlash(token: string): string[] | null {
  const parts = parseSignedParts(token, "v1", 4);
  if (!parts) {
    return null;
  }
  const expiresAtMs = Number(parts[1]);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(parts[2] ?? "", "base64url").toString("utf8"),
    );
    if (
      !Array.isArray(parsed) ||
      parsed.some((code) => typeof code !== "string")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
