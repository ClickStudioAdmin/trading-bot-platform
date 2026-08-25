import { writeFuturesAdd, writeFuturesOpen } from "./ledger";
import { parseFuturesPositionRow, type FuturesPosition } from "./model";
import {
  mapBybitOrderStatus,
  nextWorkingFill,
  paperLimitShouldFill,
  parseFuturesWorkingRow,
  workingOrderSide,
  type FuturesWorkingOrder,
  type FuturesWorkingStatus,
} from "./working";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { parseAccountMode } from "@/lib/accounts/model";
import { fetchBybitTicker, fetchBybitTickers } from "@/lib/exchanges/bybit/client";
import { cancelPerpOrderOnVenue, readPerpOrderOnVenue } from "@/lib/exchanges/execute";
import { loadBoundVenueForAccount } from "@/lib/exchanges/live-trade";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { writeEventLog } from "@/lib/logs/write";
import { markFromTicker } from "./math";
import { selectStrategySettings } from "./settings";
import { createServiceClient } from "@/lib/supabase/admin";
import type { BoundConnectionSecrets } from "@/lib/exchanges/store";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function reconcileOpenFuturesWorkingOrders(input?: {
  accountId?: string;
  userId?: string;
}): Promise<number> {
  const supabase = createServiceClient();
  if (!supabase) {
    return 0;
  }
  let query = supabase
    .from("futures_working_orders")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: true });
  if (input?.accountId) {
    query = query.eq("account_id", input.accountId);
  }
  if (input?.userId) {
    query = query.eq("user_id", input.userId);
  }
  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    return 0;
  }
  const rows = data.map((row) =>
    parseFuturesWorkingRow(row as Record<string, unknown>),
  );
  const tickers = await fetchBybitTickers("linear").catch(
    () =>
      new Map<
        string,
        { lastPrice?: string; bid1Price?: string; ask1Price?: string }
      >(),
  );
  let filled = 0;
  const connections = new Map<
    string,
    BoundConnectionSecrets | null | undefined
  >();
  for (const row of rows) {
    const applied = await reconcileOneWorkingOrder({
      supabase,
      row,
      tickers,
      connections,
    });
    if (applied) {
      filled += 1;
    }
  }
  return filled;
}

async function reconcileOneWorkingOrder(input: {
  supabase: SupabaseClient;
  row: FuturesWorkingOrder;
  tickers: Map<
    string,
    { lastPrice?: string; bid1Price?: string; ask1Price?: string }
  >;
  connections: Map<string, BoundConnectionSecrets | null | undefined>;
}): Promise<boolean> {
  const live = await connectionForWorking(input);
  if (live === undefined) {
    return false;
  }
  if (live) {
    return reconcileLiveWorking({
      supabase: input.supabase,
      row: input.row,
      connection: live,
    });
  }
  const ticker =
    input.tickers.get(input.row.symbol) ??
    (await fetchBybitTicker("linear", input.row.symbol).catch(() => null));
  const mark = ticker ? markFromTicker(ticker) : null;
  if (
    mark === null ||
    !paperLimitShouldFill({
      orderSide: workingOrderSide(input.row.action),
      limitPrice: input.row.limitPrice,
      mark,
    })
  ) {
    return false;
  }
  return applyWorkingFill({
    supabase: input.supabase,
    row: input.row,
    fillQty: input.row.remainingQty,
    fillPrice: input.row.limitPrice,
    venueFilledQty: input.row.qty,
    nextStatus: "filled",
  });
}

