"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { BybitAgreementEnables } from "@/components/bybit-agreement-enable";
import type { BybitAgreementKind } from "@/lib/exchanges/agreement";
import {
  ButtonBusyIcon,
  PendingSubmitButton,
} from "@/components/pending-submit-button";
import {
  checkExchangeConnection,
  saveExchangeConnection,
} from "@/lib/exchanges/actions";
import type { VenueDefinition } from "@/lib/exchanges/venues";
import { AppSelect } from "@/components/app-select";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function ExchangeConnectForm({
  venues,
  next,
  compact = false,
  hideTitle = false,
}: {
  venues: VenueDefinition[];
  next?: string;
  compact?: boolean;
  hideTitle?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const [check, setCheck] = useState<
    { ok: true } | { ok: false; error: string } | null
  >(null);
  const [checking, startCheck] = useTransition();
  const [agreementKinds, setAgreementKinds] = useState<BybitAgreementKind[]>(
    [],
  );
  const venue = venues.find((item) => item.id === venueId) ?? venues[0];
  if (!venue) {
    return null;
  }
  const defaultEnvironment =
    venue.id === "hyperliquid"
      ? (venue.environments.find((item) => item.id === "testnet")?.id ??
        venue.environments[0]?.id)
      : venue.environments[0]?.id;

  function clearCheck(event?: FormEvent<HTMLFormElement>) {
    const field = event
      ? (event.target as HTMLInputElement | HTMLSelectElement).name
      : "";
    if (field === "label" || field === "next") {
      return;
    }
    if (check) {
      setCheck(null);
    }
  }

  function runCheck() {
    const form = formRef.current;
    if (!form) {
      return;
    }
    startCheck(async () => {
      const result = await checkExchangeConnection(new FormData(form));
      setCheck(result);
    });
  }

  return (
    <form
      ref={formRef}
      action={saveExchangeConnection}
      autoComplete="off"
      onInput={clearCheck}
      className={
        compact
          ? "space-y-4"
          : "mt-6 space-y-4 rounded-card border border-line bg-surface p-5"
      }
    >
      {hideTitle ? null : compact ? (
        <h3 className="text-lg font-semibold tracking-tight text-ink">
          Add a connection
        </h3>
      ) : (
        <h2 className="text-lg font-semibold tracking-tight">Connect</h2>
      )}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className="block text-sm text-ink">
        Exchange
        <AppSelect
          name="venue"
          value={venue.id}
          onChange={(event) => {
            setVenueId(event.target.value);
            setAgreementKinds([]);
            setCheck(null);
          }}
          className={fieldClass}
        >
          {venues.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </AppSelect>
      </label>
      <label className="block text-sm text-ink">
        Environment
        <AppSelect
          name="environment"
          defaultValue={defaultEnvironment}
          key={`${venue.id}-environment`}
          className={fieldClass}
        >
          {venue.environments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </AppSelect>
      </label>
      {venue.credentialFields.map((field) => (
        <label key={field.key} className="block text-sm text-ink">
          {field.label}
          <input
            name={field.key}
            required
            type={field.secret ? "password" : "text"}
            autoComplete={field.secret ? "new-password" : "off"}
            spellCheck={false}
            className={`${fieldClass} ${field.secret ? "" : "font-mono"}`}
          />
        </label>
      ))}
      <label className="block text-sm text-ink">
        Label (optional)
        <input name="label" maxLength={40} className={fieldClass} />
      </label>
      {venue.id === "bybit" ? (
        <>
          {agreementKinds.map((kind) => (
            <input key={kind} type="hidden" name="agreementKind" value={kind} />
          ))}
          <BybitAgreementEnables
            kinds={["tradfi", "oil"]}
            selectedKinds={agreementKinds}
            onToggleKind={(kind) => {
              setAgreementKinds((current) =>
                current.includes(kind)
                  ? current.filter((item) => item !== kind)
                  : [...current, kind],
              );
            }}
          />
        </>
      ) : null}
      <p className="text-sm text-ink-muted">
        {venue.id === "hyperliquid"
          ? "Paste the account address and an approved agent private key. Check the connection, then save. Create the agent in Hyperliquid — this app does not generate keys. The secret is encrypted and is not shown again."
          : "Use a trade-only key with no withdrawal permission. Check the connection, then save. The secret is encrypted and is not shown again. Live desks bind a key in Desk Settings. The same key on two desks shares venue margin."}
      </p>
      {check?.ok ? (
        <p className="text-sm text-success">Connection checks out.</p>
      ) : null}
      {check && !check.ok ? (
        <p className="text-sm text-danger">{check.error}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runCheck}
          disabled={checking}
          className="rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong disabled:opacity-70"
        >
          {checking ? (
            <span className="inline-flex items-center gap-2">
              <ButtonBusyIcon />
              Checking…
            </span>
          ) : (
            "Check connection"
          )}
        </button>
        <PendingSubmitButton
          pendingLabel="Saving…"
          successKey="exchange-connect"
          disabled={!check?.ok || checking}
          title={
            check?.ok
              ? undefined
              : "Check the connection before saving."
          }
          className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          Save connection
        </PendingSubmitButton>
      </div>
    </form>
  );
}
