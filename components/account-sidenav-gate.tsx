"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AccountSidenav } from "@/components/account-sidenav";
import type { TradingAccount } from "@/lib/accounts/model";
import { usesSignedInAppChrome } from "@/lib/site-links";

export function AccountSidenavGate({
  signedIn,
  platformMember,
  desks,
  children,
}: {
  signedIn: boolean;
  platformMember: boolean;
  desks: TradingAccount[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (
    !signedIn ||
    !usesSignedInAppChrome(pathname, signedIn) ||
    pathname.startsWith("/admin")
  ) {
    return children;
  }

  return (
    <div className="flex min-h-dvh">
      <Suspense>
        <AccountSidenav desks={desks} platformMember={platformMember} />
      </Suspense>
      {children}
    </div>
  );
}
