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
import { latestFlattenExitPrices } from "./stats";
import { listFuturesOrderWebhookNames } from "./webhook-load";
import { getSessionContext } from "@/lib/auth/session";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { type EventLogRow } from "@/lib/logs/list";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  FUTURES_LIVE_POSITION_STATUSES,
  FUTURES_LIVE_WORKING_STATUSES,
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

const FUTURES_LIST_PAGE = 1000;

type FuturesRowQuery = {
  eq(column: string, value: string): FuturesRowQuery;
  in(column: string, values: readonly string[]): FuturesRowQuery;
  order(column: string, options: { ascending: boolean }): FuturesRowQuery;
  range(from: number, to: number): FuturesRowQuery;
  then: PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>["then"];
};

function futuresPositionQuery(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  scope: FuturesListScope,
  input?: {
    status?: "open" | "closed";
    ruleId?: string;
    symbol?: string;
  },
): FuturesRowQuery {
  let query = supabase
    .from("futures_positions")
    .select("*") as unknown as FuturesRowQuery;
  query = query
    .eq("account_id", scope.accountId)
    .eq("user_id", scope.userId)
    .order("opened_at", { ascending: false })
    .order("id", { ascending: false });
  if (input?.status === "closed") {
    query = query.eq("status", "closed");
  } else if (input?.status === "open") {
    query = query.in("status", [...FUTURES_LIVE_POSITION_STATUSES]);
  }
  const ruleId = input?.ruleId?.trim();
  const symbol = input?.symbol?.trim();
  if (ruleId) {
    query = query.eq("rule_id", ruleId);
  }
  if (symbol) {
    query = query.eq("symbol", symbol);
  }
  return query;
}

function parsePositionRows(data: unknown[] | null): FuturesPosition[] {
  return (data ?? []).map((row) =>
    parseFuturesPositionRow(row as Record<string, unknown>),
  );
}

