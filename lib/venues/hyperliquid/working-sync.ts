import { normalizeAddress } from "@/lib/exchanges/hyperliquid/agent";
import {
  loadHyperliquidMid,
  loadHyperliquidOpenOrders,
  loadHyperliquidUserState,
  type HyperliquidOpenOrder,
} from "@/lib/exchanges/hyperliquid/info";
import { hyperliquidCoin } from "@/lib/exchanges/hyperliquid/wire";
import type { BoundConnectionSecrets } from "@/lib/exchanges/store";
import { insertFuturesWorking, writeFuturesOpen } from "@/lib/futures/ledger";
import { parseFuturesPositionRow } from "@/lib/futures/model";
import { parseFuturesWorkingRow } from "@/lib/futures/working";
import { emptyFuturesTpsl } from "@/lib/futures/tpsl";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";
import type { SupabaseClient } from "@supabase/supabase-js";

function displayPrice(order: HyperliquidOpenOrder): number {
  const limit = order.orderType.toLowerCase().includes("limit")
    ? order.limitPx
    : (order.triggerPx ?? order.limitPx);
  return limit > 0 ? limit : order.limitPx;
}

function tpslForOrder(order: HyperliquidOpenOrder) {
  const tpsl = emptyFuturesTpsl();
  const isLimit =
    order.orderType.toLowerCase().includes("limit") ||
    (order.isTrigger && order.triggerPx !== null && order.limitPx !== order.triggerPx);
  if (order.tpsl === "tp") {
    tpsl.takeProfit = order.triggerPx ?? order.limitPx;
    tpsl.tpOrderType = isLimit ? "limit" : "market";
    tpsl.tpLimitPrice = isLimit ? order.limitPx : null;
  }
  if (order.tpsl === "sl") {
    tpsl.stopLoss = order.triggerPx ?? order.limitPx;
    tpsl.slOrderType = isLimit ? "limit" : "market";
    tpsl.slLimitPrice = isLimit ? order.limitPx : null;
  }
  return tpsl;
}

export async function syncHyperliquidWorkingOrders(input: {
  supabase: SupabaseClient;
  accountId: string;
  userId: string;
  connection: BoundConnectionSecrets;
}): Promise<number> {
  if (input.connection.venue !== "hyperliquid") {
    return 0;
  }
  const accountAddress = normalizeAddress(
    input.connection.credentials.accountAddress,
  );
  if (!accountAddress) {
    return 0;
  }
  const venueOrders = await loadHyperliquidOpenOrders({
    environmentId: hyperliquidInfoEnvironment(input.connection.environment),
    accountAddress,
  }).catch(() => []);
  if (venueOrders.length === 0) {
    return 0;
  }
  const { data } = await input.supabase
    .from("futures_working_orders")
    .select("*")
    .eq("account_id", input.accountId)
    .eq("user_id", input.userId)
    .eq("status", "open");
  const existing = (data ?? []).map((row) =>
    parseFuturesWorkingRow(row as Record<string, unknown>),
  );
  const seen = new Set(
    existing
      .map((row) => row.venueOrderId)
      .filter((id): id is string => Boolean(id)),
  );
  let added = 0;
  for (const order of venueOrders) {
    const oid = String(order.oid);
    if (seen.has(oid)) {
      continue;
    }
    const limitPrice = displayPrice(order);
    if (!(limitPrice > 0) || !(order.sz > 0)) {
      continue;
    }
    const action = order.side === "B" ? "buy" : "sell";
    const reduceOnly = order.reduceOnly || order.isTrigger;
    const inserted = await insertFuturesWorking(input.supabase, {
      userId: input.userId,
      accountId: input.accountId,
      symbol: order.coin,
      action,
      side:
        reduceOnly
          ? action === "sell"
            ? "long"
            : "short"
          : action === "buy"
            ? "long"
            : "short",
      qty: order.sz,
      limitPrice,
      venue: input.connection.venue,
      environment: input.connection.environment,
      venueOrderId: oid,
      reduceOnly,
      tpsl: tpslForOrder(order),
    });
    if (inserted.ok) {
      added += 1;
    }
  }
  return added;
}

export async function syncHyperliquidVenuePositions(input: {
  supabase: SupabaseClient;
  accountId: string;
  userId: string;
  connection: BoundConnectionSecrets;
}): Promise<number> {
  if (input.connection.venue !== "hyperliquid") {
    return 0;
  }
  const accountAddress = normalizeAddress(
    input.connection.credentials.accountAddress,
  );
  if (!accountAddress) {
    return 0;
  }
  const environmentId = hyperliquidInfoEnvironment(input.connection.environment);
  const state = await loadHyperliquidUserState({
    environmentId,
    accountAddress,
  }).catch(() => null);
  if (!state || state.positions.length === 0) {
    return 0;
  }
  const { data } = await input.supabase
    .from("futures_positions")
    .select("*")
    .eq("account_id", input.accountId)
    .eq("user_id", input.userId)
    .eq("status", "open");
  const open = (data ?? []).map((row) =>
    parseFuturesPositionRow(row as Record<string, unknown>),
  );
  let added = 0;
  for (const position of state.positions) {
    const symbol = hyperliquidCoin(position.coin);
    const side = position.size > 0 ? "long" : "short";
    const qty = Math.abs(position.size);
    if (!symbol || !(qty > 0)) {
      continue;
    }
    if (open.some((row) => row.symbol === symbol && row.side === side)) {
      continue;
    }
    const entry =
      position.entryPx && position.entryPx > 0
        ? position.entryPx
        : ((await loadHyperliquidMid(environmentId, symbol).catch(() => null)) ??
          0);
    if (!(entry > 0)) {
      continue;
    }
    const created = await writeFuturesOpen({
      supabase: input.supabase,
      userId: input.userId,
      accountId: input.accountId,
      symbol,
      side,
      qty,
      price: entry,
      venue: input.connection.venue,
      environment: input.connection.environment,
      source: "manual",
    });
    if (!created.ok) {
      continue;
    }
    added += 1;
    await input.supabase
      .from("futures_working_orders")
      .update({ position_id: created.positionId })
      .eq("account_id", input.accountId)
      .eq("user_id", input.userId)
      .eq("status", "open")
      .eq("reduce_only", true)
      .eq("symbol", symbol)
      .eq("side", side)
      .is("position_id", null);
  }
  return added;
}
