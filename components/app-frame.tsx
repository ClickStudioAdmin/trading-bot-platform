import { AccountSidenavGate } from "@/components/account-sidenav-gate";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listTradingAccounts } from "@/lib/accounts/store";
import { getAdminUser } from "@/lib/admin/access";
import { loadAutoTickEnabled } from "@/lib/admin/settings";
import { signedInHomePath } from "@/lib/auth/onboarding";
import { getSessionMember } from "@/lib/auth/session";
import {
  loadAdminNotificationChrome,
  loadMemberNotificationChrome,
} from "@/lib/notifications/badges";
import { loadPlatformBrand } from "@/lib/platform/brand";

export async function AppFrame({ children }: { children: React.ReactNode }) {
  const member = await getSessionMember();
  const desks = member ? await listTradingAccounts(member.id) : [];
  const verified = Boolean(member?.emailVerifiedAt);
  const chrome =
    verified && member
      ? await loadMemberNotificationChrome(member.id, member.platformMember)
      : null;
  const admin = verified && member ? await getAdminUser() : null;
  const autoTick = admin ? await loadAutoTickEnabled() : false;
  const adminChrome = admin ? await loadAdminNotificationChrome() : null;
  const appHref = member ? signedInHomePath(member, desks) : null;
  const brand = await loadPlatformBrand();

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
      adminBadges={
        adminChrome
          ? {
              "/admin": adminChrome.overview,
              "/admin/billing": adminChrome.billing,
              "/admin/affiliates": adminChrome.affiliates,
              "/admin/members": adminChrome.members,
            }
          : undefined
      }
      platformName={brand.name}
      platformLogoUrl={brand.logoUrl}
    >
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <SiteHeader
          platformName={brand.name}
          platformLogoUrl={brand.logoUrl}
        />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter
          appHref={appHref}
          signedIn={Boolean(member)}
          admin={
            admin
              ? { count: adminChrome?.header ?? 0, autoTick }
              : null
          }
          platformName={brand.name}
          platformLogoUrl={brand.logoUrl}
        />
      </div>
    </AccountSidenavGate>
  );
}