export async function loadFuturesPositions(input?: {
  status?: "open" | "closed";
  ruleId?: string;
  symbol?: string;
  all?: boolean;
  scope?: FuturesListScope;
}): Promise<FuturesPosition[]> {
  const resolved = await resolveFuturesListScope(input?.scope);
  const supabase = createServiceClient();
  if (!resolved || !supabase) {
    return [];
  }
  if (!input?.all) {
    const { data, error } = await futuresPositionQuery(supabase, resolved, input);
    if (error || !data) {
      return [];
    }
    return parsePositionRows(data);
  }
  const rows: FuturesPosition[] = [];
  for (let from = 0; ; from += FUTURES_LIST_PAGE) {
    const { data, error } = await futuresPositionQuery(
      supabase,
      resolved,
      input,
    ).range(from, from + FUTURES_LIST_PAGE - 1);
    if (error || !data || data.length === 0) {
      break;
    }
    rows.push(...parsePositionRows(data));
    if (data.length < FUTURES_LIST_PAGE) {
      break;
    }
  }
  return rows;
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

export async function loadFuturesDesk(): Promise<{
  signedIn: boolean;
  exchangeBook: boolean;
  open: FuturesDeskPosition[];
  working: FuturesWorkingOrder[];
  webhookNames: string[];
}> {
  const session = await getSessionContext();
  if (!session) {
    return {
      signedIn: false,
      exchangeBook: false,
      open: [],
      working: [],
      webhookNames: [],
    };
  }
  const scope: FuturesListScope = {
    accountId: session.account.id,
    userId: session.member.id,
  };
  const [rows, working, webhookNames] = await Promise.all([
    loadFuturesPositions({ status: "open", scope }),
    loadLiveFuturesWorking(scope),
    listFuturesOrderWebhookNames(session.account.id),
  ]);
  return {
    signedIn: true,
    exchangeBook: accountCanHoldConnections(session.account.mode),
    open: rows.map((row) => ({ ...row, orders: [], logs: [] })),
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
    fillsLoaded: false,
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

const FLATTEN_EXIT_PAGE = FUTURES_LIST_PAGE;

async function loadFlattenExitPrices(
  scope: FuturesListScope,
): Promise<Map<string, number>> {
  const supabase = createServiceClient();
  if (!supabase) {
    return new Map();
  }
  const rows: { positionId: string; price: number | null; filledAtMs: number }[] =
    [];
  for (let from = 0; ; from += FLATTEN_EXIT_PAGE) {
    const { data, error } = await supabase
      .from("futures_orders")
      .select("position_id,price,filled_at")
      .eq("account_id", scope.accountId)
      .eq("user_id", scope.userId)
      .eq("action", "flatten")
      .order("filled_at", { ascending: true })
      .range(from, from + FLATTEN_EXIT_PAGE - 1);
    if (error || !data || data.length === 0) {
      break;
    }
    for (const row of data) {
      const record = row as {
        position_id?: unknown;
        price?: unknown;
        filled_at?: unknown;
      };
      const filledAt = Date.parse(String(record.filled_at ?? ""));
      rows.push({
        positionId: String(record.position_id ?? ""),
        price: Number(record.price),
        filledAtMs: Number.isFinite(filledAt) ? filledAt : 0,
      });
    }
    if (data.length < FLATTEN_EXIT_PAGE) {
      break;
    }
  }
  return latestFlattenExitPrices(rows);
}

async function loadFlattenExitsForPositions(
  positionIds: readonly string[],
  scope: FuturesListScope,
): Promise<Map<string, number>> {
  const supabase = createServiceClient();
  const ids = [...new Set(positionIds.map((id) => id.trim()).filter(Boolean))];
  if (!supabase || ids.length === 0) {
    return new Map();
  }
  const rows: { positionId: string; price: number | null; filledAtMs: number }[] =
    [];
  for (let index = 0; index < ids.length; index += 40) {
    const batch = ids.slice(index, index + 40);
    const { data, error } = await supabase
      .from("futures_orders")
      .select("position_id,price,filled_at")
      .eq("account_id", scope.accountId)
      .eq("user_id", scope.userId)
      .eq("action", "flatten")
      .in("position_id", batch)
      .order("filled_at", { ascending: true });
    if (error || !data) {
      continue;
    }
    for (const row of data) {
      const record = row as {
        position_id?: unknown;
        price?: unknown;
        filled_at?: unknown;
      };
      const filledAt = Date.parse(String(record.filled_at ?? ""));
      rows.push({
        positionId: String(record.position_id ?? ""),
        price: Number(record.price),
        filledAtMs: Number.isFinite(filledAt) ? filledAt : 0,
      });
    }
  }
  return latestFlattenExitPrices(rows);
}

function performancePosition(
  row: FuturesPosition,
  exitPrice: number | undefined,
): FuturesDeskPosition {
  return {
    ...row,
    logs: [],
    orders:
      exitPrice != null && exitPrice > 0
        ? [
            {
              id: `${row.id}:exit`,
              positionId: row.id,
              action: "flatten",
              qty: row.qty,
              price: exitPrice,
              notionalUsdt: null,
              venueOrderId: null,
              venue: row.venue,
              filledAtMs: row.closedAtMs ?? row.openedAtMs,
              source: row.source,
              ruleName: row.ruleName,
            },
          ]
        : [],
  };
}

function scopedPositionFilter(filter?: {
  ruleId?: string;
  symbol?: string;
}): { empty: boolean; ruleId?: string; symbol?: string } {
  if (!filter) {
    return { empty: false };
  }
  const ruleId = filter.ruleId?.trim() ?? "";
  const symbol = filter.symbol?.trim() ?? "";
  if (!ruleId && !symbol) {
    return { empty: true };
  }
  return {
    empty: false,
    ruleId: ruleId || undefined,
    symbol: symbol || undefined,
  };
}

export async function loadFuturesPerformanceBook(input?: {
  closed?: { ruleId?: string; symbol?: string };
  open?: { ruleId?: string; symbol?: string };
}): Promise<{
  signedIn: boolean;
  exchangeBook: boolean;
  open: FuturesDeskPosition[];
  closed: FuturesDeskPosition[];
  webhookNames: string[];
}> {
  const session = await getSessionContext();
  if (!session) {
    return {
      signedIn: false,
      exchangeBook: false,
      open: [],
      closed: [],
      webhookNames: [],
    };
  }
  const scope: FuturesListScope = {
    accountId: session.account.id,
    userId: session.member.id,
  };
  const closedFilter = scopedPositionFilter(input?.closed);
  const openFilter = scopedPositionFilter(input?.open);
  const scoped = Boolean(input?.closed || input?.open);
  const [closedRows, openRows, deskExits, webhookNames] = await Promise.all([
    closedFilter.empty
      ? Promise.resolve([])
      : loadFuturesPositions({
          status: "closed",
          ruleId: closedFilter.ruleId,
          symbol: closedFilter.symbol,
          all: true,
          scope,
        }),
    openFilter.empty
      ? Promise.resolve([])
      : loadFuturesPositions({
          status: "open",
          ruleId: openFilter.ruleId,
          symbol: openFilter.symbol,
          all: true,
          scope,
        }),
    scoped || closedFilter.empty
      ? Promise.resolve(null)
      : loadFlattenExitPrices(scope),
    listFuturesOrderWebhookNames(session.account.id),
  ]);
  const exits =
    deskExits ??
    (await loadFlattenExitsForPositions(
      closedRows.map((row) => row.id),
      scope,
    ));
  return {
    signedIn: true,
    exchangeBook: accountCanHoldConnections(session.account.mode),
    open: openRows.map((row) => performancePosition(row, undefined)),
    closed: closedRows.map((row) => performancePosition(row, exits.get(row.id))),
    webhookNames,
  };
}
