import { dcaPlannedExits } from "@/lib/dca/grid";
import { formatDcaOrdersProgress } from "@/lib/dca/playbook";
import { futuresPnlUsdt } from "@/lib/futures/math";
import type { FuturesSide } from "@/lib/futures/model";
import type {
  BacktestFillReason,
  BacktestRecipe,
  SimulatedOrder,
} from "./model";

export type BacktestPositionCycle = {
  id: string;
  side: FuturesSide;
  qty: number;
  entryPrice: number;
  firstFillPrice: number;
  notionalUsdt: number;
  openedAtMs: number;
  closedAtMs: number | null;
  status: "open" | "closed";
  realizedUsdt: number;
  orders: SimulatedOrder[];
  clipCount: number;
  exitReason: BacktestFillReason | null;
  exitPrice: number | null;
};

export function groupBacktestOrdersIntoCycles(
  orders: SimulatedOrder[],
): { open: BacktestPositionCycle[]; closed: BacktestPositionCycle[] } {
  const open: BacktestPositionCycle[] = [];
  const closed: BacktestPositionCycle[] = [];
  const pending: Record<FuturesSide, SimulatedOrder[]> = {
    long: [],
    short: [],
  };
  let index = 0;

  function flush(side: FuturesSide, flatten: SimulatedOrder | null) {
    const clips = pending[side];
    if (clips.length === 0 && !flatten) {
      return;
    }
    const fills = flatten ? [...clips, flatten] : clips;
    pending[side] = [];
    if (fills.length === 0) {
      return;
    }
    const cycle = cycleFromFills(`cycle-${index}`, fills, flatten);
    index += 1;
    if (cycle.status === "open") {
      open.push(cycle);
    } else {
      closed.push(cycle);
    }
  }

  for (const row of orders) {
    if (row.action === "flatten") {
      flush(row.side, row);
      continue;
    }
    pending[row.side].push(row);
  }
  flush("long", null);
  flush("short", null);
  closed.sort(
    (left, right) =>
      (right.closedAtMs ?? 0) - (left.closedAtMs ?? 0) ||
      right.openedAtMs - left.openedAtMs,
  );
  return { open, closed };
}

export function listBacktestCycles(
  orders: SimulatedOrder[],
): BacktestPositionCycle[] {
  const grouped = groupBacktestOrdersIntoCycles(orders);
  return [...grouped.open, ...grouped.closed].sort(
    (left, right) =>
      left.openedAtMs - right.openedAtMs || left.id.localeCompare(right.id),
  );
}

export function isBacktestLadderAdd(row: SimulatedOrder): boolean {
  return row.action !== "flatten" && (row.clipIndex ?? 1) > 1;
}

export function backtestCycleSpanMs(cycle: BacktestPositionCycle): {
  fromMs: number;
  toMs: number;
} {
  const last = cycle.orders.reduce(
    (max, row) => Math.max(max, row.atMs),
    cycle.openedAtMs,
  );
  return {
    fromMs: cycle.openedAtMs,
    toMs: cycle.closedAtMs ?? last,
  };
}

function cycleFromFills(
  id: string,
  fills: SimulatedOrder[],
  flatten: SimulatedOrder | null,
): BacktestPositionCycle {
  const clips = fills.filter((row) => row.action !== "flatten");
  const side = fills[0]?.side ?? "long";
  let qty = 0;
  let cost = 0;
  let firstFillPrice = 0;
  for (const clip of clips) {
    if (!(clip.qty > 0) || !(clip.price > 0)) {
      continue;
    }
    if (firstFillPrice === 0) {
      firstFillPrice = clip.price;
    }
    qty += clip.qty;
    cost += clip.qty * clip.price;
  }
  const entryPrice = qty > 0 ? cost / qty : (flatten?.price ?? 0);
  const openedAtMs = fills[0]?.atMs ?? 0;
  return {
    id,
    side,
    qty: flatten?.qty ?? qty,
    entryPrice,
    firstFillPrice: firstFillPrice || entryPrice,
    notionalUsdt: (flatten?.qty ?? qty) * entryPrice,
    openedAtMs,
    closedAtMs: flatten?.atMs ?? null,
    status: flatten ? "closed" : "open",
    realizedUsdt: flatten?.realizedUsdt ?? 0,
    orders: fills,
    clipCount: clips.length,
    exitReason: flatten?.reason ?? null,
    exitPrice: flatten?.price ?? null,
  };
}

export function backtestCycleOrdersLabel(
  cycle: BacktestPositionCycle,
  maxClips: number | null,
): string {
  return formatDcaOrdersProgress({
    filled: cycle.clipCount,
    maxClips,
  });
}

export function plannedExitsForBacktestCycle(
  recipe: BacktestRecipe,
  cycle: BacktestPositionCycle,
): {
  takeProfit: number | null;
  stopLoss: number | null;
  trailingStop: number | null;
} {
  if (recipe.kind !== "dca") {
    return { takeProfit: null, stopLoss: null, trailingStop: null };
  }
  return dcaPlannedExits({
    side: cycle.side,
    entryPrice: cycle.entryPrice,
    firstFillPrice: cycle.firstFillPrice,
    mark: cycle.exitPrice ?? cycle.entryPrice,
    takeProfitPct: recipe.takeProfitPct,
    stopLossPct: recipe.stopLossPct,
    takeProfitBasis: recipe.takeProfitBasis,
    stopLossBasis: recipe.stopLossBasis,
    trailingPct: recipe.trailingPct,
  });
}

