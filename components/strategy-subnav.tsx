"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CASH_AND_CARRY_PRIMARY_LINKS,
  CASH_AND_CARRY_SECONDARY_LINKS,
} from "@/lib/site-links";

export function StrategySubnav({
  automationsRunning = false,
  reduceOnly = false,
  connection,
}: {
  automationsRunning?: boolean;
  reduceOnly?: boolean;
  connection?: { label: string; href: string } | null;
}) {
  const pathname = usePathname();
  const status = reduceOnly
    ? {
        href: "/strategies/cash-and-carry/automations",
        title: "Reduce only",
        label: "Reduce only",
        tone: "warning" as const,
        pulse: false,
      }
    : automationsRunning
      ? {
          href: "/strategies/cash-and-carry/automations",
          title: "Automations Running",
          label: "Automations Running",
          tone: "success" as const,
          pulse: true,
        }
      : null;

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
            Cash and Carry
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Buy the USDT spot, sell the dated future.
          </p>
        </div>
        {connection || status ? (
          <div className="mt-8 flex max-w-[min(100%,32rem)] flex-wrap items-center justify-end gap-x-4 gap-y-2">
            {connection ? (
              <Link
                href={connection.href}
                className="text-right text-sm text-ink-muted hover:text-ink"
                title={connection.label}
              >
                {connection.label}
              </Link>
            ) : null}
            {status ? (
              <Link
                href={status.href}
                className={`flex shrink-0 items-center gap-2 text-sm ${
                  status.tone === "warning" ? "text-warning" : "text-success"
                }`}
                title={status.title}
              >
                <span className="relative flex size-2.5" aria-hidden>
                  {status.pulse ? (
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                  ) : null}
                  <span
                    className={`relative inline-flex size-2.5 rounded-full ${
                      status.tone === "warning" ? "bg-warning" : "bg-success"
                    }`}
                  />
                </span>
                {status.label}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      <nav
        aria-label="Cash and Carry"
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
