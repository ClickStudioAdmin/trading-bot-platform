import type { Metadata } from "next";
import {
  DeskBlotterFilters,
  DeskBlotterScopeSelect,
} from "@/components/desk-blotter-filters";
import {
  ClosedFuturesTrades,
  FuturesPerformanceStats,
} from "@/components/futures-blotter";
import { deskHref, deskIsCopy, deskShowsDcaBlotter } from "@/lib/accounts/model";
import { getSessionContext } from "@/lib/auth/session";
import { listDcaPlaybooksForAccount } from "@/lib/dca/store";
import {
  deskBlotterFiltersActive,
  filterFuturesBlotterRows,
  parseDeskBlotterFilters,
} from "@/lib/desk-blotter-filters";
import { loadFuturesAutomationRules } from "@/lib/futures/automation-load";
import { loadFuturesDesk } from "@/lib/futures/list";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { tableFiltersSuggestOpen } from "@/lib/table-chrome";

export const metadata: Metadata = {
  title: "Performance",
  description: "Closed USDT perpetual positions and realized statistics.",
};

export default async function FuturesPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  const desk = await loadFuturesDesk();
  const settings = desk.signedIn ? await loadFuturesSettings() : null;
  const filters = parseDeskBlotterFilters(params);
  const deskType = session?.account.deskType ?? "perps";
  const copyDesk = session ? deskIsCopy(session.account) : false;
  const dcaBlotter = session
    ? deskShowsDcaBlotter(session.account)
    : deskType === "dca";
  const recipeAccountId = copyDesk
    ? session?.account.copyOfAccountId
    : session?.account.id;
  const playbooks =
    dcaBlotter && recipeAccountId
      ? await listDcaPlaybooksForAccount(recipeAccountId)
      : [];
  const perpsBots =
    deskType === "perps_bots" && recipeAccountId
      ? await loadFuturesAutomationRules(recipeAccountId)
      : [];
  const bots = dcaBlotter
    ? playbooks.map((playbook) => ({
        id: playbook.id,
        name: playbook.name || playbook.symbol,
      }))
    : perpsBots
        .filter((rule) => rule.id)
        .map((rule) => ({
          id: rule.id as string,
          name: rule.name,
        }));
  const visibleClosed = filterFuturesBlotterRows(
    desk.closed,
    filters,
    playbooks,
    undefined,
    { inferBot: false },
  );
  const visibleOpen = filterFuturesBlotterRows(desk.open, filters, playbooks);
  const clearHref = deskHref(FUTURES_PATHS.performance, session?.account.id);
  const filterBar = (
    <DeskBlotterFilters
      values={filters}
      bots={bots}
      deskId={session?.account.id}
      clearHref={clearHref}
    />
  );
  const filteredEmpty = deskBlotterFiltersActive(filters)
    ? "No positions match these filters."
    : undefined;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 pt-6 pb-8">
      <FuturesPerformanceStats
        signedIn={desk.signedIn}
        closed={visibleClosed}
        open={visibleOpen}
        exchangeBook={desk.exchangeBook}
        fallbackLeverage={
          desk.exchangeBook ? null : (settings?.paperLeverage ?? null)
        }
        scope={
          <DeskBlotterScopeSelect
            values={filters}
            bots={bots}
            deskId={session?.account.id}
          />
        }
      />
      <ClosedFuturesTrades
        signedIn={desk.signedIn}
        closed={visibleClosed}
        webhookNames={desk.webhookNames}
        fallbackLeverage={
          desk.exchangeBook ? null : (settings?.paperLeverage ?? null)
        }
        filtersOpen={tableFiltersSuggestOpen(params)}
        filterBar={filterBar}
        emptyMessage={filteredEmpty}
      />
    </main>
  );
}
