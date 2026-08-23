"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACCOUNT_NAV_LINKS } from "@/lib/site-links";

export function AccountSidenav() {
  const pathname = usePathname();

  return (
    <aside className="rounded-card border border-line bg-surface p-4 lg:w-56 lg:shrink-0">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
        Account
      </p>
      <nav aria-label="Manage account" className="mt-3 flex flex-col gap-1">
        {ACCOUNT_NAV_LINKS.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-control px-3 py-2 text-sm ${
                active
                  ? "bg-surface-raised text-ink"
                  : "text-ink-faint hover:bg-surface-raised hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
