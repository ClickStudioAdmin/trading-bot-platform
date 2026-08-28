"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { PanelCloseButton } from "@/components/panel-close-button";
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
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const nameCheck = validateNewDeskName(name, otherNames);
  const nameError = !nameCheck.ok ? nameCheck.error : null;

  function place() {
    const button = buttonRef.current;
    if (!button) {
      return;
    }
    const rect = button.getBoundingClientRect();
    const width = 256;
    setCoords({
      top: rect.bottom + 8,
      left: Math.max(8, rect.right - width),
    });
  }

  function close() {
    setOpen(false);
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

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open) {
            setName(accountName);
            place();
          }
          setOpen((current) => !current);
        }}
        className="rounded-control px-3 py-1.5 text-sm text-accent hover:bg-surface-raised"
      >
        Rename
      </button>
      {open ? (
        <div
          ref={panelRef}
          className="fixed z-50 w-64 rounded-card border border-line bg-surface p-3 pt-8"
          style={{ top: coords.top, left: coords.left }}
        >
          <PanelCloseButton onClick={close} />
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
                    ? "mt-1 w-full rounded-control border border-danger bg-canvas px-3 py-2 text-sm text-ink focus:border-danger focus:outline-none"
                    : "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
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
              className="rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
            >
              Save name
            </PendingSubmitButton>
          </form>
        </div>
      ) : null}
    </>
  );
}
