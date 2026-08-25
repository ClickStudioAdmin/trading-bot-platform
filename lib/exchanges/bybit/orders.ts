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
  avgPrice?: string;
  cumExecQty?: string;
  qty?: string;
};

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

export function floorCarryQty(
  qty: number,
  spot: BybitInstrument | undefined,
  future: BybitInstrument | undefined,
): { ok: true; qty: number; text: string } | { ok: false; error: string } {
  const spotStep = lotStep(spot, 0.000001);
  const futureStep = lotStep(future, 0.001);
  const step = maxStep(spotStep, futureStep);
  const minQty = Math.max(lotMin(spot, step), lotMin(future, step), step);
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
}): Promise<{ ok: true; fill: BybitOrderFill } | { ok: false; error: string }> {
  const body: Record<string, string | boolean | number> = {
    category: input.category,
    symbol: input.symbol,
    side: input.side,
    orderType: "Market",
    qty: input.qty,
  };
  if (input.category === "spot") {
    body.marketUnit = "baseCoin";
  }
  if (input.category === "linear") {
    body.positionIdx = 0;
    if (input.reduceOnly) {
      body.reduceOnly = true;
    }
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
