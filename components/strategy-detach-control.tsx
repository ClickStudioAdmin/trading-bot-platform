"use client";

import { useEffect, useRef, useState } from "react";
import { AnchoredPanel } from "@/components/anchored-panel";
import { detachStrategyConnection } from "@/lib/engine/actions";

const BLOCKED_MS = 4000;

const DETACH_BLOCKED =
  "Detach is blocked while this strategy has open positions or automations on.";

export function StrategyDetachControl({
  blocked,
  detachAction = detachStrategyConnection,
}: {
  blocked: boolean;
  detachAction?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const timer = window.setTimeout(() => setOpen(false), BLOCKED_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  const className =
    "rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink";

  if (!blocked) {
    return (
      <button type="submit" formAction={detachAction} className={className}>
        Detach
      </button>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={className}
      >
        Detach
      </button>
      <AnchoredPanel
        open={open}
        onClose={() => setOpen(false)}
        buttonRef={buttonRef}
      >
        <p className="text-hint text-ink-faint">{DETACH_BLOCKED}</p>
      </AnchoredPanel>
    </>
  );
}
