import { CopyTextButton } from "@/components/copy-text-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  createFuturesWebhookAction,
  deleteFuturesWebhookAction,
  rotateFuturesWebhook,
} from "@/lib/futures/actions";
import type { FuturesWebhookRow } from "@/lib/futures/webhook-load";

const STRATEGY_PAYLOAD = `{
  "action": "buy",
  "symbol": "BTCUSDT",
  "size": "0.001",
  "sizeUnit": "qty",
  "id": "{{ticker}}{{timenow}}"
}`;

const SIGNAL_PAYLOAD = `{
  "action": "arm"
}`;

export function FuturesWebhooksDesk({
  webhooks,
}: {
  webhooks: FuturesWebhookRow[];
}) {
  return (
    <div className="mt-6 space-y-4">
      <form
        action={createFuturesWebhookAction}
        className="rounded-card border border-line bg-surface p-5"
      >
        <p className="text-sm text-ink">Create webhook</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-[12rem] flex-1 text-sm text-ink">
            Name
            <input
              name="name"
              defaultValue="TradingView"
              maxLength={40}
              className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
            />
          </label>
          <label className="min-w-[16rem] flex-[1.4] text-sm text-ink">
            Type
            <select
              name="kind"
              defaultValue="order"
              className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
            >
              <option value="order">
                TradingView strategy — TV controls the orders
              </option>
              <option value="signal">
                Signal — entry condition on an automation
              </option>
            </select>
          </label>
          <PendingSubmitButton
            pendingLabel="Creating…"
            successKey="create-futures-webhook"
            className="rounded-control bg-accent-strong px-3 py-2 text-xs font-medium text-ink"
          >
            Create webhook
          </PendingSubmitButton>
        </div>
      </form>

      {webhooks.map((hook) => (
        <section
          key={hook.id}
          className="rounded-card border border-line bg-surface p-5"
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-ink">{hook.name}</p>
                <p className="text-xs text-ink-muted">
                  {hook.kind === "signal"
                    ? "Signal — add this as the When on an automation"
                    : "TradingView strategy — TV sends every buy, sell, and close"}
                </p>
              </div>
              {hook.url ? (
                <div className="space-y-2">
                  <label className="block text-sm text-ink">
                    URL
                    <input
                      readOnly
                      value={hook.url}
                      className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 font-mono text-xs text-ink focus:border-line-strong focus:outline-none"
                    />
                  </label>
                  <CopyTextButton text={hook.url} label="Copy URL" />
                </div>
              ) : (
                <p className="text-sm text-ink-muted">
                  URL is stored but could not be shown. Set APP_BASE_URL or
                  rotate.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <form action={rotateFuturesWebhook}>
                  <input type="hidden" name="webhookId" value={hook.id} />
                  <PendingSubmitButton
                    pendingLabel="Rotating…"
                    successKey={`rotate-webhook-${hook.id}`}
                    className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink"
                  >
                    Rotate URL
                  </PendingSubmitButton>
                </form>
                <form action={deleteFuturesWebhookAction}>
                  <input type="hidden" name="webhookId" value={hook.id} />
                  <PendingSubmitButton
                    pendingLabel="Deleting…"
                    successKey={`delete-webhook-${hook.id}`}
                    className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink"
                  >
                    Delete
                  </PendingSubmitButton>
                </form>
              </div>
            </div>
            <pre className="overflow-x-auto rounded-control border border-line bg-surface-raised px-3 py-2 font-mono text-xs whitespace-pre text-ink-muted">
              {hook.kind === "signal" ? SIGNAL_PAYLOAD : STRATEGY_PAYLOAD}
            </pre>
          </div>
        </section>
      ))}
    </div>
  );
}
