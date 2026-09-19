"use client";

import { useEffect, useRef, useState } from "react";
import { AnchoredPanel } from "@/components/anchored-panel";
import { AppSelect } from "@/components/app-select";
import { IconTrash } from "@/components/icons";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { PanelCloseButton } from "@/components/panel-close-button";
import { TABLE_BTN_ICON, TableIconAction } from "@/components/table-chrome";
import { deleteTradingAccount } from "@/lib/accounts/actions";

const BLOCKED_MS = 4000;

export function AccountDeleteControl({
  accountId,
  accountName,
  blockedMessage,
  switchOptions,
  defaultSwitchId,
}: {
  accountId: string;
  accountName: string;
  blockedMessage: string | null;
  switchOptions?: { id: string; name: string; mode: string }[];
  defaultSwitchId?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const options = switchOptions ?? [];

  useEffect(() => {
    if (!open || !blockedMessage) {
      return;
    }
    const timer = window.setTimeout(() => setOpen(false), BLOCKED_MS);
    return () => window.clearTimeout(timer);
  }, [open, blockedMessage]);

  return (
    <>
      <TableIconAction
        ref={buttonRef}
        danger
        label="Delete"
        detail="Remove this desk and its closed history."
        onClick={() => setOpen((current) => !current)}
      >
        <IconTrash {...TABLE_BTN_ICON} />
      </TableIconAction>
      <AnchoredPanel
        open={open}
        onClose={() => setOpen(false)}
        buttonRef={buttonRef}
        className="p-3 pt-8"
      >
        <PanelCloseButton onClick={() => setOpen(false)} />
        {blockedMessage ? (
          <p className="text-hint text-ink-faint">{blockedMessage}.</p>
        ) : (
          <form action={deleteTradingAccount} className="space-y-3">
            <input type="hidden" name="accountId" value={accountId} />
            <p className="text-hint text-ink-faint">
              Remove {accountName} and its closed history? This cannot be
              undone.
            </p>
            <PendingSubmitButton
              pendingLabel="Deleting…"
              className="w-full rounded-control bg-danger px-3 py-1.5 text-sm font-medium text-ink"
            >
              Delete desk
            </PendingSubmitButton>
            <SwitchFields
              options={options}
              defaultSwitchId={defaultSwitchId}
            />
          </form>
        )}
      </AnchoredPanel>
    </>
  );
}

function SwitchFields({
  options,
  defaultSwitchId,
}: {
  options: { id: string; name: string; mode: string }[];
  defaultSwitchId?: string;
}) {
  if (options.length === 0) {
    return null;
  }
  if (options.length === 1) {
    const only = options[0];
    return (
      <>
        <input type="hidden" name="switchToAccountId" value={only.id} />
        <p className="text-hint text-ink-faint">Switch to {only.name}.</p>
      </>
    );
  }
  return (
    <label className="block text-xs text-ink-muted">
      Switch to
      <AppSelect
        name="switchToAccountId"
        defaultValue={defaultSwitchId ?? options[0]?.id}
        className="mt-1 w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name} ({option.mode})
          </option>
        ))}
      </AppSelect>
    </label>
  );
}
