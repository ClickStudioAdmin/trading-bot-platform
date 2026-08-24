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
import { loadOpportunityBook } from "@/lib/opportunities/load";
import { firstSearchValue } from "@/lib/paper/open";
import { getOpportunityPaperProps } from "@/lib/paper/list";

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
  const justActed = Boolean(firstSearchValue(params.paper));
  const book = await loadOpportunityBook(justActed ? "stored" : "fresh");
  const error = book.error;
  const scannedAtMs = book.scannedAtMs;
  const rows = applyUsableBookShare(book.rows, await loadUsableBookShare());

  const visible = applyOpportunityFilters(rows, filters);
  const active = filtersAreActive(filters);

  return (
    <main className="mx-auto max-w-6xl px-6 pt-6 pb-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <PageHeading as="h2" title="Opportunities" className="" />
        <LastScan atMs={scannedAtMs} />
      </div>
      <div className="space-y-6">
        <PaperFlash
          opened={firstSearchValue(params.paper) === "opened"}
          error={firstSearchValue(params.paperError)}
        />
        <OpportunityFiltersForm values={filterInputValues(filters)} />
        {error ? (
          <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-ink-muted">
              {active
                ? `${visible.length} of ${rows.length} pairs`
                : `${rows.length} pairs`}
            </p>
            {visible.length === 0 ? (
              <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
                {active
                  ? "No pairs match these filters."
                  : "No pairs in the current scan."}
              </p>
            ) : (
              <OpportunityTable rows={visible} paper={paper} />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
