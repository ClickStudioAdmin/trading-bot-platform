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
import { getSessionContext } from "@/lib/auth/session";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import {
  attachPositionLogs,
  listEventLogs,
  type EventLogRow,
} from "@/lib/logs/list";
import { createServiceClient } from "@/lib/supabase/admin";

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
  if (input?.status) {
    query = query.eq("status", input.status);
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

export async function loadOpenFuturesWorking(
  scope?: FuturesListScope,
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
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return data.map((row) =>
    parseFuturesWorkingRow(row as Record<string, unknown>),
  );
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
}> {
  const session = await getSessionContext();
  if (!session) {
    return {
      signedIn: false,
      exchangeBook: false,
      open: [],
      closed: [],
      working: [],
    };
  }
  const [rows, orders, logs, working] = await Promise.all([
    loadFuturesPositions(),
    loadFuturesOrders(),
    listEventLogs(
      { scope: "trade", level: "", event: "" },
      { accountId: session.account.id, limit: 400 },
    ),
    loadOpenFuturesWorking(),
  ]);
  const withOrders = attachOrders(rows, orders);
  const withLogs = attachPositionLogs(withOrders, logs);
  return {
    signedIn: true,
    exchangeBook: accountCanHoldConnections(session.account.mode),
    open: withLogs.filter((row) => row.status === "open"),
    closed: withLogs.filter((row) => row.status === "closed"),
    working,
  };
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
    .eq("status", "open");
  if (error || !data) {
    return [];
  }
  return data.map((row) =>
    parseFuturesPositionRow(row as Record<string, unknown>),
  );
}
