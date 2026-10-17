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
import type { TemplateHardExitSignal } from "@/lib/dca/hard-exit";
import {
  resolveEntryStack,
  type EntryStack,
  type StrategyLeaf,
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

/** One condition inside a form-style group. */
export type ParamCondition = { rows: ParamRow[] };

/**
 * Conditions grouped the same way as the bot form.
 * `groups[0]` is Group 1. Later groups are opened by Or.
 * Conditions inside a group are joined with And.
 */
export type ParamStack = {
  title?: string;
  groups: ParamCondition[][];
};

export type ParamSection = {
  title: string;
  groups: ParamGroup[];
  stack?: ParamStack;
};

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

type PriceListStyle = "dca" | "flex";

function leafConditionRows(
  leaf: StrategyLeaf,
  side: "long" | "short",
  priceStyle: PriceListStyle,
  quote: string,
): ParamRow[] {
  if (leaf.kind === "price") {
    if (priceStyle === "dca") {
      return [
        { label: "Condition Type", value: "Price cross" },
        ...priceRows(
          {
            triggerBy: leaf.triggerBy,
            compare: leaf.compare,
            price: leaf.price,
          },
          quote,
        ),
      ];
    }
    return [
      { label: "Condition Type", value: "Price cross" },
      { label: "Price source", value: perpsPriceSource(leaf.triggerBy) },
      { label: "Compare", value: whenLabel(leaf.compare) },
      { label: "Price", value: num(leaf.price) },
    ];
  }
  if (leaf.kind === "webhook") {
    return [{ label: "Condition Type", value: "Signal webhook" }];
  }
  if (leaf.kind === "filter") {
    return [
      {
        label: "Condition Type",
        value: leaf.spec.kind === "supertrend" ? "Trend" : "Indicator",
      },
      ...filterRows(leaf.spec, side),
    ];
  }
  return [
    {
      label: "Condition Type",
      value: leaf.kind === "trend" ? "Trend" : "Indicator",
    },
    ...indicatorRows({
      trend: leaf.kind === "trend",
      side,
      kind: leaf.start.kind,
      timeframe: leaf.start.timeframe,
      compare: leaf.start.compare,
      level: leaf.start.level,
      period: leaf.start.period,
      slowPeriod: leaf.start.slowPeriod,
      multiplier: leaf.start.multiplier,
    }),
  ];
}

/** Lead is Group 1. And stays in the current group. Or starts the next group. */
function conditionStack(
  lead: ParamRow[] | null,
  leaves: readonly StrategyLeaf[],
  joins: readonly ("and" | "or")[],
  side: "long" | "short",
  priceStyle: PriceListStyle,
  quote: string,
): ParamCondition[][] {
  const groups: ParamCondition[][] = [];
  if (lead && lead.length > 0) {
    groups.push([{ rows: lead }]);
  }
  for (let index = 0; index < leaves.length; index += 1) {
    const leaf = leaves[index];
    if (!leaf) {
      continue;
    }
    const condition = {
      rows: leafConditionRows(leaf, side, priceStyle, quote),
    };
    if (groups.length === 0 || joins[index] === "or") {
      groups.push([condition]);
    } else {
      groups[groups.length - 1]?.push(condition);
    }
  }
  return groups;
}

function hardExitAnchorRows(
  spec: DcaFilterSpec | null | undefined,
  signal: TemplateHardExitSignal | null | undefined,
  side: "long" | "short",
): ParamRow[] | null {
  if (signal?.trigger === "price") {
    return [
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
    ];
  }
  if (signal?.trigger === "webhook") {
    return [{ label: "Condition Type", value: "Signal webhook" }];
  }
  if (!spec) {
    return null;
  }
  return [
    {
      label: "Condition Type",
      value: spec.kind === "supertrend" ? "Trend" : "Indicator",
    },
    ...filterRows(spec, side),
  ];
}

function hardExitParts(
  title: string,
  spec: DcaFilterSpec | null | undefined,
  signal: TemplateHardExitSignal | null | undefined,
  side: "long" | "short",
  stack?: EntryStack | null,
): { group?: ParamGroup; stack?: ParamStack } {
  const leaves = stack?.leaves ?? [];
  const anchor = hardExitAnchorRows(spec, signal, side);
  if (leaves.length === 0) {
    if (!anchor) {
      return { group: { rows: [{ label: title, value: "Off" }] } };
    }
    return { group: { title, rows: anchor } };
  }
  return {
    stack: {
      title,
      groups: conditionStack(
        anchor,
        leaves,
        stack?.joins ?? [],
        side,
        "flex",
        "USDT",
      ),
    },
  };
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

function dcaSideEntry(
  recipe: DcaTemplateRecipe,
  side: "long" | "short",
  quote: string,
): { groups: ParamGroup[]; stack?: ParamStack } {
  const both = recipe.direction === "both";
  const shortLeg = both && side === "short";
  const startKind = shortLeg
    ? (recipe.shortStartKind ?? recipe.startKind)
    : recipe.startKind;
  const lead: ParamRow[] = [
    { label: "Condition Type", value: dcaTriggerLabel(startKind) },
  ];
  if (startKind === "price") {
    lead.push(
      ...priceRows(
        shortLeg ? (recipe.shortArmTrigger ?? recipe.armTrigger) : recipe.armTrigger,
        quote,
      ),
    );
  } else if (startKind === "indicator" || startKind === "trend") {
    lead.push(
      ...indicatorRows({
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
    );
  }
  const confirm = shortLeg ? recipe.shortConfirm : recipe.confirm;
  const stored = shortLeg ? recipe.shortEntryStack : recipe.entryStack;
  const resolved = resolveEntryStack(stored, confirm);
  const showStack =
    startKind !== "immediate" || !both || (stored != null && stored.leaves.length > 0);
  if (showStack && resolved.leaves.length > 0) {
    return {
      groups: [],
      stack: {
        groups: conditionStack(
          lead,
          resolved.leaves,
          resolved.joins,
          side,
          "dca",
          quote,
        ),
      },
    };
  }
  const groups: ParamGroup[] = [{ rows: lead.slice(0, 1) }];
  if (lead.length > 1) {
    groups.push({ rows: lead.slice(1) });
  }
  if (showStack) {
    groups.push(secondaryGroup(confirm, side));
  }
  return { groups };
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
  const sides: Array<"long" | "short"> =
    recipe.direction === "both"
      ? ["long", "short"]
      : recipe.direction === "short"
        ? ["short"]
        : ["long"];
  return sides.map((side) => {
    const ownShort = side === "short" && recipe.direction === "both";
    const custom = hardExitParts(
      "Custom conditions",
      ownShort ? recipe.shortExitIf : recipe.exitIf,
      ownShort ? recipe.shortExitHard : recipe.exitHard,
      side,
      ownShort ? recipe.shortExitStack : recipe.exitStack,
    );
    return {
      title:
        side === "short"
          ? "Short Exit Conditions"
          : "Long Exit Conditions",
      groups: [
        ...dcaClassicGroups(recipe, side),
        ...(custom.group ? [custom.group] : []),
      ],
      stack: custom.stack,
    };
  });
}

function dcaClassicGroups(
  recipe: DcaTemplateRecipe,
  side: "long" | "short",
): ParamGroup[] {
  const own =
    side === "short" && recipe.direction === "both" && recipe.shortClassic
      ? recipe.shortClassic
      : null;
  const takeProfitKind = own?.takeProfitKind ?? recipe.takeProfitKind;
  const takeProfitAtrMult = own?.takeProfitAtrMult ?? recipe.takeProfitAtrMult;
  const takeProfitPct = own ? own.takeProfitPct : recipe.takeProfitPct;
  const takeProfitBasis = own?.takeProfitBasis ?? recipe.takeProfitBasis;
  const takeProfitOrderType = own?.takeProfitOrderType ?? recipe.takeProfitOrderType;
  const atrPeriod = own ? (own.atrPeriod ?? recipe.atrPeriod) : recipe.atrPeriod;
  const trailingPct = own ? own.trailingPct : recipe.trailingPct;
  const trailingTriggerPct = own ? own.trailingTriggerPct : recipe.trailingTriggerPct;
  const stopLossPct = own ? own.stopLossPct : recipe.stopLossPct;
  const stopLossBasis = own?.stopLossBasis ?? recipe.stopLossBasis;
  const breakevenActivationPct = own
    ? own.breakevenActivationPct
    : recipe.breakevenActivationPct;
  const breakevenOffsetPct = own ? own.breakevenOffsetPct : recipe.breakevenOffsetPct;
  const tpOn =
    takeProfitKind === "atr" ? takeProfitAtrMult != null : takeProfitPct != null;
  const tpRows: ParamRow[] = [
    { label: "Basis", value: basisLabel(takeProfitBasis) },
    {
      label: "Method",
      value: takeProfitKind === "atr" ? "ATR × multiplier" : "Percentage",
    },
  ];
  if (takeProfitKind === "atr") {
    if (recipe.spacingKind !== "atr" || own) {
      tpRows.push({ label: "ATR period", value: num(atrPeriod) });
    }
    tpRows.push({
      label: "ATR multiple",
      value: num(takeProfitAtrMult),
    });
  } else {
    tpRows.push({ label: "Target %", value: pct(takeProfitPct) });
  }
  tpRows.push({
    label: "Order type",
    value: orderLabel(takeProfitOrderType === "limit"),
  });
  const trailOn = trailingPct != null || trailingTriggerPct != null;
  const slOn = stopLossPct != null;
  return [
    optionalGroup("Take profit", tpOn, tpRows),
    optionalGroup("Trailing stop", trailOn, [
      { label: "Trigger %", value: pct(trailingTriggerPct) },
      { label: "Trailing %", value: pct(trailingPct) },
    ]),
    nestBreakeven(
      optionalGroup("Stop loss", slOn, [
        { label: "Basis", value: basisLabel(stopLossBasis) },
        { label: "Stop loss %", value: pct(stopLossPct) },
      ]),
      "Stop loss",
      breakevenActivationPct,
      breakevenOffsetPct,
    ),
  ];
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
        { title: "Maximum Exposure", rows: exposureRows(recipe, quote) },
      ],
    },
    ...entrySides.map((side) => {
      const entry = dcaSideEntry(recipe, side, quote);
      return {
        title: side === "short" ? "Short Entry Conditions" : "Long Entry Conditions",
        groups: entry.groups,
        stack: entry.stack,
      };
    }),
    {
      title: "Position Sizing",
      groups: orderGroups.filter((group) => group.title === "Initial Order Size"),
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

function perpsEntry(
  recipe: PerpsTemplateRecipe,
  side: "long" | "short",
  closing: boolean,
): { groups: ParamGroup[]; stack?: ParamStack } {
  const lead: ParamRow[] = [
    {
      label: "Condition Type",
      value: perpsTriggerLabel(recipe.entrySource),
    },
  ];
  if (recipe.entrySource === "indicator" || recipe.entrySource === "trend") {
    const start = recipe.indicator;
    lead.push(
      ...indicatorRows({
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
    );
  } else if (recipe.entrySource === "webhook") {
    lead.push({ label: "Webhook", value: "Not set" });
  } else {
    lead.push(
      { label: "Price source", value: perpsPriceSource(recipe.triggerBy) },
      { label: "Compare", value: whenLabel(recipe.triggerCompare) },
      { label: "Price", value: num(recipe.triggerPrice) },
    );
  }
  const resolved = resolveEntryStack(recipe.entryStack, recipe.confirm);
  if (!closing && resolved.leaves.length > 0) {
    return {
      groups: [],
      stack: {
        groups: conditionStack(
          lead,
          resolved.leaves,
          resolved.joins,
          side,
          "flex",
          quoteLabel(recipe.symbol),
        ),
      },
    };
  }
  const groups: ParamGroup[] = [{ rows: lead.slice(0, 1) }];
  if (lead.length > 1) {
    groups.push({ rows: lead.slice(1) });
  }
  if (!closing) {
    groups.push(secondaryGroup(recipe.confirm, side));
  }
  return { groups };
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
  const entry = perpsEntry(recipe, side, closing);
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
          ? "Long Entry Conditions"
          : "Short Entry Conditions",
      groups: entry.groups,
      stack: entry.stack,
    },
    ...(recipe.direction === "both" && recipe.shortEntry
      ? [
          {
            title: "Short Entry Conditions",
            ...perpsEntry(
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
    const addSides: Array<"long" | "short"> =
      recipe.direction === "both" ? ["long", "short"] : [side];
    for (const addSide of addSides) {
      sections.push({
        title:
          addSide === "short" ? "Short Additional Orders" : "Long Additional Orders",
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
  }
  sections.push(...perpsExitSections(recipe, side));
  return sections;
}

function perpsClassicGroups(
  tpsl: PerpsTemplateRecipe["tpsl"],
  trailing: PerpsTemplateRecipe["trailing"],
  breakevenActivationPct: number | null | undefined,
  breakevenOffsetPct: number | null | undefined,
): ParamGroup[] {
  return [
    perpsExitLevel(
      "Take profit",
      tpsl?.takeProfit,
      tpsl?.tpKind,
      tpsl?.tpTrigger,
      tpsl?.tpOrderType,
      tpsl?.tpLimitPrice,
    ),
    optionalGroup("Trailing stop", trailing?.distance != null, [
      { label: "Retracement", value: num(trailing?.distance) },
      {
        label: "Activation price",
        value:
          trailing?.activePrice == null ? "Off" : num(trailing.activePrice),
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
      breakevenActivationPct,
      breakevenOffsetPct,
    ),
  ];
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
  const longClassic = perpsClassicGroups(
    recipe.tpsl,
    recipe.trailing,
    recipe.breakevenActivationPct,
    recipe.breakevenOffsetPct,
  );
  const sides: Array<"long" | "short"> =
    recipe.direction === "both"
      ? ["long", "short"]
      : entrySide === "short"
        ? ["short"]
        : ["long"];
  return sides.map((exitSide) => {
    const ownShort = exitSide === "short" && recipe.direction === "both";
    const short = ownShort && perpsShortHasOwnExit(recipe) ? recipe.shortEntry : null;
    const shortClassic = ownShort ? recipe.shortEntry?.classic : null;
    const classic = shortClassic
      ? perpsClassicGroups(
          shortClassic.tpsl,
          shortClassic.trailing,
          shortClassic.breakevenActivationPct,
          shortClassic.breakevenOffsetPct,
        )
      : longClassic;
    const custom = hardExitParts(
      "Custom conditions",
      ownShort ? (short?.exitIf ?? null) : recipe.exitIf,
      ownShort ? (short?.exitHard ?? null) : recipe.exitHard,
      exitSide,
      ownShort ? (short?.exitStack ?? null) : recipe.exitStack,
    );
    return {
      title:
        exitSide === "short"
          ? "Short Exit Conditions"
          : "Long Exit Conditions",
      groups: [...classic, ...(custom.group ? [custom.group] : [])],
      stack: custom.stack,
    };
  });
}

export function recipeParamSections(recipe: BacktestRecipe): ParamSection[] {
  if (recipe.kind === "dca") {
    return dcaSections(recipe);
  }
  if (recipe.kind === "flex") {
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
    if (groups.length === 0 && !section.stack) {
      return [];
    }
    return [{ ...section, groups }];
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

function sectionRowScopes(
  section: ParamSection,
): Array<{ label: string; value: string; scope: string }> {
  const fromGroups = section.groups.flatMap((group) =>
    group.rows.map((row) => ({
      label: row.label,
      value: row.value,
      scope: group.title ?? section.title,
    })),
  );
  const fromStack = (section.stack?.groups ?? []).flatMap((conditions, index) =>
    conditions.flatMap((condition) =>
      condition.rows.map((row) => ({
        label: row.label,
        value: row.value,
        scope: `Group ${index + 1}`,
      })),
    ),
  );
  return [...fromGroups, ...fromStack];
}

export function recipeParamRows(
  recipe: BacktestRecipe,
): Array<{ label: string; value: string }> {
  const flat = recipeParamSections(recipe).flatMap((section) =>
    sectionRowScopes(section),
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
