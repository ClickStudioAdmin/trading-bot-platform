import type { Metadata } from "next";
import Link from "next/link";
import { listCarryPairs } from "@/lib/exchanges/bybit/list-carry-pairs";
import type { CarryPair } from "@/lib/exchanges/bybit/universe";

export const metadata: Metadata = {
  title: "Instruments",
  description: "Bybit dated cash-and-carry universe (public market data).",
};

export default async function InstrumentsPage() {
  let pairs: CarryPair[] = [];
  let error: string | null = null;

  try {
    pairs = await listCarryPairs();
  } catch (cause) {
    pairs = [];
    error = cause instanceof Error ? cause.message : "Bybit request failed";
  }

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
              Bybit public
            </p>
            <h1 className="text-lg font-semibold tracking-tight">
              Carry universe
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
          >
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <p className="text-sm text-ink-muted">
          Server fetch of Bybit instruments. No API key. USDT expiry plus
          matching USDT spot for BTC, ETH, SOL, DOGE, XRP, MNT. Perps are
          excluded.
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
                    <td className="px-4 py-3">{pair.baseCoin}</td>
                    <td className="px-4 py-3 text-ink-muted">{pair.spotSymbol}</td>
                    <td className="px-4 py-3">{pair.futureSymbol}</td>
                    <td className="px-4 py-3 text-ink-muted">
                      {new Date(pair.deliveryTimeMs).toISOString().slice(0, 10)}
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
      </main>
    </div>
  );
}
