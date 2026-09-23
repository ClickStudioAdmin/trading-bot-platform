import type { Metadata } from "next";
import { FuturesFlash } from "@/components/futures-flash";
import { LiveTickerScope } from "@/components/live-ticker";
import { FuturesOrderTicket } from "@/components/futures-order-ticket";
import {
  DeskBlotterFilters,
  DeskBlotterScopeSelect,
} from "@/components/desk-blotter-filters";
import {
  FuturesOpenStats,
  OpenFuturesTrades,
} from "@/components/futures-blotter";
import { FuturesWorkingOrders } from "@/components/futures-working";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getSessionContext } from "@/lib/auth/session";
import { fetchBybitTickers } from "@/lib/exchanges/bybit/client";
import {
  baseCoinForPerpSymbol,
  loadUsdtLinearPerps,
} from "@/lib/exchanges/bybit/perp";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { deskAllowsManualPerpTicket, deskAllowsSignalWebhooks, deskHref, deskIsCopy, deskShowsDcaBlotter } from "@/lib/accounts/model";
import { DeskBookReconcile } from "@/components/desk-book-reconcile";
import { dcaHintKey, dcaHintsForCopyOpen, dcaHintsForOpen } from "@/lib/dca/playbook";
import {
  listDcaBotOptions,
  listDcaPlaybooksForSymbols,
} from "@/lib/dca/store";
import {
  blotterFiltersForCopyDesk,
  deskBlotterFiltersActive,
  filterFuturesBlotterRows,
  filterFuturesWorkingRows,
  parseDeskBlotterFilters,
} from "@/lib/desk-blotter-filters";
import { loadFuturesAutomationRules } from "@/lib/futures/automation-load";
import { tableFiltersSuggestOpen } from "@/lib/table-chrome";
import { FuturesWebhookTest } from "@/components/futures-webhook-test";
import { submitFuturesTrade } from "@/lib/futures/actions";
import { futuresWebhookOrigin } from "@/lib/futures/webhook";
import { listFuturesWebhooks } from "@/lib/futures/webhook-load";
import { headers } from "next/headers";
import Link from "next/link";
import { loadFuturesPositionsBotBook } from "@/lib/futures/bot-book";
import { futuresOpenBookFromDesk, loadFuturesDesk } from "@/lib/futures/list";
import { futuresDeskNeedsUrgentRefresh } from "@/lib/futures/pending-close";
import { markFuturesOpen } from "@/lib/futures/mark";
import { listAgreementSymbols } from "@/lib/exchanges/agreement-store";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { firstSearchValue } from "@/lib/paper/open";
import { withMarketCapRank } from "@/lib/pairs/page";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { HyperliquidFuturesPositions } from "@/components/venues/hyperliquid/positions";
export const metadata: Metadata = {
  title: "Current Positions",
  description: "Open USDT perpetual positions.",
};

const NEXT_PATH = FUTURES_PATHS.positions;

