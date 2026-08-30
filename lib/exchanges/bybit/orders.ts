import { fetchBybitInstruments } from "./client";
import { bybitPrivateRequest, type BybitPrivateCreds } from "./private";
import {
  floorToStep,
  maxStep,
  parseStep,
  qtyFromNotionalUsdt,
  stepDecimals,
} from "./qty";
import type { BybitInstrument } from "./universe";

export type BybitOrderFill = {
  orderId: string;
  avgPrice: number | null;
  qty: number | null;
};

type CreateResult = {
  orderId?: string;
  orderLinkId?: string;
};

type OrderRow = {
  orderId?: string;
  orderStatus?: string;
  avgPrice?: string;
  cumExecQty?: string;
  qty?: string;
  leavesQty?: string;
};

export type BybitTpslAttach = {
  takeProfit?: string;
  stopLoss?: string;
  tpTriggerBy?: "LastPrice" | "MarkPrice" | "IndexPrice";
  slTriggerBy?: "LastPrice" | "MarkPrice" | "IndexPrice";
  tpslMode?: "Full" | "Partial";
  tpSize?: string;
  slSize?: string;
  tpOrderType?: "Market" | "Limit";
  slOrderType?: "Market" | "Limit";
  tpLimitPrice?: string;
  slLimitPrice?: string;
};

function applyTpslToBody(
  body: Record<string, string | boolean | number>,
  tpsl?: BybitTpslAttach,
) {
  if (!tpsl) {
    return;
  }
  if (tpsl.takeProfit) {
    body.takeProfit = tpsl.takeProfit;
    body.tpTriggerBy = tpsl.tpTriggerBy ?? "LastPrice";
    body.tpOrderType = tpsl.tpOrderType ?? "Market";
    if (body.tpOrderType === "Limit" && tpsl.tpLimitPrice) {
      body.tpLimitPrice = tpsl.tpLimitPrice;
    }
  }
  if (tpsl.stopLoss) {
    body.stopLoss = tpsl.stopLoss;
    body.slTriggerBy = tpsl.slTriggerBy ?? "LastPrice";
    body.slOrderType = tpsl.slOrderType ?? "Market";
    if (body.slOrderType === "Limit" && tpsl.slLimitPrice) {
      body.slLimitPrice = tpsl.slLimitPrice;
    }
  }
  if (tpsl.takeProfit || tpsl.stopLoss) {
    const partial = tpsl.tpslMode === "Partial";
    body.tpslMode = partial ? "Partial" : "Full";
    if (partial) {
      if (tpsl.tpSize) {
        body.tpSize = tpsl.tpSize;
      }
      if (tpsl.slSize) {
        body.slSize = tpsl.slSize;
      }
    }
  }
}

function lotStep(instrument: BybitInstrument | undefined, fallback: number): number {
  const filter = instrument?.lotSizeFilter;
  return parseStep(filter?.qtyStep ?? filter?.basePrecision, fallback);
}

function lotMin(instrument: BybitInstrument | undefined, step: number): number {
  return parseStep(instrument?.lotSizeFilter?.minOrderQty, step);
}

export function qtyForCarryLegs(input: {
  notionalUsdt: number;
  spotAsk: number;
  spot: BybitInstrument | undefined;
  future: BybitInstrument | undefined;
}): { ok: true; qty: number; text: string } | { ok: false; error: string } {
  const spotStep = lotStep(input.spot, 0.000001);
  const futureStep = lotStep(input.future, 0.001);
  const step = maxStep(spotStep, futureStep);
  const minQty = Math.max(lotMin(input.spot, step), lotMin(input.future, step), step);
  return qtyFromNotionalUsdt({
    notionalUsdt: input.notionalUsdt,
    price: input.spotAsk,
    step,
    minQty,
  });
}

export function carryQtyLimits(
  spot: BybitInstrument | undefined,
  future: BybitInstrument | undefined,
): { step: number; minQty: number } {
  const spotStep = lotStep(spot, 0.000001);
  const futureStep = lotStep(future, 0.001);
  const step = maxStep(spotStep, futureStep);
  const minQty = Math.max(lotMin(spot, step), lotMin(future, step), step);
  return { step, minQty };
}

