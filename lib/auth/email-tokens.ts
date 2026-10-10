import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";

export const EMAIL_TOKEN_PURPOSES = ["verify", "reset"] as const;

export type EmailTokenPurpose = (typeof EMAIL_TOKEN_PURPOSES)[number];

export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_TTL_MS = 60 * 60 * 1000;
export const AUTH_MAIL_COOLDOWN_MS = 2 * 60 * 1000;
export const EMAIL_VERIFY_CODE_LENGTH = 6;
export const EMAIL_VERIFY_CODE_MAX_ATTEMPTS = 5;

export type EmailVerifyCodeStatus =
  | "ok"
  | "invalid"
  | "expired"
  | "locked"
  | "unavailable";

export type EmailVerifyCodeRow = {
  codeHash: string | null;
  attempts: number;
  expiresAt: string;
  usedAt: string | null;
};

export type EmailVerifyCodeDecision =
  | { ok: true }
  | {
      ok: false;
      reason: Exclude<EmailVerifyCodeStatus, "ok" | "unavailable">;
      countAttempt: boolean;
    };

export function hashEmailToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newEmailTokenSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function emailTokenTtlMs(purpose: EmailTokenPurpose): number {
  return purpose === "verify" ? VERIFY_TTL_MS : RESET_TTL_MS;
}

export function newEmailVerifyCode(): string {
  return randomInt(0, 10 ** EMAIL_VERIFY_CODE_LENGTH)
    .toString()
    .padStart(EMAIL_VERIFY_CODE_LENGTH, "0");
}

export function normalizeEmailVerifyCode(value: string): string | null {
  const digits = value.trim().replace(/[\s-]/g, "");
  const pattern = new RegExp(`^\\d{${EMAIL_VERIFY_CODE_LENGTH}}$`);
  return pattern.test(digits) ? digits : null;
}

function attemptCount(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

function hashesMatch(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function decideEmailVerifyCode(
  row: EmailVerifyCodeRow | null,
  code: string,
  nowMs = Date.now(),
): EmailVerifyCodeDecision {
  if (!row || row.usedAt) {
    return { ok: false, reason: "invalid", countAttempt: false };
  }
  const expiresMs = Date.parse(row.expiresAt);
  if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) {
    return { ok: false, reason: "expired", countAttempt: false };
  }
  const attempts = attemptCount(row.attempts);
  if (attempts >= EMAIL_VERIFY_CODE_MAX_ATTEMPTS) {
    return { ok: false, reason: "locked", countAttempt: false };
  }
  const normalized = normalizeEmailVerifyCode(code);
  if (!normalized || !row.codeHash) {
    return { ok: false, reason: "invalid", countAttempt: false };
  }
  if (!hashesMatch(hashEmailToken(normalized), row.codeHash)) {
    return { ok: false, reason: "invalid", countAttempt: true };
  }
  return { ok: true };
}

export function emailVerifyCodeError(
  status: Exclude<EmailVerifyCodeStatus, "ok">,
): string {
  switch (status) {
    case "expired":
      return "That code has expired. Send a new confirmation.";
    case "locked":
      return "Too many attempts. Send a new confirmation, or use the link in the email.";
    case "unavailable":
      return "We could not check that code. Try again.";
    default:
      return "That code is not valid. Check the email and try again.";
  }
}

export function parseEmailTokenPurpose(
  value: unknown,
): EmailTokenPurpose | null {
  return value === "verify" || value === "reset" ? value : null;
}

export function authMailIsCoolingDown(
  lastCreatedAt: string | null,
  nowMs = Date.now(),
  cooldownMs = AUTH_MAIL_COOLDOWN_MS,
): boolean {
  if (!lastCreatedAt) {
    return false;
  }
  const created = Date.parse(lastCreatedAt);
  if (!Number.isFinite(created)) {
    return false;
  }
  return nowMs - created < cooldownMs;
}

export async function issueEmailToken(
  userId: string,
  purpose: EmailTokenPurpose,
): Promise<{ raw: string; code: string | null } | { rateLimited: true } | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data: latest } = await supabase
    .from("member_email_tokens")
    .select("created_at")
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (
    authMailIsCoolingDown(
      latest?.created_at ? String(latest.created_at) : null,
    )
  ) {
    return { rateLimited: true };
  }
  const raw = newEmailTokenSecret();
  const code = purpose === "verify" ? newEmailVerifyCode() : null;
  const now = new Date();
  const expires = new Date(now.getTime() + emailTokenTtlMs(purpose));
  await supabase
    .from("member_email_tokens")
    .update({ used_at: now.toISOString() })
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .is("used_at", null);
  const row: Record<string, unknown> = {
    user_id: userId,
    purpose,
    token_hash: hashEmailToken(raw),
    expires_at: expires.toISOString(),
    created_at: now.toISOString(),
  };
  if (code) {
    row.code_hash = hashEmailToken(code);
  }
  let { error } = await supabase.from("member_email_tokens").insert(row);
  if (error && code && /code_hash|code_attempts/.test(String(error.message))) {
    delete row.code_hash;
    const retry = await supabase.from("member_email_tokens").insert(row);
    error = retry.error;
    if (!error) {
      return { raw, code: null };
    }
  }
  if (error) {
    return null;
  }
  return { raw, code };
}

