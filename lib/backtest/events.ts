import type { FuturesSide } from "@/lib/futures/model";
import { formatPrice } from "@/lib/opportunities/format";
import {
  parseBacktestClipIndex,
  parseBacktestFillReason,
  type BacktestFillReason,
  type ReplayEvent,
  type SimulatedOrder,
} from "./model";

export type { ReplayEvent };

export function fillSentence(input: {
  reason: BacktestFillReason;
  side: FuturesSide;
  price: number;
  clipIndex?: number;
  because?: string;
}): string {
  const side = input.side === "short" ? "short" : "long";
  const price = formatPrice(input.price);
  const because = input.because?.trim() ? ` ${input.because.trim()}` : "";
  if (input.reason === "entry") {
    return `Entry ${side} at ${price}.${because} Filled at the bar close.`;
  }
  if (input.reason === "clip") {
    const index = input.clipIndex ?? 2;
    return `Add ${index} ${side} at ${price}. The adverse wick reached the resting limit.`;
  }
  if (input.reason === "take_profit") {
    return `Take profit ${side} at ${price}. The favorable wick reached the limit. The stop on this bar was not hit.`;
  }
  if (input.reason === "stop") {
    return `Stop ${side} at ${price}. The adverse wick reached the stop before take profit.`;
  }
  if (input.reason === "trailing") {
    return `Trail ${side} at ${price}. The trailing stop was hit on the adverse wick.`;
  }
  if (input.reason === "exit_if") {
    return `Exit ${side} at ${price}.${because} Filled at the bar close.`;
  }
  if (input.reason === "liquidation") {
    return `Liquidation ${side} at ${price}. Marked equity reached zero on the adverse wick.`;
  }
  return `Close ${side} at ${price}.${because} Filled at the bar close.`;
}

export function skippedEntrySentence(
  side: FuturesSide,
  because?: string,
): string {
  const detail = because?.trim() ? `${because.trim()} ` : "";
  return `Skipped entry ${side}. ${detail}Margin plus fee was more than cash left.`;
}

export function eventsFromOrders(orders: SimulatedOrder[]): ReplayEvent[] {
  return orders.map((order, orderIndex) => ({
    atMs: order.atMs,
    kind: "fill" as const,
    reason: order.reason ?? "close",
    orderIndex,
    side: order.side,
    clipIndex: order.clipIndex,
    text: fillSentence({
      reason: order.reason ?? "close",
      side: order.side,
      price: order.price,
      clipIndex: order.clipIndex,
    }),
  }));
}

export function parseReplayEvents(raw: unknown): ReplayEvent[] | null {
  if (raw == null) {
    return null;
  }
  if (!Array.isArray(raw)) {
    return null;
  }
  const rows: ReplayEvent[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    const atMs = Number(row.atMs);
    const reason = parseBacktestFillReason(row.reason);
    const text = String(row.text ?? "").trim();
    if (!(atMs > 0) || !reason || !text) {
      continue;
    }
    const kind = row.kind === "skipped" ? "skipped" : "fill";
    const orderIndex = Number(row.orderIndex);
    rows.push({
      atMs,
      kind,
      reason,
      orderIndex:
        Number.isInteger(orderIndex) && orderIndex >= 0 ? orderIndex : null,
      side: row.side === "short" ? "short" : "long",
      clipIndex: parseBacktestClipIndex(row.clipIndex),
      text,
    });
  }
  return rows;
}

export function eventForOrder(
  events: ReplayEvent[],
  order: SimulatedOrder,
  orderIndex: number,
): ReplayEvent | null {
  const indexed = events.find(
    (row) => row.kind === "fill" && row.orderIndex === orderIndex,
  );
  if (indexed) {
    return indexed;
  }
  return (
    events.find(
      (row) =>
        row.kind === "fill" &&
        row.atMs === order.atMs &&
        row.reason === (order.reason ?? "close") &&
        row.side === order.side &&
        (order.clipIndex == null || row.clipIndex === order.clipIndex),
    ) ?? null
  );
}
