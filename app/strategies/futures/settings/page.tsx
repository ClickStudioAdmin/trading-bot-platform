import type { Metadata } from "next";
import Link from "next/link";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { StrategyDetachControl } from "@/components/strategy-detach-control";
import { strategyDetachBlockers } from "@/lib/accounts/model";
import { loadAccountUsage } from "@/lib/accounts/store";
import {
  formatConnectionSummary,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { CopyTextButton } from "@/components/copy-text-button";
import {
  detachFuturesConnection,
  disableFuturesWebhook,
  rotateFuturesWebhook,
  saveFuturesSettings,
} from "@/lib/futures/actions";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { futuresWebhookOrigin } from "@/lib/futures/webhook";
import { loadFuturesWebhookSettings } from "@/lib/futures/webhook-load";
import { firstSearchValue } from "@/lib/paper/open";
import { getSessionContext } from "@/lib/auth/session";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Futures settings",
  description: "Futures strategy settings.",
};

export default async function FuturesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const params = await searchParams;
  const settings = await loadFuturesSettings(session.account.id);
  const webhook = await loadFuturesWebhookSettings({
    accountId: session.account.id,
    origin: futuresWebhookOrigin(await headers()),
  });
  const live = accountCanHoldConnections(session.account.mode);
  const connections = live
    ? await listExchangeConnections(session.member.id, session.account.id)
    : [];
  const selected =
    connections.find((row) => row.id === settings.connectionId) ?? null;
  const usage = live
    ? (await loadAccountUsage([session.account])).get(session.account.id)
    : null;
  const detachBlocked =
    Boolean(selected) &&
    strategyDetachBlockers({
      openCount: usage?.futuresOpenCount ?? 0,
      automationsRunning: false,
    }).length > 0;
  const saved = firstSearchValue(params.saved) === "1";
  const webhookSaved = firstSearchValue(params.webhook) === "1";
  const webhookOff = firstSearchValue(params.webhookOff) === "1";
  const error = firstSearchValue(params.error);

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Strategy Settings" />
      <p className="-mt-4 text-sm text-ink-muted">
        Strategy-wide knobs. Automations stay on their own page. Bind the Bybit
        key this strategy uses — cash-and-carry has its own bind. TradingView
        posts to the webhook on this book.
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 text-sm text-success">Settings saved.</p>
      ) : null}
      {webhookSaved ? (
        <p className="mt-4 text-sm text-success">
          Webhook URL created. The previous URL no longer works.
        </p>
      ) : null}
      {webhookOff ? (
        <p className="mt-4 text-sm text-success">Webhook disabled.</p>
      ) : null}
      <form
        action={saveFuturesSettings}
        className="mt-6 max-w-lg space-y-4 rounded-card border border-line bg-surface p-5"
      >
        {live ? (
          <ExchangeBindField
            connections={connections}
            selectedId={settings.connectionId}
            selected={selected}
            detachBlocked={detachBlocked}
          />
        ) : (
          <p className="text-sm text-ink-muted">
            This is a Paper Trading book. Orders stay on the in-app ledger.
          </p>
        )}
        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="reduceOnly"
            defaultChecked={settings.reduceOnly}
            className="mt-0.5"
          />
          <span>
            Reduce only
            <span className="mt-1 block text-xs text-ink-muted">
              Blocks Buy and Sell. Close still works.
            </span>
          </span>
        </label>
        <div className="space-y-3 border-t border-line pt-4">
          <p className="text-sm text-ink">Risk caps</p>
          <p className="text-xs text-ink-muted">
            Empty means no cap. Buy and Sell reject if they would breach. Close
            is never blocked.
          </p>
          <label className="block text-sm text-ink">
            Max value per symbol
            <span className="relative mt-1 block">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
                $
              </span>
              <GroupedNumberInput
                name="maxValuePerSymbol"
                defaultValue={
                  settings.maxValuePerSymbol === null
                    ? ""
                    : String(settings.maxValuePerSymbol)
                }
                allowDecimal
                placeholder="No cap"
                ariaLabel="Max value per symbol"
                className="w-full rounded-control border border-line bg-surface-raised py-2 pr-3 pl-7 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
              />
            </span>
          </label>
          <label className="block text-sm text-ink">
            Max open positions
            <GroupedNumberInput
              name="maxOpenPositions"
              defaultValue={
                settings.maxOpenPositions === null
                  ? ""
                  : String(settings.maxOpenPositions)
              }
              placeholder="No cap"
              className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
            />
          </label>
        </div>
        <PendingSubmitButton
          pendingLabel="Saving…"
          successKey="save-futures-settings"
          className="rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink"
        >
          Save settings
        </PendingSubmitButton>
      </form>
      <WebhookSettingsCard webhook={webhook} />
    </main>
  );
}

