import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  DESK_PATHNAME_HEADER,
  deskHomePath,
  pickDefaultAccount,
  type TradingAccount,
} from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import {
  ACCOUNT_HOME_PATH,
  AFFILIATES_PATH,
  pathAllowsAffiliateOnly,
  pathAllowsUnverified,
  VERIFY_PATH,
} from "@/lib/auth/onboarding-path";
import {
  getSessionContext,
  getSessionMember,
  type SessionMember,
} from "@/lib/auth/session";

export {
  ACCOUNT_HOME_PATH,
  AFFILIATES_PATH,
  FORGOT_PASSWORD_PATH,
  pathAllowsAffiliateOnly,
  pathAllowsUnverified,
  RESET_PASSWORD_PATH,
  SIGN_IN_2FA_PATH,
  SIGN_IN_PATH,
  SIGN_UP_PATH,
  VERIFY_EMAIL_PATH,
  VERIFY_PATH,
} from "@/lib/auth/onboarding-path";

export function memberIsVerified(member: SessionMember): boolean {
  return Boolean(member.emailVerifiedAt);
}

export function signedInHomePath(
  member: SessionMember,
  accounts: TradingAccount[],
): string {
  if (!memberIsVerified(member)) {
    return VERIFY_PATH;
  }
  if (!member.platformMember) {
    return AFFILIATES_PATH;
  }
  const home = pickDefaultAccount(accounts);
  return home ? deskHomePath(home.deskType, home.id) : ACCOUNT_HOME_PATH;
}

export async function memberHasDesk(userId: string): Promise<boolean> {
  const desks = await listTradingAccounts(userId);
  return desks.length > 0;
}

export async function redirectIfNeedsGate(): Promise<void> {
  const pathname = (await headers()).get(DESK_PATHNAME_HEADER) ?? "";
  const member = await getSessionMember();
  if (!member) {
    return;
  }
  if (!memberIsVerified(member)) {
    if (!pathAllowsUnverified(pathname)) {
      redirect(VERIFY_PATH);
    }
    return;
  }
  if (!member.platformMember && !pathAllowsAffiliateOnly(pathname)) {
    redirect(AFFILIATES_PATH);
  }
}

export async function redirectSignedInHome(): Promise<void> {
  const member = await getSessionMember();
  if (!member) {
    return;
  }
  if (!memberIsVerified(member)) {
    redirect(VERIFY_PATH);
  }
  if (!member.platformMember) {
    redirect(AFFILIATES_PATH);
  }
  const session = await getSessionContext();
  if (session) {
    redirect(deskHomePath(session.account.deskType, session.account.id));
  }
  redirect(ACCOUNT_HOME_PATH);
}
