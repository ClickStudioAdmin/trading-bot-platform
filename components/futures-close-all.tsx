"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { closeAllFutures } from "@/lib/futures/actions";
import { CLOSE_ALL_CONFIRM } from "@/lib/futures/close-all";

const INPUT_CLASS =
  "w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function FuturesCloseAll({
  next,
  enabled,
  openCount,
  workingCount,
}: {
  next: string;
  enabled: boolean;
  openCount: number;
  workingCount: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={!enabled}
        onClick={() => setOpen(true)}
        className="rounded-control border border-danger/40 px-3 py-1.5 text-sm text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Cancel & close all
      </button>
      {open ? (
        <FuturesCloseAllDialog
          next={next}
          openCount={openCount}
          workingCount={workingCount}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function FuturesCloseAllDialog({
  next,
  openCount,
  workingCount,
  onClose,
}: {
  next: string;
  openCount: number;
  workingCount: number;
  onClose: () => void;
}) {
  const titleId = useId();
  const [confirm, setConfirm] = useState("");
  const matched = confirm.trim() === CLOSE_ALL_CONFIRM;

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
            Cancel & close all
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
          Cancels every open working order on this book, then market-closes
          every open row at full size. This cannot be undone.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <dt className="text-[11px] text-ink-muted">Open rows</dt>
            <dd className="mt-0.5 text-sm tabular-nums text-ink">{openCount}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-muted">Working orders</dt>
            <dd className="mt-0.5 text-sm tabular-nums text-ink">
              {workingCount}
            </dd>
          </div>
        </dl>
        <form action={closeAllFutures} className="mt-4 space-y-3">
          <input type="hidden" name="next" value={next} />
          <label className="block text-sm text-ink">
            Type {CLOSE_ALL_CONFIRM} to confirm
            <input
              name="confirm"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className={`${INPUT_CLASS} mt-1`}
            />
          </label>
          <div className="flex flex-col gap-2 pt-2">
            {matched ? (
              <PendingSubmitButton
                pendingLabel="Closing…"
                successKey="close-all"
                className="rounded-control bg-danger px-3 py-2 text-sm font-medium text-ink"
              >
                Confirm close all
              </PendingSubmitButton>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-control bg-danger px-3 py-2 text-sm font-medium text-ink opacity-40"
              >
                Confirm close all
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-control border border-line px-3 py-2 text-sm text-ink hover:border-line-strong"
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
