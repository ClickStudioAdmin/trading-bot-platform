"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { saveFuturesTrailing } from "@/lib/futures/actions";
import type { FuturesSide } from "@/lib/futures/model";
import { formatPrice } from "@/lib/opportunities/format";
import { formatGroupedNumberInput } from "@/lib/paper/open";

const INPUT_CLASS =
  "w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none";
const TICKET_INPUT =
  "min-w-0 flex-1 rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none";

export function FuturesTrailingFields() {
  const [enabled, setEnabled] = useState(false);
  const [activationOn, setActivationOn] = useState(false);
  return (
    <div className="space-y-3 border-t border-line-strong pt-4">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="trailing"
          value="on"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="size-4 rounded-control accent-accent"
        />
        Trailing stop
      </label>
      {enabled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-ink-muted">
            Retracement
            <GroupedNumberInput
              name="trailingStop"
              allowDecimal
              placeholder="0.0"
              className={`${TICKET_INPUT} mt-1 block w-full`}
            />
          </label>
          <div>
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                name="trailingActivation"
                value="on"
                checked={activationOn}
                onChange={(event) => setActivationOn(event.target.checked)}
                className="size-4 rounded-control accent-accent"
              />
              Activation price
            </label>
            {activationOn ? (
              <GroupedNumberInput
                name="trailingActive"
                allowDecimal
                placeholder="0.0"
                ariaLabel="Activation price"
                className={`${TICKET_INPUT} mt-1 block w-full`}
              />
            ) : (
              <p className="mt-1 rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink-faint">
                Arms immediately
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FuturesTrailingCell({
  positionId,
  symbol,
  side,
  entryPrice,
  mark,
  last,
  liqPrice,
  trailingStop,
  trailingActive,
  next,
  readOnly = false,
}: {
  positionId: string;
  symbol: string;
  side: FuturesSide;
  entryPrice: number;
  mark: number | null;
  last?: number | null;
  liqPrice?: number | null;
  trailingStop: number | null;
  trailingActive: number | null;
  next: string;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasStop = trailingStop !== null;
  if (readOnly) {
    return hasStop ? (
      <span className="tabular-nums">{formatPrice(trailingStop)}</span>
    ) : (
      <span className="text-ink-faint">—</span>
    );
  }
  return (
    <>
      {hasStop ? (
        <span className="flex items-center gap-1.5">
          <span className="tabular-nums">{formatPrice(trailingStop)}</span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-control p-1 text-ink-muted hover:text-ink"
            aria-label="Edit trailing stop"
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
        <FuturesTrailingDialog
          positionId={positionId}
          symbol={symbol}
          side={side}
          entryPrice={entryPrice}
          mark={mark}
          last={last ?? mark}
          liqPrice={liqPrice ?? null}
          trailingStop={trailingStop}
          trailingActive={trailingActive}
          next={next}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function FuturesTrailingDialog({
  positionId,
  symbol,
  side,
  entryPrice,
  mark,
  last,
  liqPrice,
  trailingStop,
  trailingActive,
  next,
  onClose,
}: {
  positionId: string;
  symbol: string;
  side: FuturesSide;
  entryPrice: number;
  mark: number | null;
  last: number | null;
  liqPrice: number | null;
  trailingStop: number | null;
  trailingActive: number | null;
  next: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const [distance, setDistance] = useState(
    trailingStop === null
      ? ""
      : formatGroupedNumberInput(String(trailingStop), true),
  );
  const [activationOn, setActivationOn] = useState(trailingActive !== null);
  const [activePrice, setActivePrice] = useState(
    trailingActive === null
      ? ""
      : formatGroupedNumberInput(String(trailingActive), true),
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const market = last ?? mark;
  const activationLabel = activationOn
    ? optionalNumber(activePrice) === null
      ? "—"
      : formatPrice(optionalNumber(activePrice))
    : "immediately";
  const retraceLabel =
    optionalNumber(distance) === null
      ? "—"
      : formatPrice(optionalNumber(distance));

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
        className="relative w-full max-w-lg rounded-card border border-line bg-surface p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            Set Trailing Stop
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
        <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3">
          <HeaderStat label="Entry Price" value={formatPrice(entryPrice)} />
          <HeaderStat
            label="Market Price"
            value={market === null ? "—" : formatPrice(market)}
          />
          <HeaderStat
            label="Liq. Price"
            value={liqPrice === null ? "—" : formatPrice(liqPrice)}
          />
        </dl>
        <form action={saveFuturesTrailing} className="mt-4 space-y-3">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="symbol" value={symbol} />
          <input type="hidden" name="positionId" value={positionId} />
          <div>
            <div className="flex items-end justify-between gap-2">
              <p className="text-sm text-ink">Retracement</p>
              <p className="text-[11px] text-ink-faint">By Distance</p>
            </div>
            <GroupedNumberInput
              name="trailingStop"
              value={distance}
              onChange={setDistance}
              allowDecimal
              placeholder="0.0"
              className={`${INPUT_CLASS} mt-1`}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="trailingActivation"
              value="on"
              checked={activationOn}
              onChange={(event) => setActivationOn(event.target.checked)}
              className="size-4 rounded-control accent-accent"
            />
            Activation Price
          </label>
          {activationOn ? (
            <GroupedNumberInput
              name="trailingActive"
              value={activePrice}
              onChange={setActivePrice}
              allowDecimal
              placeholder="0.0"
              className={INPUT_CLASS}
            />
          ) : null}
          <ol className="space-y-2 rounded-card border border-line bg-surface-raised px-4 py-3 text-sm text-ink-muted">
            <li>
              {activationOn
                ? `When the Last Traded Price reaches ${activationLabel}, the Trailing Stop order will be activated.`
                : "The Trailing Stop order will be activated immediately."}
            </li>
            <li>
              When the Last Traded Price retraces by {retraceLabel} from the
              best price recorded since activation, it will trigger a Stop
              Market Order to close the {side} position.
            </li>
          </ol>
          <p className="text-[11px] text-ink-faint">
            Leave retracement empty to remove.
          </p>
          <button
            type="button"
            onClick={() => setHelpOpen((open) => !open)}
            className="text-sm text-accent hover:text-accent-strong"
          >
            What is Trailing Stop?
          </button>
          {helpOpen ? (
            <p className="text-sm text-ink-muted">
              A trailing stop follows last price in your favour. After it
              activates, it records the best price. If last retraces by the
              distance you set, the whole position closes at market.
            </p>
          ) : null}
          <div className="flex flex-col gap-2 pt-2">
            <PendingSubmitButton
              pendingLabel="Saving"
              successKey={`trailing-${positionId}`}
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

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function optionalNumber(raw: string): number | null {
  const value = Number(raw.replace(/,/g, "").trim());
  return value > 0 && Number.isFinite(value) ? value : null;
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
