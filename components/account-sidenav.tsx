"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { DeskTypeMark } from "@/components/desk-mark";
import { SiteLogo } from "@/components/site-logo";
import { rememberTradingAccount } from "@/lib/accounts/actions";
import {
  DESK_MODE_FILTERS,
  DESK_QUERY,
  createDeskPath,
  deskDisplayMode,
  deskHomePath,
  deskMatchesModeFilter,
  formatDeskCopyBadge,
  formatDeskDisplayMode,
  formatDeskDisplayModeHint,
  formatDeskNavLabel,
  hrefPathname,
  parseDeskModeFilter,
  parseDeskQuery,
  parseDeskTypeChoice,
  shouldShowDeskModeFilter,
  AUTOMATED_DESK_TYPES,
  type DeskDisplayMode,
  type DeskModeFilter,
  type DeskType,
  type TradingAccount,
} from "@/lib/accounts/model";
import { AFFILIATES_PATH } from "@/lib/auth/onboarding-path";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { upgradeAffiliateToPlatformAction } from "@/lib/membership/affiliate-actions";
import { IconChevronDown } from "@/components/icons";
import { NavBadge } from "@/components/nav-badge";
import { NAV_IDLE_CLASS, NavItemIcon } from "@/components/site-nav";
import { ACCOUNT_DESK_LINKS, AFFILIATE_ONLY_LINKS } from "@/lib/site-links";

