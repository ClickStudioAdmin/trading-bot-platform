import Link from "next/link";
import { LiveTickerScope } from "@/components/live-ticker";
import { OpenFuturesTrades } from "@/components/futures-blotter";
import { FuturesWorkingOrders } from "@/components/futures-working";
import { HyperliquidDeskFlash } from "@/components/venues/hyperliquid/desk-flash";
import { getSessionContext } from "@/lib/auth/session";
import { deskAllowsManualPerpTicket, deskHref } from "@/lib/accounts/model";
import { dcaHintsForOpen } from "@/lib/dca/playbook";
import { listDcaPlaybooksForAccount } from "@/lib/dca/store";
import { loadFuturesDesk } from "@/lib/futures/list";
import { markFuturesOpen } from "@/lib/futures/mark";
import { reconcileOpenFuturesBooks } from "@/lib/futures/reconcile";
import { loadFuturesVenueRisk } from "@/lib/futures/venue-risk-load";
import { attachFuturesVenueRisk } from "@/lib/futures/venue-risk";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";
import {
  loadHyperliquidLinearPerps,
  loadHyperliquidTickerMap,
} from "@/lib/venues/hyperliquid/market";
import { baseCoinForPerpSymbol } from "@/lib/exchanges/bybit/perp";

export async function HyperliquidFuturesOverview({
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
  const deskType = session?.account.deskType ?? "perps";
  const href = (path: string) => deskHref(path, session?.account.id);
  const next = href(FUTURES_PATHS.root);
  const showTicket = deskAllowsManualPerpTicket(deskType);
  const dca = deskType === "dca";
  const playbooks =
    dca && session
      ? await listDcaPlaybooksForAccount(session.account.id)
      : [];
  const env = hyperliquidInfoEnvironment(session?.account.venueEnvironment);
  const [tickers, pairs, venueRisk] = await Promise.all([
    desk.open.length > 0
      ? loadHyperliquidTickerMap(env).catch(
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
  const dcaHints = dca
    ? dcaHintsForOpen(playbooks, open, desk.working)
    : undefined;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 pt-6 pb-8">
      <HyperliquidDeskFlash params={params} />
      <FuturesWorkingOrders
        signedIn={desk.signedIn}
        working={desk.working}
        next={next}
        exchangeBook={desk.exchangeBook}
        baseCoinFor={(symbol) => baseCoinForPerpSymbol(symbol, pairs)}
        webhookNames={desk.webhookNames}
        playbookOwnsOrders={dca}
        exchangeName="Hyperliquid"
        emptyMessage={
          showTicket
            ? undefined
            : dca
              ? "No working limits. Bot orders rest here when they are limits."
              : "No working limits. TradingView limit orders rest here. Limit close on an open row also appears here."
        }
      />
      <LiveTickerScope
        symbols={open.map((row) => row.symbol)}
        venue="hyperliquid"
        environment={session?.account.venueEnvironment}
      >
        <OpenFuturesTrades
          signedIn={desk.signedIn}
          open={open}
          next={href(FUTURES_PATHS.positions)}
          exchangeBook={desk.exchangeBook}
          webhookNames={desk.webhookNames}
          showDcaColumns={dca}
          playbookOwnsOrders={dca}
          dcaHints={dcaHints}
          positionsHref={href(FUTURES_PATHS.positions)}
          emptyMessage={
            showTicket ? (
              <>
                No open futures on this book. Open from{" "}
                <Link
                  href={href(FUTURES_PATHS.positions)}
                  className="text-accent"
                >
                  Positions
                </Link>
                .
              </>
            ) : dca ? (
              <>
                No open futures on this book. The bot adds orders once it is
                armed on{" "}
                <Link
                  href={href(FUTURES_PATHS.automations)}
                  className="text-accent"
                >
                  Automations
                </Link>
                .
              </>
            ) : (
              <>
                No open futures on this book. TradingView opens them through a{" "}
                <Link href={href(FUTURES_PATHS.webhooks)} className="text-accent">
                  webhook
                </Link>
                .
              </>
            )
          }
        />
      </LiveTickerScope>

      <p className="text-sm text-ink-faint">
        <Link href={href(FUTURES_PATHS.pairs)} className="text-accent">
          Full pair list
        </Link>
        {" · "}
        Live Hyperliquid public books. No agent key.
      </p>
    </main>
  );
}
