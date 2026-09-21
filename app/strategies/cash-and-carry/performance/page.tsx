import type { Metadata } from "next";
import {
  DeskBlotterFilters,
  DeskBlotterScopeSelect,
} from "@/components/desk-blotter-filters";
import {
  ClosedPaperTrades,
  PaperPerformanceStats,
} from "@/components/paper-blotter";
import { deskHref } from "@/lib/accounts/model";
import { getSessionContext } from "@/lib/auth/session";
import {
  deskBlotterFiltersActive,
  filterPaperBlotterRows,
  parseDeskBlotterFilters,
} from "@/lib/desk-blotter-filters";
import { loadPaperRules } from "@/lib/engine/load";
import { paperConfigToFormValues } from "@/lib/engine/rules";
import { loadPaperDesk } from "@/lib/paper/list";
import { tableFiltersSuggestOpen } from "@/lib/table-chrome";

export const metadata: Metadata = {
  title: "Performance",
  description: "Past paper positions and realized cash-and-carry statistics.",
};

export default async function CashAndCarryPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  const desk = await loadPaperDesk([]);
  const filters = parseDeskBlotterFilters(params);
  const { config } = await loadPaperRules();
  const bots = paperConfigToFormValues(config)
    .layers.filter((layer) => layer.id)
    .map((layer) => ({
      id: layer.id,
      name: layer.name || "Bot",
    }));
  const visibleClosed = filterPaperBlotterRows(desk.closed, filters);
  const clearHref = deskHref(
    "/strategies/cash-and-carry/performance",
    session?.account.id,
  );

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 pt-6 pb-8">
      <PaperPerformanceStats
        signedIn={desk.signedIn}
        closed={visibleClosed}
        scope={
          <DeskBlotterScopeSelect
            values={filters}
            bots={bots}
            deskId={session?.account.id}
          />
        }
      />
      <ClosedPaperTrades
        signedIn={desk.signedIn}
        closed={visibleClosed}
        filtersOpen={tableFiltersSuggestOpen(params)}
        filterBar={
          <DeskBlotterFilters
            values={filters}
            bots={bots}
            deskId={session?.account.id}
            clearHref={clearHref}
            showSide={false}
          />
        }
        emptyMessage={
          deskBlotterFiltersActive(filters)
            ? "No positions match these filters."
            : undefined
        }
      />
    </main>
  );
}
