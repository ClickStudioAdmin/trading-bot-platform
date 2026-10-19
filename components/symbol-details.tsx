"use client";

import { useEffect, useState } from "react";
import { useDeskChartSymbol } from "@/components/desk-chart-symbol";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import {
  formatMaxLeverage,
  formatSymbolLot,
  formatSymbolPrice,
  formatSymbolSpread,
  symbolSpreadTicks,
  type SymbolQuote,
} from "@/lib/exchanges/symbol-details";

export function SymbolDetails({
  options,
  quotes,
  environment = null,
}: {
  options: LinearPerp[];
  quotes: Record<string, SymbolQuote>;
  environment?: string | null;
}) {
  const symbol = useDeskChartSymbol();
  const pair = options.find((row) => row.symbol === symbol) ?? null;
  const [live, setLive] = useState<(SymbolQuote & { symbol: string }) | null>(
    null,
  );

  useEffect(() => {
    if (!symbol) {
      return;
    }
    let dead = false;
    let timer = 0;
    const env =
      environment === "testnet" || environment === "demo" ? "testnet" : "live";

    async function pull() {
      if (document.hidden || !symbol) {
        return;
      }
      try {
        const res = await fetch(
          `/api/market/tickers?symbols=${encodeURIComponent(symbol)}&env=${env}`,
        );
        if (!res.ok) {
          return;
        }
        const body = (await res.json()) as {
          tickers?: Record<
            string,
            { bid1Price?: string; ask1Price?: string }
          >;
        };
        if (dead) {
          return;
        }
        const row = body.tickers?.[symbol];
        const bid = Number(row?.bid1Price);
        const ask = Number(row?.ask1Price);
        if (!(bid > 0) || !(ask > 0)) {
          return;
        }
        setLive({ symbol, bid, ask });
      } catch {
        return;
      }
    }

    function start() {
      window.clearInterval(timer);
      if (document.hidden) {
        return;
      }
      void pull();
      timer = window.setInterval(() => {
        void pull();
      }, 2_000);
    }

    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      dead = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", start);
    };
  }, [symbol, environment]);

  const quote =
    live && live.symbol === symbol ? live : symbol ? quotes[symbol] : undefined;
  const bid = quote?.bid ?? null;
  const ask = quote?.ask ?? null;
  const tickSize = pair?.tickSize ?? 0;
  const rows = [
    {
      label: "Bid/Ask price",
      value:
        bid != null && ask != null
          ? `${formatSymbolPrice(bid, tickSize)}/${formatSymbolPrice(ask, tickSize)}`
          : "—",
    },
    {
      label: "Spread",
      value: formatSymbolSpread(
        symbolSpreadTicks({ bid, ask, tickSize }),
      ),
    },
    { label: "Min lot size", value: formatSymbolLot(pair?.minQty) },
    { label: "Max lot size", value: formatSymbolLot(pair?.maxQty) },
    { label: "Max leverage", value: formatMaxLeverage(pair?.maxLeverage) },
    { label: "Step lot size", value: formatSymbolLot(pair?.qtyStep) },
  ];

  return (
    <section className="mt-4 border-t border-line pt-4" aria-label="Symbol details">
      <h3 className="text-sm font-semibold text-ink">Symbol Details</h3>
      <dl className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 text-sm">
            <dt className="text-ink-muted">{row.label}</dt>
            <dd className="tabular-nums text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
