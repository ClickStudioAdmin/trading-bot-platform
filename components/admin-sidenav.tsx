"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_LINKS } from "@/lib/site-links";

export function AdminSidenav() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-line bg-surface px-5 py-6">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
        Admin
      </p>
      <nav aria-label="Admin" className="mt-3 flex flex-col gap-1">
        {ADMIN_NAV_LINKS.map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
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
