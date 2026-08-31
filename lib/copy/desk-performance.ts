import { createServiceClient } from "@/lib/supabase/admin";
import {
  parseFuturesOrderRow,
  parseFuturesPositionRow,
} from "@/lib/futures/model";
import type { FuturesDeskPosition } from "@/lib/futures/list";

function attachOrders(
  rows: ReturnType<typeof parseFuturesPositionRow>[],
  orders: ReturnType<typeof parseFuturesOrderRow>[],
): FuturesDeskPosition[] {
  return rows.map((row) => ({
    ...row,
    ruleName: null,
    orders: orders
      .filter((order) => order.positionId === row.id)
      .map((order) => ({
        ...order,
        ruleName: null,
        venueOrderId: null,
      })),
    logs: [],
  }));
}

/** Closed book for a catalogue-visible desk. No event logs, rule names, or venue ids. */
export async function loadCopyDeskPublicClosed(
  accountId: string,
): Promise<FuturesDeskPosition[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const [{ data: positions }, { data: orders }] = await Promise.all([
    supabase
      .from("futures_positions")
      .select("*")
      .eq("account_id", accountId)
      .eq("status", "closed")
      .order("closed_at", { ascending: false }),
    supabase
      .from("futures_orders")
      .select("*")
      .eq("account_id", accountId)
      .order("filled_at", { ascending: true }),
  ]);
  if (!positions) {
    return [];
  }
  return attachOrders(
    positions.map((row) =>
      parseFuturesPositionRow(row as Record<string, unknown>),
    ),
    (orders ?? []).map((row) =>
      parseFuturesOrderRow(row as Record<string, unknown>),
    ),
  );
}
