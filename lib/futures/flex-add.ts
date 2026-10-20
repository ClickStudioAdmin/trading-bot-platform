import { formatStrategyLeafReason } from "@/lib/bots/condition-copy";
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";
import { entryLeafMet } from "@/lib/futures/conditions";
import type { FuturesSide } from "@/lib/futures/model";
import type { CandleBar } from "@/lib/market/candles";
import {
  addOrderForGroup,
  addStackGroupIndex,
  addStackGroups,
  addStackMet,
  type AddGroupOrder,
  type EntryStack,
} from "@/lib/strategy/expr";

export type FlexAddDecision = {
  met: boolean;
  /** Rising edge while a position is open, and the group has a size. */
  fire: boolean;
  nextTrue: boolean;
  because: string;
  order: AddGroupOrder | null;
};

/**
 * Flex additional order for one engine check.
 * Flat clears the latch. An open position fires on the rising edge only.
 */
export function flexAddDecision(input: {
  stack: EntryStack | null | undefined;
  side: FuturesSide;
  price: number | null;
  prices?: {
    last: number | null;
    mark: number | null;
    index: number | null;
  } | null;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
  wasTrue: boolean;
  open: boolean;
  protection?: { openQty: number | null; provenPct: number | null } | null;
  firedWebhookId?: string | null;
}): FlexAddDecision {
  const idle: FlexAddDecision = {
    met: false,
    fire: false,
    nextTrue: false,
    because: "",
    order: null,
  };
  if (!input.open || !input.stack || input.stack.leaves.length === 0) {
    return idle;
  }
  const flags = input.stack.leaves.map((leaf) =>
    entryLeafMet({
      leaf,
      side: input.side,
      price: input.price,
      prices: input.prices,
      barsByTimeframe: input.barsByTimeframe,
      firedWebhookId: input.firedWebhookId,
      protection: input.protection,
    }),
  );
  const met = addStackMet({ stack: input.stack, leaves: flags });
  const group = addStackGroupIndex({ stack: input.stack, leaves: flags });
  const because =
    group == null
      ? ""
      : (addStackGroups(input.stack)[group] ?? [])
          .map((leaf) => formatStrategyLeafReason(leaf, input.side))
          .filter(Boolean)
          .join(", and ");
  const order = group == null ? null : addOrderForGroup(input.stack, group);
  const sized = addOrderReady(order);
  return {
    met,
    fire: met && !input.wasTrue && sized,
    nextTrue: met,
    because,
    order: sized ? order : null,
  };
}

function addOrderReady(order: AddGroupOrder | null): boolean {
  if (!order) {
    return false;
  }
  const size = Number(String(order.size).replace(/,/g, ""));
  if (!(size > 0)) {
    return false;
  }
  if (order.orderType !== "limit") {
    return true;
  }
  const limit = Number(String(order.limitPrice).replace(/,/g, ""));
  return limit > 0;
}

export function flexAddLatchColumn(
  latch: "condition_true" | "short_condition_true",
): "add_condition_true" | "short_add_condition_true" {
  return latch === "short_condition_true"
    ? "short_add_condition_true"
    : "add_condition_true";
}