export function floorCarryQty(
  qty: number,
  spot: BybitInstrument | undefined,
  future: BybitInstrument | undefined,
): { ok: true; qty: number; text: string } | { ok: false; error: string } {
  const { step, minQty } = carryQtyLimits(spot, future);
  const floored = floorToStep(qty, step);
  if (!(floored > 0) || floored < minQty) {
    return {
      ok: false,
      error: "That size is below the exchange minimum order quantity.",
    };
  }
  return {
    ok: true,
    qty: floored,
    text: floored.toFixed(stepDecimals(step)),
  };
}

export function sizeVenueCloseQty(input: {
  rawQty: number;
  remainingQty: number | null;
  flatten: boolean;
  step: number;
  minQty: number;
}): { ok: true; text: string } | { ok: false; error: string } {
  const remaining =
    input.remainingQty !== null && input.remainingQty > 0
      ? input.remainingQty
      : input.rawQty;
  if (input.flatten) {
    if (!(remaining > 0) || !Number.isFinite(remaining)) {
      return { ok: false, error: "Could not size the close on the exchange." };
    }
    return { ok: true, text: String(Number(remaining.toPrecision(12))) };
  }
  const floored = floorToStep(input.rawQty, input.step);
  if (floored >= input.minQty) {
    return {
      ok: true,
      text: floored.toFixed(stepDecimals(input.step)),
    };
  }
  if (remaining > 0 && remaining < input.minQty) {
    return { ok: true, text: String(Number(remaining.toPrecision(12))) };
  }
  return {
    ok: false,
    error: "That size is below the exchange minimum order quantity.",
  };
}

export async function loadCarryInstruments(input: {
  spotSymbol: string;
  futureSymbol: string;
}): Promise<{
  spot: BybitInstrument | undefined;
  future: BybitInstrument | undefined;
}> {
  const [spots, futures] = await Promise.all([
    fetchBybitInstruments("spot", input.spotSymbol),
    fetchBybitInstruments("linear", input.futureSymbol),
  ]);
  return {
    spot: spots.find((row) => row.symbol === input.spotSymbol),
    future: futures.find((row) => row.symbol === input.futureSymbol),
  };
}

export async function bybitCreateMarketOrder(input: {
  environmentId: string;
  credentials: BybitPrivateCreds;
  category: "spot" | "linear";
  symbol: string;
  side: "Buy" | "Sell";
  qty: string;
  reduceOnly?: boolean;
  positionIdx?: 0 | 1 | 2;
  tpsl?: BybitTpslAttach;
  orderLinkId?: string;
}): Promise<{ ok: true; fill: BybitOrderFill } | { ok: false; error: string }> {
  const body: Record<string, string | boolean | number> = {
    category: input.category,
    symbol: input.symbol,
    side: input.side,
    orderType: "Market",
    qty: input.qty,
  };
  if (input.orderLinkId) {
    body.orderLinkId = input.orderLinkId;
  }
  if (input.category === "spot") {
    body.marketUnit = "baseCoin";
  }
  if (input.category === "linear") {
    body.positionIdx = input.positionIdx ?? 0;
    if (input.reduceOnly) {
      body.reduceOnly = true;
    }
    applyTpslToBody(body, input.tpsl);
  }
  const created = await bybitPrivateRequest<CreateResult>({
    environmentId: input.environmentId,
    credentials: input.credentials,
    method: "POST",
    path: "/v5/order/create",
    body: JSON.stringify(body),
  });
  if (!created.ok) {
    return created;
  }
  const orderId = String(created.result.orderId ?? "");
  if (!orderId) {
    return { ok: false, error: "Bybit did not return an order id." };
  }
  const filled = await readOrderFill({
    environmentId: input.environmentId,
    credentials: input.credentials,
    category: input.category,
    orderId,
  });
  if (!filled.ok) {
    return { ok: true, fill: { orderId, avgPrice: null, qty: null } };
  }
  return { ok: true, fill: filled.fill };
}

