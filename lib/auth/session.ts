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
  parseSessionToken,
  SESSION_COOKIE,
  SESSION_DAYS,
  sessionSecret,
  signSessionToken,
} from "@/lib/auth/token";
import type { MemberRole, MemberStatus } from "@/lib/members/form";
import { createServiceClient } from "@/lib/supabase/admin";

export const ACCOUNT_COOKIE = "tbp_account";

export type SessionMember = {
  id: string;
  email: string;
  name: string;
  role: MemberRole;
  status: MemberStatus;
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
  const { data, error } = await supabase
    .from("members")
    .select("user_id, email, name, role, status")
    .eq("user_id", parsed.userId)
    .maybeSingle();
  if (error || !data || data.status === "disabled") {
    return null;
  }
  return {
    id: String(data.user_id),
    email: String(data.email),
    name: String(data.name),
    role: data.role === "admin" ? "admin" : "member",
    status: data.status === "disabled" ? "disabled" : "active",
  };
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const member = await getSessionMember();
  if (!member) {
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
}
