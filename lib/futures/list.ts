import {
  parseFuturesOrderRow,
  parseFuturesPositionRow,
  type FuturesOrder,
  type FuturesPosition,
} from "./model";
import {
  parseFuturesWorkingRow,
  type FuturesWorkingOrder,
} from "./working";
import { listFuturesOrderWebhookNames } from "./webhook-load";
import { getSessionContext } from "@/lib/auth/session";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import {
  attachPositionLogs,
  listEventLogs,
  listEventLogsForAnchors,
  mergeEventLogs,
  type EventLogRow,
} from "@/lib/logs/list";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  FUTURES_LIVE_POSITION_STATUSES,
  FUTURES_LIVE_WORKING_STATUSES,
  futuresPositionIsLive,
} from "./pending-close";

export type FuturesListScope = {
  accountId: string;
  userId: string;
};

async function resolveFuturesListScope(
  scope?: FuturesListScope,
): Promise<FuturesListScope | null> {
  if (scope) {
    return scope;
  }
  const session = await getSessionContext();
  if (!session) {
    return null;
  }
  return {
    accountId: session.account.id,
    userId: session.member.id,
  };
}

export async function loadFuturesPositions(input?: {
  status?: "open" | "closed";
  scope?: FuturesListScope;
}): Promise<FuturesPosition[]> {
  const resolved = await resolveFuturesListScope(input?.scope);
  const supabase = createServiceClient();
  if (!resolved || !supabase) {
    return [];
  }
  let query = supabase
    .from("futures_positions")
    .select("*")
    .eq("account_id", resolved.accountId)
    .eq("user_id", resolved.userId)
    .order("opened_at", { ascending: false });
  if (input?.status === "closed") {
    query = query.eq("status", "closed");
  } else if (input?.status === "open") {
    query = query.in("status", [...FUTURES_LIVE_POSITION_STATUSES]);
  }
  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  return data.map((row) =>
    parseFuturesPositionRow(row as Record<string, unknown>),
  );
}

export async function loadFuturesOrders(): Promise<FuturesOrder[]> {
  const session = await getSessionContext();
  const supabase = createServiceClient();
  if (!session || !supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("futures_orders")
    .select("*")
    .eq("account_id", session.account.id)
    .eq("user_id", session.member.id)
    .order("filled_at", { ascending: true });
  if (error || !data) {
    return [];
  }
  return data.map((row) =>
    parseFuturesOrderRow(row as Record<string, unknown>),
  );
}

export async function loadFuturesWorking(
  scope?: FuturesListScope,
  statuses: readonly string[] = ["open"],
): Promise<FuturesWorkingOrder[]> {
  const resolved = await resolveFuturesListScope(scope);
  const supabase = createServiceClient();
  if (!resolved || !supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("futures_working_orders")
    .select("*")
    .eq("account_id", resolved.accountId)
    .eq("user_id", resolved.userId)
    .in("status", [...statuses])
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return data.map((row) =>
    parseFuturesWorkingRow(row as Record<string, unknown>),
  );
}

export async function loadOpenFuturesWorking(
  scope?: FuturesListScope,
): Promise<FuturesWorkingOrder[]> {
  return loadFuturesWorking(scope, ["open"]);
}

export async function loadLiveFuturesWorking(
  scope?: FuturesListScope,
): Promise<FuturesWorkingOrder[]> {
  return loadFuturesWorking(scope, [...FUTURES_LIVE_WORKING_STATUSES]);
}

export type FuturesDeskPosition = FuturesPosition & {
  orders: FuturesOrder[];
  logs: EventLogRow[];
};

function attachOrders(
  rows: FuturesPosition[],
  orders: FuturesOrder[],
): (FuturesPosition & { orders: FuturesOrder[] })[] {
  return rows.map((row) => ({
    ...row,
    orders: orders.filter((order) => order.positionId === row.id),
  }));
}

export async function loadFuturesDesk(): Promise<{
  signedIn: boolean;
  exchangeBook: boolean;
  open: FuturesDeskPosition[];
  closed: FuturesDeskPosition[];
  working: FuturesWorkingOrder[];
  webhookNames: string[];
}> {
  const session = await getSessionContext();
  if (!session) {
    return {
      signedIn: false,
      exchangeBook: false,
      open: [],
      closed: [],
      working: [],
      webhookNames: [],
    };
  }
  const [rows, orders, working, webhookNames] = await Promise.all([
    loadFuturesPositions(),
    loadFuturesOrders(),
    loadLiveFuturesWorking(),
    listFuturesOrderWebhookNames(session.account.id),
  ]);
  const liveOpenedMs = rows.reduce((oldest, row) => {
    if (!futuresPositionIsLive(row.status) || !(row.openedAtMs > 0)) {
      return oldest;
    }
    return oldest === 0 ? row.openedAtMs : Math.min(oldest, row.openedAtMs);
  }, 0);
  const [recentLogs, anchoredLogs] = await Promise.all([
    listEventLogs(
      { scope: "", level: "", event: "" },
      {
        accountId: session.account.id,
        limit: 500,
        scopes: ["trade", "strategy"],
        since:
          liveOpenedMs > 0
            ? new Date(liveOpenedMs - 60_000).toISOString()
            : undefined,
      },
    ),
    listEventLogsForAnchors({
      accountId: session.account.id,
      field: "positionId",
      ids: rows.map((row) => row.id),
    }),
  ]);
  const logs = mergeEventLogs(recentLogs, anchoredLogs);
  const withOrders = attachOrders(rows, orders);
  const withLogs = attachPositionLogs(withOrders, logs);
  return {
    signedIn: true,
    exchangeBook: accountCanHoldConnections(session.account.mode),
    open: withLogs.filter((row) => futuresPositionIsLive(row.status)),
    closed: withLogs.filter((row) => row.status === "closed"),
    working,
    webhookNames,
  };
}

export async function loadOpenFuturesByRuleId(
  ruleId: string,
  scope?: FuturesListScope,
): Promise<FuturesPosition[]> {
  const resolved = await resolveFuturesListScope(scope);
  const supabase = createServiceClient();
  const id = String(ruleId ?? "").trim();
  if (!resolved || !supabase || !id) {
    return [];
  }
  const { data, error } = await supabase
    .from("futures_positions")
    .select("*")
    .eq("account_id", resolved.accountId)
    .eq("user_id", resolved.userId)
    .in("status", [...FUTURES_LIVE_POSITION_STATUSES])
    .eq("rule_id", id);
  if (error || !data) {
    return [];
  }
  return data.map((row) =>
    parseFuturesPositionRow(row as Record<string, unknown>),
  );
}

export async function loadOpenFuturesOnSymbol(
  symbol: string,
  scope?: FuturesListScope,
): Promise<FuturesPosition[]> {
  const resolved = await resolveFuturesListScope(scope);
  const supabase = createServiceClient();
  if (!resolved || !supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("futures_positions")
    .select("*")
    .eq("account_id", resolved.accountId)
    .eq("user_id", resolved.userId)
    .eq("symbol", symbol)
    .in("status", [...FUTURES_LIVE_POSITION_STATUSES]);
  if (error || !data) {
    return [];
  }
  return data.map((row) =>
    parseFuturesPositionRow(row as Record<string, unknown>),
  );
}
