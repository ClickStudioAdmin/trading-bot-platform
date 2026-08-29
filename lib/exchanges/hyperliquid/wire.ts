import { keccak_256 } from "@noble/hashes/sha3.js";

export function hyperliquidCoin(symbol: string): string {
  const raw = symbol.trim().toUpperCase();
  if (raw.endsWith("USDT")) {
    return raw.slice(0, -4);
  }
  if (raw.endsWith("USDC")) {
    return raw.slice(0, -4);
  }
  return raw;
}

export function floatToWire(value: number): string | null {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  const rounded = value.toFixed(8);
  if (Math.abs(Number(rounded) - value) >= 1e-12) {
    return null;
  }
  const normalized = rounded.replace(/\.?0+$/, "");
  return normalized === "-0" || normalized === "" ? "0" : normalized;
}

export function cloidFromIdempotency(key: string | undefined | null): string | null {
  const value = String(key ?? "").trim();
  if (!value) {
    return null;
  }
  if (/^0x[0-9a-fA-F]{32}$/.test(value)) {
    return value.toLowerCase();
  }
  const hash = keccak_256(new TextEncoder().encode(value));
  const hex = Array.from(hash.slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `0x${hex}`;
}

export type HyperliquidLimitTif = "Gtc" | "Ioc" | "Alo";

export type HyperliquidOrderWire = {
  a: number;
  b: boolean;
  p: string;
  s: string;
  r: boolean;
  t:
    | { limit: { tif: HyperliquidLimitTif } }
    | { trigger: { isMarket: boolean; triggerPx: string; tpsl: "tp" | "sl" } };
  c?: string;
};

export function orderWire(input: {
  asset: number;
  isBuy: boolean;
  price: string;
  size: string;
  reduceOnly?: boolean;
  tif?: HyperliquidLimitTif;
  cloid?: string | null;
  trigger?: { isMarket: boolean; triggerPx: string; tpsl: "tp" | "sl" };
}): HyperliquidOrderWire {
  const wire: HyperliquidOrderWire = {
    a: input.asset,
    b: input.isBuy,
    p: input.price,
    s: input.size,
    r: Boolean(input.reduceOnly),
    t: input.trigger
      ? {
          trigger: {
            isMarket: input.trigger.isMarket,
            triggerPx: input.trigger.triggerPx,
            tpsl: input.trigger.tpsl,
          },
        }
      : { limit: { tif: input.tif ?? "Gtc" } },
  };
  if (input.cloid) {
    wire.c = input.cloid;
  }
  return wire;
}

export function orderAction(
  orders: HyperliquidOrderWire[],
  grouping: "na" | "normalTpsl" | "positionTpsl" = "na",
) {
  return {
    type: "order",
    orders,
    grouping,
  };
}
