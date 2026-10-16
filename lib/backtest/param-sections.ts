import type { BacktestRecipe } from "@/lib/backtest/model";
import { isoDateUtc } from "@/lib/backtest/model";
import {
  DCA_FILTER_KIND_OPTIONS,
  dcaFilterWhenOptions,
  dcaFilterWhenValue,
  type DcaFilterSpec,
} from "@/lib/dca/filters";
import {
  DCA_INDICATOR_KIND_OPTIONS,
  DCA_INDICATOR_TIMEFRAME_LABELS,
  DCA_TREND_KIND_OPTIONS,
  dcaIndicatorIsLegacyEmaPrice,
  dcaIndicatorShowsLevel,
  dcaIndicatorUsesPairPeriods,
  dcaIndicatorUsesPeriod,
  dcaIndicatorWhenOptions,
  dcaIndicatorWhenValue,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import { dcaAveragingKind, dcaIntervalParts } from "@/lib/dca/playbook";
import { formatStrategyLeafReason } from "@/lib/bots/condition-copy";
import type { TemplateHardExitSignal } from "@/lib/dca/hard-exit";
import {
  confirmFromEntryStack,
  entryStackIsLegacy,
  resolveEntryStack,
  type EntryStack,
} from "@/lib/strategy/expr";
import { formatGroupedNumberInput } from "@/lib/paper/open";
import type {
  DcaTemplateRecipe,
  PaperTemplateRecipe,
  PerpsTemplateRecipe,
  TemplateRecipe,
} from "@/lib/templates/recipe";

export type ParamRow = { label: string; value: string };

export type ParamGroup = { title?: string; rows: ParamRow[] };

export type ParamSection = { title: string; groups: ParamGroup[] };

export type BacktestWindowFields = {
  name?: string | null;
  leverage: number;
  startingUsdt: number;
  fromMs: number;
  toMs: number;
};

function num(value: number | string | null | undefined): string {
  if (value == null || value === "") {
    return "—";
  }
  const text = formatGroupedNumberInput(String(value), true);
  return text === "" ? "—" : text;
}

function pct(value: number | string | null | undefined): string {
  const text = num(value);
  return text === "—" ? text : `${text}%`;
}

function quoteLabel(symbol: string): string {
  return symbol.toUpperCase().endsWith("USDC") ? "USDC" : "USDT";
}

function baseCoin(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.endsWith("USDT") || upper.endsWith("USDC")) {
    return upper.slice(0, -4) || "Token";
  }
  return upper || "Token";
}

function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
): string {
  if (!value) {
    return "—";
  }
  return options.find((row) => row.value === value)?.label ?? value;
}

function timeframeLabel(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return (
    DCA_INDICATOR_TIMEFRAME_LABELS[value as DcaIndicatorTimeframe] ?? value
  );
}

function dcaTriggerLabel(kind: DcaTemplateRecipe["startKind"]): string {
  if (kind === "immediate") {
    return "Immediate";
  }
  if (kind === "trend") {
    return "Trend";
  }
  if (kind === "price") {
    return "Price Cross";
  }
  if (kind === "webhook") {
    return "Signal Webhook";
  }
  return "Indicator";
}

function directionLabel(direction: DcaTemplateRecipe["direction"]): string {
  if (direction === "both") {
    return "Both";
  }
  if (direction === "short") {
    return "Short";
  }
  return "Long";
}

function basisLabel(value: string | null | undefined): string {
  return value === "first_entry" ? "First fill" : "Average entry";
}

function orderLabel(limit: boolean): string {
  return limit ? "Limit" : "Market";
}

function priceSourceLabel(value: string | null | undefined): string {
  if (value === "mark") {
    return "Mark";
  }
  if (value === "index") {
    return "Index";
  }
  return "Last";
}

function whenLabel(value: string | null | undefined): string {
  return value === "lte" ? "At or below" : "At or above";
}

