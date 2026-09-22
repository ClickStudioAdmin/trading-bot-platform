import { LocalTime } from "@/components/local-time";
import { PageHeading } from "@/components/page-heading";
import { PairFiltersForm } from "@/components/pair-filters";
import { TokenIcon } from "@/components/token-icon";
import { PairPager } from "@/components/pair-pager";
import { SortTh, TableCard, TableFilterSession } from "@/components/table-chrome";
import { tableFiltersSuggestOpen } from "@/lib/table-chrome";
import { listCarryPairs } from "@/lib/exchanges/bybit/list-carry-pairs";
import { CARRY_BASE_COINS, type CarryPair } from "@/lib/exchanges/bybit/universe";
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

export async function BybitCarryPairs({
  searchParams,
  path,
  keep,
  hideHeading = false,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  path: string;
  keep?: Record<string, string | undefined>;
  hideHeading?: boolean;
}) {
  const filters = parsePairFilters(searchParams);
  let pairs: CarryPair[] = [];
  let error: string | null = null;

  try {
    pairs = await listCarryPairs();
  } catch (cause) {
    pairs = [];
    error = cause instanceof Error ? cause.message : "Bybit request failed";
  }

  const visible = applyPairFilters(pairs, filters, (pair) => ({
    text: `${pair.baseCoin} ${pair.spotSymbol} ${pair.futureSymbol}`,
    base: pair.baseCoin,
    dte: pair.daysToExpiry,
  }));
  const active = pairFiltersAreActive(filters);
  const { sort, dir } = parsePairSort(searchParams, PAIR_SORTS.carry);
  const caps = await loadMarketCaps();
  const ranked = sortPairRows(visible, sort, dir, {
    base: (pair) => pair.baseCoin,
    spot: (pair) => pair.spotSymbol,
    future: (pair) => pair.futureSymbol,
    delivery: (pair) => pair.deliveryTimeMs,
    dte: (pair) => pair.daysToExpiry,
    cap: (pair) => caps.get(pair.baseCoin) ?? null,
  });
  const list = paginatePairRows(ranked, searchParams.page);
  const hrefFor = (page: number) =>
    pairPageHref({
      path,
      keep,
      filters,
      page,
      sort,
      dir,
    });
  const sortHref = (key: string) =>
    pairSortHref({
      path,
      keep,
      filters,
      key,
      currentKey: sort,
      currentDir: dir,
    });

  return (
    <>
      {hideHeading ? null : (
        <>
          <PageHeading as="h2" title="Pairs" />
          <p className="-mt-2 mb-6 text-sm text-ink-muted">
            Every dated USDT cash-and-carry pair on Bybit. No API key. BTC, ETH,
            SOL, DOGE, XRP, MNT only. Perps are excluded.
          </p>
        </>
      )}
      <TableFilterSession defaultOpen={tableFiltersSuggestOpen(searchParams)}>
        <PairFiltersForm
          clearHref={pairPageHref({
            path,
            keep,
            filters: { q: "", base: "", minDte: null, maxDte: null },
            page: 1,
          })}
          keep={keep}
          values={pairFilterInputValues(filters)}
          bases={CARRY_BASE_COINS}
          showDte
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
            <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
              <tr>
                <SortTh
                  label="Base"
                  active={sort === "base"}
                  dir={dir}
                  href={sortHref("base")}
                />
                <SortTh
                  label="Spot"
                  active={sort === "spot"}
                  dir={dir}
                  href={sortHref("spot")}
                />
                <SortTh
                  label="Future"
                  active={sort === "future"}
                  dir={dir}
                  href={sortHref("future")}
                />
                <SortTh
                  label="Delivery"
                  active={sort === "delivery"}
                  dir={dir}
                  href={sortHref("delivery")}
                />
                <SortTh
                  label="DTE"
                  active={sort === "dte"}
                  dir={dir}
                  href={sortHref("dte")}
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
                  key={`${pair.spotSymbol}-${pair.futureSymbol}`}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <TokenIcon symbol={pair.baseCoin} />
                      {pair.baseCoin}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {pair.spotSymbol}
                  </td>
                  <td className="px-4 py-3">{pair.futureSymbol}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    <LocalTime at={pair.deliveryTimeMs} mode="date" />
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {pair.daysToExpiry > 0
                      ? pair.daysToExpiry.toFixed(1)
                      : "—"}
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
    </>
  );
}
