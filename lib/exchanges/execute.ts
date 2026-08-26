import {
  bybitAmendLinearOrder,
  bybitCancelLinearOrder,
  bybitCreateLinearLimitOrder,
  bybitCreateMarketOrder,
  bybitEnsureHedgeMode,
  bybitListLinearPositions,
  bybitReadLinearOrder,
  bybitReadLinearPosition,
  bybitSetTradingStop,
  explainHedgeModeError,
  loadCarryInstruments,
  qtyForCarryLegs,
  type BybitLinearOrderSnapshot,
  type BybitLinearPosition,
  type BybitLinearRisk,
  type BybitTpslAttach,
} from "@/lib/exchanges/bybit/orders";
import { loadPerpInstrument, qtyForPerp } from "@/lib/exchanges/bybit/perp";
import type { BoundConnectionSecrets } from "@/lib/exchanges/store";

export type VenueFill = {
  venue: string;
  environment: string;
  qty: string;
  spotOrderId: string;
  futureOrderId: string;
  spotPrice: number | null;
  futurePrice: number | null;
};

function creds(connection: BoundConnectionSecrets) {
  return {
    apiKey: connection.credentials.apiKey,
    apiSecret: connection.credentials.apiSecret,
  };
}

export async function openCashAndCarryOnVenue(input: {
  connection: BoundConnectionSecrets;
  spotSymbol: string;
  futureSymbol: string;
  spotAsk: number;
  notionalUsdt: number;
}): Promise<{ ok: true; fill: VenueFill } | { ok: false; error: string }> {
  if (input.connection.venue !== "bybit") {
    return { ok: false, error: "That exchange cannot place orders yet." };
  }
  const instruments = await loadCarryInstruments({
    spotSymbol: input.spotSymbol,
    futureSymbol: input.futureSymbol,
  });
  const qty = qtyForCarryLegs({
    notionalUsdt: input.notionalUsdt,
    spotAsk: input.spotAsk,
    spot: instruments.spot,
    future: instruments.future,
  });
  if (!qty.ok) {
    return qty;
  }

  const credentials = creds(input.connection);
  const environmentId = input.connection.environment;
  const spot = await bybitCreateMarketOrder({
    environmentId,
    credentials,
    category: "spot",
    symbol: input.spotSymbol,
    side: "Buy",
    qty: qty.text,
  });
  if (!spot.ok) {
    return spot;
  }

  const future = await bybitCreateMarketOrder({
    environmentId,
    credentials,
    category: "linear",
    symbol: input.futureSymbol,
    side: "Sell",
    qty: qty.text,
  });
  if (!future.ok) {
    const flat = await bybitCreateMarketOrder({
      environmentId,
      credentials,
      category: "spot",
      symbol: input.spotSymbol,
      side: "Sell",
      qty: qty.text,
    });
    return {
      ok: false,
      error: flat.ok
        ? `Future leg failed and the spot was closed. ${future.error}`
        : `Future leg failed and spot close failed. ${future.error}`,
    };
  }

  return {
    ok: true,
    fill: {
      venue: input.connection.venue,
      environment: environmentId,
      qty: qty.text,
      spotOrderId: spot.fill.orderId,
      futureOrderId: future.fill.orderId,
      spotPrice: spot.fill.avgPrice,
      futurePrice: future.fill.avgPrice,
    },
  };
}

export async function closeCashAndCarryOnVenue(input: {
  connection: BoundConnectionSecrets;
  spotSymbol: string;
  futureSymbol: string;
  qty: string;
}): Promise<{ ok: true; fill: VenueFill } | { ok: false; error: string }> {
  if (input.connection.venue !== "bybit") {
    return { ok: false, error: "That exchange cannot place orders yet." };
  }
  const credentials = creds(input.connection);
  const environmentId = input.connection.environment;

  const future = await bybitCreateMarketOrder({
    environmentId,
    credentials,
    category: "linear",
    symbol: input.futureSymbol,
    side: "Buy",
    qty: input.qty,
    reduceOnly: true,
  });
  if (!future.ok) {
    return future;
  }

  const spot = await bybitCreateMarketOrder({
    environmentId,
    credentials,
    category: "spot",
    symbol: input.spotSymbol,
    side: "Sell",
    qty: input.qty,
  });
  if (!spot.ok) {
    const restore = await bybitCreateMarketOrder({
      environmentId,
      credentials,
      category: "linear",
      symbol: input.futureSymbol,
      side: "Sell",
      qty: input.qty,
    });
    return {
      ok: false,
      error: restore.ok
        ? `Spot close failed and the future short was restored. ${spot.error}`
        : `Spot close failed and hedge restore failed. ${spot.error}`,
    };
  }

  return {
    ok: true,
    fill: {
      venue: input.connection.venue,
      environment: environmentId,
      qty: input.qty,
      spotOrderId: spot.fill.orderId,
      futureOrderId: future.fill.orderId,
      spotPrice: spot.fill.avgPrice,
      futurePrice: future.fill.avgPrice,
    },
  };
}

