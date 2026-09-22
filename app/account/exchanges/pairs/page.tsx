import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageHeading } from "@/components/page-heading";
import { PairsScopeSelect } from "@/components/pair-filters";
import { BybitCarryPairs } from "@/components/venues/bybit/carry-pairs";
import { BybitFuturesPairs } from "@/components/venues/bybit/pairs";
import { HyperliquidFuturesPairs } from "@/components/venues/hyperliquid/pairs";
import { enabledVenues } from "@/lib/exchanges/venues";
import { firstSearchValue } from "@/lib/paper/open";
import { parsePairFilters } from "@/lib/pairs/filter";
import {
  ACCOUNT_PAIRS_PATH,
  exchangePairsHref,
  parsePairsEnvironment,
  parsePairsVenue,
  pairsPageCaption,
} from "@/lib/pairs/page";
import { ACCOUNT_EXCHANGES_HREF } from "@/lib/site-links";

export const metadata: Metadata = {
  title: "Pairs",
  description: "Public market pairs available on each exchange.",
};

export default async function AccountPairsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const venue = parsePairsVenue(firstSearchValue(query.venue));
  const environment = parsePairsEnvironment(venue, firstSearchValue(query.env));
  const kind =
    firstSearchValue(query.kind) === "carry" && venue.datedCarry
      ? "carry"
      : "perps";
  const keep = {
    venue: venue.id,
    env: environment !== "live" ? environment : undefined,
    kind: kind === "carry" ? "carry" : undefined,
  };
  const filters = parsePairFilters(query);
  const venues = enabledVenues();

  return (
    <>
      <Breadcrumbs
        items={[
          { href: ACCOUNT_EXCHANGES_HREF, label: "Exchanges" },
          { label: "Pairs" },
        ]}
      />
      {venue.datedCarry ? (
        <nav
          aria-label="Pair lists"
          className="mb-6 flex flex-wrap border-b border-line"
        >
          <Link
            href={exchangePairsHref(venue.id, { environment })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              kind === "perps"
                ? "border-accent text-ink"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            Perpetuals
          </Link>
          <Link
            href={exchangePairsHref(venue.id, {
              environment,
              kind: "carry",
            })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              kind === "carry"
                ? "border-accent text-ink"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            Cash and Carry
          </Link>
        </nav>
      ) : null}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageHeading as="h2" title="Pairs" />
          <p className="-mt-2 text-sm text-ink-muted">
            {pairsPageCaption(venue.id, kind)}
          </p>
        </div>
        <PairsScopeSelect
          venues={venues}
          venueId={venue.id}
          environment={environment}
          kind={kind}
          filters={filters}
        />
      </div>
      {venue.id === "hyperliquid" ? (
        <HyperliquidFuturesPairs
          searchParams={query}
          path={ACCOUNT_PAIRS_PATH}
          keep={keep}
          environment={environment}
          hideHeading
        />
      ) : venue.id === "bybit" && kind === "carry" ? (
        <BybitCarryPairs
          searchParams={query}
          path={ACCOUNT_PAIRS_PATH}
          keep={keep}
          hideHeading
        />
      ) : (
        <BybitFuturesPairs
          searchParams={query}
          path={ACCOUNT_PAIRS_PATH}
          keep={keep}
          hideHeading
        />
      )}
    </>
  );
}
