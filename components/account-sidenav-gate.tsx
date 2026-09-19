"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AccountSidenav } from "@/components/account-sidenav";
import { AdminSidenav } from "@/components/admin-sidenav";
import { UiRegion } from "@/components/ui-preferences";
import type { TradingAccount } from "@/lib/accounts/model";
import { usesSignedInAppChrome } from "@/lib/site-links";

export function AccountSidenavGate({
  signedIn,
  platformMember,
  desks,
  badges,
  adminBadges,
  children,
  platformName,
  platformLogoUrl,
}: {
  signedIn: boolean;
  platformMember: boolean;
  desks: TradingAccount[];
  badges?: Record<string, number>;
  adminBadges?: Record<string, number>;
  children: React.ReactNode;
  platformName?: string;
  platformLogoUrl?: string | null;
}) {
  const pathname = usePathname();
  if (!signedIn || !usesSignedInAppChrome(pathname, signedIn)) {
    return children;
  }

  const admin = pathname.startsWith("/admin");

  return (
    <div className="flex min-h-dvh">
      <UiRegion region="chrome" className="shrink-0">
        <Suspense>
          {admin ? (
            <AdminSidenav
              badges={adminBadges}
              platformName={platformName}
              platformLogoUrl={platformLogoUrl}
            />
          ) : (
            <AccountSidenav
              desks={desks}
              platformMember={platformMember}
              badges={badges}
              platformName={platformName}
              platformLogoUrl={platformLogoUrl}
            />
          )}
        </Suspense>
      </UiRegion>
      {children}
    </div>
  );
}
