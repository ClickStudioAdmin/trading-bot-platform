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