async function reconcileLiveWorking(input: {
  supabase: SupabaseClient;
  row: FuturesWorkingOrder;
  connection: BoundConnectionSecrets;
}): Promise<boolean> {
  if (!input.row.venueOrderId) {
    return false;
  }
  const read = await readPerpOrderOnVenue({
    connection: input.connection,
    orderId: input.row.venueOrderId,
  });
  if (!read.ok) {
    return false;
  }
  const venueStatus = mapBybitOrderStatus(read.order.status);
  const venueFilled =
    read.order.cumExecQty > 0 ? read.order.cumExecQty : 0;
  const fillPrice =
    read.order.avgPrice && read.order.avgPrice > 0
      ? read.order.avgPrice
      : input.row.limitPrice;
  const progress = nextWorkingFill({
    qty: input.row.qty,
    filledQty: input.row.filledQty,
    venueFilledQty: venueFilled,
  });
  let applied = false;
  if (progress.delta > 0) {
    applied = await applyWorkingFill({
      supabase: input.supabase,
      row: input.row,
      fillQty: progress.delta,
      fillPrice,
      venueFilledQty: venueFilled,
      nextStatus: venueStatus === "open" && !progress.done ? "open" : venueStatus,
    });
  } else if (venueStatus !== "open") {
    applied = await closeWorkingOrder({
      supabase: input.supabase,
      row: input.row,
      status: venueStatus,
    });
  }
  return applied;
}

async function applyWorkingFill(input: {
  supabase: SupabaseClient;
  row: FuturesWorkingOrder;
  fillQty: number;
  fillPrice: number;
  venueFilledQty: number;
  nextStatus: FuturesWorkingStatus;
}): Promise<boolean> {
  const progress = nextWorkingFill({
    qty: input.row.qty,
    filledQty: input.row.filledQty,
    venueFilledQty: input.venueFilledQty,
  });
  if (!(progress.delta > 0) || !(input.fillQty > 0)) {
    if (input.nextStatus !== "open") {
      return closeWorkingOrder({
        supabase: input.supabase,
        row: input.row,
        status: input.nextStatus,
      });
    }
    return false;
  }
  const fillQty = Math.min(input.fillQty, progress.delta);
  const nextFilled = input.row.filledQty + fillQty;
  const remaining = Math.max(0, input.row.qty - nextFilled);
  const done = remaining <= 1e-12 || input.nextStatus === "filled";
  const status: FuturesWorkingStatus = done
    ? "filled"
    : input.nextStatus === "open"
      ? "open"
      : input.nextStatus;
  const now = new Date().toISOString();
  const { data, error } = await input.supabase
    .from("futures_working_orders")
    .update({
      filled_qty: nextFilled,
      remaining_qty: remaining,
      status: status === "open" ? "open" : status,
      closed_at: status === "open" ? null : now,
      updated_at: now,
    })
    .eq("id", input.row.id)
    .eq("account_id", input.row.accountId)
    .eq("filled_qty", input.row.filledQty)
    .eq("status", "open")
    .select("id");
  if (error || !data || data.length === 0) {
    return false;
  }

  const opens = await loadOpenOnSymbol(
    input.supabase,
    input.row.accountId,
    input.row.userId,
    input.row.symbol,
  );
  const sameSide = opens.find((row) => row.side === input.row.side) ?? null;
  let positionId = sameSide?.id ?? input.row.positionId;
  if (!sameSide) {
    const created = await writeFuturesOpen({
      supabase: input.supabase,
      userId: input.row.userId,
      accountId: input.row.accountId,
      symbol: input.row.symbol,
      side: input.row.side,
      qty: fillQty,
      price: input.fillPrice,
      venue: input.row.venue,
      environment: input.row.environment,
      venueOrderId: input.row.venueOrderId,
    });
    if (!created.ok) {
      await writeEventLog({
        level: "error",
        scope: "trade",
        event: "trade.futures_failed",
        message: created.error,
        userId: input.row.userId,
        accountId: input.row.accountId,
        strategy: FUTURES_STRATEGY_ID,
        data: { workingId: input.row.id, symbol: input.row.symbol },
      });
      return false;
    }
    positionId = created.positionId;
  } else {
    const added = await writeFuturesAdd({
      supabase: input.supabase,
      row: sameSide,
      qty: fillQty,
      price: input.fillPrice,
      venue: input.row.venue,
      environment: input.row.environment,
      venueOrderId: input.row.venueOrderId,
    });
    if (added.error) {
      await writeEventLog({
        level: "error",
        scope: "trade",
        event: "trade.futures_failed",
        message: added.error,
        userId: input.row.userId,
        accountId: input.row.accountId,
        strategy: FUTURES_STRATEGY_ID,
        data: { workingId: input.row.id, symbol: input.row.symbol },
      });
      return false;
    }
  }
  if (positionId) {
    await input.supabase
      .from("futures_working_orders")
      .update({ position_id: positionId, updated_at: now })
      .eq("id", input.row.id)
      .eq("account_id", input.row.accountId);
  }
  await writeEventLog({
    scope: "trade",
    event: "trade.futures",
    message: sameSide
      ? `Added ${input.row.symbol} ${input.row.side} from limit`
      : `Opened ${input.row.symbol} ${input.row.side} from limit`,
    userId: input.row.userId,
    accountId: input.row.accountId,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      symbol: input.row.symbol,
      action: input.row.action,
      qty: fillQty,
      workingId: input.row.id,
      positionId,
    },
  });
  return true;
}