function filterRows(spec: DcaFilterSpec, side: "long" | "short"): ParamRow[] {
  const when = dcaFilterWhenValue(spec.compare);
  const rows: ParamRow[] = [
    {
      label: "Kind",
      value: optionLabel(DCA_FILTER_KIND_OPTIONS, spec.kind),
    },
  ];
  if (spec.kind === "ema_cross" || spec.kind === "sma_cross") {
    rows.push(
      { label: "Fast", value: num(spec.period) },
      { label: "Slow", value: num(spec.slowPeriod) },
    );
  } else if (spec.kind !== "macd") {
    rows.push({ label: "Period", value: num(spec.period) });
  }
  if (spec.kind === "supertrend" || spec.kind === "atr_band") {
    rows.push({ label: "Multiplier", value: num(spec.multiplier) });
  }
  rows.push(
    { label: "Timeframe", value: timeframeLabel(spec.timeframe) },
    {
      label: "When",
      value: optionLabel(dcaFilterWhenOptions(spec.kind, side), when),
    },
  );
  if (spec.kind === "rsi" && spec.compare === "between") {
    rows.push(
      { label: "From", value: num(spec.level) },
      { label: "To", value: num(spec.levelTo) },
    );
  } else if (spec.kind === "rsi" || spec.kind === "macd") {
    rows.push({ label: "Level", value: num(spec.level) });
  }
  return rows;
}

function hardExitGroup(
  title: string,
  spec: DcaFilterSpec | null | undefined,
  signal: TemplateHardExitSignal | null | undefined,
  side: "long" | "short",
  stack?: EntryStack | null,
): ParamGroup {
  const extra = (stack?.leaves ?? []).map((leaf, index) => ({
    label: stack?.joins[index] === "or" ? "Or" : "And",
    value: formatStrategyLeafReason(leaf, side),
  }));
  if (signal?.trigger === "price") {
    return {
      title,
      rows: [
        { label: "Condition Type", value: "Price cross" },
        {
          label: "Price source",
          value:
            signal.triggerBy === "mark"
              ? "Mark is"
              : signal.triggerBy === "index"
                ? "Index is"
                : "Last is",
        },
        {
          label: "Compare",
          value: signal.compare === "lte" ? "At or below" : "At or above",
        },
        { label: "Price", value: num(signal.price) },
        ...extra,
      ],
    };
  }
  if (signal?.trigger === "webhook") {
    return {
      title,
      rows: [{ label: "Condition Type", value: "Signal webhook" }, ...extra],
    };
  }
  if (!spec) {
    return extra.length > 0
      ? { title, rows: extra }
      : { rows: [{ label: title, value: "Off" }] };
  }
  return {
    title,
    rows: [
      {
        label: "Condition Type",
        value: spec.kind === "supertrend" ? "Trend" : "Indicator",
      },
      ...filterRows(spec, side),
      ...extra,
    ],
  };
}

function entryStackGroup(
  stack: ReturnType<typeof resolveEntryStack>,
  confirm: DcaFilterSpec | null | undefined,
  side: "long" | "short",
): ParamGroup {
  if (entryStackIsLegacy(stack)) {
    return secondaryGroup(confirmFromEntryStack(stack) ?? confirm, side);
  }
  return {
    title: "Entry conditions",
    rows: stack.leaves.map((leaf, index) => ({
      label: stack.joins[index] === "or" ? "Or" : "And",
      value: formatStrategyLeafReason(leaf, side),
    })),
  };
}

function perpsEntryStackGroup(
  recipe: PerpsTemplateRecipe,
  side: "long" | "short",
): ParamGroup {
  const stack = resolveEntryStack(recipe.entryStack, recipe.confirm);
  return entryStackGroup(stack, recipe.confirm, side);
}

function secondaryGroup(
  spec: DcaFilterSpec | null | undefined,
  side: "long" | "short",
): ParamGroup {
  if (!spec) {
    return {
      rows: [{ label: "Secondary Entry Condition", value: "Off" }],
    };
  }
  return {
    title: "Secondary Entry Condition",
    rows: filterRows(spec, side),
  };
}

