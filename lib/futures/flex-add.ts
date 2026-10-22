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
import { formatRetraceLabel, type PositionRetraceContext } from "@/lib/strategy/retrace";
import type { ProtectionReading } from "@/lib/strategy/protection";

export type FlexAddDecision = {
  met: boolean;
  /** Rising edge while a position is open, and the group has a size. */
  fire: boolean;
  nextTrue: boolean;
  because: string;
  order: AddGroupOrder | null;
  /** First true Or group. Null when the stack is unmet. */
  group: number | null;
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
  protection?: ProtectionReading | null;
  firedWebhookId?: string | null;
  /** Buy is long, sell is short. Undefined keeps an id match. */
  signalSide?: FuturesSide | null;
  /** Null keeps an additional-order retrace unmet until the position memory exists. */
  positionRetrace?: PositionRetraceContext | null;
}): FlexAddDecision {
  const idle: FlexAddDecision = {
    met: false,
    fire: false,
    nextTrue: false,
    because: "",
    order: null,
    group: null,
  };
  if (!input.open || !input.stack || input.stack.leaves.length === 0) {
    return idle;
  }
  const positionRetrace =
    input.positionRetrace === undefined ? null : input.positionRetrace;
  const flags = input.stack.leaves.map((leaf) =>
    entryLeafMet({
      leaf,
      side: input.side,
      price: input.price,
      prices: input.prices,
      barsByTimeframe: input.barsByTimeframe,
      firedWebhookId: input.firedWebhookId,
      signalSide: input.signalSide,
      protection: input.protection,
      positionRetrace,
    }),
  );
  const met = addStackMet({ stack: input.stack, leaves: flags });
  const group = addStackGroupIndex({ stack: input.stack, leaves: flags });
  const because =
    group == null
      ? ""
      : (addStackGroups(input.stack)[group] ?? [])
          .map((leaf) =>
            leaf.kind === "retrace"
              ? formatRetraceLabel({ ...leaf, lookback: null, timeframe: null })
              : formatStrategyLeafReason(leaf, input.side),
          )
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
    group,
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

export function flexAddRetraceColumn(
  latch: "condition_true" | "short_condition_true",
): "add_retrace" | "short_add_retrace" {
  return latch === "short_condition_true" ? "short_add_retrace" : "add_retrace";
}
