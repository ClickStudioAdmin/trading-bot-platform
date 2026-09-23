import type { Metadata } from "next";
import {
  DeskBlotterFilters,
  DeskBlotterScopeSelect,
} from "@/components/desk-blotter-filters";
import {
  ClosedFuturesTrades,
  FuturesPerformanceStats,
} from "@/components/futures-blotter";
import { deskIsCopy, deskShowsDcaBlotter } from "@/lib/accounts/model";
import {
  automationsBotReturn,
  automationsReturnHref,
} from "@/lib/bots/automations-path";
import { getSessionContext } from "@/lib/auth/session";
import { listDcaBotOptions, loadDcaPlaybookById } from "@/lib/dca/store";
import {
  blotterFiltersForCopyDesk,
  deskBlotterFiltersActive,
  filterFuturesBlotterRows,
  parseDeskBlotterFilters,
} from "@/lib/desk-blotter-filters";
import { unstampedClosedBotId } from "@/lib/bots/automations-list";
import { listFuturesAutomationRuleOptions } from "@/lib/futures/automation-load";
import { loadFuturesPerformanceBook } from "@/lib/futures/list";
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
  const deskType = session?.account.deskType ?? "perps";
  const copyDesk = session ? deskIsCopy(session.account) : false;
  const filters = blotterFiltersForCopyDesk(
    parseDeskBlotterFilters(params),
    copyDesk,
  );
  const dcaBlotter = session
    ? deskShowsDcaBlotter(session.account)
    : deskType === "dca";
  const recipeAccountId = copyDesk
    ? session?.account.copyOfAccountId
    : session?.account.id;
  const botScope = Boolean(
    session &&
      filters.bot &&
      recipeAccountId &&
      (dcaBlotter || deskType === "perps_bots"),
  );
  const playbook =
    botScope && dcaBlotter && recipeAccountId
      ? await loadDcaPlaybookById(filters.bot, recipeAccountId)
      : null;
  const [desk, botOptions, perpsBots, settings] = await Promise.all([
    loadFuturesPerformanceBook(
      botScope
        ? {
            closed: dcaBlotter
              ? { symbol: playbook?.symbol ?? "" }
              : { ruleId: filters.bot },
            open: dcaBlotter
              ? { symbol: playbook?.symbol ?? "" }
              : { ruleId: filters.bot },
          }
        : undefined,
    ),
    dcaBlotter && recipeAccountId && !copyDesk
      ? listDcaBotOptions(recipeAccountId)
      : Promise.resolve([]),
    deskType === "perps_bots" && recipeAccountId && !copyDesk
      ? listFuturesAutomationRuleOptions(recipeAccountId)
      : Promise.resolve([]),
    session ? loadFuturesSettings(session.account.id) : Promise.resolve(null),
  ]);
  const bots = dcaBlotter ? botOptions : perpsBots;
  const botReturn = automationsBotReturn(
    params,
    bots,
    filters.bot,
    FUTURES_PATHS.automations,
    session?.account.id,
  );
  const memoryFilters = botScope ? { ...filters, bot: "" } : filters;
  const scopedClosed = filterFuturesBlotterRows(
    desk.closed,
    memoryFilters,
    [],
    undefined,
    { inferBot: false },
  );
  const visibleClosed =
    botScope && dcaBlotter && playbook
      ? scopedClosed.filter(
          (row) =>
            row.ruleId === playbook.id ||
            unstampedClosedBotId(row, [playbook]) === playbook.id,
        )
      : scopedClosed;
  const visibleOpen = filterFuturesBlotterRows(desk.open, memoryFilters);
  const clearHref = automationsReturnHref(
    FUTURES_PATHS.performance,
    session?.account.id,
    botReturn.keep,
  );
  const filterBar = (
    <DeskBlotterFilters
      values={filters}
      bots={bots}
      deskId={session?.account.id}
      clearHref={clearHref}
      keep={botReturn.keep}
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
        title={botReturn.titleFor("Desk Statistics")}
        backHref={botReturn.backHref}
        scope={
          <DeskBlotterScopeSelect
            values={filters}
            bots={bots}
            deskId={session?.account.id}
            keep={botReturn.keep}
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
        deferFills
      />
    </main>
  );
}