function indicatorRows(input: {
  trend: boolean;
  side: "long" | "short";
  kind: DcaIndicatorKind | null | undefined;
  timeframe: DcaIndicatorTimeframe | null | undefined;
  compare: string | null | undefined;
  level: number | null | undefined;
  period: number | null | undefined;
  slowPeriod: number | null | undefined;
  multiplier: number | null | undefined;
}): ParamRow[] {
  const kind = input.kind ?? (input.trend ? "supertrend" : "rsi");
  const whenValue = dcaIndicatorWhenValue(
    kind,
    input.side,
    input.compare,
    input.level,
  );
  const when = optionLabel(
    dcaIndicatorWhenOptions(
      kind,
      input.side,
      dcaIndicatorIsLegacyEmaPrice(kind, input.compare, input.level),
    ),
    whenValue,
  );
  const frame = timeframeLabel(input.timeframe);
  if (input.trend) {
    return [
      {
        label: "Trend",
        value: optionLabel(DCA_TREND_KIND_OPTIONS, kind),
      },
      { label: "Period", value: num(input.period) },
      { label: "Multiplier", value: num(input.multiplier) },
      { label: "Timeframe", value: frame },
      { label: "When", value: when },
    ];
  }
  const indicator = optionLabel(DCA_INDICATOR_KIND_OPTIONS, kind);
  if (dcaIndicatorUsesPairPeriods(kind)) {
    return [
      { label: "Indicator", value: indicator },
      { label: "Timeframe", value: frame },
      { label: "Fast", value: num(input.period) },
      { label: "When", value: when },
      { label: "Slow", value: num(input.slowPeriod) },
    ];
  }
  const rows: ParamRow[] = [{ label: "Indicator", value: indicator }];
  if (dcaIndicatorUsesPeriod(kind)) {
    rows.push({ label: "Period", value: num(input.period) });
  }
  if (kind === "atr_band") {
    rows.push({ label: "Multiplier", value: num(input.multiplier) });
  }
  rows.push(
    { label: "Timeframe", value: frame },
    { label: "When", value: when },
  );
  if (dcaIndicatorShowsLevel(kind, input.compare, input.level)) {
    rows.push({
      label: kind === "ema_cross" ? "Level (price)" : "Level",
      value: num(input.level),
    });
  }
  return rows;
}

function priceRows(
  trigger: DcaTemplateRecipe["armTrigger"] | null | undefined,
  quote: string,
): ParamRow[] {
  return [
    { label: "Price", value: priceSourceLabel(trigger?.triggerBy) },
    { label: "When", value: whenLabel(trigger?.compare) },
    { label: `Level (${quote})`, value: num(trigger?.price) },
  ];
}

function dcaSideEntryGroups(
  recipe: DcaTemplateRecipe,
  side: "long" | "short",
  quote: string,
): ParamGroup[] {
  const both = recipe.direction === "both";
  const shortLeg = both && side === "short";
  const startKind = shortLeg
    ? (recipe.shortStartKind ?? recipe.startKind)
    : recipe.startKind;
  const groups: ParamGroup[] = [
    {
      rows: [
        { label: "Condition Type", value: dcaTriggerLabel(startKind) },
      ],
    },
  ];
  if (startKind === "price") {
    groups.push({
      rows: priceRows(
        shortLeg ? (recipe.shortArmTrigger ?? recipe.armTrigger) : recipe.armTrigger,
        quote,
      ),
    });
  } else if (startKind === "indicator" || startKind === "trend") {
    groups.push({
      rows: indicatorRows({
        trend: startKind === "trend",
        side,
        kind: shortLeg ? (recipe.shortIndicatorKind ?? recipe.indicatorKind) : recipe.indicatorKind,
        timeframe: shortLeg
          ? (recipe.shortIndicatorTimeframe ?? recipe.indicatorTimeframe)
          : recipe.indicatorTimeframe,
        compare: shortLeg
          ? (recipe.shortIndicatorCompare ?? recipe.indicatorCompare)
          : recipe.indicatorCompare,
        level: shortLeg
          ? (recipe.shortIndicatorLevel ?? recipe.indicatorLevel)
          : recipe.indicatorLevel,
        period: shortLeg
          ? (recipe.shortIndicatorPeriod ?? recipe.indicatorPeriod)
          : recipe.indicatorPeriod,
        slowPeriod: shortLeg
          ? (recipe.shortIndicatorSlowPeriod ?? recipe.indicatorSlowPeriod)
          : recipe.indicatorSlowPeriod,
        multiplier: shortLeg
          ? (recipe.shortIndicatorMultiplier ?? recipe.indicatorMultiplier)
          : recipe.indicatorMultiplier,
      }),
    });
  }
  const confirm = shortLeg ? recipe.shortConfirm : recipe.confirm;
  const stored = shortLeg ? recipe.shortEntryStack : recipe.entryStack;
  if (startKind !== "immediate" || !both || (stored && stored.leaves.length > 0)) {
    groups.push(
      entryStackGroup(resolveEntryStack(stored, confirm), confirm, side),
    );
  }
  return groups;
}

