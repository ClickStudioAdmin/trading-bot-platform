import { floorToStep } from "./qty";

export function parseTicketSize(raw: string): number | null {
  const qty = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!(qty > 0) || !Number.isFinite(qty)) {
    return null;
  }
  return qty;
}

export function formatPerpMinQty(qty: number): string {
  if (!(qty > 0) || !Number.isFinite(qty)) {
    return "";
  }
  const text = qty.toFixed(8).replace(/\.?0+$/, "");
  const value = Number(text);
  if (value >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 8 });
  }
  return text || String(qty);
}

export function perpEffectiveMaxQty(input: {
  maxQty: number;
  maxMktQty?: number;
  orderType?: "market" | "limit";
}): number {
  const cap = input.maxQty > 0 ? input.maxQty : 0;
  const mkt =
    input.orderType === "market" && input.maxMktQty && input.maxMktQty > 0
      ? input.maxMktQty
      : 0;
  if (cap > 0 && mkt > 0) {
    return Math.min(cap, mkt);
  }
  return mkt > 0 ? mkt : cap;
}

export function perpTicketSizeError(input: {
  size: string;
  unit: "qty" | "usdt";
  minQty: number;
  maxQty?: number;
  minNotional: number;
  lastPrice?: number | null;
  limitPrice?: string;
  orderType?: "market" | "limit";
  baseCoin: string;
}): string | null {
  const amount = parseTicketSize(input.size);
  if (amount === null) {
    return null;
  }
  const maxQty = input.maxQty && input.maxQty > 0 ? input.maxQty : 0;
  if (input.unit === "usdt") {
    if (input.minNotional > 0 && amount < input.minNotional) {
      return `Minimum order value is $${formatPerpMinQty(input.minNotional)}.`;
    }
    const price =
      input.orderType === "limit"
        ? parseTicketSize(input.limitPrice ?? "")
        : null;
    const mark = input.lastPrice && input.lastPrice > 0 ? input.lastPrice : null;
    const sizePrice = price && price > 0 ? price : mark;
    if (maxQty > 0 && sizePrice) {
      const qty = amount / sizePrice;
      if (qty > maxQty) {
        return `Maximum size is ${formatPerpMinQty(maxQty)} ${input.baseCoin}.`;
      }
    }
    return null;
  }
  if (input.minQty > 0 && amount < input.minQty) {
    return `Minimum size is ${formatPerpMinQty(input.minQty)} ${input.baseCoin}.`;
  }
  if (maxQty > 0 && amount > maxQty) {
    return `Maximum size is ${formatPerpMinQty(maxQty)} ${input.baseCoin}.`;
  }
  if (input.minNotional > 0) {
    const price =
      input.orderType === "limit"
        ? parseTicketSize(input.limitPrice ?? "")
        : null;
    const mark = input.lastPrice && input.lastPrice > 0 ? input.lastPrice : null;
    const sizePrice = price && price > 0 ? price : mark;
    if (sizePrice && amount * sizePrice < input.minNotional) {
      return `Minimum order value is $${formatPerpMinQty(input.minNotional)}.`;
    }
  }
  return null;
}

export function perpTicketLimitError(input: {
  limitPrice: string;
  minPrice: number;
  tickSize: number;
}): string | null {
  const price = parseTicketSize(input.limitPrice);
  if (price === null) {
    return null;
  }
  const tick = input.tickSize > 0 ? input.tickSize : 0;
  const minPrice = Math.max(input.minPrice, tick);
  const floored = tick > 0 ? floorToStep(price, tick) : price;
  if (minPrice > 0 && (price < minPrice || floored < minPrice || floored <= 0)) {
    return `Minimum limit is $${formatPerpMinQty(minPrice)}.`;
  }
  return null;
}
