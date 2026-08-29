"use client";

import { useEffect, useRef, useState } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { renameExchangeConnection } from "@/lib/exchanges/actions";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function RenameConnectionControl({
  connectionId,
  label,
}: {
  connectionId: string;
  label: string | null;
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
        className="text-xs font-medium text-accent hover:text-accent-strong"
      >
        Rename
      </button>
      {open ? (
        <div
          ref={panelRef}
          className="fixed z-50 w-64 rounded-card border border-line bg-surface p-3"
          style={{ top: coords.top, left: coords.left }}
        >
          <p className="text-xs text-ink-muted">
            Change the label. Bound desks stay the same.
          </p>
          <form action={renameExchangeConnection} className="mt-3 space-y-3">
            <input type="hidden" name="connectionId" value={connectionId} />
            <label className="block text-xs text-ink-muted">
              Label (optional)
              <input
                name="label"
                maxLength={40}
                defaultValue={label ?? ""}
                className={fieldClass}
              />
            </label>
            <PendingSubmitButton
              pendingLabel="Saving"
              successKey={`exchange-rename-${connectionId}`}
              className="rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
            >
              Save label
            </PendingSubmitButton>
          </form>
        </div>
      ) : null}
    </>
  );
}
