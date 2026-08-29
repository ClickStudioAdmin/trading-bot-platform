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
  connectionsForDeskBind,
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
  const [venue, setVenue] = useState("bybit");
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [track, setTrack] = useState<"paper" | "testnet" | "live">("testnet");
  const [bindChoice, setBindChoice] = useState<"later" | "existing">("later");
  const [connectionId, setConnectionId] = useState("");
  const [name, setName] = useState("");
  const venues = venuesForDeskType(deskType);
  const hyperliquid = venue === "hyperliquid";
  const connected = hyperliquid ? track !== "paper" : mode === "live";
  const deskEnvironment = hyperliquid
    ? track === "paper"
      ? null
      : track
    : null;
  const liveKeys = useMemo(
    () =>
      connectionsForDeskBind(
        connections.filter((row) => row.status === "active"),
        { venue, venueEnvironment: deskEnvironment },
      ),
    [connections, deskEnvironment, venue],
  );
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
            const nextVenues = venuesForDeskType(nextType);
            if (!nextVenues.some((item) => item.id === venue)) {
              setVenue(nextVenues[0]?.id ?? "bybit");
              setTrack("testnet");
              resetBind();
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
      {venues.length > 1 ? (
        <label className="block text-xs text-ink-muted">
          Exchange
          <select
            name="venue"
            value={venue}
            onChange={(event) => {
              const nextVenue = event.target.value;
              setVenue(nextVenue);
              if (nextVenue === "hyperliquid") {
                setTrack("testnet");
              } else {
                setMode("paper");
              }
              resetBind();
            }}
            className={fieldClass}
          >
            {venues.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="venue" value={venue} />
      )}
      {hyperliquid ? (
        <label className="block text-xs text-ink-muted">
          Track
          <select
            name="track"
            value={track}
            onChange={(event) => {
              const nextTrack = event.target.value as typeof track;
              setTrack(nextTrack);
              resetBind();
            }}
            className={fieldClass}
          >
            <option value="paper">{formatAccountModeChoice("paper")}</option>
            <option value="testnet">Demo (Hyperliquid Testnet)</option>
            <option value="live">Live</option>
          </select>
        </label>
      ) : (
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
      )}
      {connected ? (
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
                {hyperliquid
                  ? "Hyperliquid keys come in the next step. Choose Bind Later."
                  : firstDesk
                    ? "No connections on this login yet. Choose Bind Later — you can add a key after this desk is created."
                    : (
                      <>
                        No matching connections saved yet.{" "}
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
        Type and exchange are set at create and never change. Paper Trading
        uses public marks and fills on the in-app ledger. Bybit Connected
        binds a Demo or Live key. Hyperliquid Demo is Testnet, not Paper.
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
