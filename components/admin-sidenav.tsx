"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavBadge } from "@/components/nav-badge";
import { ADMIN_NAV_LINKS } from "@/lib/site-links";

export function AdminSidenav({
  badges = {},
}: {
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-line bg-surface px-5 py-6">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
        Admin
      </p>
      <nav aria-label="Admin" className="mt-3 flex flex-col gap-1">
        {ADMIN_NAV_LINKS.map((link) => {
          const exact = "exact" in link && Boolean(link.exact);
          const active = exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center justify-between gap-2 rounded-control px-3 py-2 text-sm ${
                active
                  ? "bg-surface-raised text-ink"
                  : "text-ink-faint hover:bg-surface-raised hover:text-ink"
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
