import {
  DEFAULT_DCA_RSI_PERIOD,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DEFAULT_DCA_SUPERTREND_PERIOD,
  indicatorCompareForDirection,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";

export type PerpsAddConditionType =
  | ""
  | "indicator"
  | "trend"
  | "price"
  | "webhook";

export type PerpsAddConditionDraft = {
  kind: DcaIndicatorKind | "";
  timeframe: DcaIndicatorTimeframe;
  compare: string;
  level: string;
  period: string;
  slowPeriod: string;
  multiplier: string;
  triggerBy: "last" | "mark" | "index";
  triggerCompare: "gte" | "lte";
  triggerPrice: string;
  webhookId: string;
};

export function blankPerpsAddConditionDraft(
  side: "long" | "short",
): PerpsAddConditionDraft {
  return {
    kind: "",
    timeframe: "15",
    compare: "",
    level: side === "short" ? "70" : "30",
    period: String(DEFAULT_DCA_RSI_PERIOD),
    slowPeriod: "",
    multiplier: String(DEFAULT_DCA_SUPERTREND_MULTIPLIER),
    triggerBy: "last",
    triggerCompare: side === "short" ? "lte" : "gte",
    triggerPrice: "",
    webhookId: "",
  };
}

export type PerpsAddOrderValues = {
  size: string;
  sizeUnit: "qty" | "usdt";
  orderType: "market" | "limit";
  limitPrice: string;
};

export type PerpsAddCondition = {
  key: string;
  type: PerpsAddConditionType;
  draft: PerpsAddConditionDraft;
};

/** One Or group. Conditions inside it are And. Order values belong to the group. */
export type PerpsAddOrderGroup = {
  key: string;
  lead: PerpsAddCondition;
  conditions: PerpsAddCondition[];
  order: PerpsAddOrderValues;
  /** Group 2 and later. Omitted means the group uses Group 1's size. */
  sameAsGroup1?: boolean;
};

function perpsAddKey(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function blankPerpsAddOrderValues(): PerpsAddOrderValues {
  return {
    size: "",
    sizeUnit: "usdt",
    orderType: "market",
    limitPrice: "",
  };
}

/** Group 2+ uses Group 1 until the box is cleared. Group 1 always shows its fields. */
export function sharesGroupLeadSizing(
  groupIndex: number,
  sameAsGroup1: boolean | undefined,
): boolean {
  return groupIndex > 0 && sameAsGroup1 !== false;
}

export function positiveSizingText(text: string): boolean {
  const value = Number(text.replace(/,/g, "").trim());
  return Number.isFinite(value) && value > 0;
}

/** Size, and Limit price when the order is Limit. Unit and Order keep defaults. */
export function perpsOrderValuesMissing(order: PerpsAddOrderValues): boolean {
  if (!positiveSizingText(order.size)) {
    return true;
  }
  return order.orderType === "limit" && !positiveSizingText(order.limitPrice);
}

/** A group's own size is required only while that group's fields are on screen. */
export function perpsAddGroupsSizingMissing(
  groups: readonly PerpsAddOrderGroup[],
): boolean {
  return groups.some((group, index) => {
    if (group.lead.type === "") {
      return false;
    }
    if (sharesGroupLeadSizing(index, group.sameAsGroup1)) {
      return false;
    }
    return perpsOrderValuesMissing(group.order);
  });
}

/**
 * Position Sizing stays hidden until that group's first Condition Type is chosen.
 * Group 1 uses the lead. Later groups use their opening row, not an And trigger.
 */
export function groupShowsPositionSizing(
  groupIndex: number,
  leadChosen: boolean,
  rows: readonly { join: "and" | "or"; kind: string }[],
): boolean {
  if (groupIndex <= 0) {
    return leadChosen;
  }
  let group = 0;
  for (const row of rows) {
    if (row.join === "or") {
      group += 1;
    }
    if (group === groupIndex) {
      return row.kind !== "" && row.kind !== "unset";
    }
  }
  return false;
}

export function isBlankPerpsAddOrder(order: PerpsAddOrderValues): boolean {
  const blank = blankPerpsAddOrderValues();
  return (
    order.size === blank.size &&
    order.sizeUnit === blank.sizeUnit &&
    order.orderType === blank.orderType &&
    order.limitPrice === blank.limitPrice
  );
}

/** The first time a later group leaves Same as Group 1, start from Group 1's values. */
export function revealGroupOrder(
  order: PerpsAddOrderValues,
  lead: PerpsAddOrderValues,
): PerpsAddOrderValues {
  return isBlankPerpsAddOrder(order) ? { ...lead } : order;
}

export function blankPerpsAddCondition(
  side: "long" | "short",
): PerpsAddCondition {
  return {
    key: perpsAddKey("add"),
    type: "",
    draft: blankPerpsAddConditionDraft(side),
  };
}

export function blankPerpsAddOrderGroup(
  side: "long" | "short",
): PerpsAddOrderGroup {
  return {
    key: perpsAddKey("group"),
    lead: blankPerpsAddCondition(side),
    conditions: [],
    order: blankPerpsAddOrderValues(),
  };
}

export function blankPerpsAddOrderGroups(
  side: "long" | "short",
): PerpsAddOrderGroup[] {
  return [blankPerpsAddOrderGroup(side)];
}

export function countPerpsAddConditions(
  groups: readonly PerpsAddOrderGroup[],
): number {
  return groups.reduce(
    (sum, group) => sum + 1 + group.conditions.length,
    0,
  );
}

export function appendPerpsAddCondition(
  group: PerpsAddOrderGroup,
  side: "long" | "short",
): PerpsAddOrderGroup {
  return {
    ...group,
    conditions: [...group.conditions, blankPerpsAddCondition(side)],
  };
}

export function appendPerpsAddOrderGroup(
  groups: readonly PerpsAddOrderGroup[],
  side: "long" | "short",
): PerpsAddOrderGroup[] {
  return [...groups, blankPerpsAddOrderGroup(side)];
}

/** Fields that belong to the selected additional-order condition. */
export function perpsAddConditionDraftForType(
  type: PerpsAddConditionType,
  side: "long" | "short",
  current: PerpsAddConditionDraft,
): PerpsAddConditionDraft {
  if (type === "indicator") {
    return { ...current, kind: "" };
  }
  if (type === "trend") {
    return {
      ...current,
      kind: "supertrend",
      compare: indicatorCompareForDirection(side, "supertrend", ""),
      period: String(DEFAULT_DCA_SUPERTREND_PERIOD),
      multiplier: String(DEFAULT_DCA_SUPERTREND_MULTIPLIER),
    };
  }
  return current;
}
