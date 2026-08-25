"use client";

import { useState } from "react";
import { FuturesSymbolSelect } from "@/components/futures-symbol-select";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";

export function FuturesOrderTicket({ options }: { options: LinearPerp[] }) {
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
    <>
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
        <div className="mt-1 flex rounded-control border border-line bg-surface p-0.5">
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
            <input
              name="size"
              value={size}
              onChange={(event) => setSize(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder={unit === "usdt" ? "100" : "0.001"}
              aria-label={
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
      {orderType === "limit" ? (
        <div className="block text-sm text-ink">
          Limit price
          <span className="relative mt-1 block">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
              $
            </span>
            <input
              name="limitPrice"
              value={limitPrice}
              onChange={(event) => setLimitPrice(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.0"
              aria-label="Limit price"
              className="w-full rounded-control border border-line bg-surface-raised py-2 pr-3 pl-7 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
            />
          </span>
        </div>
      ) : null}
    </>
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
