"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CASH_AND_CARRY_PRIMARY_LINKS,
  CASH_AND_CARRY_SECONDARY_LINKS,
} from "@/lib/site-links";

export function StrategySubnav({
  automationsRunning = false,
}: {
  automationsRunning?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-6xl px-6 pt-8">
      <div className="flex items-start justify-between gap-4">
        <div>
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
        </div>
        {automationsRunning ? (
          <Link
            href="/strategies/cash-and-carry/automations"
            className="mt-8 flex items-center gap-2 text-sm text-success"
            title="Automations running"
          >
            <span className="relative flex size-2.5" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-success" />
            </span>
            Automations
          </Link>
        ) : null}
      </div>
      <nav
        aria-label="Cash and carry"
        className="mt-5 flex items-end justify-between gap-4 border-b border-line"
      >
        <div className="flex min-w-0 flex-wrap gap-1">
          {CASH_AND_CARRY_PRIMARY_LINKS.map((link) => (
            <SubnavLink key={link.href} link={link} pathname={pathname} />
          ))}
        </div>
        <div className="flex shrink-0 gap-1">
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
