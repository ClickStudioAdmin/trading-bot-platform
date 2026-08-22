import type { Metadata } from "next";
import Link from "next/link";
import { OpportunityFiltersForm } from "@/components/opportunity-filters";
import { OpportunityTable } from "@/components/opportunity-table";
import { PaperFlash } from "@/components/paper-flash";
import {
  applyOpportunityFilters,
  filterInputValues,
  filtersAreActive,
  parseOpportunityFilters,
} from "@/lib/opportunities/filter";
import { persistOpportunities } from "@/lib/opportunities/persist";
import { firstSearchValue } from "@/lib/paper/open";
import { getOpportunityPaperProps } from "@/lib/paper/list";
import { scanCarryOpportunities } from "@/lib/opportunities/scan";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";

export const metadata: Metadata = {
  title: "Opportunities",
  description: "Current dated cash-and-carry opportunities from Bybit public books.",
};

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseOpportunityFilters(params);
  const paper = await getOpportunityPaperProps("/opportunities");
  let rows: ScannedOpportunity[] = [];
  let error: string | null = null;

  try {
    rows = await scanCarryOpportunities();
    await persistOpportunities(rows);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Scan failed";
  }

  const visible = applyOpportunityFilters(rows, filters);
  const active = filtersAreActive(filters);

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
          Red is a discount or loss of edge. Open is paper only — no Bybit
          order.
        </p>
        <PaperFlash
          opened={firstSearchValue(params.paper) === "opened"}
          error={firstSearchValue(params.paperError)}
        />
        <div className="mt-6">
          <OpportunityFiltersForm values={filterInputValues(filters)} />
        </div>
        {error ? (
          <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink-faint">
            {active
              ? `${visible.length} of ${rows.length} pairs`
              : `${rows.length} pairs`}
          </p>
        )}
        <div className="mt-6">
          {visible.length === 0 && !error ? (
            <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
              {active
                ? "No pairs match these filters."
                : "No pairs in the current scan."}
            </p>
          ) : (
            <OpportunityTable rows={visible} paper={paper} />
          )}
        </div>
      </main>
    </div>
  );
}
