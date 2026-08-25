import { blendEntryPrice, futuresNotionalUsdt, futuresPnlUsdt } from "./math";
import type { FuturesAction, FuturesPosition, FuturesSide } from "./model";
import { tpslColumns, type FuturesTpsl } from "./tpsl";
import { trailingColumns, trailingWorkingColumns, type FuturesTrailing } from "./trailing";
import type { FuturesWorkingOrder } from "./working";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function insertFuturesOrder(
  supabase: SupabaseClient,
  input: {
    positionId: string;
    userId: string;
    accountId: string;
    action: FuturesAction;
    qty: number;
    price: number | null;
    notionalUsdt: number | null;
    venue?: string | null;
    environment?: string | null;
    venueOrderId?: string | null;
  },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("futures_orders").insert({
    position_id: input.positionId,
    user_id: input.userId,
    account_id: input.accountId,
    action: input.action,
    qty: input.qty,
    price: input.price,
    notional_usdt: input.notionalUsdt,
    source: "manual",
    venue: input.venue ?? null,
    environment: input.environment ?? null,
    venue_order_id: input.venueOrderId ?? null,
  });
  if (error) {
    await writeEventLog({
      level: "warning",
      scope: "trade",
      event: "trade.order_failed",
      message: error.message,
      userId: input.userId,
      accountId: input.accountId,
      strategy: FUTURES_STRATEGY_ID,
      data: { positionId: input.positionId, action: input.action },
    });
    return { error: error.message };
  }
  return { error: null };
}

export async function writeFuturesOpen(input: {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  symbol: string;
  side: FuturesSide;
  qty: number;
  price: number;
  venue?: string | null;
  environment?: string | null;
  venueOrderId?: string | null;
  tpsl?: FuturesTpsl | null;
  trailing?: FuturesTrailing | null;
}): Promise<{ ok: true; positionId: string } | { ok: false; error: string }> {
  const { data, error } = await input.supabase
    .from("futures_positions")
    .insert({
      user_id: input.userId,
      account_id: input.accountId,
      symbol: input.symbol,
      side: input.side,
      qty: input.qty,
      entry_price: input.price,
      notional_usdt: futuresNotionalUsdt(input.qty, input.price),
      realized_usdt: 0,
      status: "open",
      source: "manual",
      venue: input.venue ?? null,
      environment: input.environment ?? null,
      ...tpslColumns(input.tpsl),
      ...trailingColumns(input.trailing),
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not write the position." };
  }
  const positionId = String((data as { id: string }).id);
  const order = await insertFuturesOrder(input.supabase, {
    positionId,
    userId: input.userId,
    accountId: input.accountId,
    action: input.side === "long" ? "buy" : "sell",
    qty: input.qty,
    price: input.price,
    notionalUsdt: futuresNotionalUsdt(input.qty, input.price),
    venue: input.venue,
    environment: input.environment,
    venueOrderId: input.venueOrderId,
  });
  if (order.error) {
    return { ok: false, error: order.error };
  }
  return { ok: true, positionId };
}

export async function writeFuturesAdd(input: {
  supabase: SupabaseClient;
  row: FuturesPosition;
  qty: number;
  price: number;
  venue?: string | null;
  environment?: string | null;
  venueOrderId?: string | null;
  tpsl?: FuturesTpsl | null;
  trailing?: FuturesTrailing | null;
}): Promise<{ error: string | null }> {
  if (input.row.status !== "open") {
    return { error: "Can only add size to an open position." };
  }
  const qty = input.row.qty + input.qty;
  const entryPrice = blendEntryPrice(
    input.row.qty,
    input.row.entryPrice,
    input.qty,
    input.price,
  );
  const { error } = await input.supabase
    .from("futures_positions")
    .update({
      qty,
      entry_price: entryPrice,
      notional_usdt: futuresNotionalUsdt(qty, entryPrice),
      venue: input.venue ?? input.row.venue,
      environment: input.environment ?? input.row.environment,
      ...(input.tpsl ? tpslColumns(input.tpsl) : {}),
      ...(input.trailing ? trailingColumns(input.trailing) : {}),
    })
    .eq("id", input.row.id)
    .eq("account_id", input.row.accountId)
    .eq("status", "open");
  if (error) {
    return { error: error.message };
  }
  return insertFuturesOrder(input.supabase, {
    positionId: input.row.id,
    userId: input.row.userId,
    accountId: input.row.accountId,
    action: input.row.side === "long" ? "buy" : "sell",
    qty: input.qty,
    price: input.price,
    notionalUsdt: futuresNotionalUsdt(input.qty, input.price),
    venue: input.venue,
    environment: input.environment,
    venueOrderId: input.venueOrderId,
  });
}

export async function writeFuturesFlatten(input: {
  supabase: SupabaseClient;
  row: FuturesPosition;
  qty: number;
  price: number;
  venue?: string | null;
  environment?: string | null;
  venueOrderId?: string | null;
}): Promise<{ error: string | null }> {
  if (input.row.status !== "open") {
    return { error: "That position is already closed." };
  }
  const realized =
    input.row.realizedUsdt +
    futuresPnlUsdt({
      side: input.row.side,
      qty: input.qty,
      entryPrice: input.row.entryPrice,
      exitPrice: input.price,
    });
  const { error } = await input.supabase
    .from("futures_positions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      realized_usdt: realized,
    })
    .eq("id", input.row.id)
    .eq("account_id", input.row.accountId)
    .eq("status", "open");
  if (error) {
    return { error: error.message };
  }
  return insertFuturesOrder(input.supabase, {
    positionId: input.row.id,
    userId: input.row.userId,
    accountId: input.row.accountId,
    action: "flatten",
    qty: input.qty,
    price: input.price,
    notionalUsdt: futuresNotionalUsdt(input.qty, input.price),
    venue: input.venue,
    environment: input.environment,
    venueOrderId: input.venueOrderId,
  });
}

