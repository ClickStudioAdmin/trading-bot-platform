"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { closeAllFutures } from "@/lib/futures/actions";
import {
  confirmPhraseForScope,
  type CloseAllScope,
} from "@/lib/futures/close-all";

const INPUT_CLASS =
  "w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";
const BUTTON_CLASS =
  "rounded-control border border-danger/40 px-3 py-1.5 text-center text-sm text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-40";

const COPY: Record<
  CloseAllScope,
  { label: string; title: string; body: string; confirm: string; pending: string }
> = {
  positions: {
    label: "Close All",
    title: "Close All",
    body: "Market-closes every open position at full size. Working orders stay, except a leftover reduce-only close limit on a row that fully closes. This cannot be undone.",
    confirm: "Confirm close all",
    pending: "Closing…",
  },
  orders: {
    label: "Cancel All Open Orders",
    title: "Cancel All Open Orders",
    body: "Cancels every open working order on this book. Open positions stay. This cannot be undone.",
    confirm: "Confirm cancel all",
    pending: "Cancelling…",
  },
  all: {
    label: "Close All & Cancel All Open Orders",
    title: "Close All & Cancel All Open Orders",
    body: "Cancels every open working order on this book, then market-closes every open position at full size. This cannot be undone.",
    confirm: "Confirm close all",
    pending: "Closing…",
  },
};

export function FuturesPositionBulkActions({
  next,
  signedIn,
  openCount,
  workingCount,
}: {
  next: string;
  signedIn: boolean;
  openCount: number;
  workingCount: number;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <FuturesBulkButton
        next={next}
        scope="positions"
        enabled={signedIn && openCount > 0}
        openCount={openCount}
        workingCount={workingCount}
      />
      <FuturesBulkButton
        next={next}
        scope="all"
        enabled={signedIn && (openCount > 0 || workingCount > 0)}
        openCount={openCount}
        workingCount={workingCount}
      />
    </div>
  );
}

export function FuturesCancelAllOrders({
  next,
  signedIn,
  workingCount,
}: {
  next: string;
  signedIn: boolean;
  workingCount: number;
}) {
  return (
    <FuturesBulkButton
      next={next}
      scope="orders"
      enabled={signedIn && workingCount > 0}
      openCount={0}
      workingCount={workingCount}
    />
  );
}

function FuturesBulkButton({
  next,
  scope,
  enabled,
  openCount,
  workingCount,
}: {
  next: string;
  scope: CloseAllScope;
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
        className={BUTTON_CLASS}
      >
        {COPY[scope].label}
      </button>
      {open ? (
        <FuturesBulkDialog
          next={next}
          scope={scope}
          openCount={openCount}
          workingCount={workingCount}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function FuturesBulkDialog({
  next,
  scope,
  openCount,
  workingCount,
  onClose,
}: {
  next: string;
  scope: CloseAllScope;
  openCount: number;
  workingCount: number;
  onClose: () => void;
}) {
  const titleId = useId();
  const copy = COPY[scope];
  const phrase = confirmPhraseForScope(scope);
  const [confirm, setConfirm] = useState("");
  const matched = confirm.trim() === phrase;
  const showPositions = scope !== "orders";
  const showOrders = scope !== "positions";

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
            {copy.title}
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
        <p className="mt-2 text-sm text-ink-muted">{copy.body}</p>
        <dl
          className={`mt-3 grid gap-x-4 gap-y-3 ${showPositions && showOrders ? "grid-cols-2" : "grid-cols-1"}`}
        >
          {showPositions ? (
            <div>
              <dt className="text-[11px] text-ink-muted">Open positions</dt>
              <dd className="mt-0.5 text-sm tabular-nums text-ink">{openCount}</dd>
            </div>
          ) : null}
          {showOrders ? (
            <div>
              <dt className="text-[11px] text-ink-muted">Working orders</dt>
              <dd className="mt-0.5 text-sm tabular-nums text-ink">
                {workingCount}
              </dd>
            </div>
          ) : null}
        </dl>
        <form action={closeAllFutures} className="mt-4 space-y-3">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="scope" value={scope} />
          {scope !== "orders" ? (
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="setReduceOnly"
                className="mt-0.5"
              />
              <span>
                Set reduce only
                <span className="mt-1 block text-xs text-ink-muted">
                  Blocks Buy and Sell on this book so size cannot come back.
                  Active automation rules also switch to Reduce only.
                </span>
              </span>
            </label>
          ) : null}
          <label className="block text-sm text-ink">
            Type {phrase} to confirm
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
                pendingLabel={copy.pending}
                successKey={`bulk-${scope}`}
                className="rounded-control bg-danger px-3 py-2 text-sm font-medium text-ink"
              >
                {copy.confirm}
              </PendingSubmitButton>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-control bg-danger px-3 py-2 text-sm font-medium text-ink opacity-40"
              >
                {copy.confirm}
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
