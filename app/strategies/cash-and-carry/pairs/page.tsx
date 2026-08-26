import type { Metadata } from "next";
import { LocalTime } from "@/components/local-time";
import { PageHeading } from "@/components/page-heading";
import { PairFiltersForm } from "@/components/pair-filters";
import { TokenIcon } from "@/components/token-icon";
import { listCarryPairs } from "@/lib/exchanges/bybit/list-carry-pairs";
import { CARRY_BASE_COINS, type CarryPair } from "@/lib/exchanges/bybit/universe";
import {
  applyPairFilters,
  pairFilterInputValues,
  pairFiltersAreActive,
  parsePairFilters,
} from "@/lib/pairs/filter";

export const metadata: Metadata = {
  title: "Pairs",
  description: "Bybit dated cash-and-carry pair list (public market data).",
};

const CLEAR = "/strategies/cash-and-carry/pairs";

export default async function CashAndCarryPairsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parsePairFilters(params);
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

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Pairs" />
      <p className="-mt-2 mb-6 text-sm text-ink-muted">
        Every dated USDT pair in this strategy’s scan. No API key. BTC, ETH,
        SOL, DOGE, XRP, MNT only. Perps are excluded.
      </p>
      <PairFiltersForm
        clearHref={CLEAR}
        values={pairFilterInputValues(filters)}
        bases={CARRY_BASE_COINS}
        showDte
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
                    <th className="px-4 py-3 font-medium">Spot</th>
                    <th className="px-4 py-3 font-medium">Future</th>
                    <th className="px-4 py-3 font-medium">Delivery</th>
                    <th className="px-4 py-3 font-medium">DTE</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((pair) => (
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
