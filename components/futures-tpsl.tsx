"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { saveFuturesTpsl } from "@/lib/futures/actions";
import { estimatedTpslPnl } from "@/lib/futures/tpsl";
import type {
  FuturesOrderType,
  FuturesSide,
  FuturesTpslMode,
  FuturesTrigger,
} from "@/lib/futures/model";
import { formatPrice, formatSignedUsd } from "@/lib/opportunities/format";
import { formatGroupedNumberInput } from "@/lib/paper/open";

const INPUT_CLASS =
  "w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none";
const SELECT_CLASS =
  "shrink-0 rounded-control border border-line bg-surface-raised px-2 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";
const TICKET_INPUT =
  "min-w-0 flex-1 rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none";
const TICKET_QTY =
  "w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none";

export function FuturesTpslFields() {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<FuturesTpslMode>("full");
  const partial = enabled && mode === "partial";
  return (
    <div className="space-y-3 border-t border-line-strong pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="tpsl"
            value="on"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="size-4 rounded-control accent-accent"
          />
          Take profit / Stop loss
        </label>
        {enabled ? (
          <>
            <input type="hidden" name="tpslMode" value={mode} />
            <ModeToggle mode={mode} onChange={setMode} />
          </>
        ) : null}
      </div>
      {enabled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <TpslPriceField
            name="takeProfit"
            triggerName="tpTrigger"
            label="Take profit"
            qtyName={partial ? "tpQty" : undefined}
            qtyAria={partial ? "Take profit qty" : undefined}
          />
          <TpslPriceField
            name="stopLoss"
            triggerName="slTrigger"
            label="Stop loss"
            qtyName={partial ? "slQty" : undefined}
            qtyAria={partial ? "Stop loss qty" : undefined}
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
  last,
  liqPrice,
  takeProfit,
  stopLoss,
  tpTrigger,
  slTrigger,
  tpslMode,
  tpQty,
  slQty,
  tpOrderType,
  slOrderType,
  tpLimitPrice,
  slLimitPrice,
  next,
  readOnly = false,
  plannedTakeProfit = null,
  plannedStopLoss = null,
  plannedTpOrderType,
  plannedSlOrderType,
  tpLimitResting = false,
}: {
  positionId: string;
  symbol: string;
  side: FuturesSide;
  qty: number;
  entryPrice: number;
  mark: number | null;
  last?: number | null;
  liqPrice?: number | null;
  takeProfit: number | null;
  stopLoss: number | null;
  tpTrigger: FuturesTrigger;
  slTrigger: FuturesTrigger;
  tpslMode: FuturesTpslMode;
  tpQty: number | null;
  slQty: number | null;
  tpOrderType: FuturesOrderType;
  slOrderType: FuturesOrderType;
  tpLimitPrice: number | null;
  slLimitPrice: number | null;
  next: string;
  readOnly?: boolean;
  plannedTakeProfit?: number | null;
  plannedStopLoss?: number | null;
  plannedTpOrderType?: FuturesOrderType;
  plannedSlOrderType?: FuturesOrderType;
  tpLimitResting?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const liveTakeProfit = takeProfit;
  const liveStopLoss = stopLoss;
  const displayTakeProfit = liveTakeProfit ?? plannedTakeProfit;
  const displayStopLoss = liveStopLoss ?? plannedStopLoss;
  const plannedLevels =
    displayTakeProfit !== null || displayStopLoss !== null;
  const liveLevels = liveTakeProfit !== null || liveStopLoss !== null;
  if (readOnly) {
    return plannedLevels ? (
      <TpslPair
        takeProfit={displayTakeProfit}
        stopLoss={displayStopLoss}
        mode={tpslMode}
        tpOrderType={
          liveTakeProfit !== null
            ? tpOrderType
            : (plannedTpOrderType ?? tpOrderType)
        }
        slOrderType={
          liveStopLoss !== null
            ? slOrderType
            : (plannedSlOrderType ?? slOrderType)
        }
        tpTone={
          tpLimitResting ||
          (liveTakeProfit !== null && tpOrderType === "limit")
            ? "live"
            : "planned"
        }
        slTone={
          liveStopLoss !== null && slOrderType === "limit" ? "live" : "planned"
        }
      />
    ) : (
      <span className="text-ink-faint">—</span>
    );
  }
  return (
    <>
      {liveLevels ? (
        <span className="flex items-start gap-1.5">
          <TpslPair
            takeProfit={takeProfit}
            stopLoss={stopLoss}
            mode={tpslMode}
            tpOrderType={tpOrderType}
            slOrderType={slOrderType}
          />
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
          last={last ?? mark}
          liqPrice={liqPrice ?? null}
          takeProfit={takeProfit}
          stopLoss={stopLoss}
          tpTrigger={tpTrigger}
          slTrigger={slTrigger}
          tpslMode={tpslMode}
          tpQty={tpQty}
          slQty={slQty}
          tpOrderType={tpOrderType}
          slOrderType={slOrderType}
          tpLimitPrice={tpLimitPrice}
          slLimitPrice={slLimitPrice}
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
  mode,
  tpOrderType,
  slOrderType,
  tpTone = "live",
  slTone = "live",
}: {
  takeProfit: number | null;
  stopLoss: number | null;
  mode?: FuturesTpslMode;
  tpOrderType?: FuturesOrderType;
  slOrderType?: FuturesOrderType;
  tpTone?: "live" | "planned";
  slTone?: "live" | "planned";
}) {
  const tpLimited = takeProfit !== null && tpOrderType === "limit";
  const slLimited = stopLoss !== null && slOrderType === "limit";
  return (
    <span className="inline-flex items-start gap-1.5">
      <span className="inline-flex items-start gap-1.5 tabular-nums">
        <span className="inline-flex flex-col items-start leading-tight">
          <span
            className={tpTone === "planned" ? "text-ink-faint" : "text-success"}
          >
            {takeProfit === null ? "--" : formatPrice(takeProfit)}
          </span>
          {tpLimited ? (
            <span className="text-[11px] text-ink-faint">Limit</span>
          ) : null}
        </span>
        <span className="text-ink-faint">/</span>
        <span className="inline-flex flex-col items-start leading-tight">
          <span
            className={slTone === "planned" ? "text-ink-faint" : "text-danger"}
          >
            {stopLoss === null ? "--" : formatPrice(stopLoss)}
          </span>
          {slLimited ? (
            <span className="text-[11px] text-ink-faint">Limit</span>
          ) : null}
        </span>
      </span>
      {mode === "partial" ? (
        <span className="text-[11px] text-ink-faint">Partial</span>
      ) : null}
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
  last,
  liqPrice,
  takeProfit,
  stopLoss,
  tpTrigger,
  slTrigger,
  tpslMode,
  tpQty,
  slQty,
  tpOrderType,
  slOrderType,
  tpLimitPrice,
  slLimitPrice,
  next,
  onClose,
}: {
  positionId: string;
  symbol: string;
  side: FuturesSide;
  qty: number;
  entryPrice: number;
  mark: number | null;
  last: number | null;
  liqPrice: number | null;
  takeProfit: number | null;
  stopLoss: number | null;
  tpTrigger: FuturesTrigger;
  slTrigger: FuturesTrigger;
  tpslMode: FuturesTpslMode;
  tpQty: number | null;
  slQty: number | null;
  tpOrderType: FuturesOrderType;
  slOrderType: FuturesOrderType;
  tpLimitPrice: number | null;
  slLimitPrice: number | null;
  next: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const [mode, setMode] = useState<FuturesTpslMode>(
    tpslMode === "partial" ? "partial" : "full",
  );
  const [tp, setTp] = useState(
    takeProfit === null
      ? ""
      : formatGroupedNumberInput(String(takeProfit), true),
  );
  const [sl, setSl] = useState(
    stopLoss === null ? "" : formatGroupedNumberInput(String(stopLoss), true),
  );
  const [tpQtyText, setTpQtyText] = useState(qtyText(tpQty, qty, tpslMode));
  const [slQtyText, setSlQtyText] = useState(qtyText(slQty, qty, tpslMode));
  const [tpPct, setTpPct] = useState(percentFromQty(tpQtyText, qty));
  const [slPct, setSlPct] = useState(percentFromQty(slQtyText, qty));
  const [tpType, setTpType] = useState<FuturesOrderType>(
    tpOrderType === "limit" ? "limit" : "market",
  );
  const [slType, setSlType] = useState<FuturesOrderType>(
    slOrderType === "limit" ? "limit" : "market",
  );
  const [tpLimit, setTpLimit] = useState(
    tpLimitPrice === null
      ? ""
      : formatGroupedNumberInput(String(tpLimitPrice), true),
  );
  const [slLimit, setSlLimit] = useState(
    slLimitPrice === null
      ? ""
      : formatGroupedNumberInput(String(slLimitPrice), true),
  );
  const tpCloseQty =
    mode === "partial" ? optionalNumber(tpQtyText) ?? qty : qty;
  const slCloseQty =
    mode === "partial" ? optionalNumber(slQtyText) ?? qty : qty;
  const profit = estimatedTpslPnl({
    side,
    qty: tpCloseQty,
    entryPrice,
    exitPrice:
      tpType === "limit"
        ? (optionalNumber(tpLimit) ?? optionalNumber(tp))
        : optionalNumber(tp),
  });
  const loss = estimatedTpslPnl({
    side,
    qty: slCloseQty,
    entryPrice,
    exitPrice:
      slType === "limit"
        ? (optionalNumber(slLimit) ?? optionalNumber(sl))
        : optionalNumber(sl),
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

  function setModeAndPrefill(nextMode: FuturesTpslMode) {
    setMode(nextMode);
    if (nextMode === "partial" && mode === "full") {
      const full = formatGroupedNumberInput(String(qty), true);
      const hundred = formatGroupedNumberInput("100", true);
      if (optionalNumber(tpQtyText) === null) {
        setTpQtyText(full);
        setTpPct(hundred);
      }
      if (optionalNumber(slQtyText) === null) {
        setSlQtyText(full);
        setSlPct(hundred);
      }
    }
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
        className="relative w-full max-w-xl rounded-card border border-line bg-surface p-5"
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
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <HeaderStat label="Entry Price" value={formatPrice(entryPrice)} />
          <HeaderStat label="Quantity" value={String(qty)} />
          <HeaderStat
            label="Last Traded Price"
            value={last === null && mark === null ? "—" : formatPrice(last ?? mark)}
          />
          <HeaderStat
            label="Liq. Price"
            value={liqPrice === null ? "—" : formatPrice(liqPrice)}
          />
        </dl>
        <form action={saveFuturesTpsl} className="mt-4 space-y-3">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="symbol" value={symbol} />
          <input type="hidden" name="positionId" value={positionId} />
          <input type="hidden" name="tpslMode" value={mode} />
          <ModeToggle mode={mode} onChange={setModeAndPrefill} />
          <TpslDialogRow
            name="takeProfit"
            triggerName="tpTrigger"
            label="TP price"
            resultLabel="Profit"
            value={tp}
            onChange={setTp}
            defaultTrigger={tpTrigger}
            orderType={tpType}
            onOrderTypeChange={setTpType}
            orderTypeName="tpOrderType"
            limitName="tpLimitPrice"
            limitValue={tpLimit}
            onLimitChange={setTpLimit}
            result={profit}
            resultClass="text-success"
            partial={mode === "partial"}
            qtyName="tpQty"
            qtyValue={tpQtyText}
            onQtyChange={(nextQty) => {
              setTpQtyText(nextQty);
              setTpPct(percentFromQty(nextQty, qty));
            }}
            percentValue={tpPct}
            onPercentChange={(nextPct) => {
              setTpPct(nextPct);
              setTpQtyText(qtyFromPercent(nextPct, qty));
            }}
            onPercentPick={(pct) => {
              const nextPct = formatGroupedNumberInput(String(pct), true);
              setTpPct(nextPct);
              setTpQtyText(qtyFromPercent(nextPct, qty));
            }}
          />
          <TpslDialogRow
            name="stopLoss"
            triggerName="slTrigger"
            label="SL price"
            resultLabel="Loss"
            value={sl}
            onChange={setSl}
            defaultTrigger={slTrigger}
            orderType={slType}
            onOrderTypeChange={setSlType}
            orderTypeName="slOrderType"
            limitName="slLimitPrice"
            limitValue={slLimit}
            onLimitChange={setSlLimit}
            result={loss}
            resultClass="text-danger"
            partial={mode === "partial"}
            qtyName="slQty"
            qtyValue={slQtyText}
            onQtyChange={(nextQty) => {
              setSlQtyText(nextQty);
              setSlPct(percentFromQty(nextQty, qty));
            }}
            percentValue={slPct}
            onPercentChange={(nextPct) => {
              setSlPct(nextPct);
              setSlQtyText(qtyFromPercent(nextPct, qty));
            }}
            onPercentPick={(pct) => {
              const nextPct = formatGroupedNumberInput(String(pct), true);
              setSlPct(nextPct);
              setSlQtyText(qtyFromPercent(nextPct, qty));
            }}
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

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function TpslPriceField({
  name,
  triggerName,
  label,
  qtyName,
  qtyAria,
}: {
  name: string;
  triggerName: string;
  label: string;
  qtyName?: string;
  qtyAria?: string;
}) {
  const [orderType, setOrderType] = useState<FuturesOrderType>("market");
  const orderName = name === "stopLoss" ? "slOrderType" : "tpOrderType";
  const limitName = name === "stopLoss" ? "slLimitPrice" : "tpLimitPrice";
  return (
    <div className="space-y-2">
      <label className="block text-xs text-ink-muted">
        {label}
        <span className="mt-1 flex gap-1">
          <GroupedNumberInput
            name={name}
            allowDecimal
            placeholder="0.0"
            className={TICKET_INPUT}
          />
          <TriggerSelect name={triggerName} defaultValue="last" />
          <OrderTypeSelect
            name={orderName}
            value={orderType}
            onChange={setOrderType}
          />
        </span>
      </label>
      {orderType === "limit" ? (
        <label className="block text-xs text-ink-muted">
          Limit
          <GroupedNumberInput
            name={limitName}
            allowDecimal
            placeholder="Trigger price"
            className={`${TICKET_QTY} mt-1`}
          />
        </label>
      ) : (
        <input type="hidden" name={limitName} value="" />
      )}
      {qtyName ? (
        <label className="block text-xs text-ink-muted">
          Qty
          <GroupedNumberInput
            name={qtyName}
            allowDecimal
            placeholder="0.0"
            ariaLabel={qtyAria}
            className={`${TICKET_QTY} mt-1`}
          />
        </label>
      ) : null}
    </div>
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
  orderType,
  onOrderTypeChange,
  orderTypeName,
  limitName,
  limitValue,
  onLimitChange,
  result,
  resultClass,
  partial,
  qtyName,
  qtyValue,
  onQtyChange,
  percentValue,
  onPercentChange,
  onPercentPick,
}: {
  name: string;
  triggerName: string;
  label: string;
  resultLabel: string;
  value: string;
  onChange: (next: string) => void;
  defaultTrigger: FuturesTrigger;
  orderType: FuturesOrderType;
  onOrderTypeChange: (next: FuturesOrderType) => void;
  orderTypeName: string;
  limitName: string;
  limitValue: string;
  onLimitChange: (next: string) => void;
  result: number | null;
  resultClass: string;
  partial: boolean;
  qtyName: string;
  qtyValue: string;
  onQtyChange: (next: string) => void;
  percentValue: string;
  onPercentChange: (next: string) => void;
  onPercentPick: (pct: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
        <label className="block text-sm text-ink">
          {label}
          <span className="mt-1 flex gap-1">
            <GroupedNumberInput
              name={name}
              value={value}
              onChange={onChange}
              allowDecimal
              placeholder="0.0"
              className={INPUT_CLASS}
            />
            <TriggerSelect name={triggerName} defaultValue={defaultTrigger} />
            <OrderTypeSelect
              name={orderTypeName}
              value={orderType}
              onChange={onOrderTypeChange}
            />
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
      {orderType === "limit" ? (
        <label className="block text-sm text-ink">
          Limit
          <GroupedNumberInput
            name={limitName}
            value={limitValue}
            onChange={onLimitChange}
            allowDecimal
            placeholder="Trigger price"
            className={`${INPUT_CLASS} mt-1`}
          />
        </label>
      ) : (
        <input type="hidden" name={limitName} value="" />
      )}
      {partial ? (
        <div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm text-ink">
              Quantity
              <GroupedNumberInput
                name={qtyName}
                value={qtyValue}
                onChange={onQtyChange}
                allowDecimal
                placeholder="0.0"
                className={`${INPUT_CLASS} mt-1`}
              />
            </label>
            <label className="block text-sm text-ink">
              Proportion
              <span className="relative mt-1 block">
                <GroupedNumberInput
                  value={percentValue}
                  onChange={onPercentChange}
                  allowDecimal
                  placeholder="100"
                  className={`${INPUT_CLASS} pr-8`}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-muted">
                  %
                </span>
              </span>
            </label>
          </div>
          <div className="mt-2 flex gap-1">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => onPercentPick(pct)}
                className="flex-1 rounded-control border border-line px-2 py-1 text-[11px] text-ink-muted hover:border-line-strong hover:text-ink"
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: FuturesTpslMode;
  onChange: (mode: FuturesTpslMode) => void;
}) {
  return (
    <div className="flex w-fit rounded-control border border-line bg-surface p-0.5">
      <ModeButton active={mode === "full"} onClick={() => onChange("full")}>
        Entire
      </ModeButton>
      <ModeButton
        active={mode === "partial"}
        onClick={() => onChange("partial")}
      >
        Partial
      </ModeButton>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-control px-2 py-1.5 text-xs font-medium ${
        active ? "bg-surface-raised text-ink" : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
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
    <select
      name={name}
      defaultValue={defaultValue}
      className={SELECT_CLASS}
      aria-label="Trigger"
    >
      <option value="last">Last</option>
      <option value="mark">Mark</option>
      <option value="index">Index</option>
    </select>
  );
}

function OrderTypeSelect({
  name,
  value,
  onChange,
}: {
  name: string;
  value: FuturesOrderType;
  onChange: (next: FuturesOrderType) => void;
}) {
  return (
    <select
      name={name}
      value={value}
      onChange={(event) =>
        onChange(event.target.value === "limit" ? "limit" : "market")
      }
      className={SELECT_CLASS}
      aria-label="Order type"
    >
      <option value="market">Market</option>
      <option value="limit">Limit</option>
    </select>
  );
}

function qtyText(
  stored: number | null,
  positionQty: number,
  mode: FuturesTpslMode,
): string {
  if (mode === "partial" && stored !== null) {
    return formatGroupedNumberInput(String(stored), true);
  }
  if (mode === "partial") {
    return formatGroupedNumberInput(String(positionQty), true);
  }
  return "";
}

function optionalNumber(raw: string): number | null {
  const value = Number(raw.replace(/,/g, "").trim());
  return value > 0 && Number.isFinite(value) ? value : null;
}

function percentFromQty(qtyRaw: string, positionQty: number): string {
  const qty = optionalNumber(qtyRaw);
  if (qty === null || !(positionQty > 0)) {
    return "";
  }
  return formatGroupedNumberInput(String((qty / positionQty) * 100), true);
}

function qtyFromPercent(percentRaw: string, positionQty: number): string {
  const percent = optionalNumber(percentRaw);
  if (percent === null || !(positionQty > 0)) {
    return "";
  }
  return formatGroupedNumberInput(String((percent / 100) * positionQty), true);
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
