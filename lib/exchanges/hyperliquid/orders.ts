import type {
  BybitLinearOrderSnapshot,
  BybitLinearPosition,
  BybitLinearRisk,
  BybitTpslAttach,
} from "@/lib/exchanges/bybit/orders";
import { postHyperliquidAction, parseOrderStatuses } from "./exchange";
import {
  findHyperliquidAsset,
  loadHyperliquidMid,
  loadHyperliquidOpenOrders,
  loadHyperliquidOrderStatus,
  loadHyperliquidUserState,
} from "./info";
import {
  cloidFromIdempotency,
  floatToWire,
  hyperliquidCoin,
  orderAction,
  orderWire,
  priceToWire,
} from "./wire";

const MARKET_SLIPPAGE = 0.05;

function sizeWire(qty: number, szDecimals: number): string | null {
  const factor = 10 ** szDecimals;
  const rounded = Math.floor(qty * factor + 1e-12) / factor;
  return floatToWire(rounded);
}

function parseQty(raw: string): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function aggressivePrice(input: {
  environmentId: string;
  symbol: string;
  isBuy: boolean;
  szDecimals: number;
}): Promise<string | null> {
  const mid = await loadHyperliquidMid(input.environmentId, input.symbol);
  if (mid === null) {
    return null;
  }
  const raw = input.isBuy ? mid * (1 + MARKET_SLIPPAGE) : mid * (1 - MARKET_SLIPPAGE);
  return priceToWire(raw, input.szDecimals);
}

function firstAckError(
  acks: ReturnType<typeof parseOrderStatuses>,
): string | null {
  const failed = acks.find((row) => row.status === "error");
  return failed?.error ?? null;
}

export async function placeHyperliquidMarket(input: {
  environmentId: string;
  agentKey: string;
  accountAddress: string;
  symbol: string;
  side: "Buy" | "Sell";
  qty: string;
  reduceOnly?: boolean;
  tpsl?: BybitTpslAttach;
  orderLinkId?: string;
}): Promise<
  | { ok: true; fill: { orderId: string; avgPrice: number | null; qty: string } }
  | { ok: false; error: string }
> {
  let asset;
  try {
    asset = await findHyperliquidAsset(input.environmentId, input.symbol);
  } catch {
    return { ok: false, error: "Could not reach Hyperliquid." };
  }
  if (!asset) {
    return { ok: false, error: "That coin is not listed on Hyperliquid." };
  }
  const qty = parseQty(input.qty);
  const size = qty === null ? null : sizeWire(qty, asset.szDecimals);
  if (!size) {
    return { ok: false, error: "Order size is too small for Hyperliquid." };
  }
  const isBuy = input.side === "Buy";
  let price: string | null;
  try {
    price = await aggressivePrice({
      environmentId: input.environmentId,
      symbol: input.symbol,
      isBuy,
      szDecimals: asset.szDecimals,
    });
  } catch {
    return { ok: false, error: "Could not reach Hyperliquid." };
  }
  if (!price) {
    return { ok: false, error: "Could not read a Hyperliquid mark." };
  }
  const cloid = cloidFromIdempotency(input.orderLinkId);
  const orders = [
    orderWire({
      asset: asset.index,
      isBuy,
      price,
      size,
      reduceOnly: input.reduceOnly,
      tif: "Ioc",
      cloid,
    }),
  ];
  const tp = input.tpsl?.takeProfit
    ? priceToWire(Number(input.tpsl.takeProfit), asset.szDecimals)
    : null;
  const sl = input.tpsl?.stopLoss
    ? priceToWire(Number(input.tpsl.stopLoss), asset.szDecimals)
    : null;
  if (tp) {
    orders.push(
      orderWire({
        asset: asset.index,
        isBuy: !isBuy,
        price: tp,
        size,
        reduceOnly: true,
        trigger: { isMarket: true, triggerPx: tp, tpsl: "tp" },
      }),
    );
  }
  if (sl) {
    orders.push(
      orderWire({
        asset: asset.index,
        isBuy: !isBuy,
        price: sl,
        size,
        reduceOnly: true,
        trigger: { isMarket: true, triggerPx: sl, tpsl: "sl" },
      }),
    );
  }
  const posted = await postHyperliquidAction({
    environmentId: input.environmentId,
    agentKey: input.agentKey,
    action: orderAction(orders, tp || sl ? "normalTpsl" : "na"),
  });
  if (!posted.ok) {
    return posted;
  }
  const acks = parseOrderStatuses(posted.body);
  const error = firstAckError(acks);
  if (error) {
    return { ok: false, error };
  }
  const fill = acks[0];
  if (!fill?.oid) {
    return { ok: false, error: "Hyperliquid did not return an order id." };
  }
  return {
    ok: true,
    fill: {
      orderId: fill.oid,
      avgPrice: fill.avgPx,
      qty: fill.sz != null ? String(fill.sz) : size,
    },
  };
}

