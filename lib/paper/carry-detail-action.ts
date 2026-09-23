"use server";

import { getSessionContext } from "@/lib/auth/session";
import { listEventLogsForAnchors, type EventLogRow } from "@/lib/logs/list";
import { ordersForCarry, parsePaperOrderRow, type PaperOrderRow } from "@/lib/paper/orders";
import { parsePaperCarryRow } from "@/lib/paper/rows";
import { createServiceClient } from "@/lib/supabase/admin";

export async function loadPaperCarryDetail(carryId: number): Promise<{
  orders: PaperOrderRow[];
  logs: EventLogRow[];
}> {
  const session = await getSessionContext();
  const supabase = createServiceClient();
  const id = Number(carryId);
  if (!session || !supabase || !Number.isFinite(id)) {
    return { orders: [], logs: [] };
  }
  const [carryResult, orderResult, logs] = await Promise.all([
    supabase
      .from("paper_carries")
      .select("*")
      .eq("account_id", session.account.id)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("paper_orders")
      .select("*")
      .eq("account_id", session.account.id)
      .eq("carry_id", id)
      .order("filled_at", { ascending: true }),
    listEventLogsForAnchors({
      accountId: session.account.id,
      field: "carryId",
      ids: [String(id)],
    }),
  ]);
  if (carryResult.error || !carryResult.data) {
    return { orders: [], logs: [] };
  }
  let carry;
  try {
    carry = parsePaperCarryRow(carryResult.data as Record<string, unknown>);
  } catch {
    return { orders: [], logs: [] };
  }
  const stored =
    orderResult.error || !orderResult.data
      ? []
      : orderResult.data.map((row) =>
          parsePaperOrderRow(row as Record<string, unknown>),
        );
  return { orders: ordersForCarry(carry, stored), logs };
}
