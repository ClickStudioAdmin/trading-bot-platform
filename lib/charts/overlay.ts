import type { FuturesOrder, FuturesPosition } from "@/lib/futures/model";
import type { FuturesWorkingOrder } from "@/lib/futures/working";
import {
  splitCompletedBacktestOrders,
  type SimulatedOrder,
} from "@/lib/backtest/model";
import { backtestFillMarkerText } from "@/lib/backtest/positions";
import type { CandleBar } from "@/lib/market/candles";

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
  levels?: {
    entry: number | null;
    takeProfit: number | null;
    stopLoss: number | null;
    side?: "long" | "short";
  } | null;
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
  const levels = input.levels;
  if (levels) {
    const entry = line(
      "entry",
      levels.entry,
      levels.side === "short" ? "Entry short" : "Entry long",
      CHART_COLORS.entry,
    );
    const takeProfit = line(
      "tp",
      levels.takeProfit,
      "Take profit",
      CHART_COLORS.takeProfit,
    );
    const stopLoss = line(
      "sl",
      levels.stopLoss,
      "Stop loss",
      CHART_COLORS.stopLoss,
    );
    for (const item of [entry, takeProfit, stopLoss]) {
      if (item) {
        lines.push(item);
      }
    }
  }
  const { open } = splitCompletedBacktestOrders(input.orders);
  const openSet = new Set(open);
  const markers: ChartMarker[] = input.orders
    .filter((row) => row.price > 0 && row.atMs > 0)
    .map((row) => {
      const current = openSet.has(row);
      const buy = row.action === "buy";
      const flatten = row.action === "flatten";
      return {
        timeSec: markerTimeSec(row.atMs),
        position: buy || (flatten && row.side === "short")
          ? "belowBar"
          : "aboveBar",
        color: current
          ? CHART_COLORS.entry
          : flatten
            ? row.reason === "take_profit"
              ? CHART_COLORS.takeProfit
              : CHART_COLORS.sell
            : buy
              ? CHART_COLORS.buy
              : CHART_COLORS.sell,
        shape: current ? "circle" : buy ? "arrowUp" : "arrowDown",
        text: backtestFillMarkerText(row, current),
      } satisfies ChartMarker;
    });
  return { lines, markers };
}

function nearestCandleSec(times: number[], sec: number): number | null {
  if (times.length === 0) {
    return null;
  }
  const first = times[0];
  const last = times[times.length - 1];
  if (first == null || last == null || sec < first || sec > last) {
    return null;
  }
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const value = times[mid] ?? 0;
    if (value < sec) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const right = times[lo] ?? last;
  const left = times[Math.max(0, lo - 1)] ?? first;
  return sec - left <= right - sec ? left : right;
}

export function snapOverlayToCandles(
  overlay: ChartOverlay,
  candles: CandleBar[],
): ChartOverlay {
  const times = candles
    .map((row) => Math.floor(row.timeMs / 1000))
    .filter((row) => row > 0)
    .sort((a, b) => a - b);
  const grouped = new Map<string, ChartMarker & { count: number }>();
  for (const marker of overlay.markers) {
    const timeSec = nearestCandleSec(times, marker.timeSec);
    if (timeSec == null) {
      continue;
    }
    const key = `${timeSec}:${marker.position}:${marker.text}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(key, { ...marker, timeSec, count: 1 });
    }
  }
  const markers = [...grouped.values()]
    .map((row) => ({
      timeSec: row.timeSec,
      position: row.position,
      color: row.color,
      shape: row.shape,
      text: row.count > 1 ? `${row.text} ×${row.count}` : row.text,
    }))
    .sort(
      (a, b) => a.timeSec - b.timeSec || a.position.localeCompare(b.position),
    );
  return { lines: overlay.lines, markers };
}
