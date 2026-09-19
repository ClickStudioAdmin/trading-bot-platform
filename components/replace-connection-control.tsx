"use client";

import { useRef, useState } from "react";
import { AnchoredPanel } from "@/components/anchored-panel";
import { IconReplace } from "@/components/icons";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { TABLE_BTN_ICON, TableIconAction } from "@/components/table-chrome";
import { replaceExchangeConnection } from "@/lib/exchanges/actions";
import type { VenueCredentialField } from "@/lib/exchanges/venues";

const fieldClass =
  "mt-1 w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function ReplaceConnectionControl({
  connectionId,
  credentialFields,
}: {
  connectionId: string;
  credentialFields: readonly VenueCredentialField[];
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <TableIconAction
        ref={buttonRef}
        label="Replace key"
        detail="Paste a new API key and secret."
        onClick={() => setOpen((current) => !current)}
      >
        <IconReplace {...TABLE_BTN_ICON} />
      </TableIconAction>
      <AnchoredPanel
        open={open}
        onClose={() => setOpen(false)}
        buttonRef={buttonRef}
      >
        <p className="text-hint text-ink-faint">
          Paste the API key and secret again. Desks stay bound. The secret is
          not shown after save.
        </p>
        <form
          action={replaceExchangeConnection}
          autoComplete="off"
          className="mt-3 space-y-3"
        >
          <input type="hidden" name="connectionId" value={connectionId} />
          {credentialFields.map((field) => (
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
          <PendingSubmitButton
            pendingLabel="Verifying…"
            successKey={`exchange-replace-${connectionId}`}
            className="w-full rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
          >
            Save key
          </PendingSubmitButton>
        </form>
      </AnchoredPanel>
    </>
  );
}