export function backtestOpenMarkPrice(input: {
  side: FuturesSide;
  entryPrice: number;
  qty: number;
  unrealizedUsdt: number;
}): number | null {
  if (!(input.qty > 0) || !(input.entryPrice > 0)) {
    return null;
  }
  const mark =
    input.side === "long"
      ? input.entryPrice + input.unrealizedUsdt / input.qty
      : input.entryPrice - input.unrealizedUsdt / input.qty;
  return mark > 0 ? mark : null;
}

export function backtestReplayMarkPrice(input: {
  opens: ReadonlyArray<Pick<BacktestPositionCycle, "side" | "qty" | "entryPrice">>;
  markUsdt: number;
  lastPrice?: number | null;
}): number | null {
  if (input.lastPrice != null && input.lastPrice > 0) {
    return input.lastPrice;
  }
  const opens = input.opens.filter(
    (row) => row.qty > 0 && row.entryPrice > 0,
  );
  if (opens.length === 0) {
    return null;
  }
  if (opens.length === 1) {
    return backtestOpenMarkPrice({
      side: opens[0]!.side,
      entryPrice: opens[0]!.entryPrice,
      qty: opens[0]!.qty,
      unrealizedUsdt: input.markUsdt,
    });
  }
  let longQty = 0;
  let shortQty = 0;
  let longNotional = 0;
  let shortNotional = 0;
  for (const row of opens) {
    if (row.side === "long") {
      longQty += row.qty;
      longNotional += row.qty * row.entryPrice;
    } else {
      shortQty += row.qty;
      shortNotional += row.qty * row.entryPrice;
    }
  }
  const netQty = longQty - shortQty;
  if (!(Math.abs(netQty) > 1e-12)) {
    return null;
  }
  const mark = (input.markUsdt - shortNotional + longNotional) / netQty;
  return mark > 0 && Number.isFinite(mark) ? mark : null;
}

export function backtestCycleUnrealizedUsdt(
  cycle: Pick<BacktestPositionCycle, "side" | "qty" | "entryPrice">,
  mark: number | null,
): number | null {
  if (mark == null || !(mark > 0) || !(cycle.qty > 0) || !(cycle.entryPrice > 0)) {
    return null;
  }
  return futuresPnlUsdt({
    side: cycle.side,
    qty: cycle.qty,
    entryPrice: cycle.entryPrice,
    exitPrice: mark,
  });
}

export function backtestCycleLogLines(
  cycle: BacktestPositionCycle,
): { atMs: number; message: string }[] {
  return cycle.orders.map((row) => ({
    atMs: row.atMs,
    message: backtestFillLogMessage(row),
  }));
}

export function backtestFillLogMessage(row: SimulatedOrder): string {
  if (row.action === "flatten") {
    if (row.reason === "take_profit") {
      return `Take profit filled at ${row.price}.`;
    }
    if (row.reason === "stop") {
      return `Stop loss filled at ${row.price}.`;
    }
    if (row.reason === "trailing") {
      return `Trailing stop filled at ${row.price}.`;
    }
    if (row.reason === "liquidation") {
      return `Account liquidated at ${row.price}. Replay stopped.`;
    }
    return `Position closed at ${row.price}.`;
  }
  const index = row.clipIndex ?? 1;
  return index === 1
    ? `Entry #1 filled at ${row.price}.`
    : `Entry #${index} filled at ${row.price}.`;
}

export function backtestChartLevels(
  recipe: BacktestRecipe,
  orders: SimulatedOrder[],
  focusCycleId?: string | null,
): {
  entry: number | null;
  takeProfit: number | null;
  stopLoss: number | null;
  liquidation: number | null;
  side: "long" | "short";
} | null {
  if (!focusCycleId) {
    return null;
  }
  const cycle = listBacktestCycles(orders).find((row) => row.id === focusCycleId);
  if (!cycle) {
    return null;
  }
  const liquidated = cycle.exitReason === "liquidation";
  const planned = plannedExitsForBacktestCycle(recipe, cycle);
  return {
    entry: cycle.entryPrice,
    takeProfit: liquidated ? null : planned.takeProfit,
    stopLoss: liquidated ? null : planned.stopLoss,
    liquidation: liquidated ? cycle.exitPrice : null,
    side: cycle.side,
  };
}

export function backtestFillMarkerText(
  row: SimulatedOrder,
  stillOpen: boolean,
): string {
  const side = row.side === "short" ? "short" : "long";
  if (stillOpen) {
    const index = row.clipIndex ?? 1;
    if (index > 1) {
      return `Add ${index} ${side}`;
    }
    return side === "short" ? "Open short" : "Open long";
  }
  if (row.action === "flatten") {
    if (row.reason === "take_profit") {
      return `TP ${side}`;
    }
    if (row.reason === "stop") {
      return `SL ${side}`;
    }
    if (row.reason === "exit_if") {
      return `Exit-if ${side}`;
    }
    if (row.reason === "trailing") {
      return `Trail ${side}`;
    }
    if (row.reason === "liquidation") {
      return `Liq ${side}`;
    }
    return `Close ${side}`;
  }
  const index = row.clipIndex ?? (row.reason === "clip" ? 2 : 1);
  if (index > 1) {
    return `Add ${index} ${side}`;
  }
  return `Entry ${side}`;
}
