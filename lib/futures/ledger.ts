import { blendEntryPrice, futuresNotionalUsdt, futuresPnlUsdt } from "./math";
import type { FuturesAction, FuturesPosition, FuturesSide } from "./model";
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
  const realized = futuresPnlUsdt({
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
