"use client";

import { usePathname } from "next/navigation";
import { SiteLogo } from "@/components/site-logo";
export function HeaderBar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideLogo =
    pathname.startsWith("/account") || pathname.startsWith("/strategies");

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-sm">
      <div
        className={`mx-auto flex max-w-7xl items-center gap-4 px-6 py-3 ${
          hideLogo ? "justify-end" : "justify-between"
        }`}
      >
        {hideLogo ? null : (
          <div className="min-w-0">
            <SiteLogo />
          </div>
        )}
        {children}
      </div>
    </header>
  );
}
