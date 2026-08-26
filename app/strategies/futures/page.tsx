import type { Metadata } from "next";
import Link from "next/link";
import { FuturesFlash } from "@/components/futures-flash";
import { OpenFuturesTrades } from "@/components/futures-blotter";
import { FuturesWorkingOrders } from "@/components/futures-working";
import { getSessionContext } from "@/lib/auth/session";
import { fetchBybitTickers } from "@/lib/exchanges/bybit/client";
import {
  baseCoinForPerpSymbol,
  loadUsdtLinearPerps,
} from "@/lib/exchanges/bybit/perp";
import { loadFuturesDesk } from "@/lib/futures/list";
import { markFuturesOpen } from "@/lib/futures/mark";
import { reconcileOpenFuturesBooks } from "@/lib/futures/reconcile";
import { loadFuturesVenueRisk } from "@/lib/futures/venue-risk-load";
import { attachFuturesVenueRisk } from "@/lib/futures/venue-risk";
import { firstSearchValue } from "@/lib/paper/open";
import { deskAllowsManualPerpTicket } from "@/lib/accounts/model";
import { FUTURES_PATHS } from "@/lib/strategies/registry";

export const metadata: Metadata = {
  title: "Futures",
  description: "USDT linear perpetual buy, sell, and close.",
};

export default async function FuturesOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  if (session) {
    await reconcileOpenFuturesBooks({
      accountId: session.account.id,
      userId: session.member.id,
    });
  }
  const desk = await loadFuturesDesk();
  const showTicket = deskAllowsManualPerpTicket(
    session?.account.deskType ?? "perps",
  );
  const [tickers, pairs, venueRisk] = await Promise.all([
    desk.open.length > 0
      ? fetchBybitTickers("linear").catch(
          () =>
            new Map<
              string,
              { lastPrice?: string; bid1Price?: string; ask1Price?: string }
            >(),
        )
      : Promise.resolve(
          new Map<
            string,
            { lastPrice?: string; bid1Price?: string; ask1Price?: string }
          >(),
        ),
    loadUsdtLinearPerps().catch(() => []),
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

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 pt-6 pb-8">
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
          error={firstSearchValue(params.paperError)}
      />
      <FuturesWorkingOrders
        signedIn={desk.signedIn}
        working={desk.working}
        next={FUTURES_PATHS.root}
        exchangeBook={desk.exchangeBook}
        baseCoinFor={(symbol) => baseCoinForPerpSymbol(symbol, pairs)}
        webhookNames={desk.webhookNames}
        emptyMessage={
          showTicket
            ? undefined
            : "No working limits. TradingView limit orders rest here. Limit close on an open row also appears here."
        }
      />
      <OpenFuturesTrades
        signedIn={desk.signedIn}
        open={open}
        exchangeBook={desk.exchangeBook}
        webhookNames={desk.webhookNames}
        emptyMessage={
          showTicket ? (
            <>
              No open futures on this book. Open from{" "}
              <Link href={FUTURES_PATHS.positions} className="text-accent">
                Positions
              </Link>
              .
            </>
          ) : (
            <>
              No open futures on this book. TradingView opens them through a{" "}
              <Link href={FUTURES_PATHS.webhooks} className="text-accent">
                webhook
              </Link>
              .
            </>
          )
        }
      />

      <p className="text-sm text-ink-faint">
        <Link href={FUTURES_PATHS.pairs} className="text-accent">
          Full pair list
        </Link>
        {" · "}
        Live Bybit public books. No API key.
      </p>
    </main>
  );
}
