"use client";

import { useEffect, useRef, useState } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { replaceExchangeConnection } from "@/lib/exchanges/actions";
import type { VenueCredentialField } from "@/lib/exchanges/venues";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function ReplaceConnectionControl({
  connectionId,
  credentialFields,
}: {
  connectionId: string;
  credentialFields: readonly VenueCredentialField[];
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
    const width = 320;
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
        Replace key
      </button>
      {open ? (
        <div
          ref={panelRef}
          className="fixed z-50 w-80 rounded-card border border-line bg-surface p-3"
          style={{ top: coords.top, left: coords.left }}
        >
          <p className="text-xs text-ink-muted">
            Paste the API key and secret again. Desks stay bound. The secret
            is not shown after save.
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
              className="rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
            >
              Save key
            </PendingSubmitButton>
          </form>
        </div>
      ) : null}
    </>
  );
}