export default async function FuturesPositionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
  if (session?.account.venue === "hyperliquid") {
    return <HyperliquidFuturesPositions searchParams={searchParams} />;
  }
  const NEXT = deskHref(NEXT_PATH, session?.account.id);
  const params = await searchParams;
  const live = Boolean(
    session && accountCanHoldConnections(session.account.mode),
  );
  const deskType = session?.account.deskType ?? "perps";
  const copyDesk = session ? deskIsCopy(session.account) : false;
  const filters = blotterFiltersForCopyDesk(
    parseDeskBlotterFilters(params),
    copyDesk,
  );
  const dcaBlotter = session
    ? deskShowsDcaBlotter(session.account)
    : deskType === "dca";
  const playbookAccountId = copyDesk
    ? session?.account.copyOfAccountId
    : session?.account.id;
  const recipeAccountId = playbookAccountId ?? session?.account.id;
  const botScope = Boolean(
    session &&
      filters.bot &&
      recipeAccountId &&
      (dcaBlotter || deskType === "perps_bots"),
  );
  const showTicket = session
    ? deskAllowsManualPerpTicket(session.account)
    : deskAllowsManualPerpTicket(deskType);
  const allowSignal = session
    ? deskAllowsSignalWebhooks(session.account)
    : deskAllowsSignalWebhooks(deskType);
  const loadCatalog = !botScope || showTicket;
  const emptyTickers = new Map<
    string,
    { lastPrice?: string; bid1Price?: string; ask1Price?: string }
  >();
  const headerList = headers();
  const [scoped, fullDesk, settings, webhooks, tickers, pairs, botOptions, perpsBots] =
    await Promise.all([
      botScope && recipeAccountId
        ? loadFuturesPositionsBotBook({
            botId: filters.bot,
            mode: dcaBlotter ? "dca" : "perps",
            recipeAccountId,
          })
        : Promise.resolve(null),
      botScope ? Promise.resolve(null) : loadFuturesDesk(),
      session && showTicket
        ? loadFuturesSettings(session.account.id)
        : Promise.resolve({
            reduceOnly: false,
            connectionId: null,
            paperLeverage: null,
            maxValuePerSymbol: null,
            maxOpenPositions: null,
          }),
      session && showTicket
        ? headerList.then((headerStore) =>
            listFuturesWebhooks({
              accountId: session.account.id,
              origin: futuresWebhookOrigin(headerStore),
            }),
          )
        : Promise.resolve([]),
      loadCatalog
        ? fetchBybitTickers("linear").catch(() => emptyTickers)
        : Promise.resolve(emptyTickers),
      loadCatalog
        ? loadUsdtLinearPerps().catch(() => []).then(withMarketCapRank)
        : Promise.resolve([]),
      dcaBlotter && playbookAccountId && !copyDesk
        ? listDcaBotOptions(playbookAccountId)
        : Promise.resolve([]),
      deskType === "perps_bots" && recipeAccountId && !copyDesk
        ? loadFuturesAutomationRules(recipeAccountId)
        : Promise.resolve([]),
    ]);
  const desk = scoped
    ? scoped.book
    : futuresOpenBookFromDesk(
        fullDesk ?? {
          signedIn: false,
          exchangeBook: false,
          open: [],
          working: [],
          webhookNames: [],
        },
      );
  const blotterSymbols = [
    ...desk.open.map((row) => row.symbol),
    ...desk.working.map((row) => row.symbol),
  ];
  const deferVenueRisk = desk.exchangeBook && desk.open.length > 0;
  const [playbooks, agreementSymbols] = await Promise.all([
    botScope
      ? Promise.resolve(scoped?.playbook ? [scoped.playbook] : [])
      : dcaBlotter && playbookAccountId
        ? listDcaPlaybooksForSymbols(playbookAccountId, blotterSymbols)
        : Promise.resolve([]),
    showTicket
      ? listAgreementSymbols(
          session?.account.venue === "bybit" ? settings.connectionId : null,
        )
      : Promise.resolve([]),
  ]);
  const open = markFuturesOpen(desk.open, tickers, (symbol) =>
    baseCoinForPerpSymbol(symbol, pairs),
  );

  const lastPrices: Record<string, number> = {};
  for (const [symbol, row] of tickers) {
    const last = Number(row.lastPrice);
    if (last > 0) {
      lastPrices[symbol] = last;
    }
  }
  const hintRows = desk.fillsLoaded
    ? open
    : open.map((row) => ({ ...row, orders: undefined }));
  const dcaHints = dcaBlotter
    ? copyDesk
      ? dcaHintsForCopyOpen(playbooks, hintRows, desk.working)
      : dcaHintsForOpen(playbooks, hintRows, desk.working)
    : undefined;
  const bots = dcaBlotter
    ? botOptions
    : perpsBots
        .filter((rule) => rule.id)
        .map((rule) => ({
          id: rule.id as string,
          name: rule.name,
        }));
  const visibleOpen = filterFuturesBlotterRows(
    open,
    filters,
    playbooks,
    (row) => dcaHints?.[dcaHintKey(row.symbol, row.side)]?.playbookId,
  );
  const visibleWorking = filterFuturesWorkingRows(
    desk.working,
    filters,
    playbooks,
    (row) =>
      dcaHints?.[dcaHintKey(row.symbol, row.side)]?.playbookId ??
      perpsBots.find((rule) => rule.id && rule.name === row.ruleName)?.id ??
      null,
  );
  const testWebhooks = allowSignal
    ? webhooks
    : webhooks.filter((row) => row.kind !== "signal");

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      {session ? <DeskBookReconcile accountId={session.account.id} /> : null}
      <div className="space-y-6">
        <FuturesFlash
          opened={firstSearchValue(params.paper) === "opened"}
          added={firstSearchValue(params.paper) === "added"}
          closed={firstSearchValue(params.paper) === "closed"}
          working={firstSearchValue(params.paper) === "working"}
          cancelled={firstSearchValue(params.paper) === "cancelled"}
          amended={firstSearchValue(params.paper) === "amended"}
          liveOpened={firstSearchValue(params.paper) === "live-opened"}
          liveAdded={firstSearchValue(params.paper) === "live-added"}
          liveClosed={firstSearchValue(params.paper) === "live-closed"}
          liveWorking={firstSearchValue(params.paper) === "live-working"}
          liveAmended={firstSearchValue(params.paper) === "live-amended"}
          tpsl={firstSearchValue(params.paper) === "tpsl"}
          liveTpsl={firstSearchValue(params.paper) === "live-tpsl"}
          trailing={firstSearchValue(params.paper) === "trailing"}
          liveTrailing={firstSearchValue(params.paper) === "live-trailing"}
          closedAll={firstSearchValue(params.paper) === "closed-all"}
          liveClosedAll={firstSearchValue(params.paper) === "live-closed-all"}
          cancelledAll={firstSearchValue(params.paper) === "cancelled-all"}
          closedAndCancelled={
            firstSearchValue(params.paper) === "closed-and-cancelled"
          }
          liveClosedAndCancelled={
            firstSearchValue(params.paper) === "live-closed-and-cancelled"
          }
          webhookArm={firstSearchValue(params.paper) === "webhook-arm"}
          playbookClosed={firstSearchValue(params.paper) === "playbook-closed"}
          livePlaybookClosed={
            firstSearchValue(params.paper) === "live-playbook-closed"
          }
          positionClosed={firstSearchValue(params.paper) === "position-closed"}
          livePositionClosed={
            firstSearchValue(params.paper) === "live-position-closed"
          }
          closing={firstSearchValue(params.paper) === "closing"}
          liveClosing={firstSearchValue(params.paper) === "live-closing"}
          closingAll={firstSearchValue(params.paper) === "closing-all"}
          liveClosingAll={firstSearchValue(params.paper) === "live-closing-all"}
          error={firstSearchValue(params.paperError)}
        />

        <LiveTickerScope symbols={open.map((row) => row.symbol)}>
        <section>
        <PageHeading
          as="h2"
          title="Current Positions"
          className="mb-3"
          actions={
            <DeskBlotterScopeSelect
              values={filters}
              bots={bots}
              deskId={session?.account.id}
            />
          }
        />
        <FuturesOpenStats signedIn={desk.signedIn} open={visibleOpen} />
        </section>
        {showTicket ? (
          <section>
            <h2 className="text-lg font-semibold tracking-tight">
              Place an order
            </h2>
            <p className="text-sm text-ink-muted">
              USDT linear perpetual. Buy opens or adds a long. Sell opens or
              adds a short. Both sides can be open on the same contract. Market
              fills now. Limit rests until it matches — watch it under Open
              orders. Optional TP/SL and trailing stop attach to that order.
              Add or edit stops on an open row. Market or Limit close is on
              each open row; both set qty (full row or a slice).               Close All and
              Close All & Cancel All Open Orders sit above the table when
              there are positions. Cancel All Open Orders sits on Open
              orders only when orders are listed. Size is token quantity or
              USDT value (mark for market, limit price for limit).
              {settings.reduceOnly
                ? " Reduce only is on — Buy and Sell are blocked."
                : ""}
            </p>
            <div className="mt-3 rounded-card border border-line bg-surface p-5">
              <form action={submitFuturesTrade} className="block">
                <input type="hidden" name="next" value={NEXT} />
                <FuturesOrderTicket
                  options={pairs}
                  lastPrices={lastPrices}
                  agreementSymbols={agreementSymbols}
                  actions={
                    <>
                      <PendingSubmitButton
                        pendingLabel="Buying…"
                        successKey="futures-buy"
                        name="action"
                        value="buy"
                        className="rounded-control bg-success px-3 py-2 text-sm font-medium text-canvas"
                      >
                        Buy
                      </PendingSubmitButton>
                      <PendingSubmitButton
                        pendingLabel="Selling…"
                        successKey="futures-sell"
                        name="action"
                        value="sell"
                        className="rounded-control bg-danger px-3 py-2 text-sm font-medium text-ink"
                      >
                        Sell
                      </PendingSubmitButton>
                    </>
                  }
                />
                {testWebhooks.length > 0 ? (
                  <FuturesWebhookTest
                    webhooks={testWebhooks}
                    allowSignal={allowSignal}
                    agreementSymbols={agreementSymbols}
                  />
                ) : session ? (
                  <p className="mt-4 text-hint text-ink-muted">
                    Create a named webhook on{" "}
                    <Link href={deskHref(FUTURES_PATHS.webhooks, session?.account.id)} className="text-accent">
                      Webhooks
                    </Link>{" "}
                    to send a dummy TradingView call from this ticket.
                  </p>
                ) : null}
              </form>
              {live && !settings.connectionId ? (
                <p className="mt-3 text-xs text-warning">
                  Bind an exchange in Desk Settings before these buttons place
                  venue orders.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        <OpenFuturesTrades
          signedIn={desk.signedIn}
          open={visibleOpen}
          closeAllOpenCount={desk.closeAllOpenCount}
          next={NEXT}
          showHeading={false}
          filtersOpen={tableFiltersSuggestOpen(params)}
          filterBar={
            <DeskBlotterFilters
              values={filters}
              bots={bots}
              deskId={session?.account.id}
              clearHref={NEXT}
            />
          }
          exchangeBook={desk.exchangeBook}
          showCloseAll
          workingCount={desk.cancelAllWorkingCount}
          webhookNames={desk.webhookNames}
          showDcaColumns={dcaBlotter}
          playbookOwnsOrders={dcaBlotter}
          hideRowExits={copyDesk}
          copyDesk={copyDesk}
          dcaHints={dcaHints}
          deferFills={!desk.fillsLoaded}
          deferVenueRisk={deferVenueRisk}
          emptyMessage={
            deskBlotterFiltersActive(filters)
              ? "No positions match these filters."
              : showTicket
                ? undefined
                : copyDesk && dcaBlotter
                  ? "No open futures. Copied parent DCA fills appear here."
                  : copyDesk
                    ? "No open futures. Copied fills from the parent will appear here."
                    : dcaBlotter
                      ? "No open futures. The bot adds orders once it is armed."
                      : "No open futures. TradingView opens them through a webhook."
          }
        />
        </LiveTickerScope>

        <FuturesWorkingOrders
          signedIn={desk.signedIn}
          working={visibleWorking}
          cancelAllCount={desk.cancelAllWorkingCount}
          next={NEXT}
          exchangeBook={desk.exchangeBook}
          baseCoins={Object.fromEntries(
            desk.working.map((row) => [
              row.symbol,
              baseCoinForPerpSymbol(row.symbol, pairs),
            ]),
          )}
          webhookNames={desk.webhookNames}
          playbookOwnsOrders={dcaBlotter}
          copyDesk={copyDesk}
          filtersOpen={tableFiltersSuggestOpen(params)}
          filterBar={
            <DeskBlotterFilters
              values={filters}
              bots={bots}
              deskId={session?.account.id}
              clearHref={NEXT}
            />
          }
          urgentRefresh={futuresDeskNeedsUrgentRefresh({
            positions: open,
            working: desk.working,
          })}
          emptyMessage={
            deskBlotterFiltersActive(filters)
              ? "No orders match these filters."
              : showTicket
                ? undefined
                : copyDesk && dcaBlotter
                  ? "No working limits. Copied parent DCA limits appear here."
                  : copyDesk
                    ? "No working limits. Copied parent limits appear here."
                    : dcaBlotter
                      ? "No working limits. Bot orders rest here when they are limits."
                      : "No working limits. TradingView limit orders rest here. Limit close on an open row also appears here."
          }
        />
      </div>
    </main>
  );
}
