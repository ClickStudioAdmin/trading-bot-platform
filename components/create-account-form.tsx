"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { createTradingAccount } from "@/lib/accounts/actions";
import {
  formatAccountModeChoice,
  formatDeskTypeChoice,
  type DeskType,
  validateNewDeskName,
} from "@/lib/accounts/model";
import {
  formatConnectionSummary,
  sharedKeyWarningKind,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import {
  getVenue,
  venueAllowsDeskType,
  venuesForDeskType,
} from "@/lib/exchanges/venues";
import { SharedKeyWarning } from "@/components/shared-key-warning";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

const DESK_TYPES: DeskType[] = [
  "cash_and_carry",
  "perps",
  "signal_follower",
  "dca",
];

export function CreateAccountForm({
  connections,
  sharedConnectionIds = [],
  existingNames = [],
  next,
  embedded = false,
  firstDesk = false,
  onCancel,
}: {
  connections: ExchangeConnection[];
  sharedConnectionIds?: string[];
  existingNames?: string[];
  next?: string;
  embedded?: boolean;
  firstDesk?: boolean;
  onCancel?: () => void;
}) {
  const [deskType, setDeskType] = useState<DeskType>("cash_and_carry");
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [bindChoice, setBindChoice] = useState<"later" | "existing">("later");
  const [connectionId, setConnectionId] = useState("");
  const [paperVenue, setPaperVenue] = useState("bybit");
  const [name, setName] = useState("");
  const liveKeys = useMemo(
    () =>
      connections.filter((row) => {
        if (row.status !== "active") {
          return false;
        }
        const venue = getVenue(row.venue);
        return venue ? venueAllowsDeskType(venue, deskType) : false;
      }),
    [connections, deskType],
  );
  const paperVenues = useMemo(
    () => venuesForDeskType(deskType),
    [deskType],
  );
  const selected = liveKeys.find((row) => row.id === connectionId) ?? null;
  const venue =
    mode === "paper"
      ? paperVenues.some((row) => row.id === paperVenue)
        ? paperVenue
        : (paperVenues[0]?.id ?? "bybit")
      : (selected?.venue ?? "bybit");
  const track = selected?.environment ?? "";
  const pathname = usePathname();
  const warningKind =
    bindChoice === "existing"
      ? sharedKeyWarningKind({
          connectionId,
          sharedConnectionIds,
        })
      : null;
  const nameCheck = validateNewDeskName(name, existingNames);
  const nameError =
    name.trim().length > 0 && !nameCheck.ok ? nameCheck.error : null;

  function stampStayPath(event: FormEvent<HTMLFormElement>) {
    const field = event.currentTarget.elements.namedItem("stayPath");
    if (field instanceof HTMLInputElement) {
      field.value = `${window.location.pathname}${window.location.search}`;
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!nameCheck.ok) {
      event.preventDefault();
      return;
    }
    stampStayPath(event);
  }

  function resetBind() {
    setBindChoice("later");
    setConnectionId("");
  }

  return (
    <form
      action={createTradingAccount}
      onSubmit={onSubmit}
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
        <input type="hidden" name="stayPath" defaultValue={pathname} />
      ) : null}
      <input type="hidden" name="venue" value={venue} />
      {track ? <input type="hidden" name="track" value={track} /> : null}
      <label className="block text-xs text-ink-muted">
        Name
        <input
          name="name"
          required
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "new-desk-name-error" : undefined}
          className={
            nameError
              ? `${fieldClass} border-danger focus:border-danger`
              : fieldClass
          }
        />
        {nameError ? (
          <p id="new-desk-name-error" className="mt-1 text-xs text-danger">
            {nameError}
          </p>
        ) : null}
      </label>
      <label className="block text-xs text-ink-muted">
        Type
        <select
          name="deskType"
          value={deskType}
          onChange={(event) => {
            const nextType = event.target.value as DeskType;
            setDeskType(nextType);
            setConnectionId("");
            const allowed = venuesForDeskType(nextType);
            if (!allowed.some((row) => row.id === paperVenue)) {
              setPaperVenue(allowed[0]?.id ?? "bybit");
            }
          }}
          className={fieldClass}
        >
          {DESK_TYPES.map((type) => (
            <option key={type} value={type}>
              {formatDeskTypeChoice(type)}
            </option>
          ))}
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
              resetBind();
            }
          }}
          className={fieldClass}
        >
          <option value="paper">{formatAccountModeChoice("paper")}</option>
          <option value="live">{formatAccountModeChoice("live")}</option>
        </select>
      </label>
      {mode === "paper" && deskType !== "cash_and_carry" && paperVenues.length > 1 ? (
        <label className="block text-xs text-ink-muted">
          Exchange
          <select
            value={venue}
            onChange={(event) => setPaperVenue(event.target.value)}
            className={fieldClass}
          >
            {paperVenues.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
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
                {firstDesk ? (
                  "No connections on this login yet. Choose Bind Later — you can add a key after this desk is created."
                ) : (
                  <>
                    No connections saved yet.{" "}
                    <Link
                      href="/account/exchanges"
                      className="text-accent hover:text-accent-strong"
                    >
                      Add a connection on Exchanges
                    </Link>{" "}
                    first, or bind later in Desk Settings.
                  </>
                )}
              </p>
            )
          ) : null}
          {warningKind ? <SharedKeyWarning kind={warningKind} /> : null}
        </div>
      ) : null}
      <p className="text-sm text-ink-muted">
        Type and mode are set at create and never change. Paper Trading uses
        that exchange’s public marks and fills on the in-app ledger. Connected
        Exchange can bind a key from this login now, or later in Desk Settings.
      </p>
      {embedded && !firstDesk ? (
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
          disabled={!nameCheck.ok}
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
            {firstDesk ? "Back" : "Cancel"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