function exposureRows(recipe: DcaTemplateRecipe, quote: string): ParamRow[] {
  const rows: ParamRow[] = [
    {
      label: "Max orders",
      value: recipe.maxClips == null ? "No cap" : num(recipe.maxClips),
    },
  ];
  if (recipe.maxValue == null) {
    rows.push({ label: "Max value", value: "No max value" });
    return rows;
  }
  if (recipe.maxValueKind === "percent") {
    rows.push(
      { label: "Max value", value: "% of account" },
      { label: "Percent", value: pct(recipe.maxValue) },
    );
  } else if (recipe.maxValueKind === "margin") {
    rows.push(
      { label: "Max value", value: "% of available margin" },
      { label: "Percent", value: pct(recipe.maxValue) },
    );
  } else {
    rows.push(
      { label: "Max value", value: `Fixed ${quote}` },
      { label: quote, value: num(recipe.maxValue) },
    );
  }
  return rows;
}

function sizingGroups(recipe: DcaTemplateRecipe, quote: string): ParamGroup[] {
  const averaging = dcaAveragingKind(recipe);
  const spacing = recipe.spacingKind ?? "percent";
  const budgetSizesClip = recipe.maxValue != null && recipe.maxClips != null;
  const initial: ParamRow[] = [];
  if (!budgetSizesClip) {
    initial.push({
      label: "Size unit",
      value: recipe.sizeUnit === "qty" ? "Token qty" : quote,
    });
  }
  initial.push({
    label: budgetSizesClip ? `Order size (${quote})` : "Order size",
    value: num(recipe.clipSize),
  });
  const averagingRows: ParamRow[] = [
    {
      label: "Averaging",
      value:
        averaging === "interval"
          ? "Add on interval"
          : "Add on price deviation",
    },
  ];
  if (averaging === "dip") {
    averagingRows.push({
      label: "Spacing",
      value: spacing === "atr" ? "ATR" : "Percentage",
    });
    if (spacing === "atr") {
      averagingRows.push(
        { label: "ATR period", value: num(recipe.atrPeriod) },
        { label: "ATR spacing", value: num(recipe.atrSpacingMult) },
      );
    } else {
      averagingRows.push({
        label: "Initial Price Deviation",
        value: pct(recipe.dipPct),
      });
    }
    averagingRows.push({
      label: "Order",
      value: orderLabel(recipe.dcaMode === "order"),
    });
  } else {
    const interval = dcaIntervalParts(recipe.intervalMinutes);
    const unit =
      interval.unit === "days"
        ? "Days"
        : interval.unit === "hours"
          ? "Hours"
          : "Minutes";
    averagingRows.push({
      label: "Add every",
      value: interval.value ? `${interval.value} ${unit}` : "—",
    });
  }
  return [
    { title: "Maximum Exposure", rows: exposureRows(recipe, quote) },
    { title: "Initial Order Size", rows: initial },
    { title: "Additional Order Types", rows: averagingRows },
    {
      title: "Additional Order Scaling",
      rows: [
        { label: "Order size multiplier", value: num(recipe.sizeMultiplier) },
        {
          label: "Price deviation multiplier",
          value: num(recipe.deviationMultiplier),
        },
      ],
    },
  ];
}

function optionalGroup(
  title: string,
  enabled: boolean,
  rows: ParamRow[],
): ParamGroup {
  if (!enabled) {
    return { rows: [{ label: title, value: "Off" }] };
  }
  return { title, rows };
}

function nestBreakeven(
  group: ParamGroup,
  title: string,
  activation: number | null | undefined,
  offset: number | null | undefined,
): ParamGroup {
  if (activation == null) {
    return group;
  }
  const extra: ParamRow[] = [
    { label: "Move stop to breakeven at %", value: pct(activation) },
    { label: "Breakeven offset %", value: pct(offset ?? 0) },
  ];
  if (!group.title) {
    return { title, rows: extra };
  }
  return { title: group.title, rows: [...group.rows, ...extra] };
}

function dcaExitSections(recipe: DcaTemplateRecipe): ParamSection[] {
  const groups = dcaExitGroups(recipe);
  const classic = groups.filter((group) => group.title !== "Condition Builder" && group.title !== "Long" && group.title !== "Short" && group.title !== "Custom conditions");
  const sides: Array<"long" | "short"> =
    recipe.direction === "both"
      ? ["long", "short"]
      : recipe.direction === "short"
        ? ["short"]
        : ["long"];
  return sides.map((side) => ({
    title:
      side === "short"
        ? "Short Exit Condition Builder"
        : "Long Exit Condition Builder",
    groups: [
      ...classic,
      hardExitGroup(
        "Custom conditions",
        side === "short" ? recipe.shortExitIf : recipe.exitIf,
        side === "short" ? recipe.shortExitHard : recipe.exitHard,
        side,
        side === "short" ? recipe.shortExitStack : recipe.exitStack,
      ),
    ],
  }));
}

