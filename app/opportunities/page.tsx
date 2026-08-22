import type { Metadata } from "next";
import Link from "next/link";
import { OpportunityTable } from "@/components/opportunity-table";
import { persistOpportunities } from "@/lib/opportunities/persist";
import type { PersistResult } from "@/lib/opportunities/persist";
import { scanCarryOpportunities } from "@/lib/opportunities/scan";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";

export const metadata: Metadata = {
  title: "Opportunities",
  description: "Current dated cash-and-carry opportunities from Bybit public books.",
};

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
              All carry pairs
            </h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/cash-and-carry"
              className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Overview
            </Link>
            <Link
              href="/instruments"
              className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Universe
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <p className="text-sm text-ink-muted">
          Full book. Green basis and APR are a premium (enter if rules allow).
          Red is a discount or loss of edge.
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
        <div className="mt-6">
          <OpportunityTable rows={rows} />
        </div>
      </main>
    </div>
  );
}
