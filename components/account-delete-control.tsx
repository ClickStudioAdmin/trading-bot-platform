"use client";

import { useEffect, useRef, useState } from "react";
import { AnchoredPanel } from "@/components/anchored-panel";
import { AppSelect } from "@/components/app-select";
import { IconTrash } from "@/components/icons";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  PanelCloseButton,
  PanelCloseReserve,
} from "@/components/panel-close-button";
import { StepUpForm } from "@/components/step-up-code-field";
import { TABLE_BTN_ICON, TableIconAction } from "@/components/table-chrome";
import {
  closeTradingAccount,
  deleteTradingAccount,
} from "@/lib/accounts/actions";
import type { DeskCloseKind } from "@/lib/accounts/close";
import {
  DESK_DELETE_CONTINUE_ATTEMPTS,
  DESK_DELETE_PASS_DEADLINE_MS,
  DESK_DELETE_TIMED_OUT,
  continueTimedDeskDelete,
  deskDeleteAttemptTimeout,
  withDeskDeleteDeadline,
} from "@/lib/accounts/desk-delete";
import { stepUpRejectionMessage } from "@/lib/auth/step-up";

const BLOCKED_MS = 4000;

export function AccountDeleteControl({
  accountId,
  accountName,
  blockedMessage,
  switchOptions,
  defaultSwitchId,
  hint = "Remove this desk and its closed history.",
  closeKind = null,
}: {
  accountId: string;
  accountName: string;
  blockedMessage: string | null;
  switchOptions?: { id: string; name: string; mode: string }[];
  defaultSwitchId?: string;
  hint?: string;
  closeKind?: DeskCloseKind | null;
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
        label={closeKind ? "Close" : "Delete"}
        detail={
          closeKind
            ? closeKind === "archive"
              ? "Close this desk. Followers keep a closed copy for six months."
              : "Close this desk. Invites are withdrawn and the desk is removed."
            : hint
        }
        onClick={() => setOpen((current) => !current)}
      >
        <IconTrash {...TABLE_BTN_ICON} />
      </TableIconAction>
      <AnchoredPanel
        open={open}
        onClose={() => setOpen(false)}
        buttonRef={buttonRef}
        className="p-3"
      >
        <PanelCloseButton onClick={() => setOpen(false)} />
        {blockedMessage && !closeKind ? (
          <p className="min-w-0 break-words text-sm text-ink">
            <PanelCloseReserve />
            {blockedMessage}.
          </p>
        ) : (
          <StepUpForm
            action={async (formData) => {
              let grant = "";
              const run = closeKind ? closeTradingAccount : deleteTradingAccount;
              return continueTimedDeskDelete(
                async () => {
                  if (grant) {
                    formData.set("deskDeleteGrant", grant);
                  }
                  const result = await withDeskDeleteDeadline(
                    () => run(formData),
                    deskDeleteAttemptTimeout(grant),
                    DESK_DELETE_PASS_DEADLINE_MS,
                  );
                  if (
                    result &&
                    typeof result === "object" &&
                    "deskDeleteGrant" in result &&
                    typeof result.deskDeleteGrant === "string"
                  ) {
                    grant = result.deskDeleteGrant;
                  }
                  return result;
                },
                (result) =>
                  stepUpRejectionMessage(result) === DESK_DELETE_TIMED_OUT,
                DESK_DELETE_CONTINUE_ATTEMPTS,
              );
            }}
            confirmLabel={closeKind ? "Close desk" : "Delete desk"}
            danger
            pendingLabel={closeKind ? "Closing…" : "Deleting…"}
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="accountId" value={accountId} />
            <p className="min-w-0 break-words text-sm font-medium text-ink">
              <PanelCloseReserve />
              {closeKind === "archive"
                ? `Close ${accountName}? It leaves your list. Followers keep their copy, with history, for six months, and it no longer copies. After six months those copies are removed. If a copy is someone’s only desk, they may have no desks.`
                : closeKind === "revoke"
                  ? `Close ${accountName}? Invites are withdrawn and this desk is removed. Nobody has a copy desk to keep.`
                  : `Remove ${accountName} and its closed history?`}
            </p>
            <p className="text-hint text-ink-muted">
              {closeKind === "archive"
                ? "The hidden desk is removed after six months."
                : "This cannot be undone."}
            </p>
            <PendingSubmitButton
              pendingLabel={closeKind ? "Closing…" : "Deleting…"}
              className="w-full rounded-control bg-danger px-3 py-1.5 text-sm font-medium text-ink"
            >
              {closeKind ? "Close desk" : "Delete desk"}
            </PendingSubmitButton>
            <SwitchFields
              options={options}
              defaultSwitchId={defaultSwitchId}
            />
          </StepUpForm>
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
        <p className="text-hint text-ink-muted">Switch to {only.name}.</p>
      </>
    );
  }
  return (
    <label className="block text-sm text-ink">
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
