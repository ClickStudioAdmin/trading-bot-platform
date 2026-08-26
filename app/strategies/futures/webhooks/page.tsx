import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { FuturesWebhooksDesk } from "@/components/futures-webhooks-desk";
import { FuturesWebhookTest } from "@/components/futures-webhook-test";
import { getSessionContext } from "@/lib/auth/session";
import { deskAllowsSignalWebhooks } from "@/lib/accounts/model";
import { fetchBybitTickers } from "@/lib/exchanges/bybit/client";
import { loadUsdtLinearPerps } from "@/lib/exchanges/bybit/perp";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { futuresWebhookOrigin } from "@/lib/futures/webhook";
import { listFuturesWebhooks } from "@/lib/futures/webhook-load";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { firstSearchValue } from "@/lib/paper/open";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { headers } from "next/headers";

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
  const allowSignal = deskAllowsSignalWebhooks(
    session?.account.deskType ?? "perps",
  );
  const webhooks = session
    ? await listFuturesWebhooks({
        accountId: session.account.id,
        origin: futuresWebhookOrigin(await headers()),
      })
    : [];
  const testWebhooks = allowSignal
    ? webhooks
    : webhooks.filter((row) => row.kind !== "signal");
  const settings = session
    ? await loadFuturesSettings(session.account.id)
    : { connectionId: null };
  const live = Boolean(
    session && accountCanHoldConnections(session.account.mode),
  );
  const [tickers, pairs] = session
    ? await Promise.all([
        fetchBybitTickers("linear").catch(
          () =>
            new Map<
              string,
              { lastPrice?: string; bid1Price?: string; ask1Price?: string }
            >(),
        ),
        loadUsdtLinearPerps().catch(() => []),
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
        {allowSignal ? (
          <>
            Create a webhook and pick the type.{" "}
            <span className="text-ink">TradingView strategy</span> means TV
            sends every buy, sell, and close.{" "}
            <span className="text-ink">Signal</span> is just the entry ping —
            Automations When shows the webhook name. Send a dummy below. A fill
            opens{" "}
            <Link href={FUTURES_PATHS.positions} className="text-accent">
              Positions
            </Link>
            .
          </>
        ) : (
          <>
            TradingView sends buy, sell, and close on this URL. Send a dummy
            below. A fill opens{" "}
            <Link href={FUTURES_PATHS.positions} className="text-accent">
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
        <p className="mt-4 text-sm text-success">Webhook created.</p>
      ) : null}
      {renamed ? (
        <p className="mt-4 text-sm text-success">Webhook renamed.</p>
      ) : null}
      {rotated ? (
        <p className="mt-4 text-sm text-success">
          URL rotated. The previous URL no longer works.
        </p>
      ) : null}
      {deleted ? (
        <p className="mt-4 text-sm text-success">Webhook deleted.</p>
      ) : null}
      {session ? (
        <div className="space-y-4">
          <FuturesWebhooksDesk webhooks={webhooks} allowSignal={allowSignal} />
          {testWebhooks.length > 0 ? (
            <div>
              <FuturesWebhookTest
                webhooks={testWebhooks}
                allowSignal={allowSignal}
                standalone
                next={FUTURES_PATHS.webhooks}
                successNext={FUTURES_PATHS.positions}
                pairs={pairs}
                lastPrices={lastPrices}
              />
              {live && !settings.connectionId ? (
                <p className="mt-2 text-xs text-warning">
                  Bind an exchange in Desk Settings before a webhook test
                  places venue orders.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              Create a webhook above to send a dummy TradingView call.
            </p>
          )}
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
