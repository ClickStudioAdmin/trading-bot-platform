"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteLogo } from "@/components/site-logo";
import { isAffiliatePortalPath } from "@/lib/site-links";

export function HeaderBar({
  start,
  children,
  signedIn = false,
}: {
  start?: ReactNode;
  children: ReactNode;
  signedIn?: boolean;
}) {
  const pathname = usePathname();
  const hideLogo =
    pathname.startsWith("/account") ||
    pathname.startsWith("/strategies") ||
    (signedIn && isAffiliatePortalPath(pathname));

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex min-w-0 items-center gap-4">
          {hideLogo ? null : (
            <div className="min-w-0">
              <SiteLogo />
            </div>
          )}
          {start}
        </div>
        {children}
      </div>
    </header>
  );
}
