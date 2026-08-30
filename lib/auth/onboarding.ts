import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DESK_PATHNAME_HEADER, deskHomePath } from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import {
  pathSkipsOnboarding,
  WELCOME_PATH,
} from "@/lib/auth/onboarding-path";
import { getSessionContext, getSessionMember } from "@/lib/auth/session";

export { pathSkipsOnboarding, WELCOME_PATH } from "@/lib/auth/onboarding-path";

export async function memberHasDesk(userId: string): Promise<boolean> {
  const desks = await listTradingAccounts(userId);
  return desks.length > 0;
}

export async function redirectIfNeedsFirstDesk(): Promise<void> {
  const pathname = (await headers()).get(DESK_PATHNAME_HEADER) ?? "";
  if (pathSkipsOnboarding(pathname)) {
    return;
  }
  const member = await getSessionMember();
  if (!member) {
    return;
  }
  if (!(await memberHasDesk(member.id))) {
    redirect(WELCOME_PATH);
  }
}

export async function redirectSignedInHome(): Promise<void> {
  const member = await getSessionMember();
  if (!member) {
    return;
  }
  if (!(await memberHasDesk(member.id))) {
    redirect(WELCOME_PATH);
  }
  const session = await getSessionContext();
  if (session) {
    redirect(deskHomePath(session.account.deskType, session.account.id));
  }
}
