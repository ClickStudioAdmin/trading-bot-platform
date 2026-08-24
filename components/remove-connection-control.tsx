"use client";

import { useEffect, useRef, useState } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { removeExchangeConnection } from "@/lib/exchanges/actions";

export function RemoveConnectionControl({
  connectionId,
  blockedMessage,
}: {
  connectionId: string;
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
        Remove
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
                Remove this connection? You can add the key again later.
              </p>
              <form action={removeExchangeConnection} className="mt-3">
                <input type="hidden" name="connectionId" value={connectionId} />
                <PendingSubmitButton
                  pendingLabel="Removing"
                  successKey={`exchange-remove-${connectionId}`}
                  className="rounded-control bg-danger px-3 py-1.5 text-sm font-medium text-ink"
                >
                  Remove connection
                </PendingSubmitButton>
              </form>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
