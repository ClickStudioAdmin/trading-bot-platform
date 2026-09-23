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

export function futuresBotBookQuery(input: {
  symbol?: string | null;
  ruleId?: string | null;
  ruleName?: string | null;
}): {
  positions: { symbol: string } | { ruleId: string } | null;
  working: { symbol: string } | { ruleName: string } | null;
} {
  const symbol = String(input.symbol ?? "").trim();
  const ruleId = String(input.ruleId ?? "").trim();
  const ruleName = String(input.ruleName ?? "").trim();
  if (!symbol && !ruleId) {
    return { positions: null, working: null };
  }
  return {
    positions: ruleId ? { ruleId } : { symbol },
    working: ruleName ? { ruleName } : symbol ? { symbol } : null,
  };
}

async function countLiveFuturesRows(
  table: "futures_positions" | "futures_working_orders",
  statuses: readonly string[],
  scope?: FuturesListScope,
): Promise<number> {
  const resolved = await resolveFuturesListScope(scope);
  const supabase = createServiceClient();
  if (!resolved || !supabase) {
    return 0;
  }
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("account_id", resolved.accountId)
    .eq("user_id", resolved.userId)
    .in("status", [...statuses]);
  if (error || count == null) {
    return 0;
  }
  return count;
}

export async function loadFuturesOrdersForPositions(
  positionIds: readonly string[],
  scope?: FuturesListScope,
): Promise<FuturesOrder[]> {
  const resolved = await resolveFuturesListScope(scope);
  const supabase = createServiceClient();
  const ids = [...new Set(positionIds.map((id) => id.trim()).filter(Boolean))];
  if (!resolved || !supabase || ids.length === 0) {
    return [];
  }
  const pages: FuturesOrder[] = [];
  for (let index = 0; index < ids.length; index += 40) {
    const batch = ids.slice(index, index + 40);
    const { data, error } = await supabase
      .from("futures_orders")
      .select("*")
      .eq("account_id", resolved.accountId)
      .eq("user_id", resolved.userId)
      .in("position_id", batch)
      .order("filled_at", { ascending: true });
    if (error || !data) {
      continue;
    }
    pages.push(
      ...data.map((row) => parseFuturesOrderRow(row as Record<string, unknown>)),
    );
  }
  return pages;
}

export async function loadLiveFuturesWorkingMatching(
  filter: { symbol: string } | { ruleName: string },
  scope?: FuturesListScope,
): Promise<FuturesWorkingOrder[]> {
  const resolved = await resolveFuturesListScope(scope);
  const supabase = createServiceClient();
  if (!resolved || !supabase) {
    return [];
  }
  let query = supabase
    .from("futures_working_orders")
    .select("*")
    .eq("account_id", resolved.accountId)
    .eq("user_id", resolved.userId)
    .in("status", [...FUTURES_LIVE_WORKING_STATUSES])
    .order("created_at", { ascending: false });
  if ("ruleName" in filter) {
    query = query.eq("rule_name", filter.ruleName);
  } else {
    query = query.eq("symbol", filter.symbol);
  }
  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  return data.map((row) =>
    parseFuturesWorkingRow(row as Record<string, unknown>),
  );
}

export type FuturesOpenBook = {
  signedIn: boolean;
  exchangeBook: boolean;
  open: FuturesDeskPosition[];
  working: FuturesWorkingOrder[];
  webhookNames: string[];
  closeAllOpenCount: number;
  cancelAllWorkingCount: number;
  fillsLoaded: boolean;
};

export function futuresOpenBookFromDesk(desk: {
  signedIn: boolean;
  exchangeBook: boolean;
  open: FuturesDeskPosition[];
  working: FuturesWorkingOrder[];
  webhookNames: string[];
}): FuturesOpenBook {
  return {
    signedIn: desk.signedIn,
    exchangeBook: desk.exchangeBook,
    open: desk.open,
    working: desk.working,
    webhookNames: desk.webhookNames,
    closeAllOpenCount: desk.open.length,
    cancelAllWorkingCount: desk.working.length,
    fillsLoaded: true,
  };
}

const EMPTY_OPEN_BOOK: FuturesOpenBook = {
  signedIn: false,
  exchangeBook: false,
  open: [],
  working: [],
  webhookNames: [],
  closeAllOpenCount: 0,
  cancelAllWorkingCount: 0,
  fillsLoaded: false,
};

export async function loadFuturesBotBook(input: {
  symbol?: string | null;
  ruleId?: string | null;
  ruleName?: string | null;
}): Promise<FuturesOpenBook> {
  const session = await getSessionContext();
  if (!session) {
    return EMPTY_OPEN_BOOK;
  }
  const scope: FuturesListScope = {
    accountId: session.account.id,
    userId: session.member.id,
  };
  const query = futuresBotBookQuery(input);
  const [closeAllOpenCount, cancelAllWorkingCount, webhookNames, rows, working] =
    await Promise.all([
      countLiveFuturesRows(
        "futures_positions",
        FUTURES_LIVE_POSITION_STATUSES,
        scope,
      ),
      countLiveFuturesRows(
        "futures_working_orders",
        FUTURES_LIVE_WORKING_STATUSES,
        scope,
      ),
      listFuturesOrderWebhookNames(session.account.id),
      query.positions
        ? "ruleId" in query.positions
          ? loadOpenFuturesByRuleId(query.positions.ruleId, scope)
          : loadOpenFuturesOnSymbol(query.positions.symbol, scope)
        : Promise.resolve([]),
      query.working
        ? loadLiveFuturesWorkingMatching(query.working, scope)
        : Promise.resolve([]),
    ]);
  return {
    signedIn: true,
    exchangeBook: accountCanHoldConnections(session.account.mode),
    open: rows.map((row) => ({ ...row, orders: [], logs: [] })),
    working,
    webhookNames,
    closeAllOpenCount,
    cancelAllWorkingCount,
    fillsLoaded: false,
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
    .in("status", [...FUTURES_LIVE_POSITION_STATUSES]);
  if (error || !data) {
    return [];
  }
  return data.map((row) =>
    parseFuturesPositionRow(row as Record<string, unknown>),
  );
}
