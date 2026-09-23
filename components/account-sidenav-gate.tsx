"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AccountSidenav } from "@/components/account-sidenav";
import { AdminSidenav } from "@/components/admin-sidenav";
import { UiRegion } from "@/components/ui-preferences";
import type { TradingAccount } from "@/lib/accounts/model";
import { usesSignedInAppChrome } from "@/lib/site-links";

export function SignedInNav({
  desks,
  platformMember,
  badges,
  adminBadges,
  platformName,
  platformLogoUrl,
}: {
  desks: TradingAccount[];
  platformMember: boolean;
  badges?: Record<string, number>;
  adminBadges?: Record<string, number>;
  platformName?: string;
  platformLogoUrl?: string | null;
}) {
  const pathname = usePathname();
  const admin = pathname.startsWith("/admin");
  return (
    <UiRegion region="chrome" className="shrink-0">
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
    </UiRegion>
  );
}

export function AccountSidenavGate({
  signedIn,
  nav,
  children,
}: {
  signedIn: boolean;
  nav: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (!signedIn || !usesSignedInAppChrome(pathname, signedIn)) {
    return children;
  }

  return (
    <div className="flex min-h-dvh">
      {nav}
      {children}
    </div>
  );
}
