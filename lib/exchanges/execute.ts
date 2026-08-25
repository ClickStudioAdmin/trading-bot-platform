import {
  bybitCreateMarketOrder,
  loadCarryInstruments,
  qtyForCarryLegs,
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
        ? `Future leg failed and the spot was flattened. ${future.error}`
        : `Future leg failed and spot flatten failed. ${future.error}`,
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
  const created = await bybitCreateMarketOrder({
    environmentId: input.connection.environment,
    credentials: creds(input.connection),
    category: "linear",
    symbol: input.symbol,
    side: input.side,
    qty: sized.text,
    reduceOnly: input.reduceOnly,
  });
  if (!created.ok) {
    return created;
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
