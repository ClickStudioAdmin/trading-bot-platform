"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CASH_AND_CARRY_LINKS } from "@/lib/site-links";

export function StrategySubnav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Cash and carry" className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6 py-2">
        {CASH_AND_CARRY_LINKS.map((link) => {
          const exact = "exact" in link && link.exact;
          const active = exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
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
