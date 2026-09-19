"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { AnchoredPanel } from "@/components/anchored-panel";
import { IconPencil } from "@/components/icons";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { PanelCloseButton } from "@/components/panel-close-button";
import { TABLE_BTN_ICON, TableIconAction } from "@/components/table-chrome";
import { renameTradingAccount } from "@/lib/accounts/actions";
import { validateNewDeskName } from "@/lib/accounts/model";

export function AccountRenameControl({
  accountId,
  accountName,
  otherNames = [],
}: {
  accountId: string;
  accountName: string;
  otherNames?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(accountName);
  const errorId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const nameCheck = validateNewDeskName(name, otherNames);
  const nameError = !nameCheck.ok ? nameCheck.error : null;

  return (
    <>
      <TableIconAction
        ref={buttonRef}
        label="Rename"
        detail="Change this desk's name."
        onClick={() => {
          if (!open) {
            setName(accountName);
          }
          setOpen((current) => !current);
        }}
      >
        <IconPencil {...TABLE_BTN_ICON} />
      </TableIconAction>
      <AnchoredPanel
        open={open}
        onClose={() => setOpen(false)}
        buttonRef={buttonRef}
        className="p-3 pt-8"
      >
        <PanelCloseButton onClick={() => setOpen(false)} />
        <form
          action={renameTradingAccount}
          className="space-y-3"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            if (!nameCheck.ok) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="accountId" value={accountId} />
          <label className="block text-xs text-ink-muted">
            Name
            <input
              name="name"
              required
              maxLength={40}
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? errorId : undefined}
              className={
                nameError
                  ? "mt-1 w-full min-w-0 rounded-control border border-danger bg-canvas px-3 py-2 text-sm text-ink focus:border-danger focus:outline-none"
                  : "mt-1 w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
              }
            />
            {nameError ? (
              <p id={errorId} className="mt-1 text-xs text-danger">
                {nameError}
              </p>
            ) : null}
          </label>
          <PendingSubmitButton
            pendingLabel="Saving"
            disabled={!nameCheck.ok}
            successKey={`account-rename-${accountId}`}
            className="w-full rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
          >
            Save name
          </PendingSubmitButton>
        </form>
      </AnchoredPanel>
    </>
  );
}
