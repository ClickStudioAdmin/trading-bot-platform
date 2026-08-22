import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { TokenIcon } from "@/components/token-icon";
import { listCarryPairs } from "@/lib/exchanges/bybit/list-carry-pairs";
import type { CarryPair } from "@/lib/exchanges/bybit/universe";

export const metadata: Metadata = {
  title: "Pairs",
  description: "Bybit dated cash-and-carry pair list (public market data).",
};

export default async function CashAndCarryPairsPage() {
  let pairs: CarryPair[] = [];
  let error: string | null = null;

  try {
    pairs = await listCarryPairs();
  } catch (cause) {
    pairs = [];
    error = cause instanceof Error ? cause.message : "Bybit request failed";
  }

  return (
    <main className="mx-auto max-w-6xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Pairs" />
      <p className="-mt-2 text-sm text-ink-muted">
        Every dated USDT pair in this strategy’s scan. No API key. BTC, ETH,
        SOL, DOGE, XRP, MNT only. Perps are excluded.
      </p>
      {error ? (
        <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : (
        <p className="mt-3 text-sm text-ink-faint">{pairs.length} pairs</p>
      )}

      <div className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Base</th>
              <th className="px-4 py-3 font-medium">Spot</th>
              <th className="px-4 py-3 font-medium">Future</th>
              <th className="px-4 py-3 font-medium">Delivery (UTC)</th>
              <th className="px-4 py-3 font-medium">DTE</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((pair) => (
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
                <td className="px-4 py-3 text-ink-muted">{pair.spotSymbol}</td>
                <td className="px-4 py-3">{pair.futureSymbol}</td>
                <td className="px-4 py-3 text-ink-muted">
                  {new Date(pair.deliveryTimeMs).toISOString().slice(0, 10)}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {pair.daysToExpiry > 0 ? pair.daysToExpiry.toFixed(1) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