export async function placeHyperliquidLimit(input: {
  environmentId: string;
  agentKey: string;
  symbol: string;
  side: "Buy" | "Sell";
  qty: string;
  price: string;
  reduceOnly?: boolean;
  tpsl?: BybitTpslAttach;
  orderLinkId?: string;
}): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  let asset;
  try {
    asset = await findHyperliquidAsset(input.environmentId, input.symbol);
  } catch {
    return { ok: false, error: "Could not reach Hyperliquid." };
  }
  if (!asset) {
    return { ok: false, error: "That coin is not listed on Hyperliquid." };
  }
  const qty = parseQty(input.qty);
  const size = qty === null ? null : sizeWire(qty, asset.szDecimals);
  const price = priceToWire(Number(input.price), asset.szDecimals);
  if (!size || !price) {
    return { ok: false, error: "Limit price or size is not valid." };
  }
  const cloid = cloidFromIdempotency(input.orderLinkId);
  const posted = await postHyperliquidAction({
    environmentId: input.environmentId,
    agentKey: input.agentKey,
    action: orderAction([
      orderWire({
        asset: asset.index,
        isBuy: input.side === "Buy",
        price,
        size,
        reduceOnly: input.reduceOnly,
        tif: "Gtc",
        cloid,
      }),
    ]),
  });
  if (!posted.ok) {
    return posted;
  }
  const acks = parseOrderStatuses(posted.body);
  const error = firstAckError(acks);
  if (error) {
    return { ok: false, error };
  }
  const oid = acks[0]?.oid;
  if (!oid) {
    return { ok: false, error: "Hyperliquid did not return an order id." };
  }
  return { ok: true, orderId: oid };
}