export function AccountSidenav({
  desks,
  platformMember,
  badges = {},
  platformName,
  platformLogoUrl,
}: {
  desks: TradingAccount[];
  platformMember: boolean;
  badges?: Record<string, number>;
  platformName?: string;
  platformLogoUrl?: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const createType = parseDeskTypeChoice(searchParams.get("type"));
  const createDeskType =
    pathname === "/account/desks/new" && createType.ok
      ? createType.deskType
      : null;
  const currentDeskId = parseDeskQuery(searchParams.get(DESK_QUERY));
  const modeFilter = useDeskModeFilter();
  const showModeFilter = shouldShowDeskModeFilter(desks);
  const filterMatchCount = desks.filter((desk) =>
    deskMatchesModeFilter(desk, modeFilter.value),
  ).length;

  return (
    <aside className="sticky top-0 z-20 flex h-dvh w-72 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface px-4 py-6">
      <div className="mb-6">
        <SiteLogo
          linked={!platformMember}
          href={platformMember ? "/" : AFFILIATES_PATH}
          name={platformName}
          logoUrl={platformLogoUrl}
        />
      </div>
      <NavGroup
        label="Account"
        ariaLabel="Account"
        links={platformMember ? ACCOUNT_DESK_LINKS : AFFILIATE_ONLY_LINKS}
        pathname={pathname}
        badges={badges}
        collapsible
      />
      {!platformMember ? (
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            Account type
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            This login is affiliate-only. You can share links and earn on
            referred subscriptions, but you cannot open desks.
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            Convert to a Free platform membership to use the trading app.
            Your network, commissions, and payout settings stay. You can
            choose a paid plan later.
          </p>
          <form action={upgradeAffiliateToPlatformAction} className="mt-4">
            <PendingSubmitButton
              pendingLabel="Converting…"
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent"
            >
              Convert
            </PendingSubmitButton>
          </form>
        </div>
      ) : null}
      {platformMember ? (
        <>
          <DeskGroup
            className="mt-5"
            label="Automated desks"
            types={AUTOMATED_DESK_TYPES}
            desks={desks}
            currentDeskId={currentDeskId}
            createDeskType={createDeskType}
            modeFilter={modeFilter.value}
            filterBar={
              showModeFilter ? (
                <DeskModeFilterBar
                  value={modeFilter.value}
                  onChange={modeFilter.setValue}
                  empty={
                    modeFilter.value !== "all" && filterMatchCount === 0
                      ? `No ${formatDeskDisplayMode(modeFilter.value)} desks.`
                      : null
                  }
                />
              ) : null
            }
          />
          <ManualDeskGroup
            className="mt-5"
            desks={desks.filter((desk) => desk.deskType === "perps")}
            currentDeskId={currentDeskId}
            creating={createDeskType === "perps"}
            modeFilter={modeFilter.value}
          />
        </>
      ) : null}
    </aside>
  );
}

function DeskGroup({
  label,
  types,
  desks,
  currentDeskId,
  createDeskType,
  modeFilter,
  filterBar,
  className,
}: {
  label: string;
  types: readonly DeskType[];
  desks: TradingAccount[];
  currentDeskId: string | null;
  createDeskType?: DeskType | null;
  modeFilter: DeskModeFilter;
  filterBar?: ReactNode;
  className?: string;
}) {
  const groups = types.map((deskType) => {
    const typed = desks.filter((desk) => desk.deskType === deskType);
    return {
      deskType,
      typed,
      visible: visibleDesks(typed, modeFilter, currentDeskId),
    };
  });
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
        {label}
      </p>
      {filterBar}
      <nav aria-label={label} className="mt-3 flex flex-col">
        {groups.map((group) => {
          const creating = createDeskType === group.deskType;
          const empty = group.typed.length === 0;
          const typeLabel = formatDeskNavLabel(group.deskType);
          return (
          <div key={group.deskType} className="mt-3 first:mt-0">
            <div className="flex items-center gap-1 px-3">
              <p className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-ink">
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
                      : NAV_IDLE_CLASS
                  }`}
                >
                  +
                </Link>
              )}
            </div>
            <div className="mt-1 flex flex-col gap-1 pl-5">
              {group.visible.map((desk) => (
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
                      : NAV_IDLE_CLASS
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
  modeFilter,
  className,
}: {
  desks: TradingAccount[];
  currentDeskId: string | null;
  creating: boolean;
  modeFilter: DeskModeFilter;
  className?: string;
}) {
  const empty = desks.length === 0;
  const visible = visibleDesks(desks, modeFilter, currentDeskId);
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
                : NAV_IDLE_CLASS
            }`}
          >
            +
          </Link>
        )}
      </div>
      <nav aria-label="Manual trading desks" className="mt-3 flex flex-col gap-1 pl-5">
        {visible.map((desk) => (
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
                : NAV_IDLE_CLASS
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
  const mode = deskDisplayMode(desk);
  const hint = formatDeskDisplayModeHint(desk);
  return (
    <Link
      href={deskHomePath(desk.deskType, desk.id)}
      aria-current={current ? "true" : undefined}
      title={`${desk.name} · ${hint}`}
      onClick={() => {
        if (!current) {
          void rememberTradingAccount(desk.id);
        }
      }}
      className={`flex items-center gap-1.5 rounded-control px-3 py-2 ${
        current
          ? "bg-surface-raised text-ink"
          : NAV_IDLE_CLASS
      }`}
    >
      <span className="min-w-0 truncate text-sm">{desk.name}</span>
      <DeskModeBadge mode={mode} hint={hint} />
      {formatDeskCopyBadge(desk) ? (
        <span className="shrink-0 rounded-control bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
          Copy
        </span>
      ) : null}
    </Link>
  );
}

const MODE_BADGE_TONE: Record<DeskDisplayMode, string> = {
  paper: "bg-ink-faint/15 text-ink-muted",
  demo: "bg-warning/15 text-warning",
  live: "bg-danger/15 text-danger",
};

function DeskModeBadge({
  mode,
  hint,
}: {
  mode: DeskDisplayMode;
  hint: string;
}) {
  return (
    <span
      title={hint}
      className={`shrink-0 rounded-control px-1.5 py-0.5 text-[10px] font-medium ${MODE_BADGE_TONE[mode]}`}
    >
      {formatDeskDisplayMode(mode)}
    </span>
  );
}

const DESK_MODE_FILTER_KEY = "tbp-desk-mode-filter";

function useDeskModeFilter() {
  const [value, setValue] = useState<DeskModeFilter>("all");

  useEffect(() => {
    setValue(parseDeskModeFilter(window.localStorage.getItem(DESK_MODE_FILTER_KEY)));
  }, []);

  return {
    value,
    setValue(next: DeskModeFilter) {
      setValue(next);
      window.localStorage.setItem(DESK_MODE_FILTER_KEY, next);
    },
  };
}

function visibleDesks(
  desks: TradingAccount[],
  filter: DeskModeFilter,
  currentDeskId: string | null,
) {
  return desks.filter(
    (desk) =>
      deskMatchesModeFilter(desk, filter) || desk.id === currentDeskId,
  );
}

function DeskModeFilterBar({
  value,
  onChange,
  empty,
}: {
  value: DeskModeFilter;
  onChange: (next: DeskModeFilter) => void;
  empty?: string | null;
}) {
  return (
    <div className="mt-2 px-3">
      <div
        role="group"
        aria-label="Desk mode"
        className="flex gap-0.5 rounded-control border border-line bg-surface p-0.5"
      >
        {DESK_MODE_FILTERS.map((option) => {
          const active = value === option;
          const label =
            option === "all" ? "All" : formatDeskDisplayMode(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`min-w-0 flex-1 rounded-control px-1 py-1 text-[11px] ${
                active
                  ? "bg-surface-raised font-medium text-ink"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {empty ? (
        <p className="mt-2 px-1 text-xs text-ink-muted">{empty}</p>
      ) : null}
    </div>
  );
}

const ACCOUNT_NAV_OPEN_KEY = "tbp-account-nav-open";

function useAccountNavOpen() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(window.localStorage.getItem(ACCOUNT_NAV_OPEN_KEY) !== "0");
  }, []);

  return {
    open,
    toggle() {
      const next = !open;
      setOpen(next);
      window.localStorage.setItem(ACCOUNT_NAV_OPEN_KEY, next ? "1" : "0");
    },
  };
}

function NavGroup({
  label,
  ariaLabel,
  links,
  pathname,
  badges,
  collapsible = false,
  className,
}: {
  label: string;
  ariaLabel: string;
  links: readonly { href: string; label: string; exact?: boolean }[];
  pathname: string;
  badges?: Record<string, number>;
  collapsible?: boolean;
  className?: string;
}) {
  const fold = useAccountNavOpen();
  const open = !collapsible || fold.open;
  return (
    <div className={className}>
      {collapsible ? (
        <button
          type="button"
          onClick={fold.toggle}
          aria-expanded={open}
          aria-controls="account-nav"
          title={open ? "Collapse Account" : "Expand Account"}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span
            className="truncate text-xs font-medium uppercase tracking-[0.16em] text-accent"
            title={label}
          >
            {label}
          </span>
          <IconChevronDown
            size={14}
            className={`size-3.5 shrink-0 text-accent transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          />
        </button>
      ) : (
        <p
          className="truncate text-xs font-medium uppercase tracking-[0.16em] text-accent"
          title={label}
        >
          {label}
        </p>
      )}
      {open ? (
        <nav
          id={collapsible ? "account-nav" : undefined}
          aria-label={ariaLabel}
          className="mt-2 flex flex-col gap-0.5"
        >
          {links.map((link) => {
            const linkPath = hrefPathname(link.href);
            const active = link.exact
              ? pathname === linkPath
              : pathname === linkPath || pathname.startsWith(`${linkPath}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center justify-between gap-2 rounded-control px-3 py-1.5 text-sm ${
                  active
                    ? "bg-surface-raised text-ink"
                    : NAV_IDLE_CLASS
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <NavItemIcon href={link.href} />
                  <span>{link.label}</span>
                </span>
                <NavBadge count={badges?.[link.href] ?? 0} />
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
