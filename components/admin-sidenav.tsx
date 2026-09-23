"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavBadge } from "@/components/nav-badge";
import { SiteLogo } from "@/components/site-logo";
import { NAV_ACTIVE_CLASS, NAV_IDLE_CLASS } from "@/components/site-nav";
import { ADMIN_NAV_LINKS } from "@/lib/site-links";

export function AdminSidenav({
  badges = {},
  platformName,
  platformLogoUrl,
}: {
  badges?: Record<string, number>;
  platformName?: string;
  platformLogoUrl?: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col px-4 py-6">
      <div className="mb-6">
        <SiteLogo
          linked={false}
          name={platformName}
          logoUrl={platformLogoUrl}
        />
      </div>
      <p className="truncate text-xs font-medium uppercase tracking-[0.16em] text-accent">
        Admin
      </p>
      <nav aria-label="Admin" className="mt-2 flex flex-col gap-0.5">
        {ADMIN_NAV_LINKS.map((link) => {
          const exact = "exact" in link && Boolean(link.exact);
          const active = exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center justify-between gap-2 rounded-control px-3 py-1.5 text-sm ${
                active
                  ? NAV_ACTIVE_CLASS
                  : NAV_IDLE_CLASS
              }`}
            >
              <span>{link.label}</span>
              <NavBadge count={badges[link.href] ?? 0} />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
