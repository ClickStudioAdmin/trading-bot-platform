import type { ReplayEvent, SimulatedOrder } from "./model";

export type ReplayPlayStats = {
  trades: number;
  winRate: number | null;
  realizedUsdt: number;
  maxDrawdownUsdt: number;
};

export function ordersThrough(
  orders: SimulatedOrder[],
  throughMs: number,
): SimulatedOrder[] {
  return orders.filter((row) => row.atMs <= throughMs);
}

export function eventsThrough(
  events: ReplayEvent[],
  throughMs: number,
): ReplayEvent[] {
  return events.filter((row) => row.atMs <= throughMs);
}

export function replayPlayStats(
  orders: SimulatedOrder[],
  startingUsdt: number,
): ReplayPlayStats {
  let realized = 0;
  let peak = startingUsdt;
  let maxDrawdown = 0;
  let trades = 0;
  let wins = 0;
  for (const order of orders) {
    realized += order.realizedUsdt ?? 0;
    const equity = startingUsdt + realized;
    if (equity > peak) {
      peak = equity;
    }
    const drawdown = peak - equity;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
    if (order.action === "flatten") {
      trades += 1;
      if ((order.realizedUsdt ?? 0) > 0) {
        wins += 1;
      }
    }
  }
  return {
    trades,
    winRate: trades > 0 ? wins / trades : null,
    realizedUsdt: realized,
    maxDrawdownUsdt: maxDrawdown,
  };
}

export function nextEventIndex(
  events: ReplayEvent[],
  throughMs: number,
): number {
  return events.findIndex((row) => row.atMs > throughMs);
}

export function previousEventIndex(
  events: ReplayEvent[],
  throughMs: number,
): number {
  let found = -1;
  for (let i = 0; i < events.length; i += 1) {
    if (events[i]!.atMs < throughMs) {
      found = i;
    }
  }
  return found;
}
