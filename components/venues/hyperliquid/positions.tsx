import Link from "next/link";
import { headers } from "next/headers";
import { LiveTickerScope } from "@/components/live-ticker";
import { FuturesOrderTicket } from "@/components/futures-order-ticket";
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
} from "@/lib/accounts/model";
import { dcaHintsForOpen } from "@/lib/dca/playbook";
import { listDcaPlaybooksForAccount } from "@/lib/dca/store";
import { submitFuturesTrade } from "@/lib/futures/actions";
import { futuresWebhookOrigin } from "@/lib/futures/webhook";
import { listFuturesWebhooks } from "@/lib/futures/webhook-load";
import { loadFuturesDesk } from "@/lib/futures/list";
import { markFuturesOpen } from "@/lib/futures/mark";
import { reconcileOpenFuturesBooks } from "@/lib/futures/reconcile";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { loadFuturesVenueRisk } from "@/lib/futures/venue-risk-load";
import { attachFuturesVenueRisk } from "@/lib/futures/venue-risk";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";
import {
  loadHyperliquidLinearPerps,
  loadHyperliquidTickerMap,
} from "@/lib/venues/hyperliquid/market";
import { baseCoinForPerpSymbol } from "@/lib/exchanges/bybit/perp";

const NEXT_PATH = FUTURES_PATHS.positions;

export async function HyperliquidFuturesPositions({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
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
  const env = hyperliquidInfoEnvironment(session?.account.venueEnvironment);
  const [tickers, pairs, venueRisk] = await Promise.all([
    loadHyperliquidTickerMap(env).catch(
      () =>
        new Map<
          string,
          { lastPrice?: string; bid1Price?: string; ask1Price?: string }
        >(),
    ),
    loadHyperliquidLinearPerps(env).catch(() => []),
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
  const showTicket = deskAllowsManualPerpTicket(deskType);
  const allowSignal = deskAllowsSignalWebhooks(deskType);
  const dca = deskType === "dca";
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
      <PageHeading as="h2" title="Current Positions" />
      <div className="space-y-6">
        <HyperliquidDeskFlash params={params} includeWebhookArm />

        <LiveTickerScope
          symbols={open.map((row) => row.symbol)}
          venue="hyperliquid"
          environment={session?.account.venueEnvironment}
        >
          <FuturesOpenStats signedIn={desk.signedIn} open={open} />
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

        {showTicket ? (
          <section>
            <h2 className="text-xl font-semibold tracking-tight">
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
                  />
                ) : session ? (
                  <p className="mt-4 text-xs text-ink-muted">
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
