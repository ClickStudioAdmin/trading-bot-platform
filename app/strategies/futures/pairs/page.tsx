import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { PairFiltersForm } from "@/components/pair-filters";
import { TokenIcon } from "@/components/token-icon";
import {
  loadUsdtLinearPerps,
  type LinearPerp,
} from "@/lib/exchanges/bybit/perp";
import {
  applyPairFilters,
  pairFilterInputValues,
  pairFiltersAreActive,
  parsePairFilters,
} from "@/lib/pairs/filter";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { deskHref } from "@/lib/accounts/model";
import { getSessionContext } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Pairs",
  description: "Bybit USDT linear perpetual list (public market data).",
};

export default async function FuturesPairsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
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
                  </tr>
                </thead>
                <tbody>
                  {visible.map((pair) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
