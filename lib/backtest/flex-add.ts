import type { FuturesSide } from "@/lib/futures/model";
import type { CandleBar } from "@/lib/market/candles";
import {
  addOrderForGroup,
  addOrderQty,
  type EntryStack,
} from "@/lib/strategy/expr";

export type FlexAddLatch = {
  latched: boolean;
  was: boolean;
  limitArmed: boolean;
  skipNoted: boolean;
};

export type FlexAddDetail = {
  met: boolean;
  group: number | null;
  because: string;
};

export function freshFlexAddLatch(): FlexAddLatch {
  return { latched: false, was: false, limitArmed: false, skipNoted: false };
}

/**
 * One additional order for an open Flex position.
 * The condition fires on the rising edge, then again only after it goes false.
 * A limit order stays armed while the condition remains true.
 */
export function flexAddIntent(input: {
  stack: EntryStack | null | undefined;
  detail: FlexAddDetail;
  latch: FlexAddLatch;
  open: boolean;
  bar: CandleBar;
}): { price: number; qty: number; because: string; limit: boolean } | null {
  const latch = input.latch;
  if (!input.open || !input.stack || input.stack.leaves.length === 0) {
    if (!input.open) {
      latch.latched = false;
      latch.was = false;
      latch.limitArmed = false;
      latch.skipNoted = false;
    }
    return null;
  }
  const met = input.detail.met;
  if (!latch.latched) {
    latch.latched = true;
    latch.was = met;
    return null;
  }
  const rise = met && !latch.was;
  latch.was = met;
  if (!met) {
    latch.limitArmed = false;
    latch.skipNoted = false;
    return null;
  }
  const group = input.detail.group;
  if (group == null || (!rise && !latch.limitArmed)) {
    return null;
  }
  const order = addOrderForGroup(input.stack, group);
  if (!order) {
    return null;
  }
  const because = input.detail.because;
  if (order.orderType !== "limit") {
    if (!rise) {
      return null;
    }
    const qty = addOrderQty(order, input.bar.close);
    if (!(qty > 0)) {
      return null;
    }
    return { price: input.bar.close, qty, because, limit: false };
  }
  const limit = Number(String(order.limitPrice).replace(/,/g, ""));
  if (!(limit > 0)) {
    return null;
  }
  const touched = input.bar.low <= limit && input.bar.high >= limit;
  if (!touched) {
    latch.limitArmed = true;
    return null;
  }
  const qty = addOrderQty(order, limit);
  if (!(qty > 0)) {
    return null;
  }
  latch.limitArmed = true;
  return { price: limit, qty, because, limit: true };
}

export function flexAddClipIndex(
  orders: readonly { side: FuturesSide; action: string }[],
  side: FuturesSide,
): number {
  let count = 0;
  for (const row of orders) {
    if (row.side === side && row.action !== "flatten") {
      count += 1;
    }
  }
  return count + 1;
}
