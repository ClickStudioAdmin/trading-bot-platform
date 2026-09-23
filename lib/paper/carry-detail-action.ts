"use server";

import { getSessionContext } from "@/lib/auth/session";
import {
  listEventLogs,
  logsForCarry,
  type EventLogRow,
} from "@/lib/logs/list";
import { ordersForCarry, parsePaperOrderRow, type PaperOrderRow } from "@/lib/paper/orders";
import { parsePaperCarryRow } from "@/lib/paper/rows";
import { createServiceClient } from "@/lib/supabase/admin";

export async function loadPaperCarryDetail(carryId: number): Promise<{
  orders: PaperOrderRow[];
}> {
  const session = await getSessionContext();
  const supabase = createServiceClient();
  const id = Number(carryId);
  if (!session || !supabase || !Number.isFinite(id)) {
    return { orders: [] };
  }
  const [carryResult, orderResult] = await Promise.all([
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
  ]);
  if (carryResult.error || !carryResult.data) {
    return { orders: [] };
  }
  let carry;
  try {
    carry = parsePaperCarryRow(carryResult.data as Record<string, unknown>);
  } catch {
    return { orders: [] };
  }
  const stored =
    orderResult.error || !orderResult.data
      ? []
      : orderResult.data.map((row) =>
          parsePaperOrderRow(row as Record<string, unknown>),
        );
  return { orders: ordersForCarry(carry, stored) };
}

export async function loadPaperCarryLogs(
  carryId: number,
): Promise<EventLogRow[]> {
  const session = await getSessionContext();
  const supabase = createServiceClient();
  const id = Number(carryId);
  if (!session || !supabase || !Number.isFinite(id)) {
    return [];
  }
  const { data, error } = await supabase
    .from("paper_carries")
    .select("opened_at")
    .eq("account_id", session.account.id)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return [];
  }
  const openedAtMs = new Date(
    String((data as { opened_at?: unknown }).opened_at ?? ""),
  ).getTime();
  const logs = await listEventLogs(
    { scope: "", level: "", event: "" },
    {
      accountId: session.account.id,
      limit: 1000,
      scopes: ["trade", "strategy"],
      since:
        Number.isFinite(openedAtMs) && openedAtMs > 0
          ? new Date(openedAtMs - 60_000).toISOString()
          : undefined,
    },
  );
  return logsForCarry(logs, id);
}
