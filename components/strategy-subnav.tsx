"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CASH_AND_CARRY_PRIMARY_LINKS,
  CASH_AND_CARRY_SECONDARY_LINKS,
} from "@/lib/site-links";

export function StrategySubnav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Cash and carry" className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 overflow-x-auto px-6 py-2">
        <div className="flex gap-1">
          {CASH_AND_CARRY_PRIMARY_LINKS.map((link) => (
            <SubnavLink key={link.href} link={link} pathname={pathname} />
          ))}
        </div>
        <div className="flex gap-1">
          {CASH_AND_CARRY_SECONDARY_LINKS.map((link) => (
            <SubnavLink
              key={link.href}
              link={link}
              pathname={pathname}
              secondary
            />
          ))}
        </div>
      </div>
    </nav>
  );
}

function SubnavLink({
  link,
  pathname,
  secondary,
}: {
  link: { href: string; label: string; exact?: boolean };
  pathname: string;
  secondary?: boolean;
}) {
  const exact = Boolean(link.exact);
  const active = exact
    ? pathname === link.href
    : pathname === link.href || pathname.startsWith(`${link.href}/`);

  return (
    <Link
      href={link.href}
      className={`rounded-control px-3 py-1.5 text-sm whitespace-nowrap ${
        active
          ? "bg-surface-raised text-ink"
          : secondary
            ? "text-ink-faint hover:bg-surface-raised hover:text-ink"
            : "text-ink-muted hover:bg-surface-raised hover:text-ink"
      }`}
    >
      {link.label}
    </Link>
  );
}