function dcaExitGroups(recipe: DcaTemplateRecipe): ParamGroup[] {
  const tpOn =
    recipe.takeProfitKind === "atr"
      ? recipe.takeProfitAtrMult != null
      : recipe.takeProfitPct != null;
  const tpRows: ParamRow[] = [
    { label: "Basis", value: basisLabel(recipe.takeProfitBasis) },
    {
      label: "Method",
      value:
        recipe.takeProfitKind === "atr" ? "ATR × multiplier" : "Percentage",
    },
  ];
  if (recipe.takeProfitKind === "atr") {
    if (recipe.spacingKind !== "atr") {
      tpRows.push({ label: "ATR period", value: num(recipe.atrPeriod) });
    }
    tpRows.push({
      label: "ATR multiple",
      value: num(recipe.takeProfitAtrMult),
    });
  } else {
    tpRows.push({ label: "Target %", value: pct(recipe.takeProfitPct) });
  }
  tpRows.push({
    label: "Order type",
    value: orderLabel(recipe.takeProfitOrderType === "limit"),
  });
  const trailOn = recipe.trailingPct != null || recipe.trailingTriggerPct != null;
  const slOn = recipe.stopLossPct != null;
  const groups: ParamGroup[] = [
    optionalGroup("Take profit", tpOn, tpRows),
    optionalGroup("Trailing stop", trailOn, [
      { label: "Trigger %", value: pct(recipe.trailingTriggerPct) },
      { label: "Trailing %", value: pct(recipe.trailingPct) },
    ]),
    nestBreakeven(
      optionalGroup("Stop loss", slOn, [
        { label: "Basis", value: basisLabel(recipe.stopLossBasis) },
        { label: "Stop loss %", value: pct(recipe.stopLossPct) },
      ]),
      "Stop loss",
      recipe.breakevenActivationPct,
      recipe.breakevenOffsetPct,
    ),
  ];
  const side: "long" | "short" = recipe.direction === "short" ? "short" : "long";
  if (recipe.direction === "both") {
    groups.push({ title: "Condition Builder", rows: [] });
    groups.push(
      hardExitGroup("Long", recipe.exitIf, recipe.exitHard, "long", recipe.exitStack),
      hardExitGroup(
        "Short",
        recipe.shortExitIf,
        recipe.shortExitHard,
        "short",
        recipe.shortExitStack,
      ),
    );
  } else {
    groups.push(
      hardExitGroup(
        "Condition Builder",
        recipe.exitIf,
        recipe.exitHard,
        side,
        recipe.exitStack,
      ),
    );
  }
  return groups;
}

function dcaSections(recipe: DcaTemplateRecipe): ParamSection[] {
  const quote = quoteLabel(recipe.symbol);
  const entrySides: Array<"long" | "short"> =
    recipe.direction === "both"
      ? ["long", "short"]
      : recipe.direction === "short"
        ? ["short"]
        : ["long"];
  const orderGroups = sizingGroups(recipe, quote);
  return [
    {
      title: "General",
      groups: [
        {
          rows: [
            { label: "Name", value: recipe.name },
            { label: "Contract", value: recipe.symbol },
            { label: "Direction", value: directionLabel(recipe.direction) },
          ],
        },
      ],
    },
    ...entrySides.map((side) => ({
      title: side === "short" ? "Short Entry Condition Builder" : "Long Entry Condition Builder",
      groups: dcaSideEntryGroups(recipe, side, quote),
    })),
    {
      title: "Position Sizing",
      groups: orderGroups.filter(
        (group) =>
          group.title === "Maximum Exposure" ||
          group.title === "Initial Order Size",
      ),
    },
    {
      title: "Additional Orders",
      groups: orderGroups.filter(
        (group) =>
          group.title === "Additional Order Types" ||
          group.title === "Additional Order Scaling",
      ),
    },
    ...dcaExitSections(recipe),
  ];
}

function perpsTriggerLabel(source: PerpsTemplateRecipe["entrySource"]): string {
  if (source === "indicator") {
    return "Indicator";
  }
  if (source === "trend") {
    return "Trend";
  }
  if (source === "webhook") {
    return "Signal webhook";
  }
  return "Price cross";
}

