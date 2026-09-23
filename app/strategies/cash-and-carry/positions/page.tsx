import type { Metadata } from "next";
import {
  DeskBlotterFilters,
  DeskBlotterScopeSelect,
} from "@/components/desk-blotter-filters";
import { DeskReturnHeading } from "@/components/desk-return-heading";
import { OpenPaperTrades, PaperOpenStats } from "@/components/paper-blotter";
import { PaperFlash } from "@/components/paper-flash";
import { loadUsableBookShare } from "@/lib/engine/settings";
import { applyUsableBookShare } from "@/lib/opportunities/capacity";
import { loadStoredOpportunities } from "@/lib/opportunities/persist";
import { firstSearchValue } from "@/lib/paper/open";
import { listPaperBotOptions, loadPaperOpenCarryRows, paperBotRuleId } from "@/lib/paper/list";
import { markOpenCarries } from "@/lib/paper/rows";
import { deskHref } from "@/lib/accounts/model";
import {
  CASH_AND_CARRY_AUTOMATIONS_PATH,
  automationsBotReturn,
  automationsReturnHref,
} from "@/lib/bots/automations-path";
import { getSessionContext } from "@/lib/auth/session";
import {
  deskBlotterFiltersActive,
  filterPaperBlotterRows,
  parseDeskBlotterFilters,
} from "@/lib/desk-blotter-filters";
import { tableFiltersSuggestOpen } from "@/lib/table-chrome";

export const metadata: Metadata = {
  title: "Current Positions",
  description: "Open paper cash-and-carry positions.",
};

export default async function CashAndCarryPositionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  const next = deskHref(
    "/strategies/cash-and-carry/positions",
    session?.account.id,
  );
  const filters = parseDeskBlotterFilters(params);
  const ruleId = filters.bot ? paperBotRuleId(filters.bot) : undefined;
  const unknownBot = Boolean(filters.bot) && ruleId == null;
  const [book, share, openBook, bots] = await Promise.all([
    session
      ? loadStoredOpportunities()
      : Promise.resolve({ rows: [], scannedAtMs: null }),
    session ? loadUsableBookShare() : Promise.resolve(1),
    unknownBot
      ? Promise.resolve({
          signedIn: Boolean(session),
          exchangeBook: false,
          rows: [],
          fills: [],
        })
      : loadPaperOpenCarryRows(ruleId == null ? undefined : { ruleId }),
    listPaperBotOptions(),
  ]);
  const botReturn = automationsBotReturn(
    params,
    bots,
    filters.bot,
    CASH_AND_CARRY_AUTOMATIONS_PATH,
    session?.account.id,
  );
  const clearHref = automationsReturnHref(
    "/strategies/cash-and-carry/positions",
    session?.account.id,
    botReturn.keep,
  );
  const visibleOpen = filterPaperBlotterRows(
    markOpenCarries(
      openBook.rows,
      applyUsableBookShare(book.rows, share),
      openBook.fills,
    ).map((row) => ({ ...row, orders: [], logs: [] })),
    ruleId == null ? filters : { ...filters, bot: "" },
  );

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <div className="space-y-6">
        <PaperFlash
          opened={firstSearchValue(params.paper) === "opened"}
          closed={firstSearchValue(params.paper) === "closed"}
          liveOpened={firstSearchValue(params.paper) === "live-opened"}
          liveAdded={firstSearchValue(params.paper) === "live-added"}
          liveClosed={firstSearchValue(params.paper) === "live-closed"}
          liveUnwinding={firstSearchValue(params.paper) === "live-unwinding"}
          exits={firstSearchValue(params.paper) === "exits"}
          unwinding={firstSearchValue(params.paper) === "unwinding"}
          error={firstSearchValue(params.paperError)}
        />
        <section>
        <DeskReturnHeading
          title={botReturn.titleFor("Current Positions")}
          backHref={botReturn.backHref}
          className="mb-3"
          actions={
            <DeskBlotterScopeSelect
              values={filters}
              bots={bots}
              deskId={session?.account.id}
              keep={botReturn.keep}
            />
          }
        />
        <PaperOpenStats signedIn={openBook.signedIn} open={visibleOpen} />
        </section>
        <OpenPaperTrades
          signedIn={openBook.signedIn}
          open={visibleOpen}
          next={next}
          showHeading={false}
          exchangeBook={openBook.exchangeBook}
          deferFills
          filtersOpen={tableFiltersSuggestOpen(params)}
          filterBar={
            <DeskBlotterFilters
              values={filters}
              bots={bots}
              deskId={session?.account.id}
              clearHref={clearHref}
              keep={botReturn.keep}
              showSide={false}
            />
          }
          emptyMessage={
            deskBlotterFiltersActive(filters)
              ? "No positions match these filters."
              : undefined
          }
          opportunitiesHref={deskHref(
            "/strategies/cash-and-carry/opportunities",
            session?.account.id,
          )}
        />
      </div>
    </main>
  );
}
