"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { amendFuturesWorking } from "@/lib/futures/actions";
import { workingActionLabel } from "@/lib/futures/working";
import { formatGroupedNumberInput } from "@/lib/paper/open";

const INPUT_CLASS =
  "mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none";
const EDIT_CLASS =
  "rounded-control border border-line bg-surface-raised px-2.5 py-1 text-xs font-medium whitespace-nowrap text-ink hover:border-line-strong";

export function FuturesWorkingEdit({
  workingId,
  symbol,
  action,
  remainingQty,
  filledQty,
  limitPrice,
  next,
}: {
  workingId: string;
  symbol: string;
  action: "buy" | "sell";
  remainingQty: number;
  filledQty: number;
  limitPrice: number;
  next: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={EDIT_CLASS}>
        Edit
      </button>
      {open ? (
        <FuturesWorkingEditDialog
          workingId={workingId}
          symbol={symbol}
          action={action}
          remainingQty={remainingQty}
          filledQty={filledQty}
          limitPrice={limitPrice}
          next={next}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function FuturesWorkingEditDialog({
  workingId,
  symbol,
  action,
  remainingQty,
  filledQty,
  limitPrice,
  next,
  onClose,
}: {
  workingId: string;
  symbol: string;
  action: "buy" | "sell";
  remainingQty: number;
  filledQty: number;
  limitPrice: number;
  next: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const [qty, setQty] = useState(() =>
    formatGroupedNumberInput(String(remainingQty), true),
  );
  const [price, setPrice] = useState(() =>
    formatGroupedNumberInput(String(limitPrice), true),
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-card border border-line bg-surface p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            Edit order
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          {workingActionLabel(action)} {symbol}
          {filledQty > 0 ? (
            <span className="mt-1 block text-xs text-ink-faint">
              {filledQty} filled stays. Qty is the rest.
            </span>
          ) : null}
        </p>
        <form action={amendFuturesWorking} className="mt-4 space-y-3">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="workingId" value={workingId} />
          <label className="block text-sm text-ink">
            Qty
            <input
              name="qty"
              value={qty}
              onChange={(event) =>
                setQty(formatGroupedNumberInput(event.target.value, true))
              }
              inputMode="decimal"
              autoComplete="off"
              className={INPUT_CLASS}
            />
          </label>
          <label className="block text-sm text-ink">
            Limit
            <input
              name="limitPrice"
              value={price}
              onChange={(event) =>
                setPrice(formatGroupedNumberInput(event.target.value, true))
              }
              inputMode="decimal"
              autoComplete="off"
              className={INPUT_CLASS}
            />
          </label>
          <div className="flex flex-col gap-2 pt-2">
            <PendingSubmitButton
              pendingLabel="Saving"
              successKey={`working-amend-${workingId}`}
              className="w-full rounded-control bg-accent-strong px-3 py-2 text-sm font-medium text-ink"
            >
              Confirm
            </PendingSubmitButton>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-control border border-line px-3 py-2 text-sm text-ink hover:border-line-strong"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
