import { AccountSidenavGate } from "@/components/account-sidenav-gate";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { deskHomePath } from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import { signedInHomePath } from "@/lib/auth/onboarding";
import { getSessionMember } from "@/lib/auth/session";
import { loadMemberNotificationChrome } from "@/lib/notifications/badges";

export async function AppFrame({ children }: { children: React.ReactNode }) {
  const member = await getSessionMember();
  const desks = member ? await listTradingAccounts(member.id) : [];
  const chrome =
    member?.emailVerifiedAt
      ? await loadMemberNotificationChrome(member.id, member.platformMember)
      : null;
  const appHref = member ? signedInHomePath(member, desks) : null;

  return (
    <AccountSidenavGate
      signedIn={Boolean(member)}
      platformMember={member?.platformMember === true}
      desks={desks}
      badges={
        chrome
          ? {
              "/account": chrome.overview,
              "/account/billing": chrome.billing,
              "/account/exchanges": chrome.actions.unboundLive,
            }
          : undefined
      }
    >
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter appHref={appHref} signedIn={Boolean(member)} />
      </div>
    </AccountSidenavGate>
  );
}
