import type { FuturesSide } from "@/lib/futures/model";
import type { BacktestFillReason, ReplayEvent, SimulatedOrder } from "./model";
import { listBacktestCycles } from "./positions";

const LANE_EXIT_REASONS = new Set<BacktestFillReason>([
  "take_profit",
  "stop",
  "exit_if",
  "trailing",
  "close",
  "liquidation",
]);

export type ReplayEventGroup = {
  id: string;
  side: FuturesSide | null;
  label: string;
  events: ReplayEvent[];
};

export function groupReplayEventsByPosition(
  events: ReplayEvent[],
  orders: SimulatedOrder[],
): ReplayEventGroup[] {
  const cycles = listBacktestCycles(orders);
  const cycleByOrder = new Map<number, (typeof cycles)[number]>();
  const numberByCycle = new Map(cycles.map((cycle, index) => [cycle.id, index + 1]));
  for (const cycle of cycles) {
    for (const order of cycle.orders) {
      const index = orders.indexOf(order);
      if (index >= 0) {
        cycleByOrder.set(index, cycle);
      }
    }
  }

  const groups: ReplayEventGroup[] = [];
  for (const event of events) {
    const cycle =
      event.kind === "fill" && event.orderIndex != null
        ? cycleByOrder.get(event.orderIndex)
        : undefined;
    const id = cycle?.id ?? `loose-${event.atMs}-${event.reason}-${event.side}`;
    const tradeNumber = cycle ? numberByCycle.get(cycle.id) : undefined;
    const sideLabel = cycle ? (cycle.side === "short" ? "Short" : "Long") : "Skipped";
    const label = tradeNumber == null ? sideLabel : `${tradeNumber} ${sideLabel}`;
    const side = cycle?.side ?? null;
    const previous = groups[groups.length - 1];
    if (previous && previous.id === id) {
      previous.events.push(event);
      continue;
    }
    groups.push({ id, side, label, events: [event] });
  }
  return groups;
}

/** One lane per position. Chip groups stay in time order, so the same position can be split when the other side trades in between. */
export function coalesceReplayPositions(groups: ReplayEventGroup[]): ReplayEventGroup[] {
  const merged: ReplayEventGroup[] = [];
  const byId = new Map<string, ReplayEventGroup>();
  for (const group of groups) {
    const existing = byId.get(group.id);
    if (existing) {
      existing.events.push(...group.events);
      continue;
    }
    const copy = { ...group, events: [...group.events] };
    byId.set(group.id, copy);
    merged.push(copy);
  }
  return merged;
}

export function replayLaneStillOpen(events: ReplayEvent[]): boolean {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const row = events[index];
    if (row?.kind === "fill") {
      return !LANE_EXIT_REASONS.has(row.reason);
    }
  }
  return true;
}