function perpsDirectionText(recipe: PerpsTemplateRecipe): string {
  if (recipe.formAction === "close_long") return "Close long";
  if (recipe.formAction === "close_short") return "Close short";
  if (recipe.direction === "both") return "Both";
  if (recipe.direction === "short" || recipe.formAction === "sell") return "Short";
  return "Long";
}

function perpsPriceSource(value: string | null | undefined): string {
  if (value === "mark") {
    return "Mark is";
  }
  if (value === "index") {
    return "Index is";
  }
  return "Last is";
}

function perpsExitLevel(
  title: string,
  level: number | null | undefined,
  kind: string | null | undefined,
  trigger: string | null | undefined,
  orderType: string | null | undefined,
  limitPrice: number | null | undefined,
): ParamGroup {
  const percent = kind === "percent";
  const rows: ParamRow[] = [
    { label: "Type", value: percent ? "Percentage" : "Price" },
    { label: percent ? "%" : "Price", value: percent ? pct(level) : num(level) },
    { label: "Trigger", value: priceSourceLabel(trigger) },
    { label: "Order type", value: orderLabel(orderType === "limit") },
  ];
  if (orderType === "limit") {
    rows.push({ label: "Limit price", value: num(limitPrice) });
  }
  return optionalGroup(title, level != null, rows);
}

function perpsEntryGroups(
  recipe: PerpsTemplateRecipe,
  side: "long" | "short",
  closing: boolean,
): ParamGroup[] {
  const entry: ParamGroup[] = [
    {
      rows: [
        {
          label: "Condition Type",
          value: perpsTriggerLabel(recipe.entrySource),
        },
      ],
    },
  ];
  if (recipe.entrySource === "indicator" || recipe.entrySource === "trend") {
    const start = recipe.indicator;
    entry.push({
      rows: indicatorRows({
        trend: recipe.entrySource === "trend",
        side,
        kind: start?.kind,
        timeframe: start?.timeframe,
        compare: start?.compare,
        level: start?.level,
        period: start?.period,
        slowPeriod: start?.slowPeriod,
        multiplier: start?.multiplier,
      }),
    });
  } else if (recipe.entrySource === "webhook") {
    entry.push({
      rows: [{ label: "Webhook", value: "Not set" }],
    });
  } else {
    entry.push({
      rows: [
        { label: "Price source", value: perpsPriceSource(recipe.triggerBy) },
        { label: "Compare", value: whenLabel(recipe.triggerCompare) },
        { label: "Price", value: num(recipe.triggerPrice) },
      ],
    });
  }
  if (!closing) {
    entry.push(perpsEntryStackGroup(recipe, side));
  }
  return entry;
}

function perpsSections(recipe: PerpsTemplateRecipe): ParamSection[] {
  const closing =
    recipe.formAction === "close_long" || recipe.formAction === "close_short";
  const quote = quoteLabel(recipe.symbol);
  const side: "long" | "short" =
    recipe.direction === "both"
      ? "long"
      : recipe.formAction === "sell" || recipe.direction === "short"
        ? "short"
        : "long";
  const entry = perpsEntryGroups(recipe, side, closing);
  const sizeRows: ParamRow[] = [
    {
      label: closing ? "Qty to close" : "Size",
      value: closing && String(recipe.size).trim() === "" ? "All" : num(recipe.size),
    },
  ];
  if (!closing) {
    sizeRows.push({
      label: "Unit",
      value: recipe.sizeUnit === "qty" ? baseCoin(recipe.symbol) : quote,
    });
  }
  sizeRows.push({
    label: "Order",
    value: orderLabel(recipe.orderType === "limit"),
  });
  if (recipe.orderType === "limit") {
    sizeRows.push({ label: "Limit price", value: num(recipe.limitPrice) });
  }
  const sections: ParamSection[] = [
    {
      title: "General",
      groups: [
        {
          rows: [
            { label: "Name", value: recipe.name },
            { label: "Contract", value: recipe.symbol },
            { label: "Direction", value: perpsDirectionText(recipe) },
          ],
        },
      ],
    },
    {
      title:
        recipe.direction === "both" || side === "long"
          ? "Long Entry Condition Builder"
          : "Short Entry Condition Builder",
      groups: entry,
    },
    ...(recipe.direction === "both" && recipe.shortEntry
      ? [
          {
            title: "Short Entry Condition Builder",
            groups: perpsEntryGroups(
              {
                ...recipe,
                formAction: "sell" as const,
                entrySource: recipe.shortEntry.entrySource,
                triggerBy: recipe.shortEntry.triggerBy,
                triggerCompare: recipe.shortEntry.triggerCompare,
                triggerPrice: String(recipe.shortEntry.triggerPrice),
                skipIfOpen: recipe.shortEntry.skipIfOpen,
                indicator: recipe.shortEntry.indicator,
                confirm: recipe.shortEntry.confirm,
                entryStack: recipe.shortEntry.entryStack,
              },
              "short",
              false,
            ),
          },
        ]
      : []),
    {
      title: "Position Sizing",
      groups: [{ title: closing ? undefined : "Order Size", rows: sizeRows }],
    },
  ];
  if (!closing) {
    sections.push({
      title: "Additional Orders",
      groups: [
        {
          rows: [
            { label: "Condition Type", value: "Off" },
            { label: "Size", value: "Off" },
            { label: "Unit", value: "Off" },
            { label: "Order", value: "Off" },
          ],
        },
      ],
    });
  }
  sections.push(...perpsExitSections(recipe, side));
  return sections;
}