export async function bybitCreateLinearLimitOrder(input: {
  environmentId: string;
  credentials: BybitPrivateCreds;
  symbol: string;
  side: "Buy" | "Sell";
  qty: string;
  price: string;
  reduceOnly?: boolean;
  positionIdx?: 0 | 1 | 2;
  tpsl?: BybitTpslAttach;
  orderLinkId?: string;
}): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const body: Record<string, string | boolean | number> = {
    category: "linear",
    symbol: input.symbol,
    side: input.side,
    orderType: "Limit",
    qty: input.qty,
    price: input.price,
    timeInForce: "GTC",
    positionIdx: input.positionIdx ?? 0,
  };
  if (input.orderLinkId) {
    body.orderLinkId = input.orderLinkId;
  }
  if (input.reduceOnly) {
    body.reduceOnly = true;
  }
  applyTpslToBody(body, input.tpsl);
  const created = await bybitPrivateRequest<CreateResult>({
    environmentId: input.environmentId,
    credentials: input.credentials,
    method: "POST",
    path: "/v5/order/create",
    body: JSON.stringify(body),
  });
  if (!created.ok) {
    return created;
  }
  const orderId = String(created.result.orderId ?? "");
  if (!orderId) {
    return { ok: false, error: "Bybit did not return an order id." };
  }
  return { ok: true, orderId };
}

