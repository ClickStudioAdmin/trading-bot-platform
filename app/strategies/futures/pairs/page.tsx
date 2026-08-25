import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { TokenIcon } from "@/components/token-icon";
import {
  loadUsdtLinearPerps,
  type LinearPerp,
} from "@/lib/exchanges/bybit/perp";

export const metadata: Metadata = {
  title: "Pairs",
  description: "Bybit USDT linear perpetual list (public market data).",
};

export default async function FuturesPairsPage() {
  let pairs: LinearPerp[] = [];
  let error: string | null = null;

  try {
    pairs = await loadUsdtLinearPerps();
  } catch (cause) {
    pairs = [];
    error = cause instanceof Error ? cause.message : "Bybit request failed";
  }

  return (
    <main className="mx-auto max-w-6xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Pairs" />
      <p className="-mt-2 text-sm text-ink-muted">
        Every trading USDT linear perpetual this strategy can buy, sell, or
        flatten. No API key. Dated futures are excluded.
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
              <th className="px-4 py-3 font-medium">Contract</th>
              <th className="px-4 py-3 font-medium">Quote</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((pair) => (
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
                <td className="px-4 py-3 text-ink-muted">{pair.quoteCoin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
