import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BybitCarryPairs } from "@/components/venues/bybit/carry-pairs";
import { BybitFuturesPairs } from "@/components/venues/bybit/pairs";
import { HyperliquidFuturesPairs } from "@/components/venues/hyperliquid/pairs";
import { firstSearchValue } from "@/lib/paper/open";
import {
  exchangePairsHref,
  exchangePairsPath,
} from "@/lib/pairs/page";
import { getVenue } from "@/lib/exchanges/venues";
import { ACCOUNT_EXCHANGES_HREF } from "@/lib/site-links";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ venue: string }>;
}): Promise<Metadata> {
  const venue = getVenue((await params).venue);
  return {
    title: venue ? `${venue.label} pairs` : "Pairs",
    description: "Public market pairs available on this exchange.",
  };
}

export default async function ExchangePairsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venue: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const venue = getVenue((await params).venue);
  if (!venue?.enabled) {
    notFound();
  }
  const query = await searchParams;
  const kind =
    firstSearchValue(query.kind) === "carry" && venue.datedCarry
      ? "carry"
      : "perps";
  const environment = firstSearchValue(query.env) || null;
  const path = exchangePairsPath(venue.id);
  const keep = {
    env: environment && environment !== "live" ? environment : undefined,
    kind: kind === "carry" ? "carry" : undefined,
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { href: ACCOUNT_EXCHANGES_HREF, label: "Exchanges" },
          { label: `${venue.label} pairs` },
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
      {venue.id === "hyperliquid" ? (
        <HyperliquidFuturesPairs
          searchParams={query}
          path={path}
          keep={keep}
          environment={environment}
        />
      ) : venue.id === "bybit" && kind === "carry" ? (
        <BybitCarryPairs searchParams={query} path={path} keep={keep} />
      ) : venue.id === "bybit" ? (
        <BybitFuturesPairs searchParams={query} path={path} keep={keep} />
      ) : (
        notFound()
      )}
    </>
  );
}
