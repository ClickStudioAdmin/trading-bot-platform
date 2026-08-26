import { CopyTextButton } from "@/components/copy-text-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  createFuturesWebhookAction,
  deleteFuturesWebhookAction,
  renameFuturesWebhookAction,
  rotateFuturesWebhook,
} from "@/lib/futures/actions";
import type { FuturesWebhookRow } from "@/lib/futures/webhook-load";

const STRATEGY_PAYLOADS = [
  {
    label: "Buy",
    text: `{
  "action": "buy",
  "symbol": "BTCUSDT",
  "size": "0.001",
  "sizeUnit": "qty",
  "id": "{{ticker}}{{timenow}}"
}`,
  },
  {
    label: "Sell",
    text: `{
  "action": "sell",
  "symbol": "BTCUSDT",
  "size": "0.001",
  "sizeUnit": "qty",
  "id": "{{ticker}}{{timenow}}"
}`,
  },
  {
    label: "Close",
    text: `{
  "action": "close",
  "symbol": "BTCUSDT",
  "id": "{{ticker}}{{timenow}}"
}`,
  },
] as const;

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
              required
              maxLength={40}
              placeholder="Name this webhook"
              autoComplete="off"
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
          className="space-y-5 rounded-card border border-line bg-surface p-5"
        >
          {hook.url ? (
            <label className="block text-sm text-ink">
              URL
              <span className="mt-1 flex items-center gap-3">
                <textarea
                  readOnly
                  rows={2}
                  value={hook.url}
                  className="min-w-0 flex-1 resize-none break-all rounded-control border border-line bg-surface-raised px-3 py-2 font-mono text-xs leading-5 text-ink focus:border-line-strong focus:outline-none"
                />
                <span className="shrink-0">
                  <CopyTextButton text={hook.url} label="Copy URL" />
                </span>
              </span>
            </label>
          ) : (
            <p className="text-sm text-ink-muted">
              URL is stored but could not be shown. Set APP_BASE_URL or rotate.
            </p>
          )}
          <div className="space-y-3">
            <form
              action={renameFuturesWebhookAction}
              className="flex flex-wrap items-end gap-x-4 gap-y-3"
            >
              <input type="hidden" name="webhookId" value={hook.id} />
              <label className="min-w-[12rem] flex-1 text-sm text-ink">
                Name
                <input
                  name="name"
                  defaultValue={hook.name}
                  required
                  maxLength={40}
                  className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
                />
              </label>
              <PendingSubmitButton
                pendingLabel="Saving…"
                successKey={`rename-webhook-${hook.id}`}
                className="rounded-control border border-line bg-surface-raised px-3 py-2 text-xs font-medium text-ink"
              >
                Save name
              </PendingSubmitButton>
            </form>
            <p className="text-xs text-ink-muted">
              {hook.kind === "signal"
                ? "Signal — Automations When shows this name"
                : "TradingView strategy — same URL, one alert message per action"}
            </p>
          </div>
          {hook.kind === "signal" ? (
            <PayloadSample label="Arm" text={SIGNAL_PAYLOAD} />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-ink-muted">
                Paste one of these into each TradingView alert. Sell opens or
                adds a short. Close exits the open row.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {STRATEGY_PAYLOADS.map((sample) => (
                  <PayloadSample
                    key={sample.label}
                    label={sample.label}
                    text={sample.text}
                  />
                ))}
              </div>
            </div>
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
        </section>
      ))}
    </div>
  );
}

function PayloadSample({ label, text }: { label: string; text: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">{label}</p>
        <CopyTextButton text={text} label="Copy" />
      </div>
      <pre className="overflow-x-auto rounded-control border border-line bg-surface-raised px-3 py-2 font-mono text-xs whitespace-pre text-ink-muted">
        {text}
      </pre>
    </div>
  );
}
