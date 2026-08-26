"use client";

import { useState } from "react";
import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { createTradingAccount } from "@/lib/accounts/actions";
import {
  formatAccountModeChoice,
  formatDeskTypeChoice,
} from "@/lib/accounts/model";
import {
  formatConnectionSummary,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function CreateAccountForm({
  connections,
}: {
  connections: ExchangeConnection[];
}) {
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const liveKeys = connections.filter((row) => row.status === "active");

  return (
    <form
      action={createTradingAccount}
      className="mt-6 space-y-4 rounded-card border border-line bg-surface p-5"
    >
      <h2 className="text-lg font-semibold tracking-tight">New desk</h2>
      <input type="hidden" name="next" value="/account/sub-accounts" />
      <label className="block text-xs text-ink-muted">
        Name
        <input name="name" required maxLength={40} className={fieldClass} />
      </label>
      <label className="block text-xs text-ink-muted">
        Type
        <select
          name="deskType"
          defaultValue="cash_and_carry"
          className={fieldClass}
        >
          <option value="cash_and_carry">
            {formatDeskTypeChoice("cash_and_carry")}
          </option>
          <option value="perps">{formatDeskTypeChoice("perps")}</option>
          <option value="signal_follower">
            {formatDeskTypeChoice("signal_follower")}
          </option>
        </select>
      </label>
      <label className="block text-xs text-ink-muted">
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
        liveKeys.length > 0 ? (
          <label className="block text-xs text-ink-muted">
            Exchange key
            <select
              name="exchangeConnectionId"
              defaultValue="none"
              className={fieldClass}
            >
              <option value="none">Bind later in Strategy Settings</option>
              {liveKeys.map((row) => (
                <option key={row.id} value={row.id}>
                  {formatConnectionSummary(row)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm text-ink-muted">
            No keys saved yet.{" "}
            <Link
              href="/account/exchanges"
              className="text-accent hover:text-accent-strong"
            >
              Add a key on Exchanges
            </Link>{" "}
            first, or bind later in Strategy Settings.
          </p>
        )
      ) : null}
      <p className="text-sm text-ink-muted">
        Paper Trading uses live market data and fills on the in-app ledger.
        No real trades. Connected Exchange binds a key from this login (Bybit
        Demo or production). Mode and type are set at create and never change.
        Two desks on the same exchange key still share venue margin. Isolation
        needs another trade-only key.
      </p>
      <PendingSubmitButton
        pendingLabel="Creating…"
        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
      >
        Create desk
      </PendingSubmitButton>
    </form>
  );
}
