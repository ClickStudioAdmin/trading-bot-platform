import Link from "next/link";
import {
  IconFilterClear,
  IconOpen,
  IconStar,
  IconStarFilled,
} from "@/components/icons";
import { NavBadge } from "@/components/nav-badge";
import {
  LiveGetForm,
  TABLE_BTN_ICON,
  TABLE_FILTER_FIELD_CLASS,
  TableFilterField,
  TableFilterSession,
  TableLabelButton,
  TablePendingIconAction,
} from "@/components/table-chrome";
import { toggleDeskCopyFavoriteAction } from "@/lib/copy/actions";
import { copyCatalogueHref } from "@/lib/copy/catalogue-href";
import { CopyFollowButton } from "@/components/copy-follow-modal";
import type { CopyCatalogueCard } from "@/lib/copy/catalogue";
import type { ExchangeConnection } from "@/lib/exchanges/connections";
import {
  copyDeskPagePath,
  type CopyCatalogueSort,
  type CopyCatalogueTab,
} from "@/lib/copy/model";
import { formatDeskType } from "@/lib/accounts/model";
import { getVenue } from "@/lib/exchanges/venues";
import {
  formatCount,
  formatPct,
  formatSignedUsd,
  signedTone,
} from "@/lib/opportunities/format";
import { AppSelect } from "@/components/app-select";

function has30dBook(card: CopyCatalogueCard): boolean {
  return Boolean(card.stats30d && card.stats30d.closedCount > 0);
}

function pnlLabel(card: CopyCatalogueCard): string {
  if (!has30dBook(card) || card.stats30d?.realizedPct == null) {
    return "—";
  }
  return formatPct(card.stats30d.realizedPct);
}

function realizedLabel(card: CopyCatalogueCard): string {
  if (!has30dBook(card) || !card.stats30d) {
    return "—";
  }
  return formatSignedUsd(card.stats30d.realizedUsdt);
}

function drawdownLabel(card: CopyCatalogueCard): string {
  if (!has30dBook(card) || !card.stats30d) {
    return "—";
  }
  const dip = card.stats30d.maxDrawdownUsdt;
  return dip > 0 ? formatSignedUsd(-dip) : formatSignedUsd(0);
}

function drawdownTone(card: CopyCatalogueCard): string {
  if (!has30dBook(card) || !card.stats30d) {
    return signedTone(null);
  }
  return signedTone(
    card.stats30d.maxDrawdownUsdt > 0
      ? -card.stats30d.maxDrawdownUsdt
      : 0,
  );
}

export function StarIcon({ filled }: { filled: boolean }) {
  const Icon = filled ? IconStarFilled : IconStar;
  return <Icon size={16} className="size-4" />;
}

function winRateLabel(card: CopyCatalogueCard): string {
  const stats = card.stats30d;
  if (!stats || stats.closedCount === 0) {
    return "—";
  }
  return `${Math.round((stats.winCount / stats.closedCount) * 100)}%`;
}

function followersLabel(card: CopyCatalogueCard): string {
  if (card.maxFollowers == null) {
    return formatCount(card.followerCount);
  }
  return `${formatCount(card.followerCount)} / ${formatCount(card.maxFollowers)}`;
}

