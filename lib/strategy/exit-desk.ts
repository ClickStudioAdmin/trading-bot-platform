import { createServiceClient } from "@/lib/supabase/admin";
import type { FuturesSide } from "@/lib/futures/model";
import { writeFuturesCloseSlice } from "@/lib/futures/ledger";
import type { CandleBar } from "@/lib/market/candles";
import type { TradingAccountMode } from "@/lib/accounts/model";
import type { FuturesPosition } from "@/lib/futures/model";
import {
  evaluateExitActions,
  exitRuntimeFromJson,
  openLotsFromFills,
  sideExitActions,
  type ExitBreakevenMove,
  type ExitClaim,
  type ExitLot,
  type ExitRuntime,
  type StoredExitAction,
} from "@/lib/strategy/exit-actions";

export { sideExitActions };

async function loadExitBook(positionId: string): Promise<{
  runtime: ExitRuntime;
  fills: { id: string; action: string; qty: number; price: number | null }[];
}> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { runtime: { arms: {} }, fills: [] };
  }
  const [position, orders] = await Promise.all([
    supabase
      .from("futures_positions")
      .select("exit_runtime")
      .eq("id", positionId)
      .maybeSingle(),
    supabase
      .from("futures_orders")
      .select("id, action, qty, price")
      .eq("position_id", positionId)
      .order("filled_at", { ascending: true }),
  ]);
  const fills = (orders.data ?? []).map((row) => ({
    id: String(row.id),
    action: String(row.action),
    qty: Number(row.qty),
    price: row.price == null ? null : Number(row.price),
  }));
  return {
    runtime: exitRuntimeFromJson(position.data?.exit_runtime),
    fills,
  };
}

export async function saveExitRuntime(
  positionId: string,
  runtime: ExitRuntime,
): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  await supabase
    .from("futures_positions")
    .update({ exit_runtime: runtime })
    .eq("id", positionId);
}

export async function decideOpenExit(input: {
  actions: readonly StoredExitAction[];
  positionId: string | null;
  side: FuturesSide;
  qty: number;
  entryPrice: number | null;
  mark: number | null;
  last: number | null;
  index?: number | null;
  barsByTimeframe: Map<string, CandleBar[]>;
  firedWebhookId?: string | null;
  signalSide?: FuturesSide | null;
  nowMs?: number;
  stepQty?: number;
  breakevenDone?: boolean;
}): Promise<{ claims: ExitClaim[]; runtime: ExitRuntime; lots: ExitLot[]; breakeven: ExitBreakevenMove | null } | null> {
  if (!(input.mark != null && input.mark > 0) || !(input.qty > 0)) {
    return null;
  }
  const book = input.positionId
    ? await loadExitBook(input.positionId)
    : { runtime: { arms: {} }, fills: [] as { id: string; action: string; qty: number; price: number | null }[] };
  const lots = openLotsFromFills(book.fills, input.side);
  const seeded =
    lots.length > 0
      ? lots
      : input.entryPrice != null
        ? [{ id: "position", qty: input.qty, price: input.entryPrice }]
        : [];
  return evaluateExitActions({
    actions: input.actions,
    runtime: { arms: book.runtime.arms },
    lots: seeded,
    side: input.side,
    mark: input.mark,
    last: input.last ?? input.mark,
    entryPrice: input.entryPrice,
    nowMs: input.nowMs ?? Date.now(),
    barsByTimeframe: input.barsByTimeframe,
    firedWebhookId: input.firedWebhookId,
    signalSide: input.signalSide,
    stepQty: input.stepQty,
    breakevenDone: input.breakevenDone,
    prices: {
      last: input.last,
      mark: input.mark,
      index: input.index ?? null,
    },
  });
}

export async function applyPaperExitClaims(input: {
  mode: TradingAccountMode;
  position: FuturesPosition;
  price: number;
  claims: readonly ExitClaim[];
  runtime: ExitRuntime;
}): Promise<{ applied: boolean; remaining: number }> {
  if (input.mode !== "paper" || !(input.price > 0)) {
    return { applied: false, remaining: input.position.qty };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { applied: false, remaining: input.position.qty };
  }
  let remaining = input.position.qty;
  let row = input.position;
  for (const claim of input.claims) {
    const closed = await writeFuturesCloseSlice({
      supabase,
      row,
      qty: claim.qty,
      price: input.price,
      source: "engine",
      ruleId: row.ruleId,
      ruleName: row.ruleName,
    });
    if (closed.error) {
      return { applied: false, remaining };
    }
    remaining = closed.remaining;
    row = { ...row, qty: remaining };
  }
  await saveExitRuntime(input.position.id, input.runtime);
  return { applied: true, remaining };
}
