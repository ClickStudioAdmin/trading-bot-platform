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

/** Width of an event-lane word such as Entry or SL. Wider than the glyphs so neighbours cannot touch. */
export function replayEventLabelWidth(text: string): number {
  return Math.ceil(text.length * 8 + 6);
}

/**
 * Spread label centers so boxes on one row never overlap.
 * Labels that already clear each other stay on their marks.
 * A tight cluster stays centered on those marks.
 */
export function separateLaneLabels(
  preferred: readonly ReplayLaneLabelBox[],
  gap = 6,
  bounds?: { min: number; max: number },
): number[] {
  const count = preferred.length;
  if (count === 0) {
    return [];
  }
  const order = preferred
    .map((row, index) => ({ index, x: row.x, width: row.width }))
    .sort((left, right) => left.x - right.x || left.index - right.index);
  const placed = new Array<number>(count);
  let cursor = 0;
  let previous: (typeof order)[number] | undefined;
  while (cursor < order.length) {
    const cluster = [order[cursor]!];
    cursor += 1;
    const layout = () => {
      const packed = packLaneLabelCluster(cluster, gap);
      let shift = 0;
      if (previous) {
        const first = cluster[0]!;
        const minCenter =
          placed[previous.index]! + previous.width / 2 + gap + first.width / 2;
        shift = Math.max(0, minCenter - packed[0]!);
      }
      return { packed, shift };
    };
    while (cursor < order.length) {
      const { packed, shift } = layout();
      const last = cluster[cluster.length - 1]!;
      const rightEdge = packed[packed.length - 1]! + shift + last.width / 2;
      const next = order[cursor]!;
      if (next.x - next.width / 2 >= rightEdge + gap) {
        break;
      }
      cluster.push(next);
      cursor += 1;
    }
    const { packed, shift } = layout();
    cluster.forEach((row, index) => {
      placed[row.index] = packed[index]! + shift;
    });
    previous = cluster[cluster.length - 1];
  }
  enforceLaneLabelGaps(order, placed, gap, bounds?.min);
  if (bounds) {
    const first = order[0]!;
    const last = order[order.length - 1]!;
    const left = placed[first.index]! - first.width / 2;
    const right = placed[last.index]! + last.width / 2;
    const room = bounds.max - bounds.min;
    if (right > bounds.max && right - left <= room) {
      const shift = bounds.max - right;
      for (const row of order) {
        placed[row.index] = placed[row.index]! + shift;
      }
    }
  }
  return placed;
}

function packLaneLabelCluster(
  rows: readonly { x: number; width: number }[],
  gap: number,
): number[] {
  const first = rows[0];
  if (!first) {
    return [];
  }
  const relative = [first.width / 2];
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1]!;
    const current = rows[index]!;
    relative.push(relative[index - 1]! + (previous.width + current.width) / 2 + gap);
  }
  const packedCenter = (relative[0]! + relative[relative.length - 1]!) / 2;
  const preferredCenter = rows.reduce((sum, row) => sum + row.x, 0) / rows.length;
  const shift = preferredCenter - packedCenter;
  return relative.map((center) => center + shift);
}

function enforceLaneLabelGaps(
  order: readonly { index: number; width: number }[],
  placed: number[],
  gap: number,
  minLeft?: number,
): void {
  const first = order[0];
  if (!first) {
    return;
  }
  if (minLeft != null && placed[first.index]! < minLeft + first.width / 2) {
    placed[first.index] = minLeft + first.width / 2;
  }
  for (let step = 1; step < order.length; step += 1) {
    const previous = order[step - 1]!;
    const current = order[step]!;
    const nextCenter =
      placed[previous.index]! + previous.width / 2 + gap + current.width / 2;
    if (placed[current.index]! < nextCenter) {
      placed[current.index] = nextCenter;
    }
  }
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
