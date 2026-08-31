import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
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
import { formatPct, formatSignedUsd } from "@/lib/opportunities/format";

function roiLabel(card: CopyCatalogueCard): string {
  if (!card.stats30d || card.stats30d.closedCount === 0) {
    return "—";
  }
  if (card.stats30d.realizedPct == null) {
    return formatSignedUsd(card.stats30d.realizedUsdt);
  }
  return formatPct(card.stats30d.realizedPct);
}

function drawdownLabel(card: CopyCatalogueCard): string {
  if (!card.stats30d || card.stats30d.closedCount === 0) {
    return "—";
  }
  if (card.stats30d.maxDrawdownPct == null) {
    return formatSignedUsd(card.stats30d.maxDrawdownUsdt);
  }
  return formatPct(card.stats30d.maxDrawdownPct);
}

function winRateLabel(card: CopyCatalogueCard): string {
  const stats = card.stats30d;
  if (!stats || stats.closedCount === 0) {
    return "—";
  }
  return `${Math.round((stats.winCount / stats.closedCount) * 100)}%`;
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
}) {
  const tabs: { id: CopyCatalogueTab; label: string }[] = [
    { id: "all", label: "All" },
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
                ? "border-b-2 border-accent pb-2 text-sm font-medium text-ink"
                : "pb-2 text-sm text-ink-faint hover:text-ink-muted"
            }
          >
            {item.label}
          </Link>
        ))}
      </div>
      <form
        action="/account/copy"
        method="get"
        className="flex flex-wrap items-end gap-3"
      >
        {tab !== "all" ? (
          <input type="hidden" name="tab" value={tab} />
        ) : null}
        <label className="block min-w-[12rem] flex-1 text-sm text-ink">
          Search
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Trader or desk"
            className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          />
        </label>
        <label className="block text-sm text-ink">
          Sort
          <select
            name="sort"
            defaultValue={sort}
            className="mt-1 rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          >
            <option value="roi">30d ROI</option>
            <option value="drawdown">Lowest drawdown</option>
            <option value="followers">Followers</option>
            <option value="newest">Newest</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-ink">
          <input
            type="checkbox"
            name="private"
            value="1"
            defaultChecked={privateOnly}
          />
          Private only
        </label>
        <button
          type="submit"
          className="rounded-control border border-line px-3 py-2 text-sm text-ink hover:bg-surface-raised"
        >
          Apply
        </button>
      </form>
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
                <Link
                  href={
                    card.traderAlias
                      ? `/account/copy/traders/${encodeURIComponent(card.traderAlias)}`
                      : "/account/copy"
                  }
                  className="flex min-w-0 items-center gap-3"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-raised text-sm text-ink-muted">
                    {card.traderLogoUrl || card.deskLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={card.traderLogoUrl ?? card.deskLogoUrl ?? ""}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      (card.traderAlias ?? "T").slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] uppercase tracking-wide text-ink-faint">
                      Trader
                    </span>
                    <span className="block truncate text-sm font-medium text-ink">
                      {card.traderAlias ?? "Trader"}
                    </span>
                  </span>
                </Link>
                <form action={toggleDeskCopyFavoriteAction}>
                  <input type="hidden" name="accountId" value={card.accountId} />
                  <input
                    type="hidden"
                    name="favorite"
                    value={card.favorite ? "0" : "1"}
                  />
                  <input type="hidden" name="next" value={next} />
                  <PendingSubmitButton
                    pendingLabel="…"
                    successKey={`fav-${card.accountId}`}
                    className="rounded-control px-2 py-1 text-xs text-ink-muted hover:text-accent"
                  >
                    {card.favorite ? "Starred" : "Star"}
                  </PendingSubmitButton>
                </form>
              </div>
              <Link
                href={copyDeskPagePath(card.accountId)}
                className="group mt-2 block min-w-0"
              >
                <span className="block text-[11px] uppercase tracking-wide text-ink-faint">
                  Desk
                </span>
                <span className="block truncate text-sm text-ink group-hover:text-accent">
                  {card.deskName}
                </span>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {card.visibility === "private" ? (
                    <span className="rounded-control border border-accent/40 px-2 py-0.5 text-xs text-accent">
                      Private
                    </span>
                  ) : (
                    <span className="rounded-control border border-line px-2 py-0.5 text-xs text-ink-faint">
                      Public
                    </span>
                  )}
                  <span className="text-xs text-ink-faint">
                    {formatDeskType(card.deskType)} · {card.venue}
                  </span>
                </div>
                <p
                  className={`mt-4 text-2xl font-semibold tabular-nums ${
                    !card.stats30d || card.stats30d.closedCount === 0
                      ? "text-ink"
                      : card.stats30d.realizedUsdt < 0
                        ? "text-danger"
                        : "text-success"
                  }`}
                >
                  {roiLabel(card)}
                </p>
                <p className="text-xs text-ink-faint">ROI [30d]</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-ink-faint">Drawdown [30d]</dt>
                    <dd className="mt-1 tabular-nums text-ink">
                      {drawdownLabel(card)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Win rate [30d]</dt>
                    <dd className="mt-1 tabular-nums text-ink">
                      {winRateLabel(card)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Following</dt>
                    <dd className="mt-1 tabular-nums text-ink">
                      {card.maxFollowers == null
                        ? String(card.followerCount)
                        : `${card.followerCount} / ${card.maxFollowers}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Invited</dt>
                    <dd className="mt-1 tabular-nums text-ink">
                      {card.invitedCount}
                    </dd>
                  </div>
                </dl>
              </Link>
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
