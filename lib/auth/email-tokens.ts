import { createHash, randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";

export const EMAIL_TOKEN_PURPOSES = ["verify", "reset"] as const;

export type EmailTokenPurpose = (typeof EMAIL_TOKEN_PURPOSES)[number];

export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_TTL_MS = 60 * 60 * 1000;
export const AUTH_MAIL_COOLDOWN_MS = 2 * 60 * 1000;

export function hashEmailToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newEmailTokenSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function emailTokenTtlMs(purpose: EmailTokenPurpose): number {
  return purpose === "verify" ? VERIFY_TTL_MS : RESET_TTL_MS;
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
): Promise<{ raw: string } | { rateLimited: true } | null> {
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
  const now = new Date();
  const expires = new Date(now.getTime() + emailTokenTtlMs(purpose));
  await supabase
    .from("member_email_tokens")
    .update({ used_at: now.toISOString() })
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .is("used_at", null);
  const { error } = await supabase.from("member_email_tokens").insert({
    user_id: userId,
    purpose,
    token_hash: hashEmailToken(raw),
    expires_at: expires.toISOString(),
    created_at: now.toISOString(),
  });
  if (error) {
    return null;
  }
  return { raw };
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
