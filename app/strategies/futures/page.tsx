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
import { firstSearchValue } from "@/lib/paper/open";
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
  const [tickers, pairs] = await Promise.all([
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
  ]);
  const open = markFuturesOpen(desk.open, tickers, (symbol) =>
    baseCoinForPerpSymbol(symbol, pairs),
  );

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 pt-6 pb-8">
      <FuturesFlash
        opened={firstSearchValue(params.paper) === "opened"}
        added={firstSearchValue(params.paper) === "added"}
        closed={firstSearchValue(params.paper) === "closed"}
        working={firstSearchValue(params.paper) === "working"}
        cancelled={firstSearchValue(params.paper) === "cancelled"}
        liveOpened={firstSearchValue(params.paper) === "live-opened"}
        liveAdded={firstSearchValue(params.paper) === "live-added"}
        liveClosed={firstSearchValue(params.paper) === "live-closed"}
          liveWorking={firstSearchValue(params.paper) === "live-working"}
          tpsl={firstSearchValue(params.paper) === "tpsl"}
          liveTpsl={firstSearchValue(params.paper) === "live-tpsl"}
          error={firstSearchValue(params.paperError)}
      />
      <FuturesWorkingOrders
        signedIn={desk.signedIn}
        working={desk.working}
        next={FUTURES_PATHS.root}
        exchangeBook={desk.exchangeBook}
        baseCoinFor={(symbol) => baseCoinForPerpSymbol(symbol, pairs)}
      />
      <OpenFuturesTrades
        signedIn={desk.signedIn}
        open={open}
        exchangeBook={desk.exchangeBook}
        emptyMessage={
          <>
            No open futures on this book. Open from{" "}
            <Link href={FUTURES_PATHS.positions} className="text-accent">
              Positions
            </Link>
            .
          </>
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
