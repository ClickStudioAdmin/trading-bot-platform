import type { CandleBar } from "@/lib/market/candles";
import type { BacktestRun, EquityPoint, SimulatedOrder } from "./model";

type Leg = { qty: number; entry: number };

function emptyLegs(): Record<"long" | "short", Leg> {
  return { long: { qty: 0, entry: 0 }, short: { qty: 0, entry: 0 } };
}

function applyFill(
  legs: Record<"long" | "short", Leg>,
  realized: number,
  order: SimulatedOrder,
): number {
  if (order.action === "flatten") {
    legs[order.side] = { qty: 0, entry: 0 };
    return realized + (order.realizedUsdt ?? 0);
  }
  const leg = legs[order.side];
  const nextQty = leg.qty + order.qty;
  const entry =
    nextQty > 0
      ? (leg.entry * leg.qty + order.price * order.qty) / nextQty
      : order.price;
  legs[order.side] = { qty: nextQty, entry };
  return realized + (order.realizedUsdt ?? 0);
}

function markedEquity(
  startingUsdt: number,
  realized: number,
  legs: Record<"long" | "short", Leg>,
  price: number,
): number {
  let equity = startingUsdt + realized;
  if (legs.long.qty > 0 && price > 0) {
    equity += (price - legs.long.entry) * legs.long.qty;
  }
  if (legs.short.qty > 0 && price > 0) {
    equity += (legs.short.entry - price) * legs.short.qty;
  }
  return equity;
}

export function buildEquityTimeline(
  run: BacktestRun,
  candles: CandleBar[] = [],
): EquityPoint[] {
  if (candles.length > 0) {
    const legs = emptyLegs();
    let realized = 0;
    let index = 0;
    const points: EquityPoint[] = [
      {
        atMs: candles[0]?.timeMs ?? run.fromMs,
        equityUsdt: run.startingUsdt,
        realizedUsdt: 0,
        label: "Start",
      },
    ];
    for (const bar of candles) {
      while (
        index < run.orders.length &&
        (run.orders[index]?.atMs ?? 0) <= bar.timeMs
      ) {
        const order = run.orders[index];
        if (order) {
          realized = applyFill(legs, realized, order);
        }
        index += 1;
      }
      points.push({
        atMs: bar.timeMs,
        equityUsdt: markedEquity(run.startingUsdt, realized, legs, bar.close),
        realizedUsdt: realized,
        label:
          legs.long.qty > 0 || legs.short.qty > 0 ? "Mark" : "Equity",
      });
    }
    return points;
  }

  const points: EquityPoint[] = [
    {
      atMs: run.fromMs,
      equityUsdt: run.startingUsdt,
      realizedUsdt: 0,
      label: "Start",
    },
  ];
  const legs = emptyLegs();
  let realized = 0;
  for (const order of run.orders) {
    realized = applyFill(legs, realized, order);
    points.push({
      atMs: order.atMs,
      equityUsdt: markedEquity(run.startingUsdt, realized, legs, order.price),
      realizedUsdt: realized,
      label: `${order.action} ${order.side}`,
    });
  }
  const ending = run.stats?.endingUsdt;
  const last = points[points.length - 1];
  if (
    ending != null &&
    last &&
    (Math.abs(ending - last.equityUsdt) > 1e-6 || run.toMs > last.atMs)
  ) {
    points.push({
      atMs: run.toMs,
      equityUsdt: ending,
      realizedUsdt: run.stats?.realizedUsdt ?? realized,
      label: run.stats?.openSide ? "Mark" : "End",
    });
  }
  return points;
}

export function maxDrawdownFromEquity(
  points: readonly Pick<EquityPoint, "equityUsdt">[],
): { maxDrawdownUsdt: number; maxDrawdownPct: number | null } {
  let peak = Number.NEGATIVE_INFINITY;
  let maxDrawdownUsdt = 0;
  for (const point of points) {
    if (point.equityUsdt > peak) {
      peak = point.equityUsdt;
    }
    const drawdown = peak - point.equityUsdt;
    if (drawdown > maxDrawdownUsdt) {
      maxDrawdownUsdt = drawdown;
    }
  }
  if (!Number.isFinite(peak) || !(peak > 0)) {
    return { maxDrawdownUsdt: 0, maxDrawdownPct: null };
  }
  return {
    maxDrawdownUsdt,
    maxDrawdownPct: maxDrawdownUsdt / peak,
  };
}

export { recipeParamRows } from "./library";
