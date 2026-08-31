import type { ReactNode } from "react";
import Link from "next/link";
import { CopyFollowButton } from "@/components/copy-follow-modal";
import { formatDeskType } from "@/lib/accounts/model";
import type { CopyCatalogueCard } from "@/lib/copy/catalogue";
import type { CopyLeaderStripData } from "@/lib/copy/leader";
import type { DeskCopyListing, TraderProfile } from "@/lib/copy/model";
import type { ExchangeConnection } from "@/lib/exchanges/connections";
import { getVenue } from "@/lib/exchanges/venues";
import { formatUsd } from "@/lib/opportunities/format";
import { formatAuDateUtc, parseDisplayTime } from "@/lib/time/display";

function Meta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </dt>
      <dd className="mt-1 text-sm tabular-nums text-ink">{value}</dd>
    </div>
  );
}

export function CopyDeskDetailsHeader({
  card,
  listing,
  trader,
  leader,
  connections,
  children,
}: {
  card: CopyCatalogueCard;
  listing: DeskCopyListing | null;
  trader: TraderProfile | null;
  leader: CopyLeaderStripData | null;
  connections: ExchangeConnection[];
  children?: ReactNode;
}) {
  const traderHref = card.traderAlias
    ? `/account/copy/traders/${encodeURIComponent(card.traderAlias)}`
    : "/account/copy";
  const venueLabel = getVenue(card.venue)?.label ?? card.venue;
  const sharedMs = parseDisplayTime(card.createdAt);
  const accepting =
    listing != null
      ? listing.sharingEnabled && listing.allowNewFollowers
        ? "Open"
        : "Closed to new"
      : "—";
  const minBalance =
    listing?.minBalanceUsdt == null
      ? "No floor"
      : formatUsd(listing.minBalanceUsdt);

  return (
    <section className="mb-8 rounded-card border border-line bg-surface p-5">
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">
            Desk
          </p>
          <div className="mt-3 flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-control border border-line bg-surface-raised text-sm text-ink-muted">
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
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">
                {card.deskName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {card.visibility === "private" ? (
                  <span className="rounded-control border border-accent/40 px-2 py-0.5 text-xs text-accent">
                    Private
                  </span>
                ) : (
                  <span className="rounded-control border border-line px-2 py-0.5 text-xs text-ink-faint">
                    Public
                  </span>
                )}
                <span className="text-sm text-ink-muted">
                  {formatDeskType(card.deskType)} · {venueLabel}
                </span>
              </div>
            </div>
          </div>
          {card.description ? (
            <p className="mt-4 whitespace-pre-wrap text-sm text-ink-muted">
              {card.description}
            </p>
          ) : null}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Meta
              label="Shared"
              value={sharedMs ? formatAuDateUtc(sharedMs) : "—"}
            />
            <Meta label="New followers" value={accepting} />
            <Meta label="Min balance" value={minBalance} />
          </dl>
          <div className="mt-5">
            <CopyFollowButton
              parentAccountId={card.accountId}
              deskName={card.deskName}
              deskType={card.deskType}
              venue={card.venue}
              venueEnvironment={card.venueEnvironment}
              connections={connections}
              following={card.following}
              className="rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
            />
          </div>
        </div>
        <div className="min-w-0 border-t border-line pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">
            Trader
          </p>
          <Link
            href={traderHref}
            className="mt-3 flex items-start gap-3 hover:text-accent"
          >
            <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-raised text-sm text-ink-muted">
              {card.traderLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.traderLogoUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                (card.traderAlias ?? "T").slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-2xl font-semibold tracking-tight text-ink">
                {card.traderAlias ?? "Trader"}
              </span>
              <span className="mt-1 block text-sm text-ink-muted">
                View trader
              </span>
            </span>
          </Link>
          <p className="mt-4 text-sm text-ink-muted">
            {trader?.bio || "No bio yet."}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Meta
              label="Trader followers"
              value={String(leader?.uniqueFollowers ?? 0)}
            />
            <Meta
              label="Shared desks"
              value={String(leader?.visibleDeskCount ?? 0)}
            />
            <Meta
              label="First shared"
              value={leader?.firstSharedLabel ?? "—"}
            />
          </dl>
        </div>
      </div>
      {children ? (
        <div className="mt-6 border-t border-line pt-6">{children}</div>
      ) : null}
    </section>
  );
}
