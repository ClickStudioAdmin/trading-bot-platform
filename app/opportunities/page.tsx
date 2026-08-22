import type { Metadata } from "next";
import Link from "next/link";
import { persistOpportunities } from "@/lib/opportunities/persist";
import type { PersistResult } from "@/lib/opportunities/persist";
import { scanCarryOpportunities } from "@/lib/opportunities/scan";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";

export const metadata: Metadata = {
  title: "Opportunities",
  description: "Current dated cash-and-carry opportunities from Bybit public books.",
};

function formatPct(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${(value * 100).toFixed(2)}%`;
}

function formatUsd(value: number): string {
  if (value <= 0) {
    return "—";
  }
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function aprTone(apr: number | null): string {
  if (apr === null) {
    return "text-ink-faint";
  }
  if (apr >= 0.1) {
    return "text-success";
  }
  if (apr < 0) {
    return "text-danger";
  }
  return "text-ink";
}

export default async function OpportunitiesPage() {
  let rows: ScannedOpportunity[] = [];
  let error: string | null = null;
  let persist: PersistResult | null = null;

  try {
    rows = await scanCarryOpportunities();
    persist = await persistOpportunities(rows);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Scan failed";
  }

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
              Current opportunities
            </p>
            <h1 className="text-lg font-semibold tracking-tight">
              Dated cash-and-carry
            </h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/instruments"
              className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Universe
            </Link>
            <Link
              href="/"
              className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <p className="text-sm text-ink-muted">
          Buy spot at the ask, sell the dated future at the bid. Fees assume
          VIP0 taker (0.155%) plus 5 bp slippage. Capacity is 25% of the top
          five book levels that stay inside that slippage. Live Bybit public
          books. No API key. No orders.
        </p>
        {error ? (
          <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink-faint">{rows.length} pairs</p>
        )}
        {persist?.status === "saved" ? (
          <p className="mt-2 text-sm text-success">
            Saved {persist.count} latest rows.
          </p>
        ) : null}
        {persist?.status === "skipped" ? (
          <p className="mt-2 text-sm text-warning">{persist.reason}</p>
        ) : null}
        {persist?.status === "error" ? (
          <p className="mt-2 text-sm text-danger">{persist.reason}</p>
        ) : null}

        <div className="mt-6 overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Pair</th>
                <th className="px-4 py-3 font-medium">DTE</th>
                <th className="px-4 py-3 font-medium">Exec. basis</th>
                <th className="px-4 py-3 font-medium">Fees + slip</th>
                <th className="px-4 py-3 font-medium">Net basis</th>
                <th className="px-4 py-3 font-medium">Net APR</th>
                <th className="px-4 py-3 font-medium">Capacity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.spotSymbol}-${row.futureSymbol}`}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium">{row.baseCoin}</span>
                    <span className="mt-0.5 block text-xs text-ink-faint">
                      {row.futureSymbol}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-muted">
                    {row.daysToExpiry > 0 ? row.daysToExpiry.toFixed(1) : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatPct(row.executableBasis)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-muted">
                    {formatPct(row.feeRate)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatPct(row.netBasis)}
                  </td>
                  <td className={`px-4 py-3 tabular-nums ${aprTone(row.netApr)}`}>
                    {formatPct(row.netApr)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-muted">
                    {formatUsd(row.capacityUsdt)}
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