function perpsShortHasOwnExit(recipe: PerpsTemplateRecipe): boolean {
  const leg = recipe.shortEntry;
  if (!leg) {
    return false;
  }
  return Boolean(
    leg.exitIf ||
      leg.exitHard ||
      (leg.exitStack && leg.exitStack.leaves.length > 0),
  );
}

function perpsExitSections(
  recipe: PerpsTemplateRecipe,
  entrySide: "long" | "short",
): ParamSection[] {
  const closing =
    recipe.formAction === "close_long" || recipe.formAction === "close_short";
  if (closing) {
    return [];
  }
  const tpsl = recipe.tpsl;
  const classic: ParamGroup[] = [
    perpsExitLevel(
      "Take profit",
      tpsl?.takeProfit,
      tpsl?.tpKind,
      tpsl?.tpTrigger,
      tpsl?.tpOrderType,
      tpsl?.tpLimitPrice,
    ),
    optionalGroup("Trailing stop", recipe.trailing?.distance != null, [
      { label: "Retracement", value: num(recipe.trailing?.distance) },
      {
        label: "Activation price",
        value:
          recipe.trailing?.activePrice == null
            ? "Off"
            : num(recipe.trailing.activePrice),
      },
    ]),
    nestBreakeven(
      perpsExitLevel(
        "Stop loss",
        tpsl?.stopLoss,
        tpsl?.slKind,
        tpsl?.slTrigger,
        tpsl?.slOrderType,
        tpsl?.slLimitPrice,
      ),
      "Stop loss",
      recipe.breakevenActivationPct,
      recipe.breakevenOffsetPct,
    ),
  ];
  const sides: Array<"long" | "short"> =
    recipe.direction === "both"
      ? ["long", "short"]
      : entrySide === "short"
        ? ["short"]
        : ["long"];
  return sides.map((exitSide) => {
    const ownShort = exitSide === "short" && recipe.direction === "both";
    const short = ownShort && perpsShortHasOwnExit(recipe) ? recipe.shortEntry : null;
    return {
      title:
        exitSide === "short"
          ? "Short Exit Condition Builder"
          : "Long Exit Condition Builder",
      groups: [
        ...classic,
        hardExitGroup(
          "Custom conditions",
          ownShort ? (short?.exitIf ?? null) : recipe.exitIf,
          ownShort ? (short?.exitHard ?? null) : recipe.exitHard,
          exitSide,
          ownShort ? (short?.exitStack ?? null) : recipe.exitStack,
        ),
      ],
    };
  });
}

export function recipeParamSections(recipe: BacktestRecipe): ParamSection[] {
  if (recipe.kind === "dca") {
    return dcaSections(recipe);
  }
  if (recipe.kind === "perps") {
    return perpsSections(recipe);
  }
  return [];
}

function paperPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "Off";
  }
  return pct(Number((Math.abs(value) * 100).toPrecision(12)));
}

function paperUsdt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "Off";
  }
  return `${num(value)} USDT`;
}

