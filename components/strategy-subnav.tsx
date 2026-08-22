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
    <div className="mx-auto max-w-6xl px-6 pt-8">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
        <Link href="/strategies" className="hover:text-accent-strong">
          Strategies
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Cash and carry
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        Buy the USDT spot, sell the dated future.
      </p>
      <nav
        aria-label="Cash and carry"
        className="mt-5 flex items-end justify-between gap-4 overflow-x-auto border-b border-line"
      >
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
      </nav>
    </div>
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
      className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
        active
          ? "border-accent text-ink"
          : secondary
            ? "border-transparent text-ink-faint hover:text-ink-muted"
            : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {link.label}
    </Link>
  );
}
