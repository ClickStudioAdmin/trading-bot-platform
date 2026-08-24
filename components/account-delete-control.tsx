"use client";

import { useEffect, useRef, useState } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { deleteTradingAccount } from "@/lib/accounts/actions";

const BLOCKED_MS = 4000;

export function AccountDeleteControl({
  accountId,
  accountName,
  blockedMessage,
}: {
  accountId: string;
  accountName: string;
  blockedMessage: string | null;
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
        className="rounded-control px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
      >
        Delete
      </button>
      {open ? (
        <div
          ref={panelRef}
          className="fixed z-50 w-64 rounded-card border border-line bg-surface p-3"
          style={{ top: coords.top, left: coords.left }}
        >
          {blockedMessage ? (
            <p className="text-xs text-ink-muted">{blockedMessage}.</p>
          ) : (
            <>
              <p className="text-xs text-ink-muted">
                Remove {accountName} and its closed history? This cannot be
                undone.
              </p>
              <form action={deleteTradingAccount} className="mt-3">
                <input type="hidden" name="accountId" value={accountId} />
                <PendingSubmitButton
                  pendingLabel="Deleting…"
                  className="rounded-control bg-danger px-3 py-1.5 text-sm font-medium text-ink"
                >
                  Delete account
                </PendingSubmitButton>
              </form>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