export async function consumeEmailToken(
  raw: string,
  purpose: EmailTokenPurpose,
): Promise<{ userId: string } | null> {
  const token = raw.trim();
  if (!token) {
    return null;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("member_email_tokens")
    .update({ used_at: now })
    .eq("token_hash", hashEmailToken(token))
    .eq("purpose", purpose)
    .is("used_at", null)
    .gt("expires_at", now)
    .select("user_id")
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return { userId: String(data.user_id) };
}

type ServiceClient = NonNullable<ReturnType<typeof createServiceClient>>;

async function loadOpenVerifyToken(
  supabase: ServiceClient,
  userId: string,
): Promise<
  { id: string | number; row: EmailVerifyCodeRow } | null | "unavailable"
> {
  const { data, error } = await supabase
    .from("member_email_tokens")
    .select("id, code_hash, code_attempts, expires_at, used_at")
    .eq("user_id", userId)
    .eq("purpose", "verify")
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return "unavailable";
  }
  if (!data) {
    return null;
  }
  return {
    id: data.id as string | number,
    row: {
      codeHash: data.code_hash == null ? null : String(data.code_hash),
      attempts: Number(data.code_attempts ?? 0),
      expiresAt: String(data.expires_at),
      usedAt: data.used_at == null ? null : String(data.used_at),
    },
  };
}

export async function consumeEmailVerifyCode(
  userId: string,
  rawCode: string,
): Promise<EmailVerifyCodeStatus> {
  const supabase = createServiceClient();
  if (!supabase) {
    return "unavailable";
  }
  for (let pass = 0; pass < 6; pass += 1) {
    const loaded = await loadOpenVerifyToken(supabase, userId);
    if (loaded === "unavailable") {
      return "unavailable";
    }
    if (!loaded) {
      return "invalid";
    }
    const decision = decideEmailVerifyCode(loaded.row, rawCode);
    if (decision.ok) {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("member_email_tokens")
        .update({ used_at: now })
        .eq("id", loaded.id)
        .eq("code_hash", loaded.row.codeHash)
        .eq("code_attempts", attemptCount(loaded.row.attempts))
        .is("used_at", null)
        .gt("expires_at", now)
        .select("id")
        .maybeSingle();
      if (error) {
        return "unavailable";
      }
      if (data) {
        return "ok";
      }
      continue;
    }
    if (!decision.countAttempt) {
      return decision.reason;
    }
    const nextAttempts = attemptCount(loaded.row.attempts) + 1;
    const { data, error } = await supabase
      .from("member_email_tokens")
      .update({ code_attempts: nextAttempts })
      .eq("id", loaded.id)
      .eq("code_attempts", attemptCount(loaded.row.attempts))
      .is("used_at", null)
      .select("code_attempts")
      .maybeSingle();
    if (error) {
      return "unavailable";
    }
    if (!data) {
      continue;
    }
    return nextAttempts >= EMAIL_VERIFY_CODE_MAX_ATTEMPTS ? "locked" : "invalid";
  }
  return "invalid";
}
