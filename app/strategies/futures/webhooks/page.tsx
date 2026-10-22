import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { FuturesWebhooksDesk } from "@/components/futures-webhooks-desk";
import { FuturesWebhookTest } from "@/components/futures-webhook-test";
import { loginCanSendWebhookTest } from "@/lib/admin/emails";
import { getSessionContext } from "@/lib/auth/session";
import { deskAllowsOrderWebhooks, deskAllowsPerpsRecipes, deskAllowsSignalWebhooks, deskHref, deskHomePath } from "@/lib/accounts/model";
import { fetchBybitTickers } from "@/lib/exchanges/bybit/client";
import { loadUsdtLinearPerps } from "@/lib/exchanges/bybit/perp";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";
import {
  loadHyperliquidLinearPerps,
  loadHyperliquidTickerMap,
} from "@/lib/venues/hyperliquid/market";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { futuresWebhookOrigin } from "@/lib/futures/webhook";
import { listFuturesWebhooks } from "@/lib/futures/webhook-load";
import { loadBybitAgreementGate } from "@/lib/exchanges/agreement-store";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { firstSearchValue } from "@/lib/paper/open";
import { withMarketCapRank } from "@/lib/pairs/page";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Futures webhooks",
  description: "TradingView doors for this Futures book.",
};

