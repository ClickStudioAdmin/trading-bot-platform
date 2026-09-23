import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import {
  AccountSidenavGate,
  SignedInNav,
} from "@/components/account-sidenav-gate";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  UiPreferencesProvider,
  UiRegion,
} from "@/components/ui-preferences";
import { listTradingAccounts } from "@/lib/accounts/store";
import { DESK_PATHNAME_HEADER } from "@/lib/accounts/model";
import {
  UI_CHROME_COOKIE,
  UI_CONTENT_COOKIE,
  parseUiScheme,
} from "@/lib/theme/preferences";
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
  const admin = verified && member ? await getAdminUser() : null;
  const autoTick = admin ? await loadAutoTickEnabled() : false;
  const appHref = member ? signedInHomePath(member, desks) : null;
  const brand = await loadPlatformBrand();
  const jar = await cookies();
  const chromeScheme = parseUiScheme(jar.get(UI_CHROME_COOKIE)?.value);
  const contentScheme = parseUiScheme(jar.get(UI_CONTENT_COOKIE)?.value);
  const pathname = (await headers()).get(DESK_PATHNAME_HEADER) ?? "";
  const adminPath = pathname.startsWith("/admin");
  const platformMember = member?.platformMember === true;
  const nav = {
    desks,
    platformMember,
    platformName: brand.name,
    platformLogoUrl: brand.logoUrl,
  };

  return (
    <UiPreferencesProvider chrome={chromeScheme} content={contentScheme}>
      <AccountSidenavGate
        signedIn={Boolean(member)}
        nav={
          member ? (
            <Suspense fallback={<SignedInNav {...nav} />}>
              <SidenavBadges
                {...nav}
                userId={member.id}
                verified={verified}
                loadAdmin={adminPath && Boolean(admin)}
              />
            </Suspense>
          ) : null
        }
      >
        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <UiRegion region="chrome">
            <SiteHeader
              platformName={brand.name}
              platformLogoUrl={brand.logoUrl}
              isAdmin={Boolean(admin)}
              loadAdminAlerts={adminPath && Boolean(admin)}
            />
          </UiRegion>
          <UiRegion region="content" className="flex flex-1 flex-col">
            {children}
          </UiRegion>
          <UiRegion region="chrome">
            <SiteFooter
              appHref={appHref}
              signedIn={Boolean(member)}
              admin={admin ? { autoTick } : null}
              platformName={brand.name}
              platformLogoUrl={brand.logoUrl}
            />
          </UiRegion>
        </div>
      </AccountSidenavGate>
    </UiPreferencesProvider>
  );
}

async function SidenavBadges({
  userId,
  verified,
  loadAdmin,
  desks,
  platformMember,
  platformName,
  platformLogoUrl,
}: {
  userId: string;
  verified: boolean;
  loadAdmin: boolean;
  desks: Awaited<ReturnType<typeof listTradingAccounts>>;
  platformMember: boolean;
  platformName: string;
  platformLogoUrl: string | null;
}) {
  const [memberChrome, adminChrome] = await Promise.all([
    verified
      ? loadMemberNotificationChrome(userId, platformMember)
      : Promise.resolve(null),
    loadAdmin ? loadAdminNotificationChrome() : Promise.resolve(null),
  ]);
  return (
    <SignedInNav
      desks={desks}
      platformMember={platformMember}
      platformName={platformName}
      platformLogoUrl={platformLogoUrl}
      badges={
        memberChrome
          ? {
              "/account": memberChrome.overview,
              "/account/billing": memberChrome.billing,
              "/account/sub-accounts": memberChrome.actions.unboundLive,
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
    />
  );
}

