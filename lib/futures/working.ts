import { formatDcaEntryType, parseDcaClipIndex, parseDcaExitLimitKind } from "@/lib/dca/playbook";
import type {
  FuturesAction,
  FuturesOrderType,
  FuturesSide,
  FuturesTpslMode,
  FuturesTradeSource,
  FuturesTrigger,
} from "./model";
import { parseFuturesTriggerColumn, parseFuturesTradeSource } from "./model";

export type FuturesWorkingStatus = "open" | "filled" | "cancelled" | "rejected";

export type FuturesWorkingOrder = {
  id: string;
  userId: string;
  accountId: string;
  positionId: string | null;
  symbol: string;
  action: "buy" | "sell";
  side: FuturesSide;
  qty: number;
  filledQty: number;
  remainingQty: number;
  limitPrice: number;
  status: FuturesWorkingStatus;
  venue: string | null;
  environment: string | null;
  venueOrderId: string | null;
  createdAtMs: number;
  reduceOnly: boolean;
  takeProfit: number | null;
  stopLoss: number | null;
  tpTrigger: FuturesTrigger;
  slTrigger: FuturesTrigger;
  tpslMode: FuturesTpslMode;
  tpQty: number | null;
  slQty: number | null;
  tpOrderType: FuturesOrderType;
  slOrderType: FuturesOrderType;
  tpLimitPrice: number | null;
  slLimitPrice: number | null;
  trailingStop: number | null;
  trailingActive: number | null;
  source: FuturesTradeSource;
  ruleName: string | null;
  idempotencyKey: string | null;
};

export function paperLimitShouldFill(input: {
  orderSide: "Buy" | "Sell";
  limitPrice: number;
  mark: number;
}): boolean {
  if (!(input.limitPrice > 0) || !(input.mark > 0)) {
    return false;
  }
  if (input.orderSide === "Buy") {
    return input.mark <= input.limitPrice;
  }
  return input.mark >= input.limitPrice;
}

const SAME = 1e-12;

export const WORKING_AMEND_UNCHANGED = "Qty and limit are unchanged.";

export function isUnchangedWorkingAmend(error: string): boolean {
  return error === WORKING_AMEND_UNCHANGED;
}

export function sameWorkingNumber(a: number, b: number): boolean {
  return Math.abs(a - b) <= SAME;
}

export function nextWorkingAmend(input: {
  filledQty: number;
  qty: number;
  limitPrice: number;
  nextRemainingQty: number;
  nextLimitPrice: number;
}):
  | {
      ok: true;
      qty: number;
      remainingQty: number;
      limitPrice: number;
      qtyChanged: boolean;
      priceChanged: boolean;
    }
  | { ok: false; error: string } {
  if (!(input.nextRemainingQty > 0) || !Number.isFinite(input.nextRemainingQty)) {
    return {
      ok: false,
      error: "Enter a positive qty. Use Cancel to drop the rest.",
    };
  }
  if (!(input.nextLimitPrice > 0) || !Number.isFinite(input.nextLimitPrice)) {
    return { ok: false, error: "Enter a positive limit price." };
  }
  const filled = Math.max(0, input.filledQty);
  const remainingQty = input.nextRemainingQty;
  const qty = filled + remainingQty;
  if (qty <= filled + SAME) {
    return { ok: false, error: "Qty must stay above the filled amount." };
  }
  const qtyChanged = !sameWorkingNumber(qty, input.qty);
  const priceChanged = !sameWorkingNumber(
    input.nextLimitPrice,
    input.limitPrice,
  );
  if (!qtyChanged && !priceChanged) {
    return { ok: false, error: WORKING_AMEND_UNCHANGED };
  }
  return {
    ok: true,
    qty,
    remainingQty,
    limitPrice: input.nextLimitPrice,
    qtyChanged,
    priceChanged,
  };
}

export function nextWorkingFill(input: {
  qty: number;
  filledQty: number;
  venueFilledQty: number;
}): { delta: number; nextFilled: number; remaining: number; done: boolean } {
  const cap = input.qty > 0 ? input.qty : 0;
  const already = Math.max(0, input.filledQty);
  const venue = Math.min(cap, Math.max(0, input.venueFilledQty));
  const delta = Math.max(0, venue - already);
  const nextFilled = already + delta;
  const remaining = Math.max(0, cap - nextFilled);
  return {
    delta,
    nextFilled,
    remaining,
    done: remaining <= 1e-12,
  };
}

export function mapBybitOrderStatus(status: string): FuturesWorkingStatus {
  const value = status.trim().toLowerCase();
  if (value === "filled") {
    return "filled";
  }
  if (value === "rejected" || value.includes("reject")) {
    return "rejected";
  }
  if (
    value === "cancelled" ||
    value === "canceled" ||
    value === "deactivated" ||
    value.includes("cancel")
  ) {
    return "cancelled";
  }
  return "open";
}

export function workingOrderSide(action: "buy" | "sell"): "Buy" | "Sell" {
  return action === "buy" ? "Buy" : "Sell";
}

