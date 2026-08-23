"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { updatePaperCarryExits } from "@/lib/paper/actions";
import type { PaperReturnPath } from "@/lib/paper/open";
import {
  exitFormValues,
  formatCloseHow,
  formatEntryTriggers,
  formatExitTriggers,
  formatSourceWord,
  type CloseReason,
  type PaperCarryAutomation,
  type TradeSource,
} from "@/lib/paper/automation";

export function PaperAutomationTrigger({
  carryId,
  automation,
  label,
  canEdit,
  entrySource,
  closeSource = null,
  closeReason = null,
  next = "/strategies/cash-and-carry",
  className = "text-xs text-ink-faint hover:text-ink",
}: {
  carryId: number;
  automation: PaperCarryAutomation;
  label: string;
  canEdit: boolean;
  entrySource: TradeSource;
  closeSource?: TradeSource | null;
  closeReason?: CloseReason | null;
  next?: PaperReturnPath;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const entries = formatEntryTriggers(automation);
  const exits = formatExitTriggers(automation);
  const form = exitFormValues(automation);
  const closed = !canEdit;

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={className}
        aria-expanded={open}
        aria-controls={open ? labelId : undefined}
        onClick={(event) => {
          setBox(event.currentTarget.getBoundingClientRect());
          setOpen((current) => !current);
        }}
      >
        {label}
      </button>
      {open && box && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={labelId}
              role="dialog"
              aria-label="Trade triggers"
              className="fixed z-50 w-72 rounded-card border border-line bg-surface-raised p-3 text-left shadow-none"
              style={{
                top: box.bottom + 8,
                left: Math.max(12, Math.min(box.left, window.innerWidth - 300)),
              }}
            >
              <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                Entry · {formatSourceWord(entrySource)}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {entrySource === "engine"
                  ? "Opened automatically."
                  : "Opened manually."}
              </p>
              <TriggerList
                lines={entries}
                empty={
                  entrySource === "engine"
                    ? "No entry filters."
                    : "No automation entry."
                }
              />
              <p className="mt-3 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                {closed
                  ? `Exit · ${formatSourceWord(closeSource ?? "manual")}`
                  : "Exit"}
              </p>
              {canEdit ? (
                <form action={updatePaperCarryExits} className="mt-1 space-y-1.5">
                  <p className="text-xs text-ink-muted">
                    Used by the next tick. Close on the row uses order type
                    only.
                  </p>
                  <input type="hidden" name="carryId" value={carryId} />
                  <input
                    type="hidden"
                    name="next"
                    value={next}
                  />
                  <ExitField
                    name="closeMaxDte"
                    label="DTE ≤"
                    defaultValue={form.closeMaxDte}
                  />
                  <ExitField
                    name="closeMinApr"
                    label="APR % below"
                    defaultValue={form.closeMinApr}
                    allowDecimal
                  />
                  <ExitField
                    name="takeProfit"
                    label="Take profit %"
                    defaultValue={form.takeProfit}
                    allowDecimal
                  />
                  <ExitField
                    name="stopLoss"
                    label="Stop loss %"
                    defaultValue={form.stopLoss}
                    allowDecimal
                  />
                  <button
                    type="submit"
                    className="mt-1 rounded-control bg-accent-strong px-2.5 py-1 text-xs font-medium text-ink"
                  >
                    Save exits
                  </button>
                </form>
              ) : (
                <>
                  <p className="mt-1 text-xs text-ink-muted">
                    {formatCloseHow(closeSource, closeReason)}
                  </p>
                  <TriggerList
                    lines={exits}
                    empty={
                      closeSource === "engine"
                        ? "No exit filters stored."
                        : "No auto exits armed."
                    }
                  />
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function TriggerList({ lines, empty }: { lines: string[]; empty: string }) {
  if (lines.length === 0) {
    return <p className="mt-1 text-xs text-ink-muted">{empty}</p>;
  }
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

function ExitField({
  name,
  label,
  defaultValue,
  allowDecimal,
}: {
  name: string;
  label: string;
  defaultValue: string;
  allowDecimal?: boolean;
}) {
  return (
    <label className="block text-[11px] text-ink-muted">
      {label}
      <GroupedNumberInput
        name={name}
        defaultValue={defaultValue}
        allowDecimal={allowDecimal}
      />
    </label>
  );
}
