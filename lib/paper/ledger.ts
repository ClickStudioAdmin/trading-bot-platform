import { writeEventLog } from "@/lib/logs/write";
import { closeClipPlan, type PriorCloseClip } from "@/lib/paper/close";
import { blendEntryBasis } from "@/lib/paper/math";
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

export async function writeOpenClip(input: {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  row: PaperCarryRow;
  opportunity: ScannedOpportunity;
  clipUsdt: number;
  source?: TradeSource;
  venue?: string | null;
  environment?: string | null;
  spotOrderId?: string | null;
  futureOrderId?: string | null;
  fillQty?: number | null;
  fillSpotPrice?: number | null;
  fillFuturePrice?: number | null;
}): Promise<{ error: string | null }> {
  if (!(input.clipUsdt > 0)) {
    return { error: "Open clip must be positive." };
  }
  if (input.row.status !== "open") {
    return { error: "Can only add size to an open paper carry." };
  }

  const notionalUsdt = input.row.notionalUsdt + input.clipUsdt;
  const entryBasis = blendEntryBasis(
    input.row.notionalUsdt,
    input.row.entryBasis,
    input.clipUsdt,
    input.opportunity.netBasis,
  );

  const { data, error } = await input.supabase
    .from("paper_carries")
    .update({
      notional_usdt: notionalUsdt,
      entry_basis: entryBasis,
    })
    .eq("id", input.row.id)
    .eq("user_id", input.userId)
    .eq("account_id", input.accountId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: "Paper carry was not open." };
  }

  await insertPaperOrder(input.supabase, {
    userId: input.userId,
    accountId: input.accountId,
    carryId: input.row.id,
    side: "open",
    source: input.source ?? "engine",
    triggerReason: null,
    notionalUsdt: input.clipUsdt,
    filledAt: new Date(),
    opportunity: input.opportunity,
    automation: input.row.automation,
    venue: input.venue,
    environment: input.environment,
    spotOrderId: input.spotOrderId,
    futureOrderId: input.futureOrderId,
    fillQty: input.fillQty,
    fillSpotPrice: input.fillSpotPrice,
    fillFuturePrice: input.fillFuturePrice,
  });

  return { error: null };
}

export async function writeCloseClip(input: {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  row: PaperCarryRow;
  opportunity: ScannedOpportunity;
  clipUsdt: number;
  source: TradeSource;
  reason: CloseReason | null;
  priorCloses: PriorCloseClip[];
  venue?: string | null;
  environment?: string | null;
  spotOrderId?: string | null;
  futureOrderId?: string | null;
  fillQty?: number | null;
  fillSpotPrice?: number | null;
  fillFuturePrice?: number | null;
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
    .eq("account_id", input.accountId)
    .in("status", ["open", "closing"]);

  if (error) {
    return { kind: plan.kind, error: error.message };
  }

  await insertPaperOrder(input.supabase, {
    userId: input.userId,
    accountId: input.accountId,
    carryId: input.row.id,
    side: "close",
    source: input.source,
    triggerReason: input.reason,
    notionalUsdt: input.clipUsdt,
    filledAt: new Date(closedAtMs),
    opportunity: input.opportunity,
    automation: input.row.automation,
    venue: input.venue,
    environment: input.environment,
    spotOrderId: input.spotOrderId,
    futureOrderId: input.futureOrderId,
    fillQty: input.fillQty,
    fillSpotPrice: input.fillSpotPrice,
    fillFuturePrice: input.fillFuturePrice,
  });

  return { kind: plan.kind, error: null };
}
