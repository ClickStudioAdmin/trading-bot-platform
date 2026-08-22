"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/members", label: "Members" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/logs", label: "Logs" },
] as const;

export function AdminSubnav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6 py-2">
        {LINKS.map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-control px-3 py-1.5 text-sm whitespace-nowrap ${
                active
                  ? "bg-surface-raised text-ink"
                  : "text-ink-muted hover:bg-surface-raised hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
