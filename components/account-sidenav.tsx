"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACCOUNT_DESK_LINKS } from "@/lib/site-links";
import { rememberTradingAccount } from "@/lib/accounts/actions";
import {
  deskHomePath,
  formatAccountMode,
  formatDeskType,
  formatDeskVenueCaption,
  hrefPathname,
  type TradingAccount,
} from "@/lib/accounts/model";

export function AccountSidenav({
  deskId,
  desks,
}: {
  deskId: string;
  desks: TradingAccount[];
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-14 z-10 flex h-[calc(100dvh-3.5rem)] w-56 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface px-5 py-6">
      <NavGroup
        label="Account"
        ariaLabel="Account"
        links={ACCOUNT_DESK_LINKS}
        pathname={pathname}
      />
      <DeskList className="mt-auto pt-6" desks={desks} currentDeskId={deskId} />
    </aside>
  );
}

function DeskList({
  desks,
  currentDeskId,
  className,
}: {
  desks: TradingAccount[];
  currentDeskId: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
        Desks
      </p>
      <nav aria-label="Desks" className="panel-scroll mt-3 flex max-h-64 flex-col gap-1">
        {desks.map((desk) => {
          const current = desk.id === currentDeskId;
          const meta = `${formatDeskType(desk.deskType)} · ${formatDeskVenueCaption(desk)} · ${formatAccountMode(desk.mode)}`;
          return (
            <Link
              key={desk.id}
              href={deskHomePath(desk.deskType, desk.id)}
              aria-current={current ? "true" : undefined}
              title={`${desk.name} · ${meta}`}
              onClick={() => {
                if (!current) {
                  void rememberTradingAccount(desk.id);
                }
              }}
              className={`rounded-control px-3 py-2 ${
                current
                  ? "bg-surface-raised text-ink"
                  : "text-ink-faint hover:bg-surface-raised hover:text-ink"
              }`}
            >
              <span className="block truncate text-sm text-ink">{desk.name}</span>
              <span className="mt-0.5 block truncate text-[11px] text-ink-faint">
                {meta}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function NavGroup({
  label,
  ariaLabel,
  links,
  pathname,
  className,
}: {
  label: string;
  ariaLabel: string;
  links: readonly { href: string; label: string; exact?: boolean }[];
  pathname: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p
        className="truncate text-xs font-medium uppercase tracking-[0.16em] text-accent"
        title={label}
      >
        {label}
      </p>
      <nav aria-label={ariaLabel} className="mt-3 flex flex-col gap-1">
        {links.map((link) => {
          const linkPath = hrefPathname(link.href);
          const active = link.exact
            ? pathname === linkPath
            : pathname === linkPath || pathname.startsWith(`${linkPath}/`);
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
    </div>
  );
}