export function parseFuturesWorkingRow(
  row: Record<string, unknown>,
): FuturesWorkingOrder {
  const created = new Date(String(row.created_at ?? "")).getTime();
  const action = row.action === "sell" ? "sell" : "buy";
  const status = parseWorkingStatus(row.status);
  return {
    id: String(row.id),
    userId: String(row.user_id),
    accountId: String(row.account_id),
    positionId: row.position_id ? String(row.position_id) : null,
    symbol: String(row.symbol),
    action,
    side: row.side === "short" ? "short" : "long",
    qty: Number(row.qty) || 0,
    filledQty: Number(row.filled_qty) || 0,
    remainingQty: Number(row.remaining_qty) || 0,
    limitPrice: Number(row.limit_price) || 0,
    status,
    venue: row.venue ? String(row.venue) : null,
    environment: row.environment ? String(row.environment) : null,
    venueOrderId: row.venue_order_id ? String(row.venue_order_id) : null,
    createdAtMs: Number.isFinite(created) ? created : 0,
    reduceOnly: Boolean(row.reduce_only),
    takeProfit: Number(row.take_profit) > 0 ? Number(row.take_profit) : null,
    stopLoss: Number(row.stop_loss) > 0 ? Number(row.stop_loss) : null,
    tpTrigger: parseFuturesTriggerColumn(row.tp_trigger),
    slTrigger: parseFuturesTriggerColumn(row.sl_trigger),
    tpslMode: row.tpsl_mode === "partial" ? "partial" : "full",
    tpQty: Number(row.tp_qty) > 0 ? Number(row.tp_qty) : null,
    slQty: Number(row.sl_qty) > 0 ? Number(row.sl_qty) : null,
    tpOrderType: row.tp_order_type === "limit" ? "limit" : "market",
    slOrderType: row.sl_order_type === "limit" ? "limit" : "market",
    tpLimitPrice:
      Number(row.tp_limit_price) > 0 ? Number(row.tp_limit_price) : null,
    slLimitPrice:
      Number(row.sl_limit_price) > 0 ? Number(row.sl_limit_price) : null,
    trailingStop: Number(row.trailing_stop) > 0 ? Number(row.trailing_stop) : null,
    trailingActive:
      Number(row.trailing_active) > 0 ? Number(row.trailing_active) : null,
    source: parseFuturesTradeSource(row.source),
    ruleName: String(row.rule_name ?? "").trim() || null,
    idempotencyKey: String(row.idempotency_key ?? "").trim() || null,
  };
}

function parseWorkingStatus(raw: unknown): FuturesWorkingStatus {
  if (raw === "filled" || raw === "cancelled" || raw === "rejected") {
    return raw;
  }
  return "open";
}

export function formatWorkingStatus(status: FuturesWorkingStatus): string {
  if (status === "filled") {
    return "Filled";
  }
  if (status === "cancelled") {
    return "Cancelled";
  }
  if (status === "rejected") {
    return "Rejected";
  }
  return "Open";
}

export function workingActionLabel(
  action: FuturesAction | "buy" | "sell",
  reduceOnly = false,
): string {
  if (reduceOnly) {
    return "Close";
  }
  return action === "sell" ? "Sell" : "Buy";
}

export function workingSideLabel(action: "buy" | "sell"): "Buy" | "Sell" {
  return action === "sell" ? "Sell" : "Buy";
}

export function workingTypeLabel(row: {
  reduceOnly: boolean;
  idempotencyKey: string | null;
  takeProfit?: number | null;
  stopLoss?: number | null;
}): string {
  const clipIndex = parseDcaClipIndex(row.idempotencyKey);
  if (clipIndex !== null) {
    return formatDcaEntryType(clipIndex);
  }
  const exitKind = parseDcaExitLimitKind(row.idempotencyKey);
  if (exitKind === "tp") {
    return "Take Profit";
  }
  if (exitKind === "sl") {
    return "Stop Loss";
  }
  if (row.reduceOnly && row.takeProfit != null && row.stopLoss == null) {
    return "Take Profit";
  }
  if (row.reduceOnly && row.stopLoss != null && row.takeProfit == null) {
    return "Stop Loss";
  }
  if (row.reduceOnly) {
    return "Close";
  }
  return "Entry";
}

function workingSortRank(row: {
  idempotencyKey: string | null;
  createdAtMs: number;
}): [number, number, number] {
  const clipIndex = parseDcaClipIndex(row.idempotencyKey);
  if (clipIndex !== null) {
    return [0, clipIndex, row.createdAtMs];
  }
  const exitKind = parseDcaExitLimitKind(row.idempotencyKey);
  if (exitKind === "tp") {
    return [1, 0, row.createdAtMs];
  }
  if (exitKind === "sl") {
    return [2, 0, row.createdAtMs];
  }
  return [3, 0, row.createdAtMs];
}

function workingSourceSortKey(row: {
  source?: string;
  ruleName?: string | null;
}): string {
  const name = String(row.ruleName ?? "").trim().toLowerCase();
  const kind = String(row.source ?? "");
  return `${name}\0${kind}`;
}

export function sortFuturesWorkingRows<T extends {
  idempotencyKey: string | null;
  createdAtMs: number;
  source?: string;
  ruleName?: string | null;
}>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => {
    const sourceCmp = workingSourceSortKey(left).localeCompare(
      workingSourceSortKey(right),
    );
    if (sourceCmp !== 0) {
      return sourceCmp;
    }
    const a = workingSortRank(left);
    const b = workingSortRank(right);
    if (a[0] !== b[0]) {
      return a[0] - b[0];
    }
    if (a[1] !== b[1]) {
      return a[1] - b[1];
    }
    return a[2] - b[2];
  });
}