const CLOSE_QTY_EPS = 1e-12;

export async function writeFuturesCloseSlice(input: {
  supabase: SupabaseClient;
  row: FuturesPosition;
  qty: number;
  price: number;
  venue?: string | null;
  environment?: string | null;
  venueOrderId?: string | null;
  remainingTpsl?: FuturesTpsl | null;
}): Promise<{ error: string | null; remaining: number }> {
  if (input.row.status !== "open") {
    return { error: "That position is already closed.", remaining: 0 };
  }
  const closeQty = Math.min(input.qty, input.row.qty);
  if (!(closeQty > 0)) {
    return { error: "Nothing to close.", remaining: input.row.qty };
  }
  const remaining = input.row.qty - closeQty;
  if (remaining <= CLOSE_QTY_EPS) {
    const flattened = await writeFuturesFlatten({
      supabase: input.supabase,
      row: input.row,
      qty: closeQty,
      price: input.price,
      venue: input.venue,
      environment: input.environment,
      venueOrderId: input.venueOrderId,
    });
    return { error: flattened.error, remaining: 0 };
  }
  const realized =
    input.row.realizedUsdt +
    futuresPnlUsdt({
      side: input.row.side,
      qty: closeQty,
      entryPrice: input.row.entryPrice,
      exitPrice: input.price,
    });
  const { error } = await input.supabase
    .from("futures_positions")
    .update({
      qty: remaining,
      notional_usdt: futuresNotionalUsdt(remaining, input.row.entryPrice),
      realized_usdt: realized,
      ...tpslColumns(input.remainingTpsl ?? null),
    })
    .eq("id", input.row.id)
    .eq("account_id", input.row.accountId)
    .eq("status", "open");
  if (error) {
    return { error: error.message, remaining };
  }
  const order = await insertFuturesOrder(input.supabase, {
    positionId: input.row.id,
    userId: input.row.userId,
    accountId: input.row.accountId,
    action: "flatten",
    qty: closeQty,
    price: input.price,
    notionalUsdt: futuresNotionalUsdt(closeQty, input.price),
    venue: input.venue,
    environment: input.environment,
    venueOrderId: input.venueOrderId,
  });
  return { error: order.error, remaining };
}

