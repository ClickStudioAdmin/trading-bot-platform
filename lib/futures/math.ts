import type { FuturesSide } from "./model";

export function blendEntryPrice(
  existingQty: number,
  existingPrice: number,
  addQty: number,
  addPrice: number,
): number {
  if (
    !(existingQty > 0) ||
    !(addQty > 0) ||
    !(existingPrice > 0) ||
    !(addPrice > 0)
  ) {
    throw new Error("Blend requires positive qty and price.");
  }
  return (existingQty * existingPrice + addQty * addPrice) / (existingQty + addQty);
}

export function futuresNotionalUsdt(qty: number, price: number): number {
  return qty * price;
}

export function futuresPnlUsdt(input: {
  side: FuturesSide;
  qty: number;
  entryPrice: number;
  exitPrice: number;
}): number {
  const move =
    input.side === "long"
      ? input.exitPrice - input.entryPrice
      : input.entryPrice - input.exitPrice;
  return move * input.qty;
}

export function markFromTicker(input: {
  lastPrice?: string;
  bid1Price?: string;
  ask1Price?: string;
}): number | null {
  const last = Number(input.lastPrice ?? "");
  if (last > 0) {
    return last;
  }
  const bid = Number(input.bid1Price ?? "");
  const ask = Number(input.ask1Price ?? "");
  if (bid > 0 && ask > 0) {
    return (bid + ask) / 2;
  }
  if (bid > 0) {
    return bid;
  }
  if (ask > 0) {
    return ask;
  }
  return null;
}
