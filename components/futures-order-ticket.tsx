"use client";

import { useState, type ReactNode } from "react";
import { FuturesSymbolSelect } from "@/components/futures-symbol-select";
import { FuturesTpslFields } from "@/components/futures-tpsl";
import { FuturesTrailingFields } from "@/components/futures-trailing";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import {
  formatPerpMinQty,
  perpEffectiveMaxQty,
  perpTicketLimitError,
  perpTicketSizeError,
} from "@/lib/exchanges/bybit/ticket-size";

export function FuturesOrderTicket({
  options,
  lastPrices = {},
  actions,
  includeStops = true,
}: {
  options: LinearPerp[];
  lastPrices?: Record<string, number>;
  actions?: ReactNode;
  includeStops?: boolean;
}) {
  const [symbol, setSymbol] = useState(
    () =>
      options.find((row) => row.symbol === "BTCUSDT")?.symbol ??
      options[0]?.symbol ??
      "BTCUSDT",
  );
  const [unit, setUnit] = useState<"qty" | "usdt">("qty");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [size, setSize] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const selected = options.find((row) => row.symbol === symbol);
  const baseCoin = selected?.baseCoin ?? "Token";
  const quoteCoin = quoteLabel(selected?.quoteCoin);
  const minQty = selected?.minQty ?? 0;
  const maxQty = perpEffectiveMaxQty({
    maxQty: selected?.maxQty ?? 0,
    maxMktQty: selected?.maxMktQty ?? 0,
    orderType,
  });
  const minNotional = selected?.minNotional ?? 0;
  const minPrice = selected?.minPrice ?? 0;
  const tickSize = selected?.tickSize ?? 0;
  const sizeError = perpTicketSizeError({
    size,
    unit,
    minQty,
    maxQty,
    minNotional,
    lastPrice: lastPrices[symbol] ?? null,
    limitPrice,
    orderType,
    baseCoin,
  });
  const limitError =
    orderType === "limit"
      ? perpTicketLimitError({
          limitPrice,
          minPrice,
          tickSize,
        })
      : null;
  const ticketError = sizeError ?? limitError;
  const qtyPlaceholder = minQty > 0 ? formatPerpMinQty(minQty) : "0.001";
  const limitPlaceholder =
    minPrice > 0
      ? formatPerpMinQty(minPrice)
      : tickSize > 0
        ? formatPerpMinQty(tickSize)
        : "0.0";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid min-w-0 flex-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1.1fr)_auto_minmax(13rem,1.2fr)]">
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
                  placeholder={unit === "usdt" ? "100" : qtyPlaceholder}
                  ariaLabel={
                    unit === "usdt"
                      ? `Size in ${quoteCoin}`
                      : `Size in ${baseCoin}`
                  }
                  className={`w-full rounded-control border bg-surface-raised py-2 text-sm tabular-nums text-ink focus:outline-none ${
                    sizeError
                      ? "border-danger focus:border-danger"
                      : "border-line focus:border-line-strong"
                  } ${unit === "usdt" ? "pr-3 pl-7" : "px-3"}`}
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
            {sizeError ? (
              <p className="mt-1 text-xs text-danger">{sizeError}</p>
            ) : null}
          </div>
          {orderType === "limit" ? (
            <div className="block text-sm text-ink">
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
                  placeholder={limitPlaceholder}
                  ariaLabel="Limit price"
                  className={`w-full rounded-control border bg-surface-raised py-2 pr-3 pl-7 text-sm tabular-nums text-ink focus:outline-none ${
                    limitError
                      ? "border-danger focus:border-danger"
                      : "border-line focus:border-line-strong"
                  }`}
                />
              </span>
              {limitError ? (
                <p className="mt-1 text-xs text-danger">{limitError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="ml-auto text-sm">
            <span className="invisible select-none" aria-hidden>
              Order
            </span>
            <fieldset
              disabled={Boolean(ticketError)}
              className="mt-1 flex flex-wrap gap-2 border-0 p-0 disabled:opacity-40"
            >
              {actions}
            </fieldset>
          </div>
        ) : null}
      </div>
      {includeStops ? (
        <>
          <FuturesTpslFields />
          <FuturesTrailingFields />
        </>
      ) : null}
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
