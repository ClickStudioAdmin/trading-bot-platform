import type { FuturesSide } from "@/lib/futures/model";
import type { ReplayEvent, SimulatedOrder } from "./model";
import { listBacktestCycles } from "./positions";

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
    const label = cycle
      ? cycle.side === "short"
        ? "Short"
        : "Long"
      : "Skipped";
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
