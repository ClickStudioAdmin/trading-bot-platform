import type { Metadata } from "next";
import { FuturesFlash } from "@/components/futures-flash";
import { FuturesOrderTicket } from "@/components/futures-order-ticket";
import {
  FuturesOpenStats,
  OpenFuturesTrades,
} from "@/components/futures-blotter";
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
          liveOpened={firstSearchValue(params.paper) === "live-opened"}
          liveAdded={firstSearchValue(params.paper) === "live-added"}
          liveClosed={firstSearchValue(params.paper) === "live-closed"}
          error={firstSearchValue(params.paperError)}
        />

        <section className="rounded-card border border-line bg-surface p-5">
          <h3 className="text-sm font-medium text-ink">Place an order</h3>
          <p className="mt-1 text-sm text-ink-muted">
            USDT linear perpetual. Buy opens or adds a long. Sell opens or adds
            a short. Both sides can be open on the same contract. Close is on
            each open row. Size is token quantity or USDT notional at mark.
            {settings.reduceOnly
              ? " Reduce only is on — Buy and Sell are blocked."
              : ""}
          </p>
          <form
            action={submitFuturesTrade}
            className="mt-4 grid gap-3 sm:grid-cols-[minmax(14rem,1.1fr)_minmax(16rem,1.2fr)_auto]"
          >
            <input type="hidden" name="next" value={NEXT} />
            <FuturesOrderTicket options={pairs} />
            <div className="flex flex-wrap items-end gap-2">
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
            </div>
          </form>
          {live && !settings.connectionId ? (
            <p className="mt-3 text-xs text-warning">
              Bind an exchange in Strategy Settings before these buttons place
              venue orders.
            </p>
          ) : null}
        </section>

        <FuturesOpenStats signedIn={desk.signedIn} open={open} />
        <OpenFuturesTrades
          signedIn={desk.signedIn}
          open={open}
          next={NEXT}
          showHeading={false}
          exchangeBook={desk.exchangeBook}
        />
      </div>
    </main>
  );
}
