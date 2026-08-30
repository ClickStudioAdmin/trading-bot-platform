import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { PairFiltersForm } from "@/components/pair-filters";
import { TokenIcon } from "@/components/token-icon";
import {
  loadUsdtLinearPerps,
  type LinearPerp,
} from "@/lib/exchanges/bybit/perp";
import { PairPager } from "@/components/pair-pager";
import { formatMarketCap, loadMarketCaps } from "@/lib/market/caps";
import {
  applyPairFilters,
  pairFilterInputValues,
  pairFiltersAreActive,
  parsePairFilters,
} from "@/lib/pairs/filter";
import {
  paginatePairRows,
  pairPageHref,
  sortByMarketCap,
} from "@/lib/pairs/page";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { deskHref } from "@/lib/accounts/model";
import { getSessionContext } from "@/lib/auth/session";
import { HyperliquidFuturesPairs } from "@/components/venues/hyperliquid/pairs";

export const metadata: Metadata = {
  title: "Pairs",
  description: "Bybit USDT linear perpetual list (public market data).",
};

export default async function FuturesPairsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
  if (session?.account.venue === "hyperliquid") {
    return <HyperliquidFuturesPairs searchParams={searchParams} />;
  }
  const params = await searchParams;
  const filters = parsePairFilters(params);
  let pairs: LinearPerp[] = [];
  let error: string | null = null;

  try {
    pairs = await loadUsdtLinearPerps();
  } catch (cause) {
    pairs = [];
    error = cause instanceof Error ? cause.message : "Bybit request failed";
  }

  const visible = applyPairFilters(pairs, filters, (pair) => ({
    text: `${pair.baseCoin} ${pair.symbol} ${pair.quoteCoin}`,
    base: pair.baseCoin,
  }));
  const active = pairFiltersAreActive(filters);
  const caps = await loadMarketCaps();
  const ranked = sortByMarketCap(
    visible,
    (pair) => caps.get(pair.baseCoin) ?? null,
    (left, right) =>
      left.baseCoin.localeCompare(right.baseCoin) ||
      left.symbol.localeCompare(right.symbol),
  );
  const list = paginatePairRows(ranked, params.page);
  const deskId = session?.account.id;
  const hrefFor = (page: number) =>
    pairPageHref({
      path: FUTURES_PATHS.pairs,
      deskId,
      filters,
      page,
    });

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Pairs" />
      <p className="-mt-2 mb-6 text-sm text-ink-muted">
        Every trading USDT linear perpetual this strategy can buy, sell, or
        close. No API key. Dated futures are excluded.
      </p>
      <PairFiltersForm
        clearHref={deskHref(FUTURES_PATHS.pairs, session?.account.id)}
        deskId={session?.account.id}
        values={pairFilterInputValues(filters)}
      />
      {error ? (
        <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : (
        <div className="mt-6 space-y-2">
          <p className="text-sm text-ink-muted">
            {active
              ? `${visible.length} of ${pairs.length} pairs`
              : `${pairs.length} pairs`}
          </p>
          {visible.length === 0 ? (
            <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
              {active
                ? "No pairs match these filters."
                : "No pairs in the current scan."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-card border border-line bg-surface">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
                  <tr>
                    <th className="px-4 py-3 font-medium">Base</th>
                    <th className="px-4 py-3 font-medium">Contract</th>
                    <th className="px-4 py-3 font-medium">Quote</th>
                    <th className="px-4 py-3 font-medium">Market cap</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((pair) => (
                    <tr
                      key={pair.symbol}
                      className="border-b border-line last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <TokenIcon symbol={pair.baseCoin} />
                          {pair.baseCoin}
                        </span>
                      </td>
                      <td className="px-4 py-3">{pair.symbol}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        {pair.quoteCoin}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-ink-muted">
                        {formatMarketCap(caps.get(pair.baseCoin) ?? null)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <PairPager
            page={list.page}
            pageCount={list.pageCount}
            total={list.total}
            from={list.from}
            to={list.to}
            prevHref={hrefFor(list.page - 1)}
            nextHref={hrefFor(list.page + 1)}
          />
        </div>
      )}
    </main>
  );
}
