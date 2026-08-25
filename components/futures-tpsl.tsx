"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { saveFuturesTpsl } from "@/lib/futures/actions";
import { estimatedTpslPnl } from "@/lib/futures/tpsl";
import type { FuturesSide, FuturesTrigger } from "@/lib/futures/model";
import { formatPrice, formatSignedUsd } from "@/lib/opportunities/format";

const INPUT_CLASS =
  "w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none";
const SELECT_CLASS =
  "rounded-control border border-line bg-surface-raised px-2 py-2 text-xs text-ink focus:border-line-strong focus:outline-none";

export function FuturesTpslFields() {
  const [enabled, setEnabled] = useState(false);
  return (
    <div className="col-span-full">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="tpsl"
          value="on"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="size-4 rounded-control accent-accent"
        />
        TP/SL
      </label>
      {enabled ? (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <TpslPriceField
            name="takeProfit"
            triggerName="tpTrigger"
            label="Take profit"
          />
          <TpslPriceField
            name="stopLoss"
            triggerName="slTrigger"
            label="Stop loss"
          />
        </div>
      ) : null}
    </div>
  );
}

export function FuturesTpslCell({
  positionId,
  symbol,
  side,
  qty,
  entryPrice,
  mark,
  takeProfit,
  stopLoss,
  tpTrigger,
  slTrigger,
  next,
}: {
  positionId: string;
  symbol: string;
  side: FuturesSide;
  qty: number;
  entryPrice: number;
  mark: number | null;
  takeProfit: number | null;
  stopLoss: number | null;
  tpTrigger: FuturesTrigger;
  slTrigger: FuturesTrigger;
  next: string;
}) {
  const [open, setOpen] = useState(false);
  const hasLevels = takeProfit !== null || stopLoss !== null;
  return (
    <>
      {hasLevels ? (
        <span className="flex items-center gap-1.5">
          <TpslPair takeProfit={takeProfit} stopLoss={stopLoss} />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-control p-1 text-ink-muted hover:text-ink"
            aria-label="Edit TP/SL"
          >
            <PencilIcon />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-ink-muted hover:text-ink"
        >
          + Add
        </button>
      )}
      {open ? (
        <FuturesTpslDialog
          positionId={positionId}
          symbol={symbol}
          side={side}
          qty={qty}
          entryPrice={entryPrice}
          mark={mark}
          takeProfit={takeProfit}
          stopLoss={stopLoss}
          tpTrigger={tpTrigger}
          slTrigger={slTrigger}
          next={next}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function TpslPair({
  takeProfit,
  stopLoss,
}: {
  takeProfit: number | null;
  stopLoss: number | null;
}) {
  return (
    <span className="tabular-nums">
      <span className="text-success">
        {takeProfit === null ? "--" : formatPrice(takeProfit)}
      </span>
      <span className="text-ink-faint"> / </span>
      <span className="text-danger">
        {stopLoss === null ? "--" : formatPrice(stopLoss)}
      </span>
    </span>
  );
}

function FuturesTpslDialog({
  positionId,
  symbol,
  side,
  qty,
  entryPrice,
  mark,
  takeProfit,
  stopLoss,
  tpTrigger,
  slTrigger,
  next,
  onClose,
}: {
  positionId: string;
  symbol: string;
  side: FuturesSide;
  qty: number;
  entryPrice: number;
  mark: number | null;
  takeProfit: number | null;
  stopLoss: number | null;
  tpTrigger: FuturesTrigger;
  slTrigger: FuturesTrigger;
  next: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const [tp, setTp] = useState(takeProfit === null ? "" : String(takeProfit));
  const [sl, setSl] = useState(stopLoss === null ? "" : String(stopLoss));
  const profit = estimatedTpslPnl({
    side,
    qty,
    entryPrice,
    exitPrice: optionalPrice(tp),
  });
  const loss = estimatedTpslPnl({
    side,
    qty,
    entryPrice,
    exitPrice: optionalPrice(sl),
  });

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
            Set TP/SL
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
        <p className="mt-2 flex flex-wrap gap-x-4 text-sm text-ink-muted">
          <span>
            Qty{" "}
            <span className="tabular-nums text-ink">{qty}</span>
          </span>
          <span>
            Market price{" "}
            <span className="tabular-nums text-ink">
              {mark === null ? "—" : formatPrice(mark)}
            </span>
          </span>
        </p>
        <form action={saveFuturesTpsl} className="mt-4 space-y-3">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="symbol" value={symbol} />
          <input type="hidden" name="positionId" value={positionId} />
          <TpslDialogRow
            name="takeProfit"
            triggerName="tpTrigger"
            label="TP price"
            resultLabel="Profit"
            value={tp}
            onChange={setTp}
            defaultTrigger={tpTrigger}
            result={profit}
            resultClass="text-success"
          />
          <TpslDialogRow
            name="stopLoss"
            triggerName="slTrigger"
            label="SL price"
            resultLabel="Loss"
            value={sl}
            onChange={setSl}
            defaultTrigger={slTrigger}
            result={loss}
            resultClass="text-danger"
          />
          <div className="flex flex-col gap-2 pt-2">
            <PendingSubmitButton
              pendingLabel="Saving"
              successKey={`tpsl-${positionId}`}
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

function TpslPriceField({
  name,
  triggerName,
  label,
}: {
  name: string;
  triggerName: string;
  label: string;
}) {
  return (
    <label className="block text-sm text-ink">
      {label}
      <span className="mt-1 flex gap-1">
        <input
          name={name}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.0"
          className={INPUT_CLASS}
        />
        <TriggerSelect name={triggerName} defaultValue="last" />
      </span>
    </label>
  );
}

function TpslDialogRow({
  name,
  triggerName,
  label,
  resultLabel,
  value,
  onChange,
  defaultTrigger,
  result,
  resultClass,
}: {
  name: string;
  triggerName: string;
  label: string;
  resultLabel: string;
  value: string;
  onChange: (next: string) => void;
  defaultTrigger: FuturesTrigger;
  result: number | null;
  resultClass: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
      <label className="block text-sm text-ink">
        {label}
        <span className="mt-1 flex gap-1">
          <input
            name={name}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.0"
            className={INPUT_CLASS}
          />
          <TriggerSelect name={triggerName} defaultValue={defaultTrigger} />
        </span>
      </label>
      <p className="block text-sm text-ink">
        {resultLabel}
        <span
          className={`mt-1 block rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums ${
            result === null ? "text-ink-faint" : resultClass
          }`}
        >
          {result === null ? "—" : formatSignedUsd(result)}
        </span>
      </p>
    </div>
  );
}

function TriggerSelect({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: FuturesTrigger;
}) {
  return (
    <select name={name} defaultValue={defaultValue} className={SELECT_CLASS} aria-label="Trigger">
      <option value="last">Last</option>
      <option value="mark">Mark</option>
      <option value="index">Index</option>
    </select>
  );
}

function optionalPrice(raw: string): number | null {
  const price = Number(raw.replace(/,/g, "").trim());
  return price > 0 && Number.isFinite(price) ? price : null;
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-3.5">
      <path
        d="M10.5 2.5 13.5 5.5 6 13H3V10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
