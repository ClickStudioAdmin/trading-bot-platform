import type { BacktestRecipe } from "@/lib/backtest/model";
import { DCA_INDICATOR_TIMEFRAME_LABELS } from "@/lib/dca/indicators";
import type { DcaTemplateRecipe } from "@/lib/templates/recipe";

export type BacktestLibraryItem = {
  id: string;
  name: string;
  recipe: BacktestRecipe;
};

export function toBacktestLibraryItem(row: {
  id: string;
  name: string;
  recipe: { kind: string };
}): BacktestLibraryItem | null {
  if (row.recipe.kind !== "perps" && row.recipe.kind !== "dca") {
    return null;
  }
  return row as BacktestLibraryItem;
}

function compareMark(compare: string): string {
  if (compare === "lte" || compare === "cross_lte") {
    return "≤";
  }
  if (compare === "gte" || compare === "cross_gte") {
    return "≥";
  }
  return compare;
}

function dcaStartLabel(recipe: DcaTemplateRecipe): string {
  if (recipe.startKind === "immediate") {
    return "Manual";
  }
  if (recipe.startKind === "webhook") {
    return "Signal";
  }
  if (recipe.startKind === "price" && recipe.armTrigger) {
    return `Price ${compareMark(recipe.armTrigger.compare)} ${recipe.armTrigger.price}`;
  }
  if (recipe.startKind === "indicator") {
    const kind =
      recipe.indicatorKind === "ema_cross"
        ? "EMA"
        : recipe.indicatorKind === "macd"
          ? "MACD"
          : recipe.indicatorKind === "rsi"
            ? "RSI"
            : "Indicator";
    const when =
      recipe.indicatorCompare === "cross_lte"
        ? "crosses below"
        : recipe.indicatorCompare === "cross_gte"
          ? "crosses above"
          : recipe.indicatorCompare === "lte"
            ? "at or below"
            : recipe.indicatorCompare === "gte"
              ? "at or above"
              : recipe.indicatorCompare === "pair"
                ? "9/21 cross"
                : (recipe.indicatorCompare ?? "");
    const level =
      recipe.indicatorLevel != null ? ` ${recipe.indicatorLevel}` : "";
    const timeframe = recipe.indicatorTimeframe
      ? ` · ${DCA_INDICATOR_TIMEFRAME_LABELS[recipe.indicatorTimeframe] ?? recipe.indicatorTimeframe}`
      : "";
    return `${kind} ${when}${level}${timeframe}`.trim();
  }
  return recipe.startKind;
}

export function recipeParamRows(
  recipe: BacktestRecipe,
): Array<{ label: string; value: string }> {
  if (recipe.kind === "dca") {
    return [
      { label: "Type", value: "DCA" },
      { label: "Name", value: recipe.name },
      { label: "Contract", value: recipe.symbol },
      {
        label: "Direction",
        value:
          recipe.direction === "both"
            ? "Both"
            : recipe.direction === "short"
              ? "Short"
              : "Long",
      },
      { label: "Start", value: dcaStartLabel(recipe) },
      { label: "Clip", value: `${recipe.clipSize} ${recipe.sizeUnit}` },
      {
        label: "Size multiplier",
        value: String(recipe.sizeMultiplier),
      },
      {
        label: "Averaging",
        value:
          recipe.dipPct != null
            ? `${recipe.dipPct}% dip`
            : recipe.intervalMinutes != null
              ? `${recipe.intervalMinutes}m`
              : recipe.dcaMode,
      },
      {
        label: "Max clips",
        value: recipe.maxClips == null ? "—" : String(recipe.maxClips),
      },
      {
        label: "Take profit",
        value:
          recipe.takeProfitPct == null ? "Off" : `${recipe.takeProfitPct}%`,
      },
      {
        label: "Stop",
        value: recipe.stopLossPct == null ? "Off" : `${recipe.stopLossPct}%`,
      },
      {
        label: "Trailing",
        value: recipe.trailingPct == null ? "Off" : `${recipe.trailingPct}%`,
      },
    ];
  }
  return [
    { label: "Type", value: "Perps" },
    { label: "Name", value: recipe.name },
    { label: "Contract", value: recipe.symbol },
    {
      label: "Action",
      value:
        recipe.formAction === "sell"
          ? "Sell"
          : recipe.formAction === "close_long"
            ? "Close long"
            : recipe.formAction === "close_short"
              ? "Close short"
              : "Buy",
    },
    { label: "Size", value: `${recipe.size} ${recipe.sizeUnit}` },
    {
      label: "When",
      value: `${compareMark(recipe.triggerCompare)} ${recipe.triggerPrice}`,
    },
    {
      label: "Take profit",
      value:
        recipe.tpsl?.takeProfit == null
          ? "Off"
          : String(recipe.tpsl.takeProfit),
    },
    {
      label: "Stop",
      value:
        recipe.tpsl?.stopLoss == null ? "Off" : String(recipe.tpsl.stopLoss),
    },
    {
      label: "Trailing",
      value:
        recipe.trailing?.distance == null
          ? "Off"
          : String(recipe.trailing.distance),
    },
  ];
}
