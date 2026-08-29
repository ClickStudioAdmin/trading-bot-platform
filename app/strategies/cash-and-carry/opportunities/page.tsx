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
import { formatPct, formatUsd, signedTone } from "@/lib/opportunities/format";
import { firstSearchValue } from "@/lib/paper/open";
import { getOpportunityPaperProps } from "@/lib/paper/list";
import { deskIdFromHref } from "@/lib/accounts/model";

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
  const justActed = Boolean(
    firstSearchValue(params.paper) === "opened" ||
      firstSearchValue(params.paper) === "live-opened" ||
      firstSearchValue(params.paper) === "live-added",
  );
  const book = await loadOpportunityBook(justActed ? "stored" : "fresh");
  const error = book.error;
  const scannedAtMs = book.scannedAtMs;
  const rows = applyUsableBookShare(book.rows, await loadUsableBookShare());

  const visible = applyOpportunityFilters(rows, filters);
  const active = filtersAreActive(filters);
  const aprs = rows
    .map((row) => row.netApr)
    .filter((value): value is number => value !== null);
  const bestApr = aprs.length > 0 ? Math.max(...aprs) : null;
  const positive = rows.filter((row) => row.netBasis > 0).length;
  const negative = rows.filter((row) => row.netBasis < 0).length;
  const capacity = rows.reduce((sum, row) => sum + row.capacityUsdt, 0);

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <div className="space-y-6">
        <PaperFlash
          opened={firstSearchValue(params.paper) === "opened"}
          liveOpened={firstSearchValue(params.paper) === "live-opened"}
          liveAdded={firstSearchValue(params.paper) === "live-added"}
          error={firstSearchValue(params.paperError)}
        />
        <section>
          <h2 className="mb-3 text-xl font-semibold tracking-tight">
            Market snapshot
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Pairs scanned" value={String(rows.length)} />
            <StatCard
              label="Best net APR"
              value={formatPct(bestApr)}
              toneClass={signedTone(bestApr)}
            />
            <StatCard
              label="Positive / negative basis"
              value={`${positive} / ${negative}`}
            />
            <StatCard label="Usable book" value={formatUsd(capacity)} />
          </div>
        </section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PageHeading as="h2" title="Opportunities" className="" />
          <LastScan atMs={scannedAtMs} />
        </div>
        <OpportunityFiltersForm
          values={filterInputValues(filters)}
          deskId={deskIdFromHref(paper.next)}
        />
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

function StatCard({
  label,
  value,
  toneClass,
}: {
  label: string;
  value: string;
  toneClass?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <p
        className={`mt-3 text-2xl font-semibold tracking-tight ${toneClass ?? "text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}
