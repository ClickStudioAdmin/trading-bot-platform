import type { Metadata } from "next";
import { FuturesFlash } from "@/components/futures-flash";
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
import { submitFuturesTrade } from "@/lib/futures/actions";
import { loadFuturesDesk } from "@/lib/futures/list";
import { markFuturesOpen } from "@/lib/futures/mark";
import { reconcileOpenFuturesBooks } from "@/lib/futures/reconcile";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { firstSearchValue } from "@/lib/paper/open";
import { FUTURES_PATHS } from "@/lib/strategies/registry";

export const metadata: Metadata = {
  title: "Current Positions",
  description: "Open USDT perpetual positions.",
};

const NEXT = FUTURES_PATHS.positions;

export default async function FuturesPositionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
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
  const live = Boolean(
    session && accountCanHoldConnections(session.account.mode),
  );
  const [tickers, pairs] = await Promise.all([
    fetchBybitTickers("linear").catch(
      () =>
        new Map<
          string,
          { lastPrice?: string; bid1Price?: string; ask1Price?: string }
        >(),
    ),
    loadUsdtLinearPerps().catch(() => []),
  ]);
  const open = markFuturesOpen(desk.open, tickers, (symbol) =>
    baseCoinForPerpSymbol(symbol, pairs),
  );

  return (
    <main className="mx-auto max-w-6xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Current Positions" />
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
          error={firstSearchValue(params.paperError)}
        />

        <FuturesOpenStats signedIn={desk.signedIn} open={open} />
        <OpenFuturesTrades
          signedIn={desk.signedIn}
          open={open}
          next={NEXT}
          showHeading={false}
          exchangeBook={desk.exchangeBook}
        />

        <section>
          <h2 className="text-xl font-semibold tracking-tight">Place an order</h2>
          <p className="text-sm text-ink-muted">
            USDT linear perpetual. Buy opens or adds a long. Sell opens or adds
            a short. Both sides can be open on the same contract. Market fills
            now. Limit rests until it matches — watch it under Open orders.
            Optional TP/SL and trailing stop attach to that order. Add or edit
            stops on an open row. Close is on each open row. Size is token
            quantity or USDT notional (mark for market, limit price for limit).
            {settings.reduceOnly
              ? " Reduce only is on — Buy and Sell are blocked."
              : ""}
          </p>
          <div className="mt-3 rounded-card border border-line bg-surface p-5">
            <form action={submitFuturesTrade} className="block">
              <input type="hidden" name="next" value={NEXT} />
              <FuturesOrderTicket
                options={pairs}
                actions={
                  <>
                    <PendingSubmitButton
                      pendingLabel="Buying…"
                      successKey="futures-buy"
                      name="action"
                      value="buy"
                      className="rounded-control bg-accent-strong px-3 py-2 text-xs font-medium text-ink"
                    >
                      Buy
                    </PendingSubmitButton>
                    <PendingSubmitButton
                      pendingLabel="Selling…"
                      successKey="futures-sell"
                      name="action"
                      value="sell"
                      className="rounded-control bg-accent-strong px-3 py-2 text-xs font-medium text-ink"
                    >
                      Sell
                    </PendingSubmitButton>
                  </>
                }
              />
            </form>
            {live && !settings.connectionId ? (
              <p className="mt-3 text-xs text-warning">
                Bind an exchange in Strategy Settings before these buttons place
                venue orders.
              </p>
            ) : null}
          </div>
        </section>

        <FuturesWorkingOrders
          signedIn={desk.signedIn}
          working={desk.working}
          next={NEXT}
          exchangeBook={desk.exchangeBook}
          baseCoinFor={(symbol) => baseCoinForPerpSymbol(symbol, pairs)}
        />
      </div>
    </main>
  );
}
