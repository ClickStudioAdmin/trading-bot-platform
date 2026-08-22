import type { Metadata } from "next";
import { OpportunityFiltersForm } from "@/components/opportunity-filters";
import { OpportunityTable } from "@/components/opportunity-table";
import { PageHeading } from "@/components/page-heading";
import { PaperFlash } from "@/components/paper-flash";
import {
  applyOpportunityFilters,
  filterInputValues,
  filtersAreActive,
  parseOpportunityFilters,
} from "@/lib/opportunities/filter";
import { loadUsableBookShare } from "@/lib/engine/settings";
import { applyUsableBookShare } from "@/lib/opportunities/capacity";
import { LastScan } from "@/components/last-scan";
import {
  loadLatestScannedAt,
  persistOpportunities,
} from "@/lib/opportunities/persist";
import { firstSearchValue } from "@/lib/paper/open";
import { getOpportunityPaperProps } from "@/lib/paper/list";
import { scanCarryOpportunities } from "@/lib/opportunities/scan";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";

export const metadata: Metadata = {
  title: "Opportunities",
  description: "Current dated cash-and-carry opportunities from Bybit public books.",
};

export default async function CashAndCarryOpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseOpportunityFilters(params);
  const paper = await getOpportunityPaperProps(
    "/strategies/cash-and-carry/opportunities",
  );
  let rows: ScannedOpportunity[] = [];
  let error: string | null = null;
  let scannedAtMs: number | null = null;

  try {
    const raw = await scanCarryOpportunities();
    scannedAtMs = Date.now();
    await persistOpportunities(raw);
    rows = applyUsableBookShare(raw, await loadUsableBookShare());
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Scan failed";
    scannedAtMs = await loadLatestScannedAt();
  }

  const visible = applyOpportunityFilters(rows, filters);
  const active = filtersAreActive(filters);

  return (
    <main className="mx-auto max-w-6xl px-6 pt-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading as="h2" title="Opportunities" />
        <LastScan atMs={scannedAtMs} />
      </div>
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
  );
}
