"use server";

import { getSessionContext } from "@/lib/auth/session";
import {
  listEventLogs,
  logsForPosition,
  type EventLogRow,
} from "@/lib/logs/list";
import { loadFuturesOrdersForPositions } from "@/lib/futures/list";
import type { FuturesOrder } from "@/lib/futures/model";
import { createServiceClient } from "@/lib/supabase/admin";
import { loadFuturesVenueRisk } from "@/lib/futures/venue-risk-load";
import type { FuturesVenueRisk } from "@/lib/futures/venue-risk";

export async function loadFuturesPositionFills(positionId: string): Promise<{
  orders: FuturesOrder[];
}> {
  const session = await getSessionContext();
  const id = positionId.trim();
  if (!session || !id) {
    return { orders: [] };
  }
  const orders = await loadFuturesOrdersForPositions([id], {
    accountId: session.account.id,
    userId: session.member.id,
  });
  return { orders };
}

export async function loadFuturesPositionLogs(
  positionId: string,
): Promise<EventLogRow[]> {
  const session = await getSessionContext();
  const supabase = createServiceClient();
  const id = positionId.trim();
  if (!session || !supabase || !id) {
    return [];
  }
  const { data, error } = await supabase
    .from("futures_positions")
    .select("symbol, side, rule_id, rule_name, opened_at, closed_at")
    .eq("account_id", session.account.id)
    .eq("user_id", session.member.id)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return [];
  }
  const row = data as Record<string, unknown>;
  const openedAtMs = new Date(String(row.opened_at ?? "")).getTime();
  const closedRaw = row.closed_at;
  const closedAtMs = closedRaw
    ? new Date(String(closedRaw)).getTime()
    : Number.NaN;
  const recent = await listEventLogs(
    { scope: "", level: "", event: "" },
    {
      accountId: session.account.id,
      limit: 500,
      scopes: ["trade", "strategy"],
      since:
        Number.isFinite(openedAtMs) && openedAtMs > 0
          ? new Date(openedAtMs - 60_000).toISOString()
          : undefined,
    },
  );
  return logsForPosition(recent, {
    id,
    symbol: String(row.symbol ?? ""),
    side: String(row.side ?? ""),
    ruleId: String(row.rule_id ?? "").trim() || null,
    ruleName: String(row.rule_name ?? "").trim() || null,
    openedAtMs: Number.isFinite(openedAtMs) ? openedAtMs : 0,
    closedAtMs: Number.isFinite(closedAtMs) ? closedAtMs : null,
  });
}

export async function loadOpenVenueRiskAction(): Promise<
  Record<string, FuturesVenueRisk>
> {
  const risk = await loadFuturesVenueRisk();
  return Object.fromEntries(risk);
}
