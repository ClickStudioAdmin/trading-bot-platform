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
      <p className="text-sm text-ink-muted">
        Size matches the parent’s fill as a share of their balance, applied to
        yours. A $10,000 fill on a $100,000 book becomes $1,000 on a $10,000
        book. Caps on this desk still win. Balances are read when the fill
        copies.
      </p>
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
