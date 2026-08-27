"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AccountSnapshotHover } from "@/components/account-snapshot";
import type { AccountSnapshotView } from "@/lib/exchanges/account-view";
import {
  CASH_AND_CARRY_PRIMARY_LINKS,
  CASH_AND_CARRY_SECONDARY_LINKS,
} from "@/lib/site-links";

export function StrategySubnav({
  title = "Cash and Carry",
  description = "Buy the USDT spot, sell the dated future.",
  navLabel = "Cash and Carry",
  primaryLinks = CASH_AND_CARRY_PRIMARY_LINKS,
  secondaryLinks = CASH_AND_CARRY_SECONDARY_LINKS,
  automationsHref = "/strategies/cash-and-carry/automations",
  automationsRunning = false,
  reduceOnly = false,
  connection,
}: {
  title?: string;
  description?: string;
  navLabel?: string;
  primaryLinks?: readonly { href: string; label: string; exact?: boolean }[];
  secondaryLinks?: readonly { href: string; label: string; exact?: boolean }[];
  automationsHref?: string;
  automationsRunning?: boolean;
  reduceOnly?: boolean;
  connection?: {
    name: string;
    venue: string | null;
    connected: boolean;
    overline?: string;
    href?: string;
    snapshot?: AccountSnapshotView | null;
  } | null;
}) {
  const pathname = usePathname();
  const status = reduceOnly
    ? {
        href: automationsHref,
        title: "Reduce only",
        label: "Reduce only",
        tone: "warning" as const,
        pulse: false,
      }
    : automationsRunning
      ? {
        href: automationsHref,
        title: "Automations Running",
          label: "Running",
          tone: "success" as const,
          pulse: true,
        }
      : null;

  return (
    <div className="mx-auto max-w-7xl px-6 pt-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            <Link href="/strategies" className="hover:text-accent-strong">
              Desks
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        </div>
        {connection || status ? (
          <div className="mt-6 flex max-w-[min(100%,32rem)] flex-wrap items-start justify-end gap-2">
            {connection ? (
              <AccountSnapshotHover
                snapshot={
                  connection.connected ? connection.snapshot ?? null : null
                }
              >
                <HeaderMeta
                  overline={connection.overline ?? "Exchange Connection"}
                  href={connection.href}
                >
                  <span
                    className={`flex items-center gap-2 text-sm ${
                      connection.connected ? "text-ink" : "text-warning"
                    }`}
                  >
                    <StatusDot
                      tone={connection.connected ? "success" : "warning"}
                      pulse={false}
                    />
                    <span className="max-w-[14rem] truncate">
                      {connection.name}
                      {connection.venue ? (
                        <span className="text-ink-muted">
                          {" "}
                          ({connection.venue})
                        </span>
                      ) : null}
                    </span>
                  </span>
                </HeaderMeta>
              </AccountSnapshotHover>
            ) : null}
            {status ? (
              <HeaderMeta overline="Automations" href={status.href}>
                <span
                  className={`flex items-center gap-2 text-sm ${
                    status.tone === "warning" ? "text-warning" : "text-success"
                  }`}
                  title={status.title}
                >
                  <StatusDot tone={status.tone} pulse={status.pulse} />
                  {status.label}
                </span>
              </HeaderMeta>
            ) : null}
          </div>
        ) : null}
      </div>
      <nav
        aria-label={navLabel}
        className="mt-5 flex items-end justify-between gap-4 border-b border-line"
      >
        <div className="flex min-w-0 flex-wrap gap-1">
          {primaryLinks.map((link) => (
            <SubnavLink key={link.href} link={link} pathname={pathname} />
          ))}
        </div>
        <div className="flex shrink-0 gap-1">
          {secondaryLinks.map((link) => (
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

function HeaderMeta({
  overline,
  href,
  children,
}: {
  overline: string;
  href?: string;
  children: ReactNode;
}) {
  const className =
    "block w-max max-w-full rounded-card border border-line bg-surface px-3 py-2 text-left";
  const body = (
    <>
      <p className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
        {overline}
      </p>
      <div className="mt-1 whitespace-nowrap">{children}</div>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`${className} hover:border-line-strong`}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

function StatusDot({
  tone,
  pulse,
}: {
  tone: "success" | "warning";
  pulse: boolean;
}) {
  return (
    <span className="relative flex size-2.5 shrink-0" aria-hidden>
      {pulse ? (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
      ) : null}
      <span
        className={`relative inline-flex size-2.5 rounded-full ${
          tone === "warning" ? "bg-warning" : "bg-success"
        }`}
      />
    </span>
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
