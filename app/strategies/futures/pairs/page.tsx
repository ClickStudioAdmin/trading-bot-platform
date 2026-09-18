import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { PairFiltersForm } from "@/components/pair-filters";
import { TokenIcon } from "@/components/token-icon";
import {
  loadUsdtLinearPerps,
  type LinearPerp,
} from "@/lib/exchanges/bybit/perp";
import { PairPager } from "@/components/pair-pager";
import { SortTh, TableCard, TableFilterSession } from "@/components/table-chrome";
import { formatMarketCap, loadMarketCaps } from "@/lib/market/caps";
import {
  applyPairFilters,
  pairFilterInputValues,
  pairFiltersAreActive,
  parsePairFilters,
} from "@/lib/pairs/filter";
import {
  PAIR_SORTS,
  paginatePairRows,
  pairPageHref,
  pairSortHref,
  parsePairSort,
  sortPairRows,
} from "@/lib/pairs/page";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { deskHref, deskIsCopy } from "@/lib/accounts/model";
import { getSessionContext } from "@/lib/auth/session";
import { HyperliquidFuturesPairs } from "@/components/venues/hyperliquid/pairs";
import { redirect } from "next/navigation";

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
  if (session && deskIsCopy(session.account)) {
    redirect(deskHref(FUTURES_PATHS.positions, session.account.id));
  }
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
  const { sort, dir } = parsePairSort(params, PAIR_SORTS.futures);
  const caps = await loadMarketCaps();
  const ranked = sortPairRows(visible, sort, dir, {
    base: (pair) => pair.baseCoin,
    contract: (pair) => pair.symbol,
    quote: (pair) => pair.quoteCoin,
    cap: (pair) => caps.get(pair.baseCoin) ?? null,
  });
  const list = paginatePairRows(ranked, params.page);
  const deskId = session?.account.id;
  const hrefFor = (page: number) =>
    pairPageHref({
      path: FUTURES_PATHS.pairs,
      deskId,
      filters,
      page,
      sort,
      dir,
    });
  const sortHref = (key: string) =>
    pairSortHref({
      path: FUTURES_PATHS.pairs,
      deskId,
      filters,
      key,
      currentKey: sort,
      currentDir: dir,
    });

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Pairs" />
      <p className="-mt-2 mb-6 text-sm text-ink-muted">
        Every trading USDT linear perpetual this strategy can buy, sell, or
        close. No API key. Dated futures are excluded.
      </p>
      <TableFilterSession>
        <PairFiltersForm
          clearHref={deskHref(FUTURES_PATHS.pairs, session?.account.id)}
          deskId={session?.account.id}
          values={pairFilterInputValues(filters)}
          sort={sort}
          dir={dir}
        />
      </TableFilterSession>
      {error ? (
        <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : visible.length === 0 ? (
        <p className="mt-6 rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
          {active
            ? "No pairs match these filters."
            : "No pairs in the current scan."}
        </p>
      ) : (
        <TableCard
          pager={
            <PairPager
              page={list.page}
              pageCount={list.pageCount}
              total={list.total}
              from={list.from}
              to={list.to}
              prevHref={hrefFor(list.page - 1)}
              nextHref={hrefFor(list.page + 1)}
            />
          }
        >
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
              <tr>
                <SortTh
                  label="Base"
                  active={sort === "base"}
                  dir={dir}
                  href={sortHref("base")}
                />
                <SortTh
                  label="Contract"
                  active={sort === "contract"}
                  dir={dir}
                  href={sortHref("contract")}
                />
                <SortTh
                  label="Quote"
                  active={sort === "quote"}
                  dir={dir}
                  href={sortHref("quote")}
                />
                <SortTh
                  label="Market cap"
                  active={sort === "cap"}
                  dir={dir}
                  href={sortHref("cap")}
                />
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
        </TableCard>
      )}
    </main>
  );
}