export type PerpVenueFill = {
  venue: string;
  environment: string;
  qty: string;
  orderId: string;
  price: number | null;
  side: "Buy" | "Sell";
};

export async function placePerpMarketOnVenue(input: {
  connection: BoundConnectionSecrets;
  symbol: string;
  side: "Buy" | "Sell";
  qty: string;
  reduceOnly?: boolean;
  positionIdx: 1 | 2;
  requireHedge?: boolean;
  tpsl?: BybitTpslAttach;
  orderLinkId?: string;
}): Promise<{ ok: true; fill: PerpVenueFill } | { ok: false; error: string }> {
  if (input.connection.venue !== "bybit") {
    return { ok: false, error: "That exchange cannot place futures orders yet." };
  }
  const instrument = await loadPerpInstrument(input.symbol);
  if (!instrument) {
    return {
      ok: false,
      error: "That symbol is not a trading USDT linear perpetual on Bybit.",
    };
  }
  const sized = qtyForPerp(Number(input.qty), instrument);
  if (!sized.ok) {
    return sized;
  }
  const hedge = await bybitEnsureHedgeMode({
    environmentId: input.connection.environment,
    credentials: creds(input.connection),
    symbol: input.symbol,
  });
  if (!hedge.ok && input.requireHedge) {
    return { ok: false, error: explainHedgeModeError(hedge.error) };
  }
  const created = await bybitCreateMarketOrder({
    environmentId: input.connection.environment,
    credentials: creds(input.connection),
    category: "linear",
    symbol: input.symbol,
    side: input.side,
    qty: sized.text,
    reduceOnly: input.reduceOnly,
    positionIdx: hedge.ok ? input.positionIdx : 0,
    tpsl: input.tpsl,
    orderLinkId: input.orderLinkId,
  });
  if (!created.ok) {
    return { ok: false, error: explainHedgeModeError(created.error) };
  }
  return {
    ok: true,
    fill: {
      venue: input.connection.venue,
      environment: input.connection.environment,
      qty: created.fill.qty != null ? String(created.fill.qty) : sized.text,
      orderId: created.fill.orderId,
      price: created.fill.avgPrice,
      side: input.side,
    },
  };
}

export async function placePerpLimitOnVenue(input: {
  connection: BoundConnectionSecrets;
  symbol: string;
  side: "Buy" | "Sell";
  qty: string;
  price: string;
  reduceOnly?: boolean;
  positionIdx: 1 | 2;
  requireHedge?: boolean;
  tpsl?: BybitTpslAttach;
  orderLinkId?: string;
}): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  if (input.connection.venue !== "bybit") {
    return { ok: false, error: "That exchange cannot place futures orders yet." };
  }
  const hedge = await bybitEnsureHedgeMode({
    environmentId: input.connection.environment,
    credentials: creds(input.connection),
    symbol: input.symbol,
  });
  if (!hedge.ok && input.requireHedge) {
    return { ok: false, error: explainHedgeModeError(hedge.error) };
  }
  const created = await bybitCreateLinearLimitOrder({
    environmentId: input.connection.environment,
    credentials: creds(input.connection),
    symbol: input.symbol,
    side: input.side,
    qty: input.qty,
    price: input.price,
    reduceOnly: input.reduceOnly,
    positionIdx: hedge.ok ? input.positionIdx : 0,
    tpsl: input.tpsl,
    orderLinkId: input.orderLinkId,
  });
  if (!created.ok) {
    return { ok: false, error: explainHedgeModeError(created.error) };
  }
  return created;
}