export async function amendHyperliquidOrder(input: {
  environmentId: string;
  agentKey: string;
  accountAddress: string;
  symbol: string;
  orderId: string;
  qty?: string;
  price?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const oid = Number(input.orderId);
  if (!Number.isInteger(oid) || oid <= 0) {
    return { ok: false, error: "That Hyperliquid order cannot be amended." };
  }
  const asset = await findHyperliquidAsset(input.environmentId, input.symbol);
  if (!asset) {
    return { ok: false, error: "That coin is not listed on Hyperliquid." };
  }
  const open = await loadHyperliquidOpenOrders({
    environmentId: input.environmentId,
    accountAddress: input.accountAddress,
  }).catch(() => []);
  const current = open.find((row) => row.oid === oid);
  const qty = input.qty ? parseQty(input.qty) : current?.sz ?? null;
  const size = qty === null ? null : sizeWire(qty, asset.szDecimals);
  const price = input.price
    ? priceToWire(Number(input.price), asset.szDecimals)
    : current
      ? priceToWire(current.limitPx, asset.szDecimals)
      : null;
  if (!size || !price) {
    return { ok: false, error: "Need a price and size to amend." };
  }
  const posted = await postHyperliquidAction({
    environmentId: input.environmentId,
    agentKey: input.agentKey,
    action: {
      type: "batchModify",
      modifies: [
        {
          oid,
          order: orderWire({
            asset: asset.index,
            isBuy: current ? current.side === "B" : true,
            price,
            size,
            reduceOnly: false,
            tif: "Gtc",
          }),
        },
      ],
    },
  });
  if (!posted.ok) {
    return posted;
  }
  const error = firstAckError(parseOrderStatuses(posted.body));
  return error ? { ok: false, error } : { ok: true };
}

export async function cancelHyperliquidOrder(input: {
  environmentId: string;
  agentKey: string;
  symbol: string;
  orderId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const asset = await findHyperliquidAsset(input.environmentId, input.symbol);
  if (!asset) {
    return { ok: false, error: "That coin is not listed on Hyperliquid." };
  }
  const oid = Number(input.orderId);
  const action =
    Number.isInteger(oid) && oid > 0
      ? { type: "cancel", cancels: [{ a: asset.index, o: oid }] }
      : input.orderId.startsWith("0x")
        ? {
            type: "cancelByCloid",
            cancels: [{ asset: asset.index, cloid: input.orderId }],
          }
        : null;
  if (!action) {
    return { ok: false, error: "That Hyperliquid order cannot be cancelled." };
  }
  const posted = await postHyperliquidAction({
    environmentId: input.environmentId,
    agentKey: input.agentKey,
    action,
  });
  return posted.ok ? { ok: true } : posted;
}

export async function readHyperliquidOrder(input: {
  environmentId: string;
  accountAddress: string;
  orderId: string;
}): Promise<
  { ok: true; order: BybitLinearOrderSnapshot } | { ok: false; error: string }
> {
  const oid = Number(input.orderId);
  if (!Number.isInteger(oid) || oid <= 0) {
    return { ok: false, error: "That Hyperliquid order cannot be read." };
  }
  try {
    const status = await loadHyperliquidOrderStatus({
      environmentId: input.environmentId,
      accountAddress: input.accountAddress,
      oid,
    });
    if (!status) {
      return { ok: false, error: "Hyperliquid did not return that order." };
    }
    return {
      ok: true,
      order: {
        orderId: String(status.oid),
        status: status.status,
        avgPrice: status.avgPx,
        cumExecQty: status.filledSz,
        qty: status.sz,
      },
    };
  } catch {
    return { ok: false, error: "Could not read that Hyperliquid order." };
  }
}

export async function readHyperliquidPosition(input: {
  environmentId: string;
  accountAddress: string;
  symbol: string;
}): Promise<
  { ok: true; position: BybitLinearPosition | null } | { ok: false; error: string }
> {
  try {
    const state = await loadHyperliquidUserState({
      environmentId: input.environmentId,
      accountAddress: input.accountAddress,
    });
    const coin = hyperliquidCoin(input.symbol);
    const row = state.positions.find(
      (item) => item.coin.toUpperCase() === coin,
    );
    if (!row) {
      return { ok: true, position: null };
    }
    return {
      ok: true,
      position: {
        size: Math.abs(row.size),
        positionIdx: row.size > 0 ? 1 : 2,
        takeProfit: null,
        stopLoss: null,
      },
    };
  } catch {
    return { ok: false, error: "Could not read Hyperliquid positions." };
  }
}

export async function listHyperliquidPositionRisk(input: {
  environmentId: string;
  accountAddress: string;
}): Promise<
  { ok: true; positions: BybitLinearRisk[] } | { ok: false; error: string }
> {
  try {
    const state = await loadHyperliquidUserState({
      environmentId: input.environmentId,
      accountAddress: input.accountAddress,
    });
    return {
      ok: true,
      positions: state.positions.map((row) => ({
        symbol: row.coin,
        positionIdx: row.size > 0 ? 1 : 2,
        size: Math.abs(row.size),
        leverage: row.leverage,
        liqPrice: row.liqPx,
      })),
    };
  } catch {
    return { ok: false, error: "Could not read Hyperliquid positions." };
  }
}

export async function setHyperliquidTradingStop(input: {
  environmentId: string;
  agentKey: string;
  accountAddress: string;
  symbol: string;
  takeProfit: string;
  stopLoss: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const asset = await findHyperliquidAsset(input.environmentId, input.symbol);
  if (!asset) {
    return { ok: false, error: "That coin is not listed on Hyperliquid." };
  }
  const state = await loadHyperliquidUserState({
    environmentId: input.environmentId,
    accountAddress: input.accountAddress,
  });
  const coin = hyperliquidCoin(input.symbol);
  const row = state.positions.find((item) => item.coin.toUpperCase() === coin);
  if (!row) {
    return { ok: false, error: "No Hyperliquid position on that coin." };
  }
  const size = sizeWire(Math.abs(row.size), asset.szDecimals);
  if (!size) {
    return { ok: false, error: "Position size is too small." };
  }
  const isBuy = row.size < 0;
  const orders = [];
  const tp = input.takeProfit
    ? priceToWire(Number(input.takeProfit), asset.szDecimals)
    : null;
  const sl = input.stopLoss
    ? priceToWire(Number(input.stopLoss), asset.szDecimals)
    : null;
  if (tp) {
    orders.push(
      orderWire({
        asset: asset.index,
        isBuy,
        price: tp,
        size,
        reduceOnly: true,
        trigger: { isMarket: true, triggerPx: tp, tpsl: "tp" },
      }),
    );
  }
  if (sl) {
    orders.push(
      orderWire({
        asset: asset.index,
        isBuy,
        price: sl,
        size,
        reduceOnly: true,
        trigger: { isMarket: true, triggerPx: sl, tpsl: "sl" },
      }),
    );
  }
  if (orders.length === 0) {
    return { ok: false, error: "Enter a take profit or stop loss." };
  }
  const posted = await postHyperliquidAction({
    environmentId: input.environmentId,
    agentKey: input.agentKey,
    action: orderAction(orders, "positionTpsl"),
  });
  if (!posted.ok) {
    return posted;
  }
  const error = firstAckError(parseOrderStatuses(posted.body));
  return error ? { ok: false, error } : { ok: true };
}
