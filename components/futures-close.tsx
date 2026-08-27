"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { closeDcaPlaybookFromRow } from "@/lib/dca/actions";
import { submitFuturesTrade } from "@/lib/futures/actions";
import type { MarkedFutures } from "@/lib/futures/mark";
import { formatPrice } from "@/lib/opportunities/format";
import { formatGroupedNumberInput } from "@/lib/paper/open";

const ACTION_CLASS =
  "inline-flex items-center justify-center rounded-control bg-accent-strong px-2 py-1 text-center text-xs font-medium whitespace-nowrap text-ink";
const INPUT_CLASS =
  "w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none";

export function FuturesCloseActions({
  trade,
  next,
  playbookOwnsOrders = false,
  playbookId = null,
}: {
  trade: MarkedFutures;
  next: string;
  playbookOwnsOrders?: boolean;
  playbookId?: string | null;
}) {
  if (playbookId) {
    return <CloseDcaPlaybookButton playbookId={playbookId} next={next} />;
  }
  if (playbookOwnsOrders) {
    return null;
  }
  return (
    <div className="flex items-center gap-1">
      <FuturesCloseButton trade={trade} next={next} orderType="market" />
      <FuturesCloseButton trade={trade} next={next} orderType="limit" />
    </div>
  );
}

function CloseDcaPlaybookButton({
  playbookId,
  next,
}: {
  playbookId: string;
  next: string;
}) {
  return (
    <form action={closeDcaPlaybookFromRow}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="playbookId" value={playbookId} />
      <span
        className="inline-flex"
        title="Close all positions and place the playbook in idle mode (no new entries)"
      >
        <PendingSubmitButton
          pendingLabel="Closing…"
          successKey={`close-dca-playbook-row-${playbookId}`}
          className={ACTION_CLASS}
          skipSizeGuard
        >
          Close Playbook
        </PendingSubmitButton>
      </span>
    </form>
  );
}

function FuturesCloseButton({
  trade,
  next,
  orderType,
}: {
  trade: MarkedFutures;
  next: string;
  orderType: "market" | "limit";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={ACTION_CLASS}>
        {orderType === "market" ? "Market" : "Limit"}
      </button>
      {open ? (
        <FuturesCloseDialog
          trade={trade}
          next={next}
          orderType={orderType}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function FuturesCloseDialog({
  trade,
  next,
  orderType,
  onClose,
}: {
  trade: MarkedFutures;
  next: string;
  orderType: "market" | "limit";
  onClose: () => void;
}) {
  const titleId = useId();
  const last = trade.last ?? trade.mark;
  const limit = orderType === "limit";
  const [qty, setQty] = useState(() =>
    formatGroupedNumberInput(String(trade.qty), true),
  );
  const [price, setPrice] = useState(() =>
    last === null ? "" : formatGroupedNumberInput(String(last), true),
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
            {limit ? "Set Limit Close" : "Set Market Close"}
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
          {limit
            ? trade.side === "long"
              ? "Sells this long when last trades at the limit."
              : "Buys this short when last trades at the limit."
            : trade.side === "long"
              ? "Sells this long at market now."
              : "Buys this short at market now."}{" "}
          {limit
            ? "GTC. Watch it under Open orders."
            : "Qty can be the whole row or a slice."}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <HeaderStat label="Entry Price" value={formatPrice(trade.entryPrice)} />
          <HeaderStat label="Quantity" value={String(trade.qty)} />
          <HeaderStat
            label="Last Traded Price"
            value={last === null ? "—" : formatPrice(last)}
          />
          <HeaderStat
            label="Mark"
            value={trade.mark === null ? "—" : formatPrice(trade.mark)}
          />
        </dl>
        <form action={submitFuturesTrade} className="mt-4 space-y-3">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="symbol" value={trade.symbol} />
          <input type="hidden" name="positionId" value={trade.id} />
          <input type="hidden" name="action" value="close" />
          <input type="hidden" name="orderType" value={orderType} />
          <input type="hidden" name="sizeUnit" value="qty" />
          <label className="block text-sm text-ink">
            Qty
            <GroupedNumberInput
              name="size"
              value={qty}
              onChange={setQty}
              allowDecimal
              placeholder="0.0"
              className={`${INPUT_CLASS} mt-1`}
            />
          </label>
          {limit ? (
            <label className="block text-sm text-ink">
              Limit price
              <span className="relative mt-1 block">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
                  $
                </span>
                <GroupedNumberInput
                  name="limitPrice"
                  value={price}
                  onChange={setPrice}
                  allowDecimal
                  placeholder="0.0"
                  ariaLabel="Limit price"
                  className={`${INPUT_CLASS} pr-3 pl-7`}
                />
              </span>
            </label>
          ) : null}
          <div className="flex flex-col gap-2 pt-2">
            <PendingSubmitButton
              pendingLabel={limit ? "Placing" : "Closing"}
              successKey={`flatten-${orderType}-${trade.id}`}
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
