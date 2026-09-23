import Link from "next/link";
import { headers } from "next/headers";
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
import { FuturesWebhookTest } from "@/components/futures-webhook-test";
import { HyperliquidDeskFlash } from "@/components/venues/hyperliquid/desk-flash";
import { getSessionContext } from "@/lib/auth/session";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import {
  deskAllowsManualPerpTicket,
  deskAllowsSignalWebhooks,
  deskHref,
  deskIsCopy,
  deskShowsDcaBlotter,
} from "@/lib/accounts/model";
import { DeskBookReconcile } from "@/components/desk-book-reconcile";
import { dcaHintKey, dcaHintsForCopyOpen, dcaHintsForOpen } from "@/lib/dca/playbook";
import {
  listDcaBotOptions,
  listDcaPlaybooksForSymbols,
} from "@/lib/dca/store";
import {
  deskBlotterFiltersActive,
  filterFuturesBlotterRows,
  filterFuturesWorkingRows,
  parseDeskBlotterFilters,
} from "@/lib/desk-blotter-filters";
import { loadFuturesAutomationRules } from "@/lib/futures/automation-load";
import { tableFiltersSuggestOpen } from "@/lib/table-chrome";
import { submitFuturesTrade } from "@/lib/futures/actions";
import { futuresWebhookOrigin } from "@/lib/futures/webhook";
import { listFuturesWebhooks } from "@/lib/futures/webhook-load";
import { loadFuturesPositionsBotBook } from "@/lib/futures/bot-book";
import { futuresOpenBookFromDesk, loadFuturesDesk } from "@/lib/futures/list";
import { futuresDeskNeedsUrgentRefresh } from "@/lib/futures/pending-close";
import { markFuturesOpen } from "@/lib/futures/mark";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";
import {
  loadHyperliquidLinearPerps,
  loadHyperliquidTickerMap,
} from "@/lib/venues/hyperliquid/market";
import { baseCoinForPerpSymbol } from "@/lib/exchanges/bybit/perp";
import { withMarketCapRank } from "@/lib/pairs/page";

const NEXT_PATH = FUTURES_PATHS.positions;

export async function HyperliquidFuturesPositions({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
  const NEXT = deskHref(NEXT_PATH, session?.account.id);
  const params = await searchParams;
  const filters = parseDeskBlotterFilters(params);
  const live = Boolean(
    session && accountCanHoldConnections(session.account.mode),
  );
  const deskType = session?.account.deskType ?? "perps";
  const copyDesk = session ? deskIsCopy(session.account) : false;
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
  const env = hyperliquidInfoEnvironment(session?.account.venueEnvironment);
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
        ? loadHyperliquidTickerMap(env).catch(() => emptyTickers)
        : Promise.resolve(emptyTickers),
      loadCatalog
        ? loadHyperliquidLinearPerps(env).catch(() => []).then(withMarketCapRank)
        : Promise.resolve([]),
      dcaBlotter && playbookAccountId
        ? listDcaBotOptions(playbookAccountId)
        : Promise.resolve([]),
      deskType === "perps_bots" && recipeAccountId
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
  const playbooks =
    botScope
      ? scoped?.playbook
        ? [scoped.playbook]
        : []
      : dcaBlotter && playbookAccountId
        ? await listDcaPlaybooksForSymbols(playbookAccountId, blotterSymbols)
        : [];
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
        <HyperliquidDeskFlash params={params} includeWebhookArm />

        <LiveTickerScope
          symbols={open.map((row) => row.symbol)}
          venue="hyperliquid"
          environment={session?.account.venueEnvironment}
        >
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
              USDC perpetual. One open side per coin. Buy opens or adds a long,
              or reduces a short. Sell opens or adds a short, or reduces a
              long. Size above the open opposite side closes that row; open the
              other side after it is flat. Market fills now. Limit rests until
              it matches — watch it under Open orders. Optional TP/SL and
              trailing stop attach to that order. Market or Limit close is on
              each open row. Close All sits above the table. Size is coin
              quantity or USDC value.
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
                  defaultSymbol="BTC"
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
                    defaultSymbol="BTC"
                  />
                ) : session ? (
                  <p className="mt-4 text-hint text-ink-muted">
                    Create a named webhook on{" "}
                    <Link
                      href={deskHref(FUTURES_PATHS.webhooks, session.account.id)}
                      className="text-accent"
                    >
                      Webhooks
                    </Link>{" "}
                    to send a dummy TradingView call from this ticket.
                  </p>
                ) : null}
              </form>
              {live && !settings.connectionId ? (
                <p className="mt-3 text-xs text-warning">
                  Bind a Hyperliquid connection in Desk Settings before these
                  buttons place venue orders.
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
          exchangeName="Hyperliquid"
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