export function CopyCatalogueBoard({
  cards,
  tab,
  privateOnly,
  query,
  sort,
  next,
  connections,
  openParentId = "",
  showFilters = true,
  inviteCount = 0,
}: {
  cards: CopyCatalogueCard[];
  tab: CopyCatalogueTab;
  privateOnly: boolean;
  query: string;
  sort: CopyCatalogueSort;
  next: string;
  connections: ExchangeConnection[];
  openParentId?: string;
  showFilters?: boolean;
  inviteCount?: number;
}) {
  const tabs: { id: CopyCatalogueTab; label: string; count?: number }[] = [
    { id: "all", label: "All", count: inviteCount },
    { id: "favorites", label: "Favorites" },
    { id: "subscribed", label: "Subscribed" },
  ];
  return (
    <div className="space-y-5">
      {showFilters ? (
      <>
      <div className="flex flex-wrap items-center gap-4 border-b border-line">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={copyCatalogueHref({
              tab: item.id,
              privateOnly,
              query,
              sort,
            })}
            className={
              tab === item.id
                ? "inline-flex items-center gap-2 border-b-2 border-accent pb-2 text-sm font-medium text-ink"
                : "inline-flex items-center gap-2 pb-2 text-sm text-ink-faint hover:text-ink-muted"
            }
          >
            {item.label}
            <NavBadge count={item.count ?? 0} />
          </Link>
        ))}
      </div>
      <TableFilterSession defaultOpen={Boolean(query.trim()) || privateOnly}>
          <LiveGetForm action="/account/copy">
            {tab !== "all" ? (
              <input type="hidden" name="tab" value={tab} />
            ) : null}
            <TableFilterField label="Search">
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Trader or desk"
                autoComplete="off"
                className={TABLE_FILTER_FIELD_CLASS}
              />
            </TableFilterField>
            <TableFilterField label="Sort" className="w-44 shrink-0">
              <AppSelect
                name="sort"
                defaultValue={sort}
                className={TABLE_FILTER_FIELD_CLASS}
              >
                <option value="roi">30d P&L</option>
                <option value="drawdown">Lowest drawdown</option>
                <option value="followers">Followers</option>
                <option value="newest">Newest</option>
              </AppSelect>
            </TableFilterField>
            <TableFilterField label="Visibility" className="w-40 shrink-0">
              <AppSelect
                name="private"
                defaultValue={privateOnly ? "1" : ""}
                className={TABLE_FILTER_FIELD_CLASS}
              >
                <option value="">All</option>
                <option value="1">Private only</option>
              </AppSelect>
            </TableFilterField>
            <TableLabelButton
              href={copyCatalogueHref({ tab })}
              variant="filter"
              icon={<IconFilterClear {...TABLE_BTN_ICON} />}
            >
              Clear
            </TableLabelButton>
          </LiveGetForm>
      </TableFilterSession>
      </>
      ) : null}
      {cards.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {tab === "subscribed"
            ? "You are not following any desks yet. Create copy desk is next."
            : tab === "favorites"
              ? "No starred desks in this filter."
              : "No shared desks match this filter."}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <li
              key={card.accountId}
              className="flex flex-col rounded-card border border-line bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-control border border-line bg-surface-raised text-sm text-ink-muted">
                    {card.deskLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={card.deskLogoUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      card.deskName.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                      Desk
                    </p>
                    <p className="truncate text-lg font-semibold tracking-tight text-ink">
                      {card.deskName}
                    </p>
                    <p className="mt-1 truncate text-xs text-ink-muted">
                      {card.traderAlias ? (
                        <Link
                          href={`/account/copy/traders/${encodeURIComponent(card.traderAlias)}`}
                          className="hover:text-accent"
                        >
                          {card.traderAlias}
                        </Link>
                      ) : (
                        "Trader"
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-start gap-1">
                  <div className="pt-0.5 text-right">
                    <p
                      className={`text-2xl font-semibold tabular-nums leading-none ${
                        has30dBook(card)
                          ? signedTone(card.stats30d?.realizedUsdt ?? null)
                          : "text-ink"
                      }`}
                    >
                      {pnlLabel(card)}
                    </p>
                    <p className="mt-1 text-hint text-ink-faint">P&L [30d]</p>
                  </div>
                  <form action={toggleDeskCopyFavoriteAction}>
                    <input type="hidden" name="accountId" value={card.accountId} />
                    <input
                      type="hidden"
                      name="favorite"
                      value={card.favorite ? "0" : "1"}
                    />
                    <input type="hidden" name="next" value={next} />
                    <TablePendingIconAction
                      pendingLabel="Starring"
                      successKey={`fav-${card.accountId}`}
                      label={card.favorite ? "Remove star" : "Star"}
                      detail={
                        card.favorite
                          ? "Remove this desk from your stars."
                          : "Star this desk."
                      }
                      className={
                        card.favorite
                          ? "text-accent hover:text-accent-strong"
                          : ""
                      }
                    >
                      <StarIcon filled={card.favorite} />
                    </TablePendingIconAction>
                  </form>
                </div>
              </div>
              <div className="mt-3 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {card.visibility === "private" ? (
                    <span className="rounded-control border border-accent/40 px-2 py-0.5 text-xs text-accent">
                      Private
                    </span>
                  ) : (
                    <span className="rounded-control border border-line px-2 py-0.5 text-xs text-ink-faint">
                      Public
                    </span>
                  )}
                  <span className="text-hint text-ink-faint">
                    {formatDeskType(card.deskType)} ·{" "}
                    {getVenue(card.venue)?.label ?? card.venue}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                      Realized [30d]
                    </dt>
                    <dd
                      className={`mt-1 text-lg font-semibold tabular-nums ${
                        signedTone(
                          has30dBook(card)
                            ? (card.stats30d?.realizedUsdt ?? null)
                            : null,
                        )
                      }`}
                    >
                      {realizedLabel(card)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                      Win rate [30d]
                    </dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">
                      {winRateLabel(card)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                      Drawdown [30d]
                    </dt>
                    <dd
                      className={`mt-1 text-lg font-semibold tabular-nums ${drawdownTone(card)}`}
                    >
                      {drawdownLabel(card)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                      Followers
                    </dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">
                      {followersLabel(card)}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="mt-5">
                <CopyFollowButton
                  parentAccountId={card.accountId}
                  deskName={card.deskName}
                  deskType={card.deskType}
                  venue={card.venue}
                  venueEnvironment={card.venueEnvironment}
                  connections={connections}
                  following={card.following}
                  defaultOpen={openParentId === card.accountId}
                  className="w-full rounded-control bg-accent-strong px-4 py-2 text-center text-sm font-medium text-ink"
                />
                <TableLabelButton
                  href={copyDeskPagePath(card.accountId)}
                  variant="secondary"
                  className="mt-2 w-full justify-center"
                  icon={<IconOpen {...TABLE_BTN_ICON} />}
                >
                  View details
                </TableLabelButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
