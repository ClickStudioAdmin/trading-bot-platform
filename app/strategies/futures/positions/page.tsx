import type { Metadata } from "next";
import { FuturesFlash } from "@/components/futures-flash";
import { LiveTickerScope } from "@/components/live-ticker";
import { FuturesOrderTicket } from "@/components/futures-order-ticket";
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
import { deskAllowsDcaPlaybooks, deskAllowsManualPerpTicket, deskAllowsSignalWebhooks, deskHref } from "@/lib/accounts/model";
import { dcaHintsForOpen } from "@/lib/dca/playbook";
import { listDcaPlaybooksForAccount } from "@/lib/dca/store";
import { FuturesWebhookTest } from "@/components/futures-webhook-test";
import { submitFuturesTrade } from "@/lib/futures/actions";
import { futuresWebhookOrigin } from "@/lib/futures/webhook";
import { listFuturesWebhooks } from "@/lib/futures/webhook-load";
import { headers } from "next/headers";
import Link from "next/link";
import { loadFuturesDesk } from "@/lib/futures/list";
import { markFuturesOpen } from "@/lib/futures/mark";
import { reconcileOpenFuturesBooks } from "@/lib/futures/reconcile";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { loadFuturesVenueRisk } from "@/lib/futures/venue-risk-load";
import { attachFuturesVenueRisk } from "@/lib/futures/venue-risk";
import { firstSearchValue } from "@/lib/paper/open";
import { withMarketCapRank } from "@/lib/pairs/page";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { HyperliquidFuturesPositions } from "@/components/venues/hyperliquid/positions";
import { PositionsChartButton } from "@/components/positions-chart-button";

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
  if (session) {
    await reconcileOpenFuturesBooks({
      accountId: session.account.id,
      userId: session.member.id,
    });
  }
  const desk = await loadFuturesDesk();
  const settings = session
    ? await loadFuturesSettings(session.account.id)
    : { reduceOnly: false, connectionId: null };
  const webhooks = session
    ? await listFuturesWebhooks({
        accountId: session.account.id,
        origin: futuresWebhookOrigin(await headers()),
      })
    : [];
  const live = Boolean(
    session && accountCanHoldConnections(session.account.mode),
  );
  const [tickers, pairs, venueRisk] = await Promise.all([
    fetchBybitTickers("linear").catch(
      () =>
        new Map<
          string,
          { lastPrice?: string; bid1Price?: string; ask1Price?: string }
        >(),
    ),
    loadUsdtLinearPerps().catch(() => []).then(withMarketCapRank),
    desk.exchangeBook && desk.open.length > 0
      ? loadFuturesVenueRisk()
      : Promise.resolve(new Map()),
  ]);
  const open = attachFuturesVenueRisk(
    markFuturesOpen(desk.open, tickers, (symbol) =>
      baseCoinForPerpSymbol(symbol, pairs),
    ),
    venueRisk,
  );

  const lastPrices: Record<string, number> = {};
  for (const [symbol, row] of tickers) {
    const last = Number(row.lastPrice);
    if (last > 0) {
      lastPrices[symbol] = last;
    }
  }
  const deskType = session?.account.deskType ?? "perps";
  const showTicket = session
    ? deskAllowsManualPerpTicket(session.account)
    : deskAllowsManualPerpTicket(deskType);
  const allowSignal = session
    ? deskAllowsSignalWebhooks(session.account)
    : deskAllowsSignalWebhooks(deskType);
  const dca = session
    ? deskAllowsDcaPlaybooks(session.account)
    : deskType === "dca";
  const playbooks =
    dca && session
      ? await listDcaPlaybooksForAccount(session.account.id)
      : [];
  const dcaHints = dca
    ? dcaHintsForOpen(playbooks, open, desk.working)
    : undefined;
  const testWebhooks = allowSignal
    ? webhooks
    : webhooks.filter((row) => row.kind !== "signal");

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
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
          error={firstSearchValue(params.paperError)}
        />

        <LiveTickerScope symbols={open.map((row) => row.symbol)}>
        <FuturesOpenStats signedIn={desk.signedIn} open={open} />
        {showTicket ? (
          <section>
            <h2 className="text-xl font-semibold tracking-tight">
              Place an order
            </h2>
            <p className="text-sm text-ink-muted">
              USDT linear perpetual. Buy opens or adds a long. Sell opens or
              adds a short. Both sides can be open on the same contract. Market
              fills now. Limit rests until it matches — watch it under Open
              orders. Optional TP/SL and trailing stop attach to that order.
              Add or edit stops on an open row. Market or Limit close is on
              each open row; both set qty (full row or a slice). Close All and
              Close All & Cancel All Open Orders sit above the table. Cancel
              All Open Orders sits above Open orders. Size is token quantity or
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
                  />
                ) : session ? (
                  <p className="mt-4 text-xs text-ink-muted">
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

        <PageHeading
          as="h2"
          title="Current Positions"
          className="mb-0"
          actions={
            <PositionsChartButton
              venue="bybit"
              symbols={[
                ...open.map((row) => row.symbol),
                ...desk.working.map((row) => row.symbol),
              ]}
              defaultSymbol={open[0]?.symbol ?? "BTCUSDT"}
              positions={open}
              working={desk.working}
              orders={open.flatMap((row) =>
                row.orders.map((order) => ({
                  ...order,
                  symbol: row.symbol,
                })),
              )}
            />
          }
        />
        <OpenFuturesTrades
          signedIn={desk.signedIn}
          open={open}
          next={NEXT}
          showHeading={false}
          exchangeBook={desk.exchangeBook}
          showCloseAll
          workingCount={desk.working.length}
          webhookNames={desk.webhookNames}
          showDcaColumns={dca}
          playbookOwnsOrders={dca}
          dcaHints={dcaHints}
          emptyMessage={
            showTicket
              ? undefined
              : dca
                ? "No open futures. The bot adds orders once it is armed."
                : "No open futures. TradingView opens them through a webhook."
          }
        />
        </LiveTickerScope>

        <FuturesWorkingOrders
          signedIn={desk.signedIn}
          working={desk.working}
          next={NEXT}
          exchangeBook={desk.exchangeBook}
          baseCoinFor={(symbol) => baseCoinForPerpSymbol(symbol, pairs)}
          webhookNames={desk.webhookNames}
          playbookOwnsOrders={dca}
          emptyMessage={
            showTicket
              ? undefined
              : dca
                ? "No working limits. Bot orders rest here when they are limits."
                : "No working limits. TradingView limit orders rest here. Limit close on an open row also appears here."
          }
        />
      </div>
    </main>
  );
}