function paperSections(recipe: PaperTemplateRecipe): ParamSection[] {
  const dynamic = recipe.sizeType === "dynamic";
  const exitDynamic = recipe.exitSizeType !== "fixed";
  const sizing: ParamRow[] = [
    {
      label: "Max Position Size",
      value: paperUsdt(recipe.maxOpenNotionalUsdt),
    },
    {
      label: "Max pairs",
      value: recipe.maxOpenCount == null ? "Off" : num(recipe.maxOpenCount),
    },
    {
      label: "Order Type",
      value: dynamic ? "Dynamic (scale in)" : "Fixed",
    },
  ];
  if (!dynamic) {
    sizing.push(
      { label: "Order size (USDT)", value: num(recipe.notionalUsdt) },
      { label: "Min usable book", value: paperUsdt(recipe.minCapacityUsdt) },
    );
  }
  if (dynamic || exitDynamic) {
    sizing.push({
      label: "Min Order Size",
      value: paperUsdt(recipe.minSizeUsdt),
    });
  }
  return [
    {
      title: "General",
      groups: [{ rows: [{ label: "Name", value: recipe.name || "—" }] }],
    },
    {
      title: "Entry Conditions",
      groups: [
        {
          rows: [
            { label: "Min APR %", value: paperPercent(recipe.minNetApr) },
            {
              label: "Min DTE",
              value: recipe.minDte == null ? "Off" : num(recipe.minDte),
            },
            {
              label: "Max DTE",
              value: recipe.maxDte == null ? "Off" : num(recipe.maxDte),
            },
          ],
        },
      ],
    },
    {
      title: "Position Sizing",
      groups: [{ title: "Position and Orders", rows: sizing }],
    },
    {
      title: "Exit Conditions",
      groups: [
        {
          title: "Exit",
          rows: [
            {
              label: "DTE ≤",
              value:
                recipe.closeMaxDte == null ? "Off" : num(recipe.closeMaxDte),
            },
            {
              label: "APR % below",
              value: paperPercent(recipe.closeMinNetApr),
            },
            {
              label: "Order Type",
              value:
                recipe.exitSizeType === "fixed"
                  ? "Fixed (entire position)"
                  : "Dynamic (scale out)",
            },
          ],
        },
        optionalGroup("Take profit", recipe.takeProfitPct != null, [
          { label: "Take profit %", value: paperPercent(recipe.takeProfitPct) },
        ]),
        optionalGroup("Stop loss", recipe.stopLossPct != null, [
          { label: "Stop loss %", value: paperPercent(recipe.stopLossPct) },
        ]),
      ],
    },
  ];
}

function withoutBotName(sections: ParamSection[]): ParamSection[] {
  return sections.flatMap((section) => {
    const groups = section.groups.flatMap((group) => {
      const rows = group.rows.filter((row) => row.label !== "Name");
      return rows.length > 0 ? [{ ...group, rows }] : [];
    });
    return groups.length > 0 ? [{ ...section, groups }] : [];
  });
}

export function templateParamSections(recipe: TemplateRecipe): ParamSection[] {
  if (recipe.kind === "cash_and_carry") {
    return withoutBotName(paperSections(recipe));
  }
  return withoutBotName(recipeParamSections(recipe));
}

function listedBotSections(recipe: BacktestRecipe): ParamSection[] {
  return recipeParamSections(recipe).map((section) => {
    if (section.title !== "General") {
      return section;
    }
    return {
      ...section,
      groups: section.groups.map((group) => ({
        ...group,
        rows: group.rows.filter((row) => row.label !== "Name"),
      })),
    };
  });
}

export function backtestListedSections(
  recipe: BacktestRecipe,
  window: BacktestWindowFields,
): ParamSection[] {
  const title = window.name?.trim() || recipe.name.trim() || "Backtest";
  return [
    {
      title: "Market window",
      groups: [
        {
          rows: [
            { label: "Name", value: title },
            { label: "Start date", value: isoDateUtc(window.fromMs) },
            { label: "End date", value: isoDateUtc(window.toMs) },
            {
              label: "Initial account balance",
              value: `$${num(window.startingUsdt)}`,
            },
            { label: "Leverage", value: `${num(window.leverage)}×` },
          ],
        },
      ],
    },
    ...listedBotSections(recipe),
  ];
}

export function recipeParamRows(
  recipe: BacktestRecipe,
): Array<{ label: string; value: string }> {
  const flat = recipeParamSections(recipe).flatMap((section) =>
    section.groups.flatMap((group) =>
      group.rows.map((row) => ({
        label: row.label,
        value: row.value,
        scope: group.title ?? section.title,
      })),
    ),
  );
  const counts = new Map<string, number>();
  for (const row of flat) {
    counts.set(row.label, (counts.get(row.label) ?? 0) + 1);
  }
  return flat.map((row) => ({
    label:
      (counts.get(row.label) ?? 0) > 1 ? `${row.scope} · ${row.label}` : row.label,
    value: row.value,
  }));
}
