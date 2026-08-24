"use client";

import { useEffect, useRef, useState } from "react";
import { detachStrategyConnection } from "@/lib/engine/actions";

const BLOCKED_MS = 4000;

const DETACH_BLOCKED =
  "Detach is blocked while this strategy has open positions or automations on.";

export function StrategyDetachControl({ blocked }: { blocked: boolean }) {
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
    if (!open) {
      return;
    }
    const timer = window.setTimeout(() => setOpen(false), BLOCKED_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  const className =
    "rounded-control border border-line px-3 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink";

  if (!blocked) {
    return (
      <button type="submit" formAction={detachStrategyConnection} className={className}>
        Detach
      </button>
    );
  }

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
        className={className}
      >
        Detach
      </button>
      {open ? (
        <div
          ref={panelRef}
          className="fixed z-50 w-64 rounded-card border border-line bg-surface p-3"
          style={{ top: coords.top, left: coords.left }}
        >
          <p className="text-xs text-ink-muted">{DETACH_BLOCKED}</p>
        </div>
      ) : null}
    </>
  );
}
