import {
  DEFAULT_DCA_RSI_PERIOD,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DEFAULT_DCA_SUPERTREND_PERIOD,
  indicatorCompareForDirection,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import { parseDcaIndicatorCompare } from "@/lib/dca/indicators";
import { entryStackToJson, type EntryStack, type StrategyLeaf } from "@/lib/strategy/expr";
import { parseProtectionSpec } from "@/lib/strategy/protection";
import { parseRetraceSpec } from "@/lib/strategy/retrace";
import { parseRsiDivergenceSettings } from "@/lib/strategy/rsi-divergence";

export type PerpsAddConditionType =
  | ""
  | "indicator"
  | "trend"
  | "price"
  | "retrace"
  | "webhook"
  | "protection";

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
  retraceFrom: "high" | "low";
  retracePct: string;
  retraceLookback: string;
  protectionIs: "protected" | "unprotected";
  protectionAmount: "entire" | "at_least";
  protectionPct: string;
  divergenceWhen: string;
  divergenceStyle: string;
  pivotBars: string;
  span: string;
  minPricePct: string;
  minRsi: string;
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
    retraceFrom: side === "short" ? "low" : "high",
    retracePct: "",
    retraceLookback: "20",
    protectionIs: "protected",
    protectionAmount: "entire",
    protectionPct: "",
    divergenceWhen: side === "short" ? "bearish" : "bullish",
    divergenceStyle: "regular",
    pivotBars: "5",
    span: "50",
    minPricePct: "",
    minRsi: "",
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

function leafFromAddCondition(condition: PerpsAddCondition): StrategyLeaf | null {
  const draft = condition.draft;
  if (condition.type === "retrace") {
    const spec = parseRetraceSpec({
      source: draft.triggerBy,
      from: draft.retraceFrom,
      pct: draft.retracePct,
      lookback: draft.retraceLookback,
      timeframe: draft.timeframe,
    });
    return spec ? { kind: "retrace", ...spec } : null;
  }
  if (condition.type === "protection") {
    const spec = parseProtectionSpec({
      is: draft.protectionIs,
      amount: draft.protectionAmount,
      pct: draft.protectionPct,
    });
    return spec ? { kind: "protection", ...spec } : null;
  }
  if (condition.type === "price") {
    const price = Number(draft.triggerPrice.replace(/,/g, "").trim());
    if (!(price > 0)) {
      return null;
    }
    return {
      kind: "price",
      triggerBy: draft.triggerBy,
      compare: draft.triggerCompare,
      price,
    };
  }
  if (condition.type === "webhook") {
    const webhookId = draft.webhookId.trim();
    return webhookId ? { kind: "webhook", webhookId } : null;
  }
  if (
    (condition.type === "indicator" || condition.type === "trend") &&
    draft.kind
  ) {
    const divergence =
      draft.kind === "rsi_divergence"
        ? parseRsiDivergenceSettings({
            when: draft.divergenceWhen,
            style: draft.divergenceStyle,
            pivotBars: draft.pivotBars,
            span: draft.span,
            minPricePct: draft.minPricePct,
            minRsi: draft.minRsi,
          })
        : null;
    if (draft.kind === "rsi_divergence" && !divergence) {
      return null;
    }
    return {
      kind: condition.type,
      start: {
        kind: draft.kind,
        timeframe: draft.timeframe,
        compare: parseDcaIndicatorCompare(draft.compare),
        level: Number(draft.level.replace(/,/g, "")) || null,
        period: Number(draft.period.replace(/,/g, "")) || null,
        slowPeriod: Number(draft.slowPeriod.replace(/,/g, "")) || null,
        multiplier: Number(draft.multiplier.replace(/,/g, "")) || null,
        divergence,
      },
    };
  }
  return null;
}

function conditionFromLeaf(
  leaf: StrategyLeaf,
  side: "long" | "short",
): PerpsAddCondition | null {
  const draft = blankPerpsAddConditionDraft(side);
  if (leaf.kind === "retrace") {
    return {
      key: perpsAddKey("add"),
      type: "retrace",
      draft: {
        ...draft,
        triggerBy: leaf.source,
        timeframe: leaf.timeframe,
        retraceFrom: leaf.from,
        retracePct: String(leaf.pct),
        retraceLookback: String(leaf.lookback),
      },
    };
  }
  if (leaf.kind === "protection") {
    return {
      key: perpsAddKey("add"),
      type: "protection",
      draft: {
        ...draft,
        protectionIs: leaf.is,
        protectionAmount: leaf.amount,
        protectionPct: leaf.pct == null ? "" : String(leaf.pct),
      },
    };
  }
  if (leaf.kind === "price") {
    return {
      key: perpsAddKey("add"),
      type: "price",
      draft: {
        ...draft,
        triggerBy: leaf.triggerBy,
        triggerCompare: leaf.compare,
        triggerPrice: String(leaf.price),
      },
    };
  }
  if (leaf.kind === "webhook") {
    return {
      key: perpsAddKey("add"),
      type: "webhook",
      draft: { ...draft, webhookId: leaf.webhookId },
    };
  }
  if (leaf.kind === "indicator" || leaf.kind === "trend") {
    const settings = leaf.start.divergence;
    return {
      key: perpsAddKey("add"),
      type: leaf.kind,
      draft: {
        ...draft,
        kind: leaf.start.kind,
        timeframe: leaf.start.timeframe,
        compare: leaf.start.compare ?? "",
        level: leaf.start.level == null ? "" : String(leaf.start.level),
        period: leaf.start.period == null ? "" : String(leaf.start.period),
        slowPeriod:
          leaf.start.slowPeriod == null ? "" : String(leaf.start.slowPeriod),
        multiplier:
          leaf.start.multiplier == null ? "" : String(leaf.start.multiplier),
        divergenceWhen: settings?.when ?? draft.divergenceWhen,
        divergenceStyle: settings?.style ?? "regular",
        pivotBars: String(settings?.pivotBars ?? 5),
        span: String(settings?.span ?? 50),
        minPricePct: settings?.minPricePct == null ? "" : String(settings.minPricePct),
        minRsi: settings?.minRsi == null ? "" : String(settings.minRsi),
      },
    };
  }
  return null;
}

/** Conditions only. Order size stays on the form until that save lands. */
export function perpsAddGroupsToStack(
  groups: readonly PerpsAddOrderGroup[],
): EntryStack {
  const leaves: StrategyLeaf[] = [];
  const joins: EntryStack["joins"] = [];
  groups.forEach((group, groupIndex) => {
    const rows = [group.lead, ...group.conditions];
    let first = true;
    for (const condition of rows) {
      const leaf = leafFromAddCondition(condition);
      if (!leaf) {
        continue;
      }
      leaves.push(leaf);
      joins.push(!first && groupIndex === 0 ? "and" : first && groupIndex > 0 ? "or" : "and");
      first = false;
    }
  });
  return { leaves, joins };
}

export function perpsAddGroupsFromStack(
  stack: EntryStack | null | undefined,
  side: "long" | "short",
): PerpsAddOrderGroup[] {
  if (!stack || stack.leaves.length === 0) {
    return blankPerpsAddOrderGroups(side);
  }
  const groups: PerpsAddOrderGroup[] = [];
  stack.leaves.forEach((leaf, index) => {
    const condition = conditionFromLeaf(leaf, side);
    if (!condition) {
      return;
    }
    if (groups.length === 0 || stack.joins[index] === "or") {
      groups.push({
        key: perpsAddKey("group"),
        lead: condition,
        conditions: [],
        order: blankPerpsAddOrderValues(),
        ...(groups.length > 0 ? { sameAsGroup1: true } : {}),
      });
      return;
    }
    groups[groups.length - 1]?.conditions.push(condition);
  });
  return groups.length > 0 ? groups : blankPerpsAddOrderGroups(side);
}

export function perpsAddGroupsExpr(
  groups: readonly PerpsAddOrderGroup[],
): string {
  const stack = perpsAddGroupsToStack(groups);
  return stack.leaves.length > 0 ? JSON.stringify(entryStackToJson(stack)) : "";
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
  if (type === "retrace" || type === "protection") {
    return current;
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
