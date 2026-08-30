import type { FuturesOrder, FuturesPosition } from "@/lib/futures/model";
import type { FuturesWorkingOrder } from "@/lib/futures/working";
import type { SimulatedOrder } from "@/lib/backtest/model";

export const CHART_COLORS = {
  entry: "#A78BFA",
  takeProfit: "#34D399",
  stopLoss: "#F07167",
  trailing: "#F5B942",
  limit: "#9AA3B2",
  buy: "#34D399",
  sell: "#F07167",
  trigger: "#A78BFA",
} as const;

export type ChartPriceLine = {
  id: string;
  price: number;
  title: string;
  color: string;
};

export type ChartMarker = {
  timeSec: number;
  position: "belowBar" | "aboveBar";
  color: string;
  shape: "arrowUp" | "arrowDown" | "circle";
  text: string;
};

export type ChartOverlay = {
  lines: ChartPriceLine[];
  markers: ChartMarker[];
};

function line(
  id: string,
  price: number | null,
  title: string,
  color: string,
): ChartPriceLine | null {
  if (price == null || !(price > 0)) {
    return null;
  }
  return { id, price, title, color };
}

function markerTimeSec(ms: number): number {
  return Math.floor(ms / 1000);
}

export function buildLiveChartOverlay(input: {
  symbol: string;
  positions: Array<
    Pick<
      FuturesPosition,
      | "id"
      | "symbol"
      | "side"
      | "entryPrice"
      | "takeProfit"
      | "stopLoss"
      | "trailingStop"
      | "trailingActive"
    >
  >;
  working: Array<
    Pick<FuturesWorkingOrder, "id" | "symbol" | "limitPrice" | "action">
  >;
  orders?: Array<
    Pick<FuturesOrder, "id" | "action" | "price" | "filledAtMs"> & {
      symbol?: string;
    }
  >;
}): ChartOverlay {
  const lines: ChartPriceLine[] = [];
  const markers: ChartMarker[] = [];
  for (const row of input.positions) {
    if (row.symbol !== input.symbol) {
      continue;
    }
    const added = [
      line(
        `${row.id}-entry`,
        row.entryPrice,
        row.side === "short" ? "Entry short" : "Entry long",
        CHART_COLORS.entry,
      ),
      line(`${row.id}-tp`, row.takeProfit, "Take profit", CHART_COLORS.takeProfit),
      line(`${row.id}-sl`, row.stopLoss, "Stop loss", CHART_COLORS.stopLoss),
      line(
        `${row.id}-trail`,
        row.trailingActive ?? row.trailingStop,
        "Trailing",
        CHART_COLORS.trailing,
      ),
    ];
    for (const item of added) {
      if (item) {
        lines.push(item);
      }
    }
  }
  for (const row of input.working) {
    if (row.symbol !== input.symbol) {
      continue;
    }
    const item = line(
      `${row.id}-limit`,
      row.limitPrice,
      row.action === "sell" ? "Limit sell" : "Limit buy",
      CHART_COLORS.limit,
    );
    if (item) {
      lines.push(item);
    }
  }
  for (const row of input.orders ?? []) {
    if (row.symbol && row.symbol !== input.symbol) {
      continue;
    }
    if (row.price == null || !(row.price > 0) || !(row.filledAtMs > 0)) {
      continue;
    }
    const buy = row.action === "buy";
    markers.push({
      timeSec: markerTimeSec(row.filledAtMs),
      position: buy ? "belowBar" : "aboveBar",
      color: buy ? CHART_COLORS.buy : CHART_COLORS.sell,
      shape: buy ? "arrowUp" : "arrowDown",
      text: buy ? "Buy" : row.action === "flatten" ? "Close" : "Sell",
    });
  }
  return { lines, markers };
}

export function buildBacktestChartOverlay(input: {
  triggerPrice: number | null;
  orders: SimulatedOrder[];
}): ChartOverlay {
  const lines: ChartPriceLine[] = [];
  const trigger = line(
    "trigger",
    input.triggerPrice,
    "When",
    CHART_COLORS.trigger,
  );
  if (trigger) {
    lines.push(trigger);
  }
  const markers: ChartMarker[] = input.orders
    .filter((row) => row.price > 0 && row.atMs > 0)
    .map((row) => {
      const buy = row.action === "buy";
      return {
        timeSec: markerTimeSec(row.atMs),
        position: buy ? "belowBar" : "aboveBar",
        color: buy ? CHART_COLORS.buy : CHART_COLORS.sell,
        shape: buy ? "arrowUp" : "arrowDown",
        text: buy ? "Buy" : row.action === "flatten" ? "Close" : "Sell",
      } satisfies ChartMarker;
    });
  return { lines, markers };
}
