import { writeFuturesAdd, writeFuturesFlatten, writeFuturesOpen } from "./ledger";
import { parseFuturesPositionRow, type FuturesPosition } from "./model";
import {
  paperStopHit,
  tickerTriggerPrices,
  tpslFromRow,
  tpslHasLevels,
} from "./tpsl";
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
import {
  fetchBybitTicker,
  fetchBybitTickers,
  type BybitTicker,
} from "@/lib/exchanges/bybit/client";
import {
  cancelPerpOrderOnVenue,
  readPerpOrderOnVenue,
  readPerpPositionOnVenue,
} from "@/lib/exchanges/execute";
import { loadBoundVenueForAccount } from "@/lib/exchanges/live-trade";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { writeEventLog } from "@/lib/logs/write";
import { hedgePositionIdx } from "./decide";
import { markFromTicker } from "./math";
import { selectStrategySettings } from "./settings";
import { createServiceClient } from "@/lib/supabase/admin";
import type { BoundConnectionSecrets } from "@/lib/exchanges/store";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function reconcileOpenFuturesBooks(input?: {
  accountId?: string;
  userId?: string;
}): Promise<number> {
  const filled = await reconcileOpenFuturesWorkingOrders(input);
  const closed = await reconcileOpenFuturesStops(input);
  return filled + closed;
}

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
    () => new Map<string, BybitTicker>(),
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
  tickers: Map<string, BybitTicker>;
  connections: Map<string, BoundConnectionSecrets | null | undefined>;
}): Promise<boolean> {
  const live = await connectionForAccount({
    supabase: input.supabase,
    accountId: input.row.accountId,
    userId: input.row.userId,
    connections: input.connections,
  });
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
  const tpsl = tpslFromRow(input.row);
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
      tpsl,
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
      tpsl,
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

async function connectionForAccount(input: {
  supabase: SupabaseClient;
  accountId: string;
  userId: string;
  connections: Map<string, BoundConnectionSecrets | null | undefined>;
}): Promise<BoundConnectionSecrets | null | undefined> {
  if (input.connections.has(input.accountId)) {
    return input.connections.get(input.accountId);
  }
  const { data: account } = await input.supabase
    .from("trading_accounts")
    .select("id, mode")
    .eq("id", input.accountId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!account) {
    input.connections.set(input.accountId, undefined);
    return undefined;
  }
  const mode = parseAccountMode((account as { mode?: unknown }).mode);
  if (!accountCanHoldConnections(mode)) {
    input.connections.set(input.accountId, null);
    return null;
  }
  const settings = await selectStrategySettings(input.supabase, {
    accountId: input.accountId,
    strategyId: FUTURES_STRATEGY_ID,
  });
  const connectionId = String(
    settings?.exchange_connection_id ?? "",
  ).trim();
  if (!connectionId) {
    input.connections.set(input.accountId, undefined);
    return undefined;
  }
  const bound = await loadBoundVenueForAccount({
    userId: input.userId,
    accountId: input.accountId,
    mode,
    connectionId,
  });
  if (!bound.ok) {
    input.connections.set(input.accountId, undefined);
    return undefined;
  }
  input.connections.set(input.accountId, bound.connection);
  return bound.connection;
}

export async function reconcileOpenFuturesStops(input?: {
  accountId?: string;
  userId?: string;
}): Promise<number> {
  const supabase = createServiceClient();
  if (!supabase) {
    return 0;
  }
  let query = supabase
    .from("futures_positions")
    .select("*")
    .eq("status", "open")
    .order("opened_at", { ascending: true });
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
  const rows = data
    .map((row) => parseFuturesPositionRow(row as Record<string, unknown>))
    .filter((row) => tpslHasLevels(tpslFromRow(row)));
  if (rows.length === 0) {
    return 0;
  }
  const tickers = await fetchBybitTickers("linear").catch(
    () => new Map<string, BybitTicker>(),
  );
  const connections = new Map<
    string,
    BoundConnectionSecrets | null | undefined
  >();
  let closed = 0;
  for (const row of rows) {
    const applied = await reconcileOneStop({
      supabase,
      row,
      tickers,
      connections,
    });
    if (applied) {
      closed += 1;
    }
  }
  return closed;
}

async function reconcileOneStop(input: {
  supabase: SupabaseClient;
  row: FuturesPosition;
  tickers: Map<string, BybitTicker>;
  connections: Map<string, BoundConnectionSecrets | null | undefined>;
}): Promise<boolean> {
  const tpsl = tpslFromRow(input.row);
  if (!tpsl) {
    return false;
  }
  const ticker =
    input.tickers.get(input.row.symbol) ??
    (await fetchBybitTicker("linear", input.row.symbol).catch(() => null));
  const prices = tickerTriggerPrices(ticker ?? {});
  const live = await connectionForAccount({
    supabase: input.supabase,
    accountId: input.row.accountId,
    userId: input.row.userId,
    connections: input.connections,
  });
  if (live === undefined) {
    return false;
  }
  if (live) {
    const venue = await readPerpPositionOnVenue({
      connection: live,
      symbol: input.row.symbol,
      positionIdx: hedgePositionIdx(input.row.side),
    });
    if (!venue.ok) {
      return false;
    }
    if (venue.position && venue.position.size > 0) {
      return false;
    }
    const hit = paperStopHit({
      side: input.row.side,
      tpsl,
      last: prices.last,
      mark: prices.mark,
      index: prices.index,
    });
    const fillPrice =
      hit?.price ?? prices.mark ?? prices.last ?? input.row.entryPrice;
    return closeStopPosition({
      supabase: input.supabase,
      row: input.row,
      price: fillPrice,
      venue: live.venue,
      environment: live.environment,
      kind: hit?.kind ?? "venue",
    });
  }
  const hit = paperStopHit({
    side: input.row.side,
    tpsl,
    last: prices.last,
    mark: prices.mark,
    index: prices.index,
  });
  if (!hit) {
    return false;
  }
  return closeStopPosition({
    supabase: input.supabase,
    row: input.row,
    price: hit.price,
    venue: null,
    environment: null,
    kind: hit.kind,
  });
}

async function closeStopPosition(input: {
  supabase: SupabaseClient;
  row: FuturesPosition;
  price: number;
  venue: string | null;
  environment: string | null;
  kind: "take_profit" | "stop_loss" | "venue";
}): Promise<boolean> {
  const written = await writeFuturesFlatten({
    supabase: input.supabase,
    row: input.row,
    qty: input.row.qty,
    price: input.price,
    venue: input.venue,
    environment: input.environment,
  });
  if (written.error) {
    await writeEventLog({
      level: "error",
      scope: "trade",
      event: "trade.futures_failed",
      message: written.error,
      userId: input.row.userId,
      accountId: input.row.accountId,
      strategy: FUTURES_STRATEGY_ID,
      data: {
        symbol: input.row.symbol,
        positionId: input.row.id,
        action: input.kind,
      },
    });
    return false;
  }
  await writeEventLog({
    scope: "trade",
    event: "trade.futures",
    message:
      input.kind === "stop_loss"
        ? `Stop loss closed ${input.row.symbol} ${input.row.side}`
        : input.kind === "take_profit"
          ? `Take profit closed ${input.row.symbol} ${input.row.side}`
          : `Venue closed ${input.row.symbol} ${input.row.side}`,
    userId: input.row.userId,
    accountId: input.row.accountId,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      symbol: input.row.symbol,
      action: input.kind,
      qty: input.row.qty,
      price: input.price,
      positionId: input.row.id,
    },
  });
  return true;
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
