import { CopyTextButton } from "@/components/copy-text-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  createFuturesWebhookAction,
  deleteFuturesWebhookAction,
  rotateFuturesWebhook,
} from "@/lib/futures/actions";
import type { FuturesWebhookRow } from "@/lib/futures/webhook-load";

export function FuturesWebhooksDesk({
  webhooks,
}: {
  webhooks: FuturesWebhookRow[];
}) {
  return (
    <div className="mt-6 space-y-4">
      {webhooks.map((hook) => (
        <section
          key={hook.id}
          className="max-w-lg space-y-3 rounded-card border border-line bg-surface p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">{hook.name}</p>
              <p className="text-xs text-ink-muted">
                {hook.kind === "signal"
                  ? "Signal — arm, disarm, or close-playbook"
                  : "Order — buy, sell, or close with size"}
              </p>
            </div>
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
              URL is stored but could not be shown. Set APP_BASE_URL or rotate.
            </p>
          )}
          <pre className="overflow-x-auto rounded-control border border-line bg-surface-raised px-3 py-2 text-xs text-ink-muted">
            {hook.kind === "signal"
              ? `{ "action": "arm" }`
              : `{
  "action": "buy",
  "symbol": "BTCUSDT",
  "size": "0.001",
  "sizeUnit": "qty",
  "id": "{{ticker}}{{timenow}}"
}`}
          </pre>
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
        </section>
      ))}

      <form
        action={createFuturesWebhookAction}
        className="max-w-lg space-y-3 rounded-card border border-line bg-surface p-5"
      >
        <p className="text-sm text-ink">New webhook</p>
        <label className="block text-sm text-ink">
          Name
          <input
            name="name"
            defaultValue="TradingView"
            maxLength={40}
            className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          />
        </label>
        <label className="block text-sm text-ink">
          Type
          <select
            name="kind"
            defaultValue="order"
            className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          >
            <option value="order">Order — TV sends symbol and size</option>
            <option value="signal">Signal — TV only arms or exits</option>
          </select>
        </label>
        <PendingSubmitButton
          pendingLabel="Creating…"
          successKey="create-futures-webhook"
          className="rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink"
        >
          Create URL
        </PendingSubmitButton>
      </form>
    </div>
  );
}
