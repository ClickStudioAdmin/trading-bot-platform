import type { FuturesOrder, FuturesPosition } from "@/lib/futures/model";
import type { FuturesWorkingOrder } from "@/lib/futures/working";
import {
  splitCompletedBacktestOrders,
  type SimulatedOrder,
} from "@/lib/backtest/model";
import { intervalMs } from "@/lib/backtest/model";
import {
  backtestFillMarkerText,
  isBacktestLadderAdd,
  listBacktestCycles,
} from "@/lib/backtest/positions";
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";
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

export function backtestChartIncludeAdds(
  interval: DcaIndicatorTimeframe,
): boolean {
  return intervalMs(interval) <= 60 * 60 * 1000;
}

export function candleRangeForFocus(
  candles: CandleBar[],
  fromMs: number,
  toMs: number,
  padBars = 4,
): { fromSec: number; toSec: number } | null {
  if (candles.length === 0) {
    return null;
  }
  const times = candles
    .map((row) => Math.floor(row.timeMs / 1000))
    .filter((row) => row > 0);
  if (times.length === 0) {
    return null;
  }
  const fromSec = Math.floor(fromMs / 1000);
  const toSec = Math.floor(Math.max(toMs, fromMs) / 1000);
  let start = 0;
  let end = 0;
  for (let i = 0; i < times.length; i += 1) {
    const time = times[i] ?? 0;
    if (time <= fromSec) {
      start = i;
    }
    if (time <= toSec) {
      end = i;
    }
  }
  start = Math.max(0, start - padBars);
  end = Math.min(times.length - 1, end + padBars);
  if (end < start) {
    end = start;
  }
  const from = times[start];
  const to = times[end];
  if (from == null || to == null) {
    return null;
  }
  return { fromSec: from, toSec: to };
}

export function buildBacktestChartOverlay(input: {
  triggerPrice: number | null;
  orders: SimulatedOrder[];
  focusCycleId?: string | null;
  includeAdds?: boolean;
  levels?: {
    entry: number | null;
    takeProfit: number | null;
    stopLoss: number | null;
    liquidation?: number | null;
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
    const liquidation = line(
      "liq",
      levels.liquidation ?? null,
      "Liquidation",
      CHART_COLORS.stopLoss,
    );
    for (const item of [entry, takeProfit, stopLoss, liquidation]) {
      if (item) {
        lines.push(item);
      }
    }
  }
  const cycles = listBacktestCycles(input.orders);
  const orderCycle = new Map<SimulatedOrder, string>();
  for (const cycle of cycles) {
    for (const order of cycle.orders) {
      orderCycle.set(order, cycle.id);
    }
  }
  const { open } = splitCompletedBacktestOrders(input.orders);
  const openSet = new Set(open);
  const includeAdds = input.includeAdds === true;
  const focusCycleId = input.focusCycleId ?? null;
  const markers: ChartMarker[] = input.orders
    .filter((row) => row.price > 0 && row.atMs > 0)
    .filter((row) => {
      if (!isBacktestLadderAdd(row)) {
        return true;
      }
      if (includeAdds) {
        return true;
      }
      return focusCycleId != null && orderCycle.get(row) === focusCycleId;
    })
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
              : row.reason === "liquidation"
                ? CHART_COLORS.stopLoss
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

/** Bar open that contains `sec`. Nearest midnight pulled afternoon fills onto the next day. */
function containingCandleSec(times: number[], sec: number): number | null {
  if (times.length === 0) {
    return null;
  }
  const first = times[0];
  const last = times[times.length - 1];
  if (first == null || last == null || sec < first) {
    return null;
  }
  if (sec >= last) {
    return last;
  }
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const value = times[mid] ?? 0;
    if (value <= sec) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return times[lo] ?? last;
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
    const timeSec = containingCandleSec(times, marker.timeSec);
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
