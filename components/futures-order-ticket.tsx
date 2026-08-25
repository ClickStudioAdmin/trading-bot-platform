"use client";

import { useState, type ReactNode } from "react";
import { FuturesSymbolSelect } from "@/components/futures-symbol-select";
import { FuturesTpslFields } from "@/components/futures-tpsl";
import { FuturesTrailingFields } from "@/components/futures-trailing";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";

export function FuturesOrderTicket({
  options,
  actions,
}: {
  options: LinearPerp[];
  actions?: ReactNode;
}) {
  const [symbol, setSymbol] = useState(
    () => options.find((row) => row.symbol === "BTCUSDT")?.symbol ?? options[0]?.symbol ?? "BTCUSDT",
  );
  const [unit, setUnit] = useState<"qty" | "usdt">("qty");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [size, setSize] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const selected = options.find((row) => row.symbol === symbol);
  const baseCoin = selected?.baseCoin ?? "Token";
  const quoteCoin = quoteLabel(selected?.quoteCoin);

  return (
    <div className="space-y-4">
      <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1.2fr)_auto_minmax(14rem,1.3fr)_auto]">
        <div className="block text-sm text-ink">
          Symbol
          <FuturesSymbolSelect
            options={options}
            value={symbol}
            onChange={setSymbol}
          />
        </div>
        <div className="block text-sm text-ink">
          Type
          <input type="hidden" name="orderType" value={orderType} />
          <div className="mt-1 flex w-fit rounded-control border border-line bg-surface p-0.5">
            <UnitButton
              active={orderType === "market"}
              onClick={() => setOrderType("market")}
            >
              Market
            </UnitButton>
            <UnitButton
              active={orderType === "limit"}
              onClick={() => setOrderType("limit")}
            >
              Limit
            </UnitButton>
          </div>
        </div>
        <div className="block text-sm text-ink">
          Size
          <div className="mt-1 flex gap-1">
            <span className="relative min-w-0 flex-1">
              {unit === "usdt" ? (
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
                  $
                </span>
              ) : null}
              <GroupedNumberInput
                name="size"
                value={size}
                onChange={setSize}
                allowDecimal
                placeholder={unit === "usdt" ? "100" : "0.001"}
                ariaLabel={
                  unit === "usdt"
                    ? `Size in ${quoteCoin}`
                    : `Size in ${baseCoin}`
                }
                className={`w-full rounded-control border border-line bg-surface-raised py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none ${
                  unit === "usdt" ? "pr-3 pl-7" : "px-3"
                }`}
              />
            </span>
            <input type="hidden" name="sizeUnit" value={unit} />
            <div className="flex shrink-0 rounded-control border border-line bg-surface p-0.5">
              <UnitButton
                active={unit === "qty"}
                onClick={() => {
                  setUnit("qty");
                  setSize("");
                }}
              >
                {baseCoin}
              </UnitButton>
              <UnitButton
                active={unit === "usdt"}
                onClick={() => {
                  setUnit("usdt");
                  setSize("");
                }}
              >
                {quoteCoin}
              </UnitButton>
            </div>
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-end gap-2">{actions}</div>
        ) : null}
      </div>
      {orderType === "limit" ? (
        <div className="block max-w-xs text-sm text-ink">
          Limit price
          <span className="relative mt-1 block">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
              $
            </span>
            <GroupedNumberInput
              name="limitPrice"
              value={limitPrice}
              onChange={setLimitPrice}
              allowDecimal
              placeholder="0.0"
              ariaLabel="Limit price"
              className="w-full rounded-control border border-line bg-surface-raised py-2 pr-3 pl-7 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
            />
          </span>
        </div>
      ) : null}
      <FuturesTpslFields />
      <FuturesTrailingFields />
    </div>
  );
}

function quoteLabel(quoteCoin: string | undefined): string {
  if (quoteCoin === "USDC" || quoteCoin === "USDT") {
    return quoteCoin;
  }
  return "USDT";
}

function UnitButton({
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
        active
          ? "bg-surface-raised text-ink"
          : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
