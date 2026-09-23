import { PageHeading } from "@/components/page-heading";
import { PairFiltersForm } from "@/components/pair-filters";
import { TokenIcon } from "@/components/token-icon";
import { getSessionMember } from "@/lib/auth/session";
import {
  loadUsdtLinearPerps,
  type LinearPerp,
} from "@/lib/exchanges/bybit/perp";
import {
  bybitAgreementKind,
  bybitAgreementKindTitle,
  perpNeedsBybitAgreement,
  type BybitAgreementGate,
} from "@/lib/exchanges/agreement";
import { loadBybitAgreementGate } from "@/lib/exchanges/agreement-store";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { PairPager } from "@/components/pair-pager";
import {
  SortTh,
  StatusBadge,
  TableCard,
  TableFilterSession,
} from "@/components/table-chrome";
import { tableFiltersSuggestOpen } from "@/lib/table-chrome";
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

async function pairsAgreementGate(
  environment: string,
): Promise<BybitAgreementGate> {
  const member = await getSessionMember();
  if (!member) {
    return { symbols: [], cleared: [], live: true };
  }
  const connections = await listExchangeConnections(member.id);
  const match = connections.find(
    (row) => row.venue === "bybit" && row.environment === environment,
  );
  return loadBybitAgreementGate({
    connectionId: match?.id ?? null,
    live: true,
  });
}

export async function BybitFuturesPairs({
  searchParams,
  path,
  keep,
  environment = "live",
  hideHeading = false,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  path: string;
  keep?: Record<string, string | undefined>;
  environment?: string;
  hideHeading?: boolean;
}) {
  const filters = parsePairFilters(searchParams);
  const [loaded, gate, caps] = await Promise.all([
    loadUsdtLinearPerps()
      .then((rows) => ({ pairs: rows, error: null as string | null }))
      .catch((cause: unknown) => ({
        pairs: [] as LinearPerp[],
        error: cause instanceof Error ? cause.message : "Bybit request failed",
      })),
    pairsAgreementGate(environment),
    loadMarketCaps(),
  ]);
  const { pairs, error } = loaded;
  const visible = applyPairFilters(pairs, filters, (pair) => {
    const kind = bybitAgreementKind(pair);
    return {
      text: `${pair.baseCoin} ${pair.symbol} ${pair.quoteCoin} ${
        kind ? bybitAgreementKindTitle(kind) : ""
      }`,
      base: pair.baseCoin,
    };
  });
  const active = pairFiltersAreActive(filters);
  const { sort, dir } = parsePairSort(searchParams, PAIR_SORTS.futures);
  const ranked = sortPairRows(visible, sort, dir, {
    base: (pair) => pair.baseCoin,
    contract: (pair) => pair.symbol,
    category: (pair) => {
      const kind = bybitAgreementKind(pair);
      return kind ? bybitAgreementKindTitle(kind) : null;
    },
    quote: (pair) => pair.quoteCoin,
    cap: (pair) => caps.get(pair.baseCoin) ?? null,
    status: (pair) =>
      perpNeedsBybitAgreement(gate, pair) ? "Disabled" : "Enabled",
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
            Every trading USDT linear perpetual on Bybit. No API key. Dated
            futures are excluded.
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
                  label="Contract"
                  active={sort === "contract"}
                  dir={dir}
                  href={sortHref("contract")}
                />
                <SortTh
                  label="Category"
                  active={sort === "category"}
                  dir={dir}
                  href={sortHref("category")}
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
                <SortTh
                  label="Status"
                  active={sort === "status"}
                  dir={dir}
                  href={sortHref("status")}
                />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((pair) => {
                const kind = bybitAgreementKind(pair);
                const disabled = perpNeedsBybitAgreement(gate, pair);
                return (
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
                    {kind ? (
                      bybitAgreementKindTitle(kind)
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {pair.quoteCoin}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-muted">
                    {formatMarketCap(caps.get(pair.baseCoin) ?? null)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={disabled ? "Disabled" : "Enabled"}
                      status={disabled ? "disabled" : "enabled"}
                    />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </TableCard>
      )}
    </>
  );
}