export async function insertFuturesWorking(
  supabase: SupabaseClient,
  input: {
    userId: string;
    accountId: string;
    symbol: string;
    action: "buy" | "sell";
    side: FuturesSide;
    qty: number;
    limitPrice: number;
    venue?: string | null;
    environment?: string | null;
    venueOrderId?: string | null;
    positionId?: string | null;
    reduceOnly?: boolean;
    tpsl?: FuturesTpsl | null;
    trailing?: FuturesTrailing | null;
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("futures_working_orders")
    .insert({
      user_id: input.userId,
      account_id: input.accountId,
      symbol: input.symbol,
      action: input.action,
      side: input.side,
      qty: input.qty,
      filled_qty: 0,
      remaining_qty: input.qty,
      limit_price: input.limitPrice,
      status: "open",
      source: "manual",
      venue: input.venue ?? null,
      environment: input.environment ?? null,
      venue_order_id: input.venueOrderId ?? null,
      position_id: input.positionId ?? null,
      reduce_only: Boolean(input.reduceOnly),
      ...tpslColumns(input.tpsl),
      ...trailingWorkingColumns(input.trailing),
    })
    .select("id")
    .single();
  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Could not save the working order.",
    };
  }
  return { ok: true, id: String((data as { id: string }).id) };
}

export async function patchFuturesWorking(input: {
  supabase: SupabaseClient;
  row: FuturesWorkingOrder;
  qty: number;
  remainingQty: number;
  limitPrice: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.row.status !== "open") {
    return { ok: false, error: "That order is no longer open." };
  }
  const now = new Date().toISOString();
  const { data, error } = await input.supabase
    .from("futures_working_orders")
    .update({
      qty: input.qty,
      remaining_qty: input.remainingQty,
      limit_price: input.limitPrice,
      updated_at: now,
    })
    .eq("id", input.row.id)
    .eq("account_id", input.row.accountId)
    .eq("status", "open")
    .select("id");
  if (error || !data || data.length === 0) {
    return {
      ok: false,
      error: error?.message ?? "Could not update that order.",
    };
  }
  return { ok: true };
}

export async function patchFuturesTpsl(input: {
  supabase: SupabaseClient;
  row: FuturesPosition;
  tpsl: FuturesTpsl;
}): Promise<{ error: string | null }> {
  if (input.row.status !== "open") {
    return { error: "Can only set TP/SL on an open position." };
  }
  const { error } = await input.supabase
    .from("futures_positions")
    .update({
      ...tpslColumns(input.tpsl),
    })
    .eq("id", input.row.id)
    .eq("account_id", input.row.accountId)
    .eq("status", "open");
  return { error: error?.message ?? null };
}

export async function patchFuturesTrailing(input: {
  supabase: SupabaseClient;
  row: FuturesPosition;
  trailing: FuturesTrailing | null;
}): Promise<{ error: string | null }> {
  if (input.row.status !== "open") {
    return { error: "Can only set a trailing stop on an open position." };
  }
  const { error } = await input.supabase
    .from("futures_positions")
    .update({
      ...trailingColumns(input.trailing),
    })
    .eq("id", input.row.id)
    .eq("account_id", input.row.accountId)
    .eq("status", "open");
  return { error: error?.message ?? null };
}

export async function patchFuturesTrailingPeak(input: {
  supabase: SupabaseClient;
  row: FuturesPosition;
  peak: number | null;
}): Promise<{ error: string | null }> {
  if (input.row.status !== "open") {
    return { error: "Can only update a trailing stop on an open position." };
  }
  const { error } = await input.supabase
    .from("futures_positions")
    .update({
      trailing_peak: input.peak,
    })
    .eq("id", input.row.id)
    .eq("account_id", input.row.accountId)
    .eq("status", "open");
  return { error: error?.message ?? null };
}
