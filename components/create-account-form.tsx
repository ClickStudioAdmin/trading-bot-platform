"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AppCheck } from "@/components/app-check";
import { BotButtonLead, botBtnIcon } from "@/components/bot-form-chrome";
import { DeskTypeMark } from "@/components/desk-mark";
import { IconPlus } from "@/components/icons";
import { TemplateNameWithParameters } from "@/components/template-parameters-tip";
import { ExchangeConnectForm } from "@/components/exchange-connect-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { createTradingAccount } from "@/lib/accounts/actions";
import {
  formatAccountModeChoice,
  formatDeskType,
  formatDeskTypeChoice,
  type DeskCreateOrigin,
  type DeskType,
  validateNewDeskName,
} from "@/lib/accounts/model";
import {
  connectionListedForBind,
  formatConnectionSummary,
  mergeExchangeConnections,
  sharedKeyWarningKind,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import type { SavedMemberConnection } from "@/lib/exchanges/member-connection";
import {
  foldersForDesk,
  type StarterFolder,
} from "@/lib/onboarding/model";
import {
  connectionVenuesForDeskType,
  getVenue,
  venueAllowsDeskType,
  venuesForDeskType,
} from "@/lib/exchanges/venues";
import { SharedKeyWarning } from "@/components/shared-key-warning";
import { AppSelect } from "@/components/app-select";
import { useDeskTypeAccess } from "@/components/desk-type-access";
import { DeskTypeRejectBanner, QuotaRejectNotices } from "@/components/desk-type-reject";
import { FreeTrialBadge } from "@/components/plan-trial-hint";
import { useQuotaAccess } from "@/components/quota-access";
import {
  QUOTA_CAP_KEYS,
  deskTypeAccessFor,
  quotaAccessFor,
  quotaKeyForDesk,
} from "@/lib/membership/entitlements";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

const DESK_TYPES: DeskType[] = [
  "cash_and_carry",
  "manual",
  "flex",
  "signal_follower",
  "dca",
];

export function CreateAccountForm({
  connections,
  sharedConnectionIds = [],
  allowSharedKeys = false,
  existingNames = [],
  next,
  createFrom = null,
  embedded = false,
  firstDesk = false,
  initialDeskType,
  lockType = false,
  hideTitle = false,
  onCancel,
  starterFolders = [],
}: {
  connections: ExchangeConnection[];
  sharedConnectionIds?: string[];
  allowSharedKeys?: boolean;
  existingNames?: string[];
  next?: string;
  createFrom?: DeskCreateOrigin | null;
  embedded?: boolean;
  firstDesk?: boolean;
  initialDeskType?: DeskType;
  lockType?: boolean;
  hideTitle?: boolean;
  onCancel?: () => void;
  starterFolders?: StarterFolder[];
}) {
  const deskTypeAccess = useDeskTypeAccess();
  const deskTypesGated = deskTypeAccess.length > 0;
  const quotaAccess = useQuotaAccess();
  const quotasGated = quotaAccess.length > 0;
  const [deskType, setDeskType] = useState<DeskType>(
    initialDeskType ?? "cash_and_carry",
  );
  const [trackedDeskType, setTrackedDeskType] = useState(initialDeskType);
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [bindChoice, setBindChoice] = useState<"later" | "new" | "existing">(
    "later",
  );
  const [connectionId, setConnectionId] = useState("");
  const [addedConnections, setAddedConnections] = useState<ExchangeConnection[]>(
    [],
  );
  const [paperVenue, setPaperVenue] = useState("bybit");
  const [name, setName] = useState("");
  const [addStarter, setAddStarter] = useState(false);
  const [starterIds, setStarterIds] = useState<string[]>([]);
  const connectionRows = useMemo(
    () => mergeExchangeConnections(connections, addedConnections),
    [addedConnections, connections],
  );
  const liveKeys = useMemo(
    () =>
      connectionRows.filter((row) => {
        if (row.status !== "active") {
          return false;
        }
        if (
          !connectionListedForBind({
            connectionId: row.id,
            sharedConnectionIds,
            allowShared: allowSharedKeys,
          })
        ) {
          return false;
        }
        const venue = getVenue(row.venue);
        return venue ? venueAllowsDeskType(venue, deskType) : false;
      }),
    [allowSharedKeys, connectionRows, deskType, sharedConnectionIds],
  );
  const keyVenues = useMemo(
    () => connectionVenuesForDeskType(deskType),
    [deskType],
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
  const typeRow = deskTypeAccessFor(deskTypeAccess, deskType);
  const typeDenied = deskTypesGated && typeRow ? !typeRow.allowed : false;
  const typeNotice = deskTypesGated ? typeRow?.message ?? null : null;
  function quotaBlock(key: "max_paper_desks" | "max_demo_desks" | "max_live_env_desks") {
    const row = quotaAccessFor(quotaAccess, key);
    return quotasGated && row && !row.allowed ? row : null;
  }
  const paperBlocked = quotaBlock("max_paper_desks");
  const demoBlocked = quotaBlock("max_demo_desks");
  const liveBlocked = quotaBlock("max_live_env_desks");
  const selectedBand =
    mode === "paper"
      ? "max_paper_desks"
      : bindChoice === "existing" && connectionId
        ? quotaKeyForDesk({
            mode: "live",
            venueEnvironment: selected?.environment ?? null,
          })
        : "max_live_env_desks";
  const quotaRow = quotaAccessFor(quotaAccess, selectedBand);
  const quotaDenied =
    mode === "paper"
      ? paperBlocked
      : bindChoice === "later" || !connectionId
        ? liveBlocked
        : quotaBlock(
            quotaKeyForDesk({
              mode: "live",
              venueEnvironment: selected?.environment ?? null,
            }) === "max_demo_desks"
              ? "max_demo_desks"
              : "max_live_env_desks",
          );
  const quotaNotice =
    quotasGated && quotaRow?.allowed ? quotaRow.message : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!nameCheck.ok || typeDenied || quotaDenied) {
      event.preventDefault();
    }
  }

  function resetBind() {
    setBindChoice("later");
    setConnectionId("");
  }

  function handleKeyCreated(saved: SavedMemberConnection) {
    const now = Date.now();
    const row: ExchangeConnection = {
      id: saved.id,
      userId: "",
      venue: saved.venue,
      environment: saved.environment,
      label: saved.label,
      fingerprint: saved.fingerprint,
      venueAccountId: null,
      status: "active",
      verifiedAtMs: now,
      createdAtMs: now,
    };
    setAddedConnections((current) =>
      current.some((item) => item.id === row.id) ? current : [...current, row],
    );
    setConnectionId(saved.id);
    setBindChoice("existing");
  }

  if (initialDeskType && initialDeskType !== trackedDeskType) {
    setTrackedDeskType(initialDeskType);
    setDeskType(initialDeskType);
    setConnectionId("");
    setPaperVenue((current) => {
      const allowed = venuesForDeskType(initialDeskType);
      return allowed.some((row) => row.id === current)
        ? current
        : (allowed[0]?.id ?? "bybit");
    });
  }

  const formClass = embedded
    ? "mt-4 space-y-4"
    : hideTitle
      ? "space-y-4 rounded-card border border-line bg-surface p-5"
      : "mt-6 space-y-4 rounded-card border border-line bg-surface p-5";

  return (
    <div>
    <form
      action={createTradingAccount}
      onSubmit={onSubmit}
      className={formClass}
    >
      {embedded || hideTitle ? null : (
        <h2 className="text-lg font-semibold tracking-tight">New desk</h2>
      )}
      {typeDenied && typeRow && !hideTitle ? (
        <DeskTypeRejectBanner access={typeRow} />
      ) : null}
      {hideTitle ? null : (
        <QuotaRejectNotices keys={QUOTA_CAP_KEYS} className="space-y-3" />
      )}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {createFrom ? (
        <input type="hidden" name="createFrom" value={createFrom} />
      ) : null}
      <input type="hidden" name="venue" value={venue} />
      {track ? <input type="hidden" name="track" value={track} /> : null}
      {lockType ? (
        <div className="text-xs text-ink-muted">
          Desk Type
          <input type="hidden" name="deskType" value={deskType} />
          <p className="mt-1 flex items-center gap-2 text-sm text-ink">
            <DeskTypeMark deskType={deskType} />
            {formatDeskType(deskType)}
          </p>
        </div>
      ) : (
        <label className="block text-sm text-ink">
          Desk Type
          <AppSelect
            name="deskType"
            value={deskType}
            onChange={(event) => {
              const nextType = event.target.value as DeskType;
              const nextRow = deskTypeAccessFor(deskTypeAccess, nextType);
              if (deskTypesGated && nextRow && !nextRow.allowed) {
                return;
              }
              setDeskType(nextType);
              setConnectionId("");
              setAddStarter(false);
              setStarterIds([]);
              const allowed = venuesForDeskType(nextType);
              if (!allowed.some((row) => row.id === paperVenue)) {
                setPaperVenue(allowed[0]?.id ?? "bybit");
              }
            }}
            className={fieldClass}
          >
            {DESK_TYPES.map((type) => {
              const row = deskTypeAccessFor(deskTypeAccess, type);
              const off = deskTypesGated && row ? !row.allowed : false;
              return (
                <option key={type} value={type} disabled={off}>
                  {formatDeskTypeChoice(type)}
                </option>
              );
            })}
          </AppSelect>
        </label>
      )}
      {typeNotice && !typeDenied ? (
        <FreeTrialBadge message={typeNotice} />
      ) : null}
      {quotaNotice ? <FreeTrialBadge message={quotaNotice} /> : null}
      <label className="block text-sm text-ink">
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
      <label className="block text-sm text-ink">
        Mode
        <AppSelect
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
          <option value="paper" disabled={Boolean(paperBlocked)}>
            {formatAccountModeChoice("paper")}
          </option>
          <option value="live" disabled={Boolean(demoBlocked && liveBlocked)}>
            {formatAccountModeChoice("live")}
          </option>
        </AppSelect>
      </label>
      {mode === "paper" && deskType !== "cash_and_carry" && paperVenues.length > 1 ? (
        <label className="block text-sm text-ink">
          Market Data
          <AppSelect
            value={venue}
            onChange={(event) => setPaperVenue(event.target.value)}
            className={fieldClass}
          >
            {paperVenues.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </AppSelect>
        </label>
      ) : null}
      {mode === "live" ? (
        <div className="space-y-4">
          <label className="block text-sm text-ink">
            Exchange Connection
            <AppSelect
              value={bindChoice}
              onChange={(event) => {
                const value = event.target.value;
                const nextChoice =
                  value === "existing" || value === "new" ? value : "later";
                setBindChoice(nextChoice);
                if (nextChoice !== "existing") {
                  setConnectionId("");
                }
              }}
              className={fieldClass}
            >
              <option value="later" disabled={Boolean(liveBlocked)}>
                Bind Later in Desk Settings
              </option>
              <option value="new" disabled={keyVenues.length === 0}>
                Add New Exchange Key
              </option>
              <option value="existing">
                Select Existing Exchange Connection
              </option>
            </AppSelect>
          </label>
          {bindChoice === "existing" ? (
            liveKeys.length > 0 ? (
              <label className="block text-sm text-ink">
                Connection
                <AppSelect
                  name="exchangeConnectionId"
                  required
                  value={connectionId}
                  onChange={(event) => setConnectionId(event.target.value)}
                  className={fieldClass}
                >
                  <option value="" disabled>
                    Choose a connection
                  </option>
                  {liveKeys.map((row) => {
                    const band = quotaKeyForDesk({
                      mode: "live",
                      venueEnvironment: row.environment,
                    });
                    const off =
                      band === "max_demo_desks" ? demoBlocked : liveBlocked;
                    return (
                      <option key={row.id} value={row.id} disabled={Boolean(off)}>
                        {formatConnectionSummary(row)}
                      </option>
                    );
                  })}
                </AppSelect>
              </label>
            ) : (
              <p className="text-sm text-ink-muted">
                {sharedConnectionIds.length > 0 ? (
                  "Every matching key is already bound to another desk. Save a new trade-only key, or unbind one first."
                ) : firstDesk ? (
                  "No connections on this login yet. Choose Add New Exchange Key, or bind later after this desk is created."
                ) : (
                  "No connections saved yet. Choose Add New Exchange Key, or bind later in Desk Settings."
                )}
              </p>
            )
          ) : null}
          {warningKind ? <SharedKeyWarning kind={warningKind} /> : null}
        </div>
      ) : null}
      <StarterBots
        folders={foldersForDesk(starterFolders, deskType)}
        enabled={addStarter}
        selected={starterIds}
        onEnabled={(next) => {
          setAddStarter(next);
          if (!next) {
            setStarterIds([]);
          }
        }}
        onSelected={setStarterIds}
      />
      <p className="text-sm text-ink-muted">
        Type and mode are set at create and never change. Paper Trading uses
        that market’s public marks and fills on the in-app ledger. Connected
        Exchange can bind a key from this login now, or later in Desk Settings.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <PendingSubmitButton
          pendingLabel="Creating…"
          disabled={!nameCheck.ok || typeDenied || Boolean(quotaDenied)}
          title={
            typeDenied
              ? typeNotice ?? undefined
              : quotaDenied?.message ?? undefined
          }
          className="inline-flex items-center gap-2 rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          <BotButtonLead icon={<IconPlus {...botBtnIcon} />}>
            Create desk
          </BotButtonLead>
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
    {mode === "live" && bindChoice === "new" && keyVenues.length > 0 ? (
      <ExchangeConnectForm
        venues={keyVenues}
        title="Add New Exchange Key"
        onCreated={handleKeyCreated}
      />
    ) : null}
    </div>
  );
}

function StarterBots({
  folders,
  enabled,
  selected,
  onEnabled,
  onSelected,
}: {
  folders: StarterFolder[];
  enabled: boolean;
  selected: string[];
  onEnabled: (next: boolean) => void;
  onSelected: (ids: string[]) => void;
}) {
  if (folders.length === 0) {
    return null;
  }
  return (
    <fieldset className="space-y-3">
      <label className="inline-flex items-center gap-2 text-sm text-ink">
        <AppCheck
          checked={enabled}
          className=""
          onChange={(event) => onEnabled(event.target.checked)}
        />
        Add starter bots
      </label>
      {enabled ? (
        <div className="space-y-3 pl-1">
          {folders.map((folder) => (
            <div key={folder.id}>
              {folder.loose ? null : (
                <p className="text-sm font-medium text-ink">{folder.name}</p>
              )}
              <ul className="mt-1 space-y-1">
                {folder.templates.map((template) => (
                  <li key={template.id}>
                    <label className="inline-flex items-center gap-2 text-sm text-ink">
                      <AppCheck
                        name="starterTemplateId"
                        value={template.id}
                        checked={selected.includes(template.id)}
                        className=""
                        onChange={() => {
                          onSelected(
                            selected.includes(template.id)
                              ? selected.filter((id) => id !== template.id)
                              : [...selected, template.id],
                          );
                        }}
                      />
                      <TemplateNameWithParameters
                        name={template.name}
                        description={template.description}
                        recipe={template.recipe}
                        templateId={template.id}
                        nameClassName=""
                      />
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-hint text-ink-muted">
            Loaded idle or disabled. Nothing trades until you arm or enable.
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}