async function closeWorkingOrder(input: {
  supabase: SupabaseClient;
  row: FuturesWorkingOrder;
  status: FuturesWorkingStatus;
}): Promise<boolean> {
  if (input.status === "open") {
    return false;
  }
  const now = new Date().toISOString();
  const { data, error } = await input.supabase
    .from("futures_working_orders")
    .update({
      status: input.status,
      remaining_qty: input.row.remainingQty,
      closed_at: now,
      updated_at: now,
    })
    .eq("id", input.row.id)
    .eq("account_id", input.row.accountId)
    .eq("status", "open")
    .select("id");
  return !error && Boolean(data && data.length > 0);
}

export async function cancelFuturesWorkingRow(input: {
  supabase: SupabaseClient;
  row: FuturesWorkingOrder;
  connection: BoundConnectionSecrets | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.row.status !== "open") {
    return { ok: false, error: "That order is no longer open." };
  }
  if (input.connection && input.row.venueOrderId) {
    const cancelled = await cancelPerpOrderOnVenue({
      connection: input.connection,
      symbol: input.row.symbol,
      orderId: input.row.venueOrderId,
    });
    if (!cancelled.ok) {
      return cancelled;
    }
  }
  const closed = await closeWorkingOrder({
    supabase: input.supabase,
    row: input.row,
    status: "cancelled",
  });
  if (!closed) {
    return { ok: false, error: "Could not cancel that order." };
  }
  return { ok: true };
}

async function connectionForWorking(input: {
  supabase: SupabaseClient;
  row: FuturesWorkingOrder;
  connections: Map<string, BoundConnectionSecrets | null | undefined>;
}): Promise<BoundConnectionSecrets | null | undefined> {
  if (input.connections.has(input.row.accountId)) {
    return input.connections.get(input.row.accountId);
  }
  const { data: account } = await input.supabase
    .from("trading_accounts")
    .select("id, mode")
    .eq("id", input.row.accountId)
    .eq("user_id", input.row.userId)
    .maybeSingle();
  if (!account) {
    input.connections.set(input.row.accountId, undefined);
    return undefined;
  }
  const mode = parseAccountMode((account as { mode?: unknown }).mode);
  if (!accountCanHoldConnections(mode)) {
    input.connections.set(input.row.accountId, null);
    return null;
  }
  const settings = await selectStrategySettings(input.supabase, {
    accountId: input.row.accountId,
    strategyId: FUTURES_STRATEGY_ID,
  });
  const connectionId = String(
    settings?.exchange_connection_id ?? "",
  ).trim();
  if (!connectionId) {
    input.connections.set(input.row.accountId, undefined);
    return undefined;
  }
  const bound = await loadBoundVenueForAccount({
    userId: input.row.userId,
    accountId: input.row.accountId,
    mode,
    connectionId,
  });
  if (!bound.ok) {
    input.connections.set(input.row.accountId, undefined);
    return undefined;
  }
  input.connections.set(input.row.accountId, bound.connection);
  return bound.connection;
}

async function loadOpenOnSymbol(
  supabase: SupabaseClient,
  accountId: string,
  userId: string,
  symbol: string,
): Promise<FuturesPosition[]> {
  const { data, error } = await supabase
    .from("futures_positions")
    .select("*")
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .eq("symbol", symbol)
    .eq("status", "open");
  if (error || !data) {
    return [];
  }
  return data.map((row) =>
    parseFuturesPositionRow(row as Record<string, unknown>),
  );
}
