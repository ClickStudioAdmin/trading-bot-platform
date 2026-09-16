import { fromByteaParam, toByteaParam } from "@/lib/exchanges/connections";
import { decryptTotpSecret, encryptTotpSecret } from "@/lib/auth/totp-encrypt";
import { createServiceClient } from "@/lib/supabase/admin";

export type MemberTotpRow = {
  secretCipher: Buffer | null;
  secretNonce: Buffer | null;
  enabledAt: string | null;
  recoveryHashes: string[];
  lastStep: number | null;
};

export function memberTotpEnabled(row: MemberTotpRow | null): boolean {
  return Boolean(row?.enabledAt);
}

function asHashList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export async function loadMemberTotp(
  userId: string,
): Promise<MemberTotpRow | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("members")
    .select(
      "totp_secret_cipher, totp_secret_nonce, totp_enabled_at, totp_recovery_hashes, totp_last_step",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const last = data.totp_last_step;
  return {
    secretCipher: fromByteaParam(data.totp_secret_cipher),
    secretNonce: fromByteaParam(data.totp_secret_nonce),
    enabledAt:
      data.totp_enabled_at == null || data.totp_enabled_at === ""
        ? null
        : String(data.totp_enabled_at),
    recoveryHashes: asHashList(data.totp_recovery_hashes),
    lastStep:
      last == null || last === "" ? null : Number.isFinite(Number(last))
        ? Number(last)
        : null,
  };
}

export function decryptMemberTotpSecret(row: MemberTotpRow): string | null {
  if (!row.secretCipher || !row.secretNonce) {
    return null;
  }
  return decryptTotpSecret(row.secretCipher, row.secretNonce);
}

export async function savePendingTotpSecret(
  userId: string,
  secret: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { error: "Database is not configured." };
  }
  let packed;
  try {
    packed = encryptTotpSecret(secret);
  } catch (cause) {
    return {
      error:
        cause instanceof Error
          ? cause.message
          : "Two-factor is not configured on this environment.",
    };
  }
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("members")
    .update({
      totp_secret_cipher: toByteaParam(packed.ciphertext),
      totp_secret_nonce: toByteaParam(packed.nonce),
      totp_enabled_at: null,
      totp_recovery_hashes: [],
      totp_last_step: null,
      updated_at: now,
    })
    .eq("user_id", userId);
  if (error) {
    return { error: error.message };
  }
  return { ok: true };
}

export async function confirmMemberTotp(
  userId: string,
  recoveryHashes: string[],
  lastStep: number,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { error: "Database is not configured." };
  }
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("members")
    .update({
      totp_enabled_at: now,
      totp_recovery_hashes: recoveryHashes,
      totp_last_step: lastStep,
      updated_at: now,
    })
    .eq("user_id", userId);
  if (error) {
    return { error: error.message };
  }
  return { ok: true };
}

export async function clearMemberTotp(
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { error: "Database is not configured." };
  }
  const { error } = await supabase
    .from("members")
    .update({
      totp_secret_cipher: null,
      totp_secret_nonce: null,
      totp_enabled_at: null,
      totp_recovery_hashes: [],
      totp_last_step: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) {
    return { error: error.message };
  }
  return { ok: true };
}

export async function saveTotpLastStep(
  userId: string,
  step: number,
): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  await supabase
    .from("members")
    .update({
      totp_last_step: step,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

export async function saveTotpRecoveryHashes(
  userId: string,
  hashes: string[],
): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  await supabase
    .from("members")
    .update({
      totp_recovery_hashes: hashes,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}
