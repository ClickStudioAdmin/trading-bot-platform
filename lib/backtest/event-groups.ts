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

/** Chart fill marks and indicator dots for other positions hide while one position is in focus. A null focus shows every mark. */
export function replayMarkerInPositionFocus(
  orderIndex: number | null,
  focus: ReadonlySet<number> | null,
): boolean {
  if (focus == null) {
    return true;
  }
  return orderIndex != null && focus.has(orderIndex);
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

export type ReplayLaneLabelBox = {
  x: number;
  width: number;
};

export function replayLaneLabelWidth(text: string): number {
  return Math.ceil(text.length * 6.2 + 8);
}

export function replayLaneLabelsOverlap(
  left: ReplayLaneLabelBox,
  right: ReplayLaneLabelBox,
  gap = 6,
): boolean {
  const leftStart = left.x - left.width / 2;
  const leftEnd = left.x + left.width / 2;
  const rightStart = right.x - right.width / 2;
  const rightEnd = right.x + right.width / 2;
  return leftStart < rightEnd + gap && leftEnd > rightStart - gap;
}

export function fitLaneCaption(label: string, barWidth: number): string {
  const brief = label.replace(/^Position /, "");
  if (brief !== label && barWidth < replayLaneLabelWidth(label)) {
    return brief;
  }
  return label;
}

export function placeLaneCaption(
  preferred: number,
  width: number,
  minX: number,
  maxX: number,
  placed: ReplayLaneLabelBox[],
): { x: number; clear: boolean } {
  const lo = Math.min(minX, maxX);
  const hi = Math.max(minX, maxX);
  const clamp = (value: number) => Math.min(hi, Math.max(lo, value));
  const start = clamp(preferred);
  const fits = (x: number) =>
    !placed.some((row) => replayLaneLabelsOverlap({ x, width }, row));
  if (fits(start)) {
    return { x: start, clear: true };
  }
  const span = hi - lo + width;
  for (let step = 8; step <= span; step += 8) {
    for (const candidate of [clamp(start + step), clamp(start - step)]) {
      if (fits(candidate)) {
        return { x: candidate, clear: true };
      }
    }
  }
  return { x: start, clear: false };
}

export type ReplayLogicalRange = { from: number; to: number };

/** Keep the current zoom when a position already fits. Return null when it is already fully on screen. */
export function replayPositionVisibleRange(
  positionFrom: number,
  positionTo: number,
  visible: ReplayLogicalRange | null,
): ReplayLogicalRange | null {
  const start = Math.min(positionFrom, positionTo);
  const end = Math.max(positionFrom, positionTo);
  const span = Math.max(1, end - start);
  const fitted = (): ReplayLogicalRange => {
    const pad = Math.max(4, Math.round(span * 0.08));
    return { from: start - pad, to: end + pad };
  };
  if (!visible || !(visible.to > visible.from)) {
    return fitted();
  }
  const view = visible.to - visible.from;
  if (start >= visible.from && end <= visible.to) {
    return null;
  }
  if (span <= view) {
    let from = visible.from;
    let to = visible.to;
    if (start < from) {
      from = start;
      to = start + view;
    }
    if (end > to) {
      to = end;
      from = end - view;
    }
    return { from, to };
  }
  return fitted();
}
