"use client";

import { useState } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { saveExchangeConnection } from "@/lib/exchanges/actions";
import type { VenueDefinition } from "@/lib/exchanges/venues";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function ExchangeConnectForm({
  venues,
  next,
  compact = false,
}: {
  venues: VenueDefinition[];
  next?: string;
  compact?: boolean;
}) {
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const venue = venues.find((item) => item.id === venueId) ?? venues[0];
  if (!venue) {
    return null;
  }
  const defaultEnvironment =
    venue.id === "hyperliquid"
      ? (venue.environments.find((item) => item.id === "testnet")?.id ??
        venue.environments[0]?.id)
      : venue.environments[0]?.id;

  return (
    <form
      action={saveExchangeConnection}
      autoComplete="off"
      className={
        compact
          ? "space-y-4"
          : "mt-6 space-y-4 rounded-card border border-line bg-surface p-5"
      }
    >
      {compact ? (
        <h3 className="text-sm font-medium text-ink">Add a connection</h3>
      ) : (
        <h2 className="text-lg font-semibold tracking-tight">Connect</h2>
      )}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className="block text-xs text-ink-muted">
        Exchange
        <select
          name="venue"
          value={venue.id}
          onChange={(event) => setVenueId(event.target.value)}
          className={fieldClass}
        >
          {venues.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-ink-muted">
        Environment
        <select
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
        </select>
      </label>
      {venue.credentialFields.map((field) => (
        <label key={field.key} className="block text-xs text-ink-muted">
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
      <label className="block text-xs text-ink-muted">
        Label (optional)
        <input name="label" maxLength={40} className={fieldClass} />
      </label>
      <p className="text-sm text-ink-muted">
        {venue.id === "hyperliquid"
          ? "Paste the account address and an approved agent private key. We check the agent on that network before saving. Create the agent in Hyperliquid — this app does not generate keys. The secret is encrypted and is not shown again."
          : "Use a trade-only key with no withdrawal permission. We check that with Bybit before saving. The secret is encrypted and is not shown again. Live desks bind a key in Desk Settings. The same key on two desks shares venue margin."}
      </p>
      <PendingSubmitButton
        pendingLabel="Verifying…"
        successKey="exchange-connect"
        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
      >
        Save connection
      </PendingSubmitButton>
    </form>
  );
}
