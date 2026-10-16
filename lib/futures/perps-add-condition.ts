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
