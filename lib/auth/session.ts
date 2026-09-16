import { cookies, headers } from "next/headers";
import {
  listTradingAccounts,
} from "@/lib/accounts/store";
import {
  DESK_HEADER,
  parseDeskQuery,
  pickDefaultAccount,
  type TradingAccount,
} from "@/lib/accounts/model";
import {
  CHALLENGE_COOKIE,
  CHALLENGE_MINUTES,
  parseChallengeToken,
  parseRecoveryFlash,
  parseSessionToken,
  RECOVERY_FLASH_COOKIE,
  RECOVERY_FLASH_MINUTES,
  SESSION_COOKIE,
  SESSION_DAYS,
  sessionSecret,
  signChallengeToken,
  signRecoveryFlash,
  signSessionToken,
} from "@/lib/auth/token";
import { VERIFY_PATH } from "@/lib/auth/onboarding-path";
import type { MemberRole, MemberStatus } from "@/lib/members/form";
import { createServiceClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const ACCOUNT_COOKIE = "tbp_account";

export type SessionMember = {
  id: string;
  email: string;
  name: string;
  role: MemberRole;
  status: MemberStatus;
  platformMember: boolean;
  emailVerifiedAt: string | null;
  totpEnabled: boolean;
};

export type SessionContext = {
  member: SessionMember;
  account: TradingAccount;
};

async function requestCookies() {
  try {
    return await cookies();
  } catch {
    return null;
  }
}

async function requestHeaders() {
  try {
    return await headers();
  } catch {
    return null;
  }
}

export async function getSessionMember(): Promise<SessionMember | null> {
  const store = await requestCookies();
  if (!store) {
    return null;
  }
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  const parsed = parseSessionToken(token);
  if (!parsed) {
    return null;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const loaded = await loadSessionMemberRow(supabase, parsed.userId);
  if (!loaded || loaded.status === "disabled") {
    return null;
  }
  const verifiedRaw = loaded.email_verified_at;
  const totpRaw = loaded.totp_enabled_at;
  return {
    id: String(loaded.user_id),
    email: String(loaded.email),
    name: String(loaded.name),
    role: loaded.role === "admin" ? "admin" : "member",
    status: loaded.status === "disabled" ? "disabled" : "active",
    platformMember: loaded.platform_member !== false,
    emailVerifiedAt:
      verifiedRaw == null || verifiedRaw === ""
        ? null
        : String(verifiedRaw),
    totpEnabled: totpRaw != null && totpRaw !== "",
  };
}

async function loadSessionMemberRow(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  userId: string,
) {
  const full = await supabase
    .from("members")
    .select(
      "user_id, email, name, role, status, platform_member, email_verified_at, totp_enabled_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!full.error) {
    return full.data;
  }
  const withoutTotp = await supabase
    .from("members")
    .select(
      "user_id, email, name, role, status, platform_member, email_verified_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!withoutTotp.error && withoutTotp.data) {
    return { ...withoutTotp.data, totp_enabled_at: null };
  }
  const withoutVerified = await supabase
    .from("members")
    .select("user_id, email, name, role, status, platform_member")
    .eq("user_id", userId)
    .maybeSingle();
  if (!withoutVerified.error && withoutVerified.data) {
    return {
      ...withoutVerified.data,
      email_verified_at: "legacy",
      totp_enabled_at: null,
    };
  }
  const legacy = await supabase
    .from("members")
    .select("user_id, email, name, role, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (legacy.error || !legacy.data) {
    return null;
  }
  return {
    ...legacy.data,
    platform_member: true,
    email_verified_at: "legacy",
    totp_enabled_at: null,
  };
}

export async function requireVerifiedEmail(): Promise<SessionMember> {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  if (!member.emailVerifiedAt) {
    redirect(VERIFY_PATH);
  }
  return member;
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const member = await getSessionMember();
  if (!member || !member.emailVerifiedAt) {
    return null;
  }
  const accounts = await listTradingAccounts(member.id);
  const fallback = pickDefaultAccount(accounts);
  if (!fallback) {
    return null;
  }
  const store = await requestCookies();
  const headerStore = await requestHeaders();
  if (!store) {
    return null;
  }
  const headerDesk = parseDeskQuery(headerStore?.get(DESK_HEADER) ?? null);
  const requested = headerDesk ?? store.get(ACCOUNT_COOKIE)?.value;
  const current =
    accounts.find((account) => account.id === requested) ?? fallback;
  return { member, account: current };
}

export async function createSession(userId: string): Promise<void> {
  if (!sessionSecret()) {
    throw new Error("Session secret is not configured.");
  }
  const expiresAtMs = Date.now() + SESSION_DAYS * 86_400_000;
  const store = await cookies();
  store.set(SESSION_COOKIE, signSessionToken(userId, expiresAtMs), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAtMs),
  });
  store.delete(CHALLENGE_COOKIE);
  const accounts = await listTradingAccounts(userId);
  const account = pickDefaultAccount(accounts);
  if (account) {
    await setActiveAccountId(account.id);
  }
}

export async function setActiveAccountId(accountId: string): Promise<void> {
  const store = await cookies();
  const expiresAtMs = Date.now() + SESSION_DAYS * 86_400_000;
  store.set(ACCOUNT_COOKIE, accountId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAtMs),
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(ACCOUNT_COOKIE);
  store.delete(CHALLENGE_COOKIE);
  store.delete(RECOVERY_FLASH_COOKIE);
}

function cookieOptions(expiresAtMs: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAtMs),
  };
}

export async function createSignInChallenge(userId: string): Promise<void> {
  if (!sessionSecret()) {
    throw new Error("Session secret is not configured.");
  }
  const expiresAtMs = Date.now() + CHALLENGE_MINUTES * 60_000;
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.set(
    CHALLENGE_COOKIE,
    signChallengeToken(userId, expiresAtMs),
    cookieOptions(expiresAtMs),
  );
}

export async function getSignInChallengeUserId(): Promise<string | null> {
  const store = await requestCookies();
  const token = store?.get(CHALLENGE_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return parseChallengeToken(token)?.userId ?? null;
}

export async function clearSignInChallenge(): Promise<void> {
  const store = await cookies();
  store.delete(CHALLENGE_COOKIE);
}

export async function setRecoveryCodesFlash(codes: string[]): Promise<void> {
  if (!sessionSecret()) {
    throw new Error("Session secret is not configured.");
  }
  const expiresAtMs = Date.now() + RECOVERY_FLASH_MINUTES * 60_000;
  const store = await cookies();
  store.set(
    RECOVERY_FLASH_COOKIE,
    signRecoveryFlash(codes, expiresAtMs),
    cookieOptions(expiresAtMs),
  );
}

export async function readRecoveryCodesFlash(): Promise<string[] | null> {
  const store = await requestCookies();
  const token = store?.get(RECOVERY_FLASH_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return parseRecoveryFlash(token);
}

export async function clearRecoveryCodesFlash(): Promise<void> {
  const store = await cookies();
  store.delete(RECOVERY_FLASH_COOKIE);
}
