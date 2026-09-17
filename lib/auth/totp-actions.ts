"use server";

import { exchangeCredentialsConfigured } from "@/lib/exchanges/encrypt";
import { writeEventLog } from "@/lib/logs/write";
import { verifyPassword } from "@/lib/auth/password";
import {
  SIGN_IN_2FA_PATH,
  SIGN_IN_PATH,
} from "@/lib/auth/onboarding-path";
import { signedInHomePath } from "@/lib/auth/onboarding";
import { listTradingAccounts } from "@/lib/accounts/store";
import {
  clearRecoveryCodesFlash,
  clearSignInChallenge,
  createSession,
  getSessionMember,
  getSignInChallengeUserId,
  requireVerifiedEmail,
  setRecoveryCodesFlash,
} from "@/lib/auth/session";
import {
  newRecoveryCodes,
  newTotpSecret,
  verifyTotpCode,
} from "@/lib/auth/totp";
import {
  clearMemberTotp,
  confirmMemberTotp,
  decryptMemberTotpSecret,
  loadMemberTotp,
  memberTotpEnabled,
  savePendingTotpSecret,
} from "@/lib/auth/totp-store";
import { verifyMemberSecondFactor } from "@/lib/auth/totp-verify";
import { createServiceClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const SETTINGS_SECURITY = "/account/settings?tab=password";

function settingsSecurityPath(query: {
  error?: string;
  saved?: string;
  enroll?: "1";
}): string {
  const params = new URLSearchParams();
  params.set("tab", "password");
  if (query.error) {
    params.set("error", query.error);
  }
  if (query.saved) {
    params.set("saved", query.saved);
  }
  if (query.enroll) {
    params.set("enroll", query.enroll);
  }
  return `/account/settings?${params.toString()}`;
}

function challengePath(error?: string): string {
  return error
    ? `${SIGN_IN_2FA_PATH}?error=${encodeURIComponent(error)}`
    : SIGN_IN_2FA_PATH;
}

export async function startTotpEnrollAction() {
  const member = await requireVerifiedEmail();
  if (!exchangeCredentialsConfigured()) {
    redirect(
      settingsSecurityPath({
        error: "Two-factor is not configured on this environment.",
      }),
    );
  }
  const current = await loadMemberTotp(member.id);
  if (memberTotpEnabled(current)) {
    redirect(settingsSecurityPath({ error: "Google Authenticator is already on." }));
  }
  const saved = await savePendingTotpSecret(member.id, newTotpSecret());
  if ("error" in saved) {
    redirect(settingsSecurityPath({ error: saved.error }));
  }
  revalidatePath("/account/settings");
  redirect(settingsSecurityPath({ enroll: "1" }));
}

export async function cancelTotpEnrollAction() {
  const member = await requireVerifiedEmail();
  const current = await loadMemberTotp(member.id);
  if (memberTotpEnabled(current)) {
    redirect(SETTINGS_SECURITY);
  }
  const cleared = await clearMemberTotp(member.id);
  if ("error" in cleared) {
    redirect(settingsSecurityPath({ error: cleared.error }));
  }
  revalidatePath("/account/settings");
  redirect(SETTINGS_SECURITY);
}

export async function confirmTotpEnrollAction(formData: FormData) {
  const member = await requireVerifiedEmail();
  const current = await loadMemberTotp(member.id);
  if (!current || memberTotpEnabled(current)) {
    redirect(
      settingsSecurityPath({
        error: "Start Google Authenticator setup first.",
      }),
    );
  }
  const secret = decryptMemberTotpSecret(current);
  if (!secret) {
    redirect(
      settingsSecurityPath({
        error: "Could not read the authenticator secret. Check the credentials key.",
      }),
    );
  }
  const matched = verifyTotpCode(secret, String(formData.get("code") ?? ""));
  if (!matched) {
    redirect(
      settingsSecurityPath({
        enroll: "1",
        error: "That Google Authenticator code is incorrect.",
      }),
    );
  }
  const recovery = newRecoveryCodes();
  const confirmed = await confirmMemberTotp(
    member.id,
    recovery.hashes,
    matched.step,
  );
  if ("error" in confirmed) {
    redirect(settingsSecurityPath({ enroll: "1", error: confirmed.error }));
  }
  await setRecoveryCodesFlash(recovery.display);
  await writeEventLog({
    scope: "system",
    event: "member.totp_enabled",
    message: "Turned on Google Authenticator",
    userId: member.id,
  });
  revalidatePath("/", "layout");
  redirect(settingsSecurityPath({ saved: "2fa" }));
}

export async function disableTotpAction(formData: FormData) {
  const member = await requireVerifiedEmail();
  const password = String(formData.get("currentPassword") ?? "");
  const code = String(formData.get("code") ?? "");
  if (password.length < 8 || !code.trim()) {
    redirect(
      settingsSecurityPath({
        error: "Enter your password and a Google Authenticator or recovery code.",
      }),
    );
  }
  const supabase = createServiceClient();
  if (!supabase) {
    redirect(settingsSecurityPath({ error: "Database is not configured." }));
  }
  const { data, error } = await supabase
    .from("members")
    .select("password_hash")
    .eq("user_id", member.id)
    .maybeSingle();
  if (error || !data) {
    redirect(settingsSecurityPath({ error: "That member was not found." }));
  }
  if (!verifyPassword(password, String(data.password_hash ?? ""))) {
    redirect(settingsSecurityPath({ error: "Current password is incorrect." }));
  }
  const current = await loadMemberTotp(member.id);
  if (!memberTotpEnabled(current)) {
    redirect(SETTINGS_SECURITY);
  }
  if (!(await verifyMemberSecondFactor(member.id, code, current))) {
    redirect(
      settingsSecurityPath({
        error: "That Google Authenticator or recovery code is incorrect.",
      }),
    );
  }
  const cleared = await clearMemberTotp(member.id);
  if ("error" in cleared) {
    redirect(settingsSecurityPath({ error: cleared.error }));
  }
  await writeEventLog({
    scope: "system",
    event: "member.totp_disabled",
    message: "Turned off Google Authenticator",
    userId: member.id,
  });
  revalidatePath("/", "layout");
  redirect(settingsSecurityPath({ saved: "2fa-off" }));
}

export async function dismissRecoveryCodesAction() {
  await requireVerifiedEmail();
  await clearRecoveryCodesFlash();
  redirect(SETTINGS_SECURITY);
}

export async function completeSignIn2faAction(formData: FormData) {
  const userId = await getSignInChallengeUserId();
  if (!userId) {
    redirect(`${SIGN_IN_PATH}?error=${encodeURIComponent("Sign in again.")}`);
  }
  const code = String(formData.get("code") ?? "");
  if (!code.trim()) {
    redirect(challengePath("Enter the Google Authenticator or recovery code."));
  }
  if (!(await verifyMemberSecondFactor(userId, code))) {
    redirect(challengePath("That code is incorrect."));
  }
  await clearSignInChallenge();
  await createSession(userId);
  revalidatePath("/", "layout");
  const member = await getSessionMember();
  if (!member) {
    redirect(SIGN_IN_PATH);
  }
  const accounts = await listTradingAccounts(userId);
  redirect(signedInHomePath(member, accounts));
}

