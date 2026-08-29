"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AccountSidenav } from "@/components/account-sidenav";
import type { TradingAccount } from "@/lib/accounts/model";
import { isAppChromePath } from "@/lib/site-links";

export function AccountSidenavGate({
  deskId,
  desks,
  children,
}: {
  deskId: string | null;
  desks: TradingAccount[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (
    !deskId ||
    !isAppChromePath(pathname) ||
    pathname.startsWith("/admin")
  ) {
    return children;
  }

  return (
    <div className="flex min-h-dvh">
      <Suspense>
        <AccountSidenav deskId={deskId} desks={desks} />
      </Suspense>
      {children}
    </div>
  );
}
