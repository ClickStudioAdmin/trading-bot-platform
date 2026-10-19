"use client";

import { useState, type ReactNode } from "react";
import { DeskTradeChart } from "@/components/desk-trade-chart";
import { DeskChartSymbolProvider } from "@/components/desk-chart-symbol";
import type { CandleVenue } from "@/lib/market/candles";

export function ManualTradeWorkspace({
  venue,
  environment = null,
  defaultSymbol,
  children,
}: {
  venue: CandleVenue;
  environment?: string | null;
  defaultSymbol: string;
  children: ReactNode;
}) {
  const [symbol, setSymbol] = useState(defaultSymbol);
  return (
    <DeskChartSymbolProvider value={setSymbol}>
      <div className="@container">
        <div className="grid items-start gap-4 @min-[960px]:grid-cols-[minmax(0,1fr)_22.5rem]">
          <DeskTradeChart
            venue={venue}
            environment={environment}
            symbol={symbol}
          />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </DeskChartSymbolProvider>
  );
}
