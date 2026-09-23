"use server";

import { getSessionContext } from "@/lib/auth/session";
import { listEventLogsForAnchors, type EventLogRow } from "@/lib/logs/list";
import {
  loadFuturesOrdersForPositions,
} from "@/lib/futures/list";
import type { FuturesOrder } from "@/lib/futures/model";
import { loadFuturesVenueRisk } from "@/lib/futures/venue-risk-load";
import type { FuturesVenueRisk } from "@/lib/futures/venue-risk";

export async function loadFuturesPositionFills(positionId: string): Promise<{
  orders: FuturesOrder[];
  logs: EventLogRow[];
}> {
  const session = await getSessionContext();
  const id = positionId.trim();
  if (!session || !id) {
    return { orders: [], logs: [] };
  }
  const scope = {
    accountId: session.account.id,
    userId: session.member.id,
  };
  const [orders, logs] = await Promise.all([
    loadFuturesOrdersForPositions([id], scope),
    listEventLogsForAnchors({
      accountId: session.account.id,
      field: "positionId",
      ids: [id],
    }),
  ]);
  return { orders, logs };
}

export async function loadOpenVenueRiskAction(): Promise<
  Record<string, FuturesVenueRisk>
> {
  const risk = await loadFuturesVenueRisk();
  return Object.fromEntries(risk);
}
