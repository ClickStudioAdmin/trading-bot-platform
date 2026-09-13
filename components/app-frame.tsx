import { AccountSidenavGate } from "@/components/account-sidenav-gate";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { deskHomePath } from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import { AFFILIATES_PATH, WELCOME_PATH } from "@/lib/auth/onboarding-path";
import { getSessionContext, getSessionMember } from "@/lib/auth/session";

export async function AppFrame({ children }: { children: React.ReactNode }) {
  const member = await getSessionMember();
  const session = await getSessionContext();
  const desks = member ? await listTradingAccounts(member.id) : [];
  const appHref = session
    ? deskHomePath(session.account.deskType, session.account.id)
    : member
      ? member.platformMember
        ? WELCOME_PATH
        : AFFILIATES_PATH
      : null;

  return (
    <AccountSidenavGate
      signedIn={Boolean(member)}
      platformMember={member?.platformMember === true}
      desks={desks}
    >
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter appHref={appHref} signedIn={Boolean(member)} />
      </div>
    </AccountSidenavGate>
  );
}
