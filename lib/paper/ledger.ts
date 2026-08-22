import { writeEventLog } from "@/lib/logs/write";
import { closeClipPlan, type PriorCloseClip } from "@/lib/paper/close";
import {
  paperOrderInsertRow,
  type PaperOrderRow,
} from "@/lib/paper/orders";
import type { CloseReason, TradeSource } from "@/lib/paper/automation";
import type { PaperCarryRow } from "@/lib/paper/rows";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import type { SupabaseClient } from "@supabase/supabase-js";

export function priorClosesFromOrders(
  orders: PaperOrderRow[],
  carryId: number,
): PriorCloseClip[] {
  return orders
    .filter((order) => order.carryId === carryId && order.side === "close")
    .map((order) => ({
      notionalUsdt: order.notionalUsdt,
      fillBasis: order.fillBasis,
      feeRate: order.theoretical.feeRate,
    }));
}

export async function insertPaperOrder(
  supabase: SupabaseClient,
  input: Parameters<typeof paperOrderInsertRow>[0],
) {
  const { error } = await supabase
    .from("paper_orders")
    .insert(paperOrderInsertRow(input));
  if (error) {
    await writeEventLog({
      level: "warning",
      scope: "trade",
      event: "trade.order_failed",
      message: error.message,
      userId: input.userId,
      strategy: "cash-and-carry",
      data: { carryId: input.carryId, side: input.side },
    });
  }
}

export async function writeCloseClip(input: {
  supabase: SupabaseClient;
  userId: string;
  row: PaperCarryRow;
  opportunity: ScannedOpportunity;
  clipUsdt: number;
  source: TradeSource;
  reason: CloseReason | null;
  priorCloses: PriorCloseClip[];
}): Promise<{ kind: "partial" | "flat"; error: string | null }> {
  const closedAtMs = Date.now();
  const plan = closeClipPlan({
    remainingUsdt: input.row.notionalUsdt,
    clipUsdt: input.clipUsdt,
    priorCloses: input.priorCloses,
    entryBasis: input.row.entryBasis,
    exitBasis: input.opportunity.netBasis,
    feeRate: input.opportunity.feeRate,
    openedAtMs: input.row.openedAtMs,
    closedAtMs,
  });

  const update =
    plan.kind === "partial"
      ? {
          status: "closing",
          notional_usdt: plan.remainingUsdt,
          close_source: input.source,
          close_reason: input.reason,
        }
      : {
          status: "closed",
          notional_usdt: plan.openedNotionalUsdt,
          exit_basis: plan.exitBasis,
          closed_at: new Date(closedAtMs).toISOString(),
          realized_usdt: plan.realizedUsdt,
          days_held: plan.daysHeld,
          realized_apr: plan.realizedApr,
          close_source: input.source,
          close_reason: input.reason,
        };

  const { error } = await input.supabase
    .from("paper_carries")
    .update(update)
    .eq("id", input.row.id)
    .eq("user_id", input.userId)
    .in("status", ["open", "closing"]);

  if (error) {
    return { kind: plan.kind, error: error.message };
  }

  await insertPaperOrder(input.supabase, {
    userId: input.userId,
    carryId: input.row.id,
    side: "close",
    source: input.source,
    triggerReason: input.reason,
    notionalUsdt: input.clipUsdt,
    filledAt: new Date(closedAtMs),
    opportunity: input.opportunity,
    automation: input.row.automation,
  });

  return { kind: plan.kind, error: null };
}