export async function bybitAmendLinearOrder(input: {
  environmentId: string;
  credentials: BybitPrivateCreds;
  symbol: string;
  orderId: string;
  qty?: string;
  price?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const body: Record<string, string> = {
    category: "linear",
    symbol: input.symbol,
    orderId: input.orderId,
  };
  if (input.qty) {
    body.qty = input.qty;
  }
  if (input.price) {
    body.price = input.price;
  }
  const amended = await bybitPrivateRequest<Record<string, unknown>>({
    environmentId: input.environmentId,
    credentials: input.credentials,
    method: "POST",
    path: "/v5/order/amend",
    body: JSON.stringify(body),
    allowMissingResult: true,
  });
  if (amended.ok) {
    return { ok: true };
  }
  return amended;
}

export async function bybitReadLinearOrder(input: {
  environmentId: string;
  credentials: BybitPrivateCreds;
  orderId: string;
}): Promise<
  { ok: true; order: BybitLinearOrderSnapshot } | { ok: false; error: string }
> {
  const query = `category=linear&orderId=${encodeURIComponent(input.orderId)}`;
  const realtime = await bybitPrivateRequest<{ list?: OrderRow[] }>({
    environmentId: input.environmentId,
    credentials: input.credentials,
    method: "GET",
    path: "/v5/order/realtime",
    query,
  });
  const live = realtime.ok ? realtime.result.list?.[0] : undefined;
  if (live) {
    return { ok: true, order: snapshotFromRow(live, input.orderId) };
  }
  const history = await bybitPrivateRequest<{ list?: OrderRow[] }>({
    environmentId: input.environmentId,
    credentials: input.credentials,
    method: "GET",
    path: "/v5/order/history",
    query,
  });
  const past = history.ok ? history.result.list?.[0] : undefined;
  if (past) {
    return { ok: true, order: snapshotFromRow(past, input.orderId) };
  }
  return { ok: false, error: "Bybit did not return that order." };
}

export async function bybitCancelLinearOrder(input: {
  environmentId: string;
  credentials: BybitPrivateCreds;
  symbol: string;
  orderId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const cancelled = await bybitPrivateRequest<Record<string, unknown>>({
    environmentId: input.environmentId,
    credentials: input.credentials,
    method: "POST",
    path: "/v5/order/cancel",
    body: JSON.stringify({
      category: "linear",
      symbol: input.symbol,
      orderId: input.orderId,
    }),
    allowMissingResult: true,
  });
  if (cancelled.ok) {
    return { ok: true };
  }
  if (/not exists|not found|already|110001|110010/i.test(cancelled.error)) {
    return { ok: true };
  }
  return cancelled;
}

export type BybitLinearOrderSnapshot = {
  orderId: string;
  status: string;
  avgPrice: number | null;
  cumExecQty: number;
  qty: number;
};

export type BybitLinearPosition = {
  size: number;
  positionIdx: number;
  takeProfit: number | null;
  stopLoss: number | null;
};

export type BybitLinearRisk = {
  symbol: string;
  positionIdx: number;
  size: number;
  leverage: number | null;
  liqPrice: number | null;
};

function parseBybitPositive(raw: unknown): number | null {
  const value = Number(raw);
  return value > 0 && Number.isFinite(value) ? value : null;
}

export async function bybitReadLinearPosition(input: {
  environmentId: string;
  credentials: BybitPrivateCreds;
  symbol: string;
  positionIdx: 1 | 2;
}): Promise<
  { ok: true; position: BybitLinearPosition | null } | { ok: false; error: string }
> {
  const query = `category=linear&symbol=${encodeURIComponent(input.symbol)}`;
  const listed = await bybitPrivateRequest<{
    list?: {
      size?: string;
      positionIdx?: number;
      takeProfit?: string;
      stopLoss?: string;
    }[];
  }>({
    environmentId: input.environmentId,
    credentials: input.credentials,
    method: "GET",
    path: "/v5/position/list",
    query,
  });
  if (!listed.ok) {
    return listed;
  }
  const row = (listed.result.list ?? []).find(
    (item) => Number(item.positionIdx) === input.positionIdx,
  );
  if (!row) {
    return { ok: true, position: null };
  }
  const size = Number(row.size ?? "");
  const takeProfit = Number(row.takeProfit ?? "");
  const stopLoss = Number(row.stopLoss ?? "");
  return {
    ok: true,
    position: {
      size: size > 0 ? size : 0,
      positionIdx: input.positionIdx,
      takeProfit: takeProfit > 0 ? takeProfit : null,
      stopLoss: stopLoss > 0 ? stopLoss : null,
    },
  };
}

export async function bybitListLinearPositions(input: {
  environmentId: string;
  credentials: BybitPrivateCreds;
  settleCoin?: string;
}): Promise<
  { ok: true; positions: BybitLinearRisk[] } | { ok: false; error: string }
> {
  const settleCoin = input.settleCoin ?? "USDT";
  const query = `category=linear&settleCoin=${encodeURIComponent(settleCoin)}&limit=200`;
  const listed = await bybitPrivateRequest<{
    list?: {
      symbol?: string;
      size?: string;
      positionIdx?: number;
      leverage?: string;
      liqPrice?: string;
    }[];
  }>({
    environmentId: input.environmentId,
    credentials: input.credentials,
    method: "GET",
    path: "/v5/position/list",
    query,
  });
  if (!listed.ok) {
    return listed;
  }
  return {
    ok: true,
    positions: (listed.result.list ?? [])
      .map((item) => {
        const symbol = String(item.symbol ?? "").trim();
        const positionIdx = Number(item.positionIdx);
        if (!symbol || (positionIdx !== 1 && positionIdx !== 2)) {
          return null;
        }
        return {
          symbol,
          positionIdx,
          size: Number(item.size ?? "") || 0,
          leverage: parseBybitPositive(item.leverage),
          liqPrice: parseBybitPositive(item.liqPrice),
        } satisfies BybitLinearRisk;
      })
      .filter((row): row is BybitLinearRisk => row !== null),
  };
}

export async function bybitSetTradingStop(input: {
  environmentId: string;
  credentials: BybitPrivateCreds;
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
  const partial = input.tpslMode === "Partial";
  const tpOrderType = input.tpOrderType ?? "Market";
  const slOrderType = input.slOrderType ?? "Market";
  const body: Record<string, string | number> = {
    category: "linear",
    symbol: input.symbol,
    tpslMode: partial ? "Partial" : "Full",
    positionIdx: input.positionIdx,
    takeProfit: input.takeProfit,
    stopLoss: input.stopLoss,
    tpTriggerBy: input.tpTriggerBy,
    slTriggerBy: input.slTriggerBy,
    tpOrderType,
    slOrderType,
  };
  if (tpOrderType === "Limit" && input.tpLimitPrice) {
    body.tpLimitPrice = input.tpLimitPrice;
  }
  if (slOrderType === "Limit" && input.slLimitPrice) {
    body.slLimitPrice = input.slLimitPrice;
  }
  if (partial) {
    if (input.tpSize) {
      body.tpSize = input.tpSize;
    }
    if (input.slSize) {
      body.slSize = input.slSize;
    }
  }
  if (input.trailingStop !== undefined) {
    body.trailingStop = input.trailingStop;
    if (input.trailingStop !== "0" && input.activePrice) {
      body.activePrice = input.activePrice;
    }
  }
  const set = await bybitPrivateRequest<Record<string, unknown>>({
    environmentId: input.environmentId,
    credentials: input.credentials,
    method: "POST",
    path: "/v5/position/trading-stop",
    body: JSON.stringify(body),
    allowMissingResult: true,
  });
  if (set.ok) {
    return { ok: true };
  }
  return set;
}

function snapshotFromRow(
  row: OrderRow,
  fallbackId: string,
): BybitLinearOrderSnapshot {
  const avg = Number(row.avgPrice ?? "");
  const cum = Number(row.cumExecQty ?? "");
  const qty = Number(row.qty ?? "");
  return {
    orderId: String(row.orderId ?? fallbackId),
    status: String(row.orderStatus ?? ""),
    avgPrice: avg > 0 ? avg : null,
    cumExecQty: cum > 0 ? cum : 0,
    qty: qty > 0 ? qty : 0,
  };
}

async function readOrderFill(input: {
  environmentId: string;
  credentials: BybitPrivateCreds;
  category: "spot" | "linear";
  orderId: string;
}): Promise<{ ok: true; fill: BybitOrderFill } | { ok: false; error: string }> {
  const query = `category=${input.category}&orderId=${encodeURIComponent(input.orderId)}`;
  const realtime = await bybitPrivateRequest<{ list?: OrderRow[] }>({
    environmentId: input.environmentId,
    credentials: input.credentials,
    method: "GET",
    path: "/v5/order/realtime",
    query,
  });
  const row = realtime.ok ? realtime.result.list?.[0] : undefined;
  if (!row) {
    return { ok: false, error: "Bybit did not return that order." };
  }
  const avg = Number(row.avgPrice ?? "");
  const qty = Number(row.cumExecQty ?? row.qty ?? "");
  return {
    ok: true,
    fill: {
      orderId: String(row.orderId ?? input.orderId),
      avgPrice: avg > 0 ? avg : null,
      qty: qty > 0 ? qty : null,
    },
  };
}

export async function bybitEnsureHedgeMode(input: {
  environmentId: string;
  credentials: BybitPrivateCreds;
  symbol: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const switched = await bybitPrivateRequest<Record<string, unknown>>({
    environmentId: input.environmentId,
    credentials: input.credentials,
    method: "POST",
    path: "/v5/position/switch-mode",
    body: JSON.stringify({
      category: "linear",
      symbol: input.symbol,
      mode: 3,
    }),
    allowMissingResult: true,
  });
  if (switched.ok) {
    return { ok: true };
  }
  if (alreadyHedgeMode(switched.error)) {
    return { ok: true };
  }
  return switched;
}

export function explainHedgeModeError(error: string): string {
  if (alreadyHedgeMode(error)) {
    return error;
  }
  if (
    /position idx|positionIdx|one-way|one way|Merged Single|110025|110026|110043/i.test(
      error,
    )
  ) {
    return "Bybit is in one-way mode on this contract. Close the venue position, then Buy and Sell can hold a long and a short together.";
  }
  return error;
}

function alreadyHedgeMode(error: string): boolean {
  return /not modified|already|both side|hedge mode/i.test(error);
}