function WebhookSettingsCard({
  webhook,
}: {
  webhook: { enabled: boolean; url: string | null };
}) {
  const example = `{
  "action": "buy",
  "symbol": "BTCUSDT",
  "size": "0.001",
  "sizeUnit": "qty",
  "id": "{{ticker}}{{timenow}}"
}`;

  return (
    <section className="mt-6 max-w-lg space-y-4 rounded-card border border-line bg-surface p-5">
      <p className="text-sm text-ink">TradingView webhook</p>
      <p className="text-xs text-ink-muted">
        POST JSON to this URL. The path is the secret. Use buy, sell, or close.
        Arm, disarm, and close-playbook are accepted and logged. Do not send a
        Bybit dump. Paper writes the ledger only. Live uses the Futures bind.
      </p>
      {webhook.url ? (
        <div className="space-y-2">
          <label className="block text-sm text-ink">
            URL
            <input
              readOnly
              value={webhook.url}
              className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 font-mono text-xs text-ink focus:border-line-strong focus:outline-none"
            />
          </label>
          <CopyTextButton text={webhook.url} label="Copy URL" />
        </div>
      ) : webhook.enabled ? (
        <p className="text-sm text-ink-muted">
          The URL is stored but could not be shown. Set APP_BASE_URL or rotate
          the token.
        </p>
      ) : (
        <p className="text-sm text-ink-muted">
          No webhook on this book yet.
        </p>
      )}
      <pre className="overflow-x-auto rounded-control border border-line bg-surface-raised px-3 py-2 text-xs text-ink-muted">
        {example}
      </pre>
      <div className="flex flex-wrap gap-2">
        <form action={rotateFuturesWebhook}>
          <PendingSubmitButton
            pendingLabel="Saving…"
            successKey="rotate-futures-webhook"
            className="rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink"
          >
            {webhook.enabled ? "Rotate URL" : "Create URL"}
          </PendingSubmitButton>
        </form>
        {webhook.enabled ? (
          <form action={disableFuturesWebhook}>
            <PendingSubmitButton
              pendingLabel="Disabling…"
              successKey="disable-futures-webhook"
              className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink"
            >
              Disable
            </PendingSubmitButton>
          </form>
        ) : null}
      </div>
    </section>
  );
}

function ExchangeBindField({
  connections,
  selectedId,
  selected,
  detachBlocked,
}: {
  connections: ExchangeConnection[];
  selectedId: string | null;
  selected: ExchangeConnection | null;
  detachBlocked: boolean;
}) {
  if (connections.length === 0) {
    return (
      <div>
        <p className="text-sm text-ink">Exchange</p>
        <p className="mt-1 text-sm text-ink-muted">
          Connect an exchange to start trading.{" "}
          <Link
            href="/account/exchanges"
            className="text-accent hover:text-accent-strong"
          >
            Exchanges
          </Link>
        </p>
      </div>
    );
  }

  const options = connections.filter(
    (row) => row.status === "active" || row.id === selectedId,
  );

  return (
    <div>
      <p className="text-sm text-ink">Exchange</p>
      <select
        name="exchangeConnectionId"
        defaultValue={selectedId ?? "none"}
        className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
      >
        {selected ? null : <option value="none">None</option>}
        {options.map((row) => (
          <option key={row.id} value={row.id}>
            {formatConnectionSummary(row)}
            {row.status === "invalid" ? " (Invalid)" : ""}
          </option>
        ))}
      </select>
      {selected ? (
        <div className="mt-2">
          <StrategyDetachControl
            blocked={detachBlocked}
            detachAction={detachFuturesConnection}
          />
        </div>
      ) : null}
    </div>
  );
}
