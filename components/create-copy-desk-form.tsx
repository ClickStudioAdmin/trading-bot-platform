"use client";

import { useState } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { createCopyDeskAction } from "@/lib/copy/actions";
import { formatAccountModeChoice } from "@/lib/accounts/model";
import { formatConnectionSummary, type ExchangeConnection } from "@/lib/exchanges/connections";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function CreateCopyDeskForm({
  parentAccountId,
  defaultName,
  stamp,
  connections,
}: {
  parentAccountId: string;
  defaultName: string;
  stamp: string;
  connections: ExchangeConnection[];
}) {
  const [mode, setMode] = useState<"paper" | "live">("paper");
  return (
    <form action={createCopyDeskAction} className="space-y-4 rounded-card border border-line bg-surface p-5">
      <input type="hidden" name="parentAccountId" value={parentAccountId} />
      <p className="text-xs text-ink-faint">{stamp}</p>
      <label className="block text-sm text-ink">
        Desk name
        <input
          type="text"
          name="name"
          required
          maxLength={40}
          defaultValue={defaultName}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm text-ink">
        Scale
        <span className="relative mt-1 block">
          <input
            type="text"
            name="scale"
            inputMode="decimal"
            defaultValue="10"
            className="w-full rounded-control border border-line bg-surface-raised py-2 pr-10 pl-3 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-muted">
            %
          </span>
        </span>
        <span className="mt-1 block text-xs text-ink-faint">
          Percent of the parent fill notional. Caps on this desk still win.
        </span>
      </label>
      <label className="block text-sm text-ink">
        Mode
        <select
          name="mode"
          value={mode}
          onChange={(event) =>
            setMode(event.target.value === "live" ? "live" : "paper")
          }
          className={fieldClass}
        >
          <option value="paper">{formatAccountModeChoice("paper")}</option>
          <option value="live">{formatAccountModeChoice("live")}</option>
        </select>
      </label>
      {mode === "live" ? (
        connections.length > 0 ? (
          <label className="block text-sm text-ink">
            Exchange connection
            <select name="exchangeConnectionId" className={fieldClass}>
              <option value="">Bind later in Desk Settings</option>
              {connections.map((row) => (
                <option key={row.id} value={row.id}>
                  {formatConnectionSummary(row)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm text-ink-muted">
            No matching key on this login. Bind later in Desk Settings.
          </p>
        )
      ) : (
        <p className="text-sm text-ink-muted">
          Paper copies stay on the in-app ledger. Venue is stamped from the
          parent.
        </p>
      )}
      <PendingSubmitButton
        pendingLabel="Creating…"
        successKey="create-copy-desk"
        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
      >
        Create copy desk
      </PendingSubmitButton>
    </form>
  );
}
