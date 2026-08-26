"use client";

import { useState } from "react";
import { FuturesSymbolSelect } from "@/components/futures-symbol-select";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  parseAutomationMode,
  type AutomationMode,
} from "@/lib/engine/decide";
import { saveFuturesAutomations } from "@/lib/futures/actions";
import {
  defaultFuturesAutomationForm,
  type FuturesAutomationFormValues,
} from "@/lib/futures/automation";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";

export function FuturesAutomationsDesk({
  rules,
  options,
  reduceOnly = false,
}: {
  rules: FuturesAutomationFormValues[];
  options: LinearPerp[];
  reduceOnly?: boolean;
}) {
  const [layers, setLayers] = useState(rules);
  const empty = layers.length === 0;
  const defaultSymbol =
    options.find((row) => row.symbol === "BTCUSDT")?.symbol ??
    options[0]?.symbol ??
    "BTCUSDT";

  return (
    <form action={saveFuturesAutomations} className="space-y-4">
      <input type="hidden" name="ruleCount" value={layers.length} />
      {empty ? (
        <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
          No rules yet. Add a rule to fire Buy, Sell, or Close when last,
          mark, or index crosses a price. Leave this empty to trade by hand.
        </p>
      ) : (
        layers.map((layer, index) => (
          <RuleCard
            key={layer.key}
            index={index}
            layer={layer}
            options={options}
            accountReduceOnly={reduceOnly}
            onRemove={() => {
              const next = layers.filter((item) => item.key !== layer.key);
              setLayers(next);
              if (next.length === 0) {
                const data = new FormData();
                data.set("ruleCount", "0");
                void saveFuturesAutomations(data);
              }
            }}
          />
        ))
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setLayers((current) => [
              ...current,
              defaultFuturesAutomationForm(current.length, defaultSymbol),
            ])
          }
          className={
            empty
              ? "rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
              : "rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong"
          }
        >
          Add rule
        </button>
        {empty ? null : (
          <PendingSubmitButton
            pendingLabel="Saving…"
            successKey="save-futures-rules"
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            Save automations
          </PendingSubmitButton>
        )}
      </div>
    </form>
  );
}

function RuleCard({
  index,
  layer,
  options,
  accountReduceOnly,
  onRemove,
}: {
  index: number;
  layer: FuturesAutomationFormValues;
  options: LinearPerp[];
  accountReduceOnly: boolean;
  onRemove: () => void;
}) {
  const prefix = `r${index}_`;
  const [mode, setMode] = useState(layer.mode);
  const [formAction, setFormAction] = useState(layer.formAction);
  const [orderType, setOrderType] = useState(layer.orderType);
  const [sizeUnit, setSizeUnit] = useState(layer.sizeUnit);
  const [size, setSize] = useState(layer.size);
  const [limitPrice, setLimitPrice] = useState(layer.limitPrice);
  const [triggerPrice, setTriggerPrice] = useState(layer.triggerPrice);
  const [symbol, setSymbol] = useState(layer.symbol);
  const closing = formAction === "close_long" || formAction === "close_short";
  const selected = options.find((row) => row.symbol === symbol);
  const baseCoin = selected?.baseCoin ?? "Token";

  return (
    <section className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="mb-2 grid grid-cols-[auto_minmax(0,1fr)_13rem_auto] items-center gap-x-2 gap-y-0.5">
        <button
          type="button"
          onClick={onRemove}
          className="justify-self-start rounded-control px-2 py-0.5 text-xs text-danger hover:bg-danger/10"
        >
          Remove
        </button>
        <label htmlFor={`${prefix}name`} className="text-[11px] text-ink-muted">
          Name
        </label>
        <label htmlFor={`${prefix}mode`} className="text-[11px] text-ink-muted">
          Mode
        </label>
        <ModeLight mode={mode} accountReduceOnly={accountReduceOnly} />
        <span />
        <input
          id={`${prefix}name`}
          name={`${prefix}name`}
          defaultValue={layer.name}
          maxLength={40}
          className="w-full rounded-control border border-line bg-surface-raised px-1.5 py-1 text-sm font-semibold text-ink focus:border-line-strong focus:outline-none"
        />
        <select
          id={`${prefix}mode`}
          name={`${prefix}mode`}
          value={mode}
          onChange={(event) => setMode(parseAutomationMode(event.target.value))}
          className="w-full rounded-control border border-line bg-surface-raised px-1.5 py-1 text-xs text-ink focus:border-line-strong focus:outline-none"
        >
          <option value="active">
            {accountReduceOnly ? "Active (Reduce only)" : "Active"}
          </option>
          <option value="reduce_only">Reduce only</option>
          <option value="disabled">Disabled</option>
        </select>
        <span />
      </div>
      <input type="hidden" name={`${prefix}id`} value={layer.id} />

      <div className="mt-3 grid items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm text-ink">
          Contract
          <FuturesSymbolSelect
            name={`${prefix}symbol`}
            options={options}
            value={symbol}
            onChange={setSymbol}
          />
        </label>
        <label className="block text-sm text-ink">
          Action
          <select
            name={`${prefix}action`}
            value={formAction}
            onChange={(event) =>
              setFormAction(
                event.target.value as FuturesAutomationFormValues["formAction"],
              )
            }
            className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
            <option value="close_long">Close long</option>
            <option value="close_short">Close short</option>
          </select>
        </label>
        <label className="block text-sm text-ink">
          Order
          <input type="hidden" name={`${prefix}orderType`} value={orderType} />
          <span className="mt-1 flex w-fit rounded-control border border-line bg-surface p-0.5">
            <Toggle active={orderType === "market"} onClick={() => setOrderType("market")}>
              Market
            </Toggle>
            <Toggle active={orderType === "limit"} onClick={() => setOrderType("limit")}>
              Limit
            </Toggle>
          </span>
        </label>
        <label className="block text-sm text-ink">
          {closing ? "Qty to close" : "Size"}
          <span className="mt-1 flex gap-1">
            <span className="relative min-w-0 flex-1">
              {!closing && sizeUnit === "usdt" ? (
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
                  $
                </span>
              ) : null}
              <GroupedNumberInput
                name={`${prefix}size`}
                value={size}
                onChange={setSize}
                allowDecimal
                className={`w-full rounded-control border border-line bg-surface-raised py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none ${
                  !closing && sizeUnit === "usdt" ? "pr-3 pl-7" : "px-3"
                }`}
              />
            </span>
            {closing ? (
              <input type="hidden" name={`${prefix}sizeUnit`} value="qty" />
            ) : (
              <>
                <input type="hidden" name={`${prefix}sizeUnit`} value={sizeUnit} />
                <span className="flex shrink-0 rounded-control border border-line bg-surface p-0.5">
                  <Toggle
                    active={sizeUnit === "qty"}
                    onClick={() => {
                      setSizeUnit("qty");
                      setSize("");
                    }}
                  >
                    {baseCoin}
                  </Toggle>
                  <Toggle
                    active={sizeUnit === "usdt"}
                    onClick={() => {
                      setSizeUnit("usdt");
                      setSize("");
                    }}
                  >
                    USDT
                  </Toggle>
                </span>
              </>
            )}
          </span>
          {closing ? (
            <span className="mt-1 block text-xs text-ink-muted">
              Empty closes the whole row.
            </span>
          ) : null}
        </label>
      </div>

      {orderType === "limit" ? (
        <label className="mt-3 block max-w-xs text-sm text-ink">
          Limit price
          <span className="relative mt-1 block">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
              $
            </span>
            <GroupedNumberInput
              name={`${prefix}limitPrice`}
              value={limitPrice}
              onChange={setLimitPrice}
              allowDecimal
              className="w-full rounded-control border border-line bg-surface-raised py-2 pr-3 pl-7 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
            />
          </span>
        </label>
      ) : null}

      <div className="mt-3 grid items-end gap-3 md:grid-cols-3">
        <label className="block text-sm text-ink">
          When
          <select
            name={`${prefix}triggerBy`}
            defaultValue={layer.triggerBy}
            className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          >
            <option value="last">Last is</option>
            <option value="mark">Mark is</option>
            <option value="index">Index is</option>
          </select>
        </label>
        <label className="block text-sm text-ink">
          Compare
          <select
            name={`${prefix}triggerCompare`}
            defaultValue={layer.triggerCompare}
            className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          >
            <option value="gte">At or above</option>
            <option value="lte">At or below</option>
          </select>
        </label>
        <label className="block text-sm text-ink">
          Price
          <span className="relative mt-1 block">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
              $
            </span>
            <GroupedNumberInput
              name={`${prefix}triggerPrice`}
              value={triggerPrice}
              onChange={setTriggerPrice}
              allowDecimal
              className="w-full rounded-control border border-line bg-surface-raised py-2 pr-3 pl-7 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
            />
          </span>
        </label>
      </div>

      {closing ? null : (
        <label className="mt-3 flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name={`${prefix}skipIfOpen`}
            value="on"
            defaultChecked={layer.skipIfOpen}
            className="mt-0.5 size-4"
          />
          <span>
            Skip if this side is already open
            <span className="mt-1 block text-xs text-ink-muted">
              Off means each new cross can add size to the same row.
            </span>
          </span>
        </label>
      )}
    </section>
  );
}

function Toggle({
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
      className={`rounded-control px-3 py-1.5 text-sm ${
        active
          ? "bg-surface-raised font-medium text-ink"
          : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ModeLight({
  mode,
  accountReduceOnly,
}: {
  mode: AutomationMode;
  accountReduceOnly: boolean;
}) {
  const fill =
    mode === "disabled"
      ? "bg-ink-faint"
      : mode === "reduce_only" || accountReduceOnly
        ? "bg-warning"
        : "bg-success";
  const label =
    mode === "disabled"
      ? "Disabled"
      : mode === "reduce_only"
        ? "Reduce only"
        : accountReduceOnly
          ? "Active · book Reduce only has priority"
          : "Active";
  return (
    <span
      className="relative flex size-3.5 shrink-0"
      title={label}
      aria-label={label}
    >
      <span className={`relative inline-flex size-3.5 rounded-full ${fill}`} />
    </span>
  );
}
