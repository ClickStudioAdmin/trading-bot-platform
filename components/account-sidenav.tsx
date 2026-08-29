"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DeskMark, DeskTypeMark } from "@/components/desk-mark";
import { SiteLogo } from "@/components/site-logo";
import { ACCOUNT_DESK_LINKS } from "@/lib/site-links";
import { rememberTradingAccount } from "@/lib/accounts/actions";
import {
  DESK_QUERY,
  createDeskPath,
  deskHomePath,
  parseDeskQuery,
  parseDeskTypeChoice,
  formatAccountMode,
  formatDeskType,
  formatDeskVenueCaption,
  hrefPathname,
  type DeskType,
  type TradingAccount,
} from "@/lib/accounts/model";

const AUTOMATED_DESK_TYPES: DeskType[] = [
  "cash_and_carry",
  "signal_follower",
  "dca",
  "perps_bots",
];

export function AccountSidenav({
  desks,
}: {
  desks: TradingAccount[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const createType = parseDeskTypeChoice(searchParams.get("type"));
  const createDeskType =
    pathname === "/account/desks/new" && createType.ok
      ? createType.deskType
      : null;
  const currentDeskId = parseDeskQuery(searchParams.get(DESK_QUERY));

  return (
    <aside className="sticky top-0 z-20 flex h-dvh w-72 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface px-4 py-6">
      <div className="mb-6">
        <SiteLogo linked={false} />
      </div>
      <NavGroup
        label="Account"
        ariaLabel="Account"
        links={ACCOUNT_DESK_LINKS}
        pathname={pathname}
      />
      <DeskGroup
        className="mt-5"
        label="Automated desks"
        types={AUTOMATED_DESK_TYPES}
        desks={desks}
        currentDeskId={currentDeskId}
        createDeskType={createDeskType}
      />
      <ManualDeskGroup
        className="mt-5"
        desks={desks.filter((desk) => desk.deskType === "perps")}
        currentDeskId={currentDeskId}
        creating={createDeskType === "perps"}
      />
    </aside>
  );
}

function DeskGroup({
  label,
  types,
  desks,
  currentDeskId,
  createDeskType,
  className,
}: {
  label: string;
  types: readonly DeskType[];
  desks: TradingAccount[];
  currentDeskId: string | null;
  createDeskType?: DeskType | null;
  className?: string;
}) {
  const groups = types.map((deskType) => ({
    deskType,
    desks: desks.filter((desk) => desk.deskType === deskType),
  }));
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
        {label}
      </p>
      <nav aria-label={label} className="mt-3 flex flex-col">
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
              {group.desks.map((desk) => (
                <DeskNavLink
                  key={desk.id}
                  desk={desk}
                  current={desk.id === currentDeskId}
                />
              ))}
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

function ManualDeskGroup({
  desks,
  currentDeskId,
  creating,
  className,
}: {
  desks: TradingAccount[];
  currentDeskId: string | null;
  creating: boolean;
  className?: string;
}) {
  const empty = desks.length === 0;
  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <p className="min-w-0 flex-1 text-xs font-medium uppercase tracking-[0.16em] text-accent">
          Manual trading desks
        </p>
        {empty ? null : (
          <Link
            href={createDeskPath("perps")}
            aria-current={creating ? "true" : undefined}
            aria-label="Create Perps desk"
            title="Create Perps desk"
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
      <nav aria-label="Manual trading desks" className="mt-3 flex flex-col gap-1">
        {desks.map((desk) => (
          <DeskNavLink
            key={desk.id}
            desk={desk}
            current={desk.id === currentDeskId}
          />
        ))}
        {empty ? (
          <Link
            href={createDeskPath("perps")}
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
      </nav>
    </div>
  );
}

function DeskNavLink({
  desk,
  current,
}: {
  desk: TradingAccount;
  current: boolean;
}) {
  const meta = `${formatDeskVenueCaption(desk)} · ${formatAccountMode(desk.mode)}`;
  return (
    <Link
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
      <span className="min-w-0 truncate text-sm text-ink">{desk.name}</span>
    </Link>
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
