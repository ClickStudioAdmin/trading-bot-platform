"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { createTradingAccount } from "@/lib/accounts/actions";
import {
  formatAccountModeChoice,
  formatDeskTypeChoice,
} from "@/lib/accounts/model";
import {
  formatConnectionSummary,
  sharedKeyWarningKind,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import { SharedKeyWarning } from "@/components/shared-key-warning";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function CreateAccountForm({
  connections,
  sharedConnectionIds = [],
  next,
  embedded = false,
  onCancel,
}: {
  connections: ExchangeConnection[];
  sharedConnectionIds?: string[];
  next?: string;
  embedded?: boolean;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [bindChoice, setBindChoice] = useState<"later" | "existing">("later");
  const [connectionId, setConnectionId] = useState("");
  const liveKeys = connections.filter((row) => row.status === "active");
  const stayPath = usePathname();
  const warningKind =
    bindChoice === "existing"
      ? sharedKeyWarningKind({
          connectionId,
          sharedConnectionIds,
        })
      : null;

  return (
    <form
      action={createTradingAccount}
      className={
        embedded
          ? "mt-4 space-y-4"
          : "mt-6 space-y-4 rounded-card border border-line bg-surface p-5"
      }
    >
      {embedded ? null : (
        <h2 className="text-lg font-semibold tracking-tight">New desk</h2>
      )}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {embedded ? (
        <input type="hidden" name="stayPath" value={stayPath} />
      ) : null}
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
          <option value="dca">{formatDeskTypeChoice("dca")}</option>
        </select>
      </label>
      <label className="block text-xs text-ink-muted">
        Mode
        <select
          name="mode"
          value={mode}
          onChange={(event) => {
            const nextMode = event.target.value === "live" ? "live" : "paper";
            setMode(nextMode);
            if (nextMode !== "live") {
              setBindChoice("later");
              setConnectionId("");
            }
          }}
          className={fieldClass}
        >
          <option value="paper">{formatAccountModeChoice("paper")}</option>
          <option value="live">{formatAccountModeChoice("live")}</option>
        </select>
      </label>
      {mode === "live" ? (
        <div className="space-y-4">
          <label className="block text-xs text-ink-muted">
            Exchange Connection
            <select
              value={bindChoice}
              onChange={(event) => {
                const nextChoice =
                  event.target.value === "existing" ? "existing" : "later";
                setBindChoice(nextChoice);
                if (nextChoice !== "existing") {
                  setConnectionId("");
                }
              }}
              className={fieldClass}
            >
              <option value="later">Bind Later in Desk Settings</option>
              <option value="existing">
                Select Existing Exchange Connection
              </option>
            </select>
          </label>
          {bindChoice === "existing" ? (
            liveKeys.length > 0 ? (
              <label className="block text-xs text-ink-muted">
                Connection
                <select
                  name="exchangeConnectionId"
                  required
                  value={connectionId}
                  onChange={(event) => setConnectionId(event.target.value)}
                  className={fieldClass}
                >
                  <option value="" disabled>
                    Choose a connection
                  </option>
                  {liveKeys.map((row) => (
                    <option key={row.id} value={row.id}>
                      {formatConnectionSummary(row)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-sm text-ink-muted">
                No connections saved yet.{" "}
                <Link
                  href="/account/exchanges"
                  className="text-accent hover:text-accent-strong"
                >
                  Add a connection on Exchanges
                </Link>{" "}
                first, or bind later in Desk Settings.
              </p>
            )
          ) : null}
          {warningKind ? <SharedKeyWarning kind={warningKind} /> : null}
        </div>
      ) : null}
      <p className="text-sm text-ink-muted">
        Paper Trading uses live market data and fills on the in-app ledger.
        No real trades. Connected Exchange binds a key from this login (Bybit
        Demo or production). Mode and type are set at create and never change.
      </p>
      {embedded ? (
        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="switchToDesk"
            value="1"
            defaultChecked
            className="mt-0.5"
          />
          <span>Switch to New Desk</span>
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <PendingSubmitButton
          pendingLabel="Creating…"
          className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          Create desk
        </PendingSubmitButton>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-control px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