export async function amendPerpOrderOnVenue(input: {
  connection: BoundConnectionSecrets;
  symbol: string;
  orderId: string;
  qty?: string;
  price?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.connection.venue !== "bybit") {
    return { ok: false, error: "That exchange cannot amend futures orders yet." };
  }
  if (!input.qty && !input.price) {
    return { ok: false, error: "Qty and limit are unchanged." };
  }
  return bybitAmendLinearOrder({
    environmentId: input.connection.environment,
    credentials: creds(input.connection),
    symbol: input.symbol,
    orderId: input.orderId,
    qty: input.qty,
    price: input.price,
  });
}

export async function readPerpOrderOnVenue(input: {
  connection: BoundConnectionSecrets;
  orderId: string;
}): Promise<
  { ok: true; order: BybitLinearOrderSnapshot } | { ok: false; error: string }
> {
  if (input.connection.venue !== "bybit") {
    return { ok: false, error: "That exchange cannot read futures orders yet." };
  }
  return bybitReadLinearOrder({
    environmentId: input.connection.environment,
    credentials: creds(input.connection),
    orderId: input.orderId,
  });
}

export async function cancelPerpOrderOnVenue(input: {
  connection: BoundConnectionSecrets;
  symbol: string;
  orderId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.connection.venue !== "bybit") {
    return { ok: false, error: "That exchange cannot cancel futures orders yet." };
  }
  return bybitCancelLinearOrder({
    environmentId: input.connection.environment,
    credentials: creds(input.connection),
    symbol: input.symbol,
    orderId: input.orderId,
  });
}

export async function readPerpPositionOnVenue(input: {
  connection: BoundConnectionSecrets;
  symbol: string;
  positionIdx: 1 | 2;
}): Promise<
  { ok: true; position: BybitLinearPosition | null } | { ok: false; error: string }
> {
  if (input.connection.venue !== "bybit") {
    return { ok: false, error: "That exchange cannot read futures positions yet." };
  }
  return bybitReadLinearPosition({
    environmentId: input.connection.environment,
    credentials: creds(input.connection),
    symbol: input.symbol,
    positionIdx: input.positionIdx,
  });
}

export async function listLinearPositionRisk(input: {
  connection: BoundConnectionSecrets;
}): Promise<
  { ok: true; positions: BybitLinearRisk[] } | { ok: false; error: string }
> {
  if (input.connection.venue !== "bybit") {
    return { ok: false, error: "That exchange cannot read futures positions yet." };
  }
  return bybitListLinearPositions({
    environmentId: input.connection.environment,
    credentials: creds(input.connection),
  });
}

export async function setPerpTradingStopOnVenue(input: {
  connection: BoundConnectionSecrets;
  symbol: string;
  positionIdx: 1 | 2;
  takeProfit: string;
  stopLoss: string;
  tpTriggerBy: "LastPrice" | "MarkPrice" | "IndexPrice";
  slTriggerBy: "LastPrice" | "MarkPrice" | "IndexPrice";
  tpslMode?: "Full" | "Partial";
  tpSize?: string;
  slSize?: string;
  tpOrderType?: "Market" | "Limit";
  slOrderType?: "Market" | "Limit";
  tpLimitPrice?: string;
  slLimitPrice?: string;
  trailingStop?: string;
  activePrice?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.connection.venue !== "bybit") {
    return { ok: false, error: "That exchange cannot set TP/SL yet." };
  }
  return bybitSetTradingStop({
    environmentId: input.connection.environment,
    credentials: creds(input.connection),
    symbol: input.symbol,
    positionIdx: input.positionIdx,
    takeProfit: input.takeProfit,
    stopLoss: input.stopLoss,
    tpTriggerBy: input.tpTriggerBy,
    slTriggerBy: input.slTriggerBy,
    tpslMode: input.tpslMode,
    tpSize: input.tpSize,
    slSize: input.slSize,
    tpOrderType: input.tpOrderType,
    slOrderType: input.slOrderType,
    tpLimitPrice: input.tpLimitPrice,
    slLimitPrice: input.slLimitPrice,
    trailingStop: input.trailingStop,
    activePrice: input.activePrice,
  });
}
