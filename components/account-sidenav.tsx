"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DeskMark, DeskTypeMark } from "@/components/desk-mark";
import { SiteLogo } from "@/components/site-logo";
import { ACCOUNT_DESK_LINKS } from "@/lib/site-links";
import { rememberTradingAccount } from "@/lib/accounts/actions";
import {
  createDeskPath,
  deskHomePath,
  formatAccountMode,
  formatDeskType,
  formatDeskVenueCaption,
  hrefPathname,
  type DeskType,
  type TradingAccount,
} from "@/lib/accounts/model";

const DESK_TYPE_ORDER: DeskType[] = [
  "cash_and_carry",
  "perps",
  "signal_follower",
  "dca",
];

export function AccountSidenav({
  deskId,
  desks,
  createDeskType = null,
}: {
  deskId: string;
  desks: TradingAccount[];
  createDeskType?: DeskType | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-20 flex h-dvh w-72 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface px-4 py-6">
      <div className="mb-6">
        <SiteLogo />
      </div>
      <NavGroup
        label="Account"
        ariaLabel="Account"
        links={ACCOUNT_DESK_LINKS}
        pathname={pathname}
      />
      <DeskList
        className="mt-5"
        desks={desks}
        currentDeskId={deskId}
        createDeskType={createDeskType}
      />
    </aside>
  );
}

function DeskList({
  desks,
  currentDeskId,
  createDeskType,
  className,
}: {
  desks: TradingAccount[];
  currentDeskId: string;
  createDeskType?: DeskType | null;
  className?: string;
}) {
  const groups = DESK_TYPE_ORDER.map((deskType) => ({
    deskType,
    desks: desks.filter((desk) => desk.deskType === deskType),
  }));
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
        Desks
      </p>
      <nav aria-label="Desks" className="mt-3 flex flex-col">
        {groups.map((group) => {
          const creating = createDeskType === group.deskType;
          const empty = group.desks.length === 0;
          const typeLabel = formatDeskType(group.deskType);
          return (
          <div key={group.deskType} className="mt-3 first:mt-0">
            <div className="flex items-center gap-1 px-3">
              <p className="flex min-w-0 flex-1 items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
                <DeskTypeMark deskType={group.deskType} />
                <span>{typeLabel}</span>
              </p>
              {empty ? null : (
                <Link
                  href={createDeskPath(group.deskType)}
                  aria-current={creating ? "true" : undefined}
                  aria-label={`Create ${typeLabel} desk`}
                  title={`Create ${typeLabel} desk`}
                  className={`flex size-6 shrink-0 items-center justify-center rounded-control text-base leading-none ${
                    creating
                      ? "bg-surface-raised text-ink"
                      : "text-ink-faint hover:bg-surface-raised hover:text-ink"
                  }`}
                >
                  +
                </Link>
              )}
            </div>
            <div className="mt-1 flex flex-col gap-1">
              {group.desks.map((desk) => {
                const current = desk.id === currentDeskId;
                const meta = `${formatDeskVenueCaption(desk)} · ${formatAccountMode(desk.mode)}`;
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
                    className={`flex items-center gap-2 rounded-control px-3 py-2 ${
                      current
                        ? "bg-surface-raised text-ink"
                        : "text-ink-faint hover:bg-surface-raised hover:text-ink"
                    }`}
                  >
                    <DeskMark desk={desk} />
                    <span className="min-w-0 truncate text-sm text-ink">
                      {desk.name}
                    </span>
                  </Link>
                );
              })}
              {empty ? (
                <Link
                  href={createDeskPath(group.deskType)}
                  aria-current={creating ? "true" : undefined}
                  className={`flex items-center gap-1.5 rounded-control px-3 py-2 text-sm ${
                    creating
                      ? "bg-surface-raised text-ink"
                      : "text-ink-faint hover:bg-surface-raised hover:text-ink"
                  }`}
                >
                  <span aria-hidden className="text-base leading-none">
                    +
                  </span>
                  Create Desk
                </Link>
              ) : null}
            </div>
          </div>
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
