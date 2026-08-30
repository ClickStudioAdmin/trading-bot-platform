"use client";

import { useEffect, useRef, useState } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { PanelCloseButton } from "@/components/panel-close-button";
import { deleteTradingAccount } from "@/lib/accounts/actions";

const BLOCKED_MS = 4000;
const PANEL_WIDTH = 288;

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
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const options = switchOptions ?? [];

  function place() {
    const button = buttonRef.current;
    if (!button) {
      return;
    }
    const rect = button.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 8,
      left: Math.max(8, rect.right - PANEL_WIDTH),
    });
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    place();
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !blockedMessage) {
      return;
    }
    const timer = window.setTimeout(() => setOpen(false), BLOCKED_MS);
    return () => window.clearTimeout(timer);
  }, [open, blockedMessage]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open) {
            place();
          }
          setOpen((current) => !current);
        }}
        className="rounded-control border border-line px-2 py-0.5 text-xs font-medium text-danger hover:bg-danger/10"
      >
        Delete
      </button>
      {open ? (
        <div
          ref={panelRef}
          className="fixed z-50 w-72 rounded-card border border-line bg-surface p-3 pt-8"
          style={{ top: coords.top, left: coords.left }}
        >
          <PanelCloseButton onClick={() => setOpen(false)} />
          {blockedMessage ? (
            <p className="text-xs text-ink-muted">{blockedMessage}.</p>
          ) : (
            <form action={deleteTradingAccount} className="space-y-3">
              <input type="hidden" name="accountId" value={accountId} />
              <p className="text-xs text-ink-muted">
                Remove {accountName} and its closed history? This cannot be
                undone.
              </p>
              <PendingSubmitButton
                pendingLabel="Deleting…"
                className="rounded-control bg-danger px-3 py-1.5 text-sm font-medium text-ink"
              >
                Delete desk
              </PendingSubmitButton>
              <SwitchFields
                options={options}
                defaultSwitchId={defaultSwitchId}
              />
            </form>
          )}
        </div>
      ) : null}
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
        <p className="text-xs text-ink-muted">Switch to {only.name}.</p>
      </>
    );
  }
  return (
    <label className="block text-xs text-ink-muted">
      Switch to
      <select
        name="switchToAccountId"
        defaultValue={defaultSwitchId ?? options[0]?.id}
        className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name} ({option.mode})
          </option>
        ))}
      </select>
    </label>
  );
}
