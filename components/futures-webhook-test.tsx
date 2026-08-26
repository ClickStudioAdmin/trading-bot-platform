"use client";

import { useMemo, useState } from "react";
import { FuturesOrderTicket } from "@/components/futures-order-ticket";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { testFuturesWebhook } from "@/lib/futures/actions";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import type { FuturesWebhookRow } from "@/lib/futures/webhook-load";

export function FuturesWebhookTest({
  webhooks,
  allowSignal = true,
  signalFiresRecipes = true,
  standalone = false,
  next,
  successNext,
  pairs = [],
  lastPrices = {},
}: {
  webhooks: Pick<FuturesWebhookRow, "id" | "name" | "kind">[];
  allowSignal?: boolean;
  signalFiresRecipes?: boolean;
  standalone?: boolean;
  next?: string;
  successNext?: string;
  pairs?: LinearPerp[];
  lastPrices?: Record<string, number>;
}) {
  const [webhookId, setWebhookId] = useState(webhooks[0]?.id ?? "");
  const selected = useMemo(
    () => webhooks.find((row) => row.id === webhookId) ?? webhooks[0],
    [webhookId, webhooks],
  );
  const signal = selected?.kind === "signal";
  const help = standalone
    ? [
        "Posts through the same door as TradingView.",
        signal ? null : "Symbol and size go in the dummy payload.",
        signal
          ? signalFiresRecipes
            ? "A Signal test arms and fires any automation that uses that webhook."
            : "A Signal test sends arm, disarm, or close-playbook through this door."
          : null,
        signal ? null : "A fill opens Positions.",
      ]
        .filter(Boolean)
        .join(" ")
    : [
        "Posts through the same door as TradingView.",
        "A TradingView strategy test uses the symbol and size above.",
        allowSignal
          ? signalFiresRecipes
            ? "A Signal test arms and fires any automation that uses that webhook."
            : "A Signal test sends arm, disarm, or close-playbook through this door."
          : null,
      ]
        .filter(Boolean)
        .join(" ");
  const fields = (
    <>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {successNext ? (
        <input type="hidden" name="successNext" value={successNext} />
      ) : null}
      {standalone ? (
        <div className="mb-4">
          <p className="text-sm text-ink">Send a Webhook</p>
          <p className="mt-1 text-sm text-ink-muted">{help}</p>
        </div>
      ) : null}
      {standalone && !signal ? (
        <FuturesOrderTicket
          options={pairs}
          lastPrices={lastPrices}
          includeStops={false}
        />
      ) : null}
      <div className={standalone ? "mt-4 space-y-2" : "mt-4 space-y-2 border-t border-line pt-4"}>
        {standalone ? null : (
          <>
            <p className="text-sm text-ink">Send a test</p>
            <p className="text-xs text-ink-muted">{help}</p>
          </>
        )}
        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-4">
          <label className="block min-w-[14rem] flex-1 text-sm text-ink">
            Webhook
            <select
              name="webhookId"
              value={webhookId}
              onChange={(event) => setWebhookId(event.target.value)}
              className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
            >
              {webhooks.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} (
                  {row.kind === "signal"
                    ? "Signal"
                    : "TradingView strategy"}
                  )
                </option>
              ))}
            </select>
          </label>
          <label className="block w-40 shrink-0 text-sm text-ink">
            Send as
            <select
              key={selected?.kind ?? "order"}
              name="testAction"
              defaultValue={signal ? "arm" : "buy"}
              className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
            >
              {signal ? (
                <>
                  <option value="arm">Arm</option>
                  <option value="disarm">Disarm</option>
                  <option value="close-playbook">Close playbook</option>
                </>
              ) : (
                <>
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                  <option value="close">Close</option>
                </>
              )}
            </select>
          </label>
          <PendingSubmitButton
            formAction={standalone ? undefined : testFuturesWebhook}
            pendingLabel="Sending…"
            successKey="test-futures-webhook"
            className="rounded-control bg-accent-strong px-4 py-2 text-xs font-medium text-ink"
          >
            Send test
          </PendingSubmitButton>
        </div>
      </div>
    </>
  );

  if (!standalone) {
    return fields;
  }

  return (
    <form
      action={testFuturesWebhook}
      className="rounded-card border border-line bg-surface p-5"
    >
      {fields}
    </form>
  );
}
