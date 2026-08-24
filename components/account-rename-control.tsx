"use client";

import { useEffect, useRef, useState } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { renameTradingAccount } from "@/lib/accounts/actions";

export function AccountRenameControl({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

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
          className="fixed z-50 w-64 rounded-card border border-line bg-surface p-3"
          style={{ top: coords.top, left: coords.left }}
        >
          <form action={renameTradingAccount} className="space-y-3">
            <input type="hidden" name="accountId" value={accountId} />
            <label className="block text-xs text-ink-muted">
              Name
              <input
                name="name"
                required
                maxLength={40}
                defaultValue={accountName}
                className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
              >
                Close
              </button>
              <PendingSubmitButton
                pendingLabel="Saving"
                successKey={`account-rename-${accountId}`}
                className="rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
              >
                Save name
              </PendingSubmitButton>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