export default async function FuturesWebhooksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  const href = (path: string) => deskHref(path, session?.account.id);
  const deskType = session?.account.deskType ?? "manual";
  const allowSignal = session
    ? deskAllowsSignalWebhooks(session.account)
    : deskAllowsSignalWebhooks(deskType);
  const allowOrder = session
    ? deskAllowsOrderWebhooks(session.account)
    : deskAllowsOrderWebhooks(deskType);
  const canTestWebhook = session ? loginCanSendWebhookTest(session.member) : false;
  const dummyLine = canTestWebhook ? "Send a dummy below. " : "";
  if (session && !allowSignal && !allowOrder) {
    redirect(deskHomePath(session.account, session.account.id));
  }
  const webhooks = session
    ? await listFuturesWebhooks({
        accountId: session.account.id,
        origin: futuresWebhookOrigin(await headers()),
      })
    : [];
  const testWebhooks = webhooks.filter((row) =>
    row.kind === "signal" ? allowSignal : allowOrder,
  );
  const settings = session
    ? await loadFuturesSettings(session.account.id)
    : { connectionId: null };
  const agreementGate = await loadBybitAgreementGate({
    connectionId: settings.connectionId,
    live: Boolean(
      session &&
        session.account.venue === "bybit" &&
        accountCanHoldConnections(session.account.mode),
    ),
  });
  const live = Boolean(
    session && accountCanHoldConnections(session.account.mode),
  );
  const hl = session?.account.venue === "hyperliquid";
  const env = hyperliquidInfoEnvironment(session?.account.venueEnvironment);
  const [tickers, pairs] = session
    ? await Promise.all([
        hl
          ? loadHyperliquidTickerMap(env).catch(
              () =>
                new Map<
                  string,
                  { lastPrice?: string; bid1Price?: string; ask1Price?: string }
                >(),
            )
          : fetchBybitTickers("linear").catch(
              () =>
                new Map<
                  string,
                  { lastPrice?: string; bid1Price?: string; ask1Price?: string }
                >(),
            ),
        hl
          ? loadHyperliquidLinearPerps(env).catch(() => []).then(withMarketCapRank)
          : loadUsdtLinearPerps().catch(() => []).then(withMarketCapRank),
      ])
    : [new Map<string, { lastPrice?: string }>(), []];
  const lastPrices: Record<string, number> = {};
  for (const [symbol, row] of tickers) {
    const last = Number(row.lastPrice);
    if (last > 0) {
      lastPrices[symbol] = last;
    }
  }
  const error =
    firstSearchValue(params.error) ?? firstSearchValue(params.paperError);
  const created = firstSearchValue(params.created) === "1";
  const renamed = firstSearchValue(params.renamed) === "1";
  const rotated = firstSearchValue(params.rotated) === "1";
  const deleted = firstSearchValue(params.deleted) === "1";

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Webhooks" />
      <p className="-mt-4 text-sm text-ink-muted">
        {allowSignal && allowOrder ? (
          <>
            Create a webhook and pick the type.{" "}
            <span className="text-ink">TradingView strategy</span> means TV
            sends every buy, sell, and close.{" "}
            <span className="text-ink">Signal</span> is just the entry ping —
            Automations When shows the webhook name.
            {hl ? " Strategy orders use the coin (BTC), not BTCUSDT." : ""} {dummyLine}A fill opens{" "}
            <Link href={href(FUTURES_PATHS.positions)} className="text-accent">
              Positions
            </Link>
            .
          </>
        ) : (session
            ? deskAllowsPerpsRecipes(session.account)
            : deskAllowsPerpsRecipes(deskType)) ? (
          <>
            Signal webhooks are a When trigger. Bind the name on Automations.
            Buy fires long entries and short exits. Sell fires short entries
            and long exits. The bot owns the size.
            {dummyLine}Fired orders open{" "}
            <Link href={href(FUTURES_PATHS.positions)} className="text-accent">
              Positions
            </Link>
            .
          </>
        ) : allowSignal ? (
          <>
            Signal webhooks fire the bound bot. Buy fires long entries and
            short exits. Sell fires short entries and long exits. The bot
            owns the size. {dummyLine}Fired orders open{" "}
            <Link href={href(FUTURES_PATHS.positions)} className="text-accent">
              Positions
            </Link>
            .
          </>
        ) : (
          <>
            TradingView sends buy, sell, and close on this URL.
            {hl ? " Use the coin symbol (BTC), not BTCUSDT." : ""} {dummyLine}A fill opens{" "}
            <Link href={href(FUTURES_PATHS.positions)} className="text-accent">
              Positions
            </Link>
            .
          </>
        )}
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {created ? (
        <p className="mt-4 rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">Webhook created.</p>
      ) : null}
      {renamed ? (
        <p className="mt-4 rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">Webhook renamed.</p>
      ) : null}
      {rotated ? (
        <p className="mt-4 rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          URL rotated. The previous URL no longer works.
        </p>
      ) : null}
      {deleted ? (
        <p className="mt-4 rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">Webhook deleted.</p>
      ) : null}
      {session ? (
        <div className="space-y-4">
          <FuturesWebhooksDesk
            webhooks={webhooks}
            allowSignal={allowSignal}
            allowOrder={allowOrder}
          />
          {canTestWebhook && testWebhooks.length > 0 ? (
            <div>
              <FuturesWebhookTest
                webhooks={testWebhooks}
                allowSignal={allowSignal}
                signalFiresRecipes={
                  session
                    ? deskAllowsPerpsRecipes(session.account)
                    : deskAllowsPerpsRecipes(deskType)
                }
                standalone
                next={href(FUTURES_PATHS.webhooks)}
                successNext={href(FUTURES_PATHS.positions)}
                pairs={pairs}
                lastPrices={lastPrices}
                defaultSymbol={hl ? "BTC" : undefined}
                agreementGate={agreementGate}
              />
              {live && !settings.connectionId ? (
                <p className="mt-2 text-xs text-warning">
                  Bind an exchange in Desk Settings before a webhook test
                  places venue orders.
                </p>
              ) : null}
            </div>
          ) : canTestWebhook ? (
            <p className="text-sm text-ink-muted">
              Create a webhook above to send a dummy TradingView call.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-6 text-sm text-ink-muted">
          <Link href="/sign-in" className="text-accent">
            Sign in
          </Link>{" "}
          to create webhooks.
        </p>
      )}
    </main>
  );
}
