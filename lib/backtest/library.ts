import type { BacktestRecipe } from "@/lib/backtest/model";
import { DCA_INDICATOR_TIMEFRAME_LABELS } from "@/lib/dca/indicators";
import { formatGroupedNumberInput } from "@/lib/paper/open";
import {
  parseTemplateRecipe,
  recipesMatchReplayFields,
  templateIsLibraryRow,
  TEMPLATE_RECIPE_VERSION,
  type DcaTemplateRecipe,
  type TemplateVisibility,
} from "@/lib/templates/recipe";

function formatParamNumber(value: number | string | null | undefined): string {
  if (value == null || value === "") {
    return "";
  }
  return formatGroupedNumberInput(String(value), true);
}

export type BacktestLibraryItem = {
  id: string;
  name: string;
  recipe: BacktestRecipe;
  visibility?: string;
};

export type BacktestDeskBot = {
  id: string;
  name: string;
  deskName: string;
  recipe: BacktestRecipe;
  venue: string;
  venueEnvironment: string | null;
};

export function toBacktestLibraryItem(row: {
  id: string;
  name: string;
  recipe: { kind: string };
  visibility?: string;
}): BacktestLibraryItem | null {
  if (row.recipe.kind !== "perps" && row.recipe.kind !== "dca") {
    return null;
  }
  return row as BacktestLibraryItem;
}

export function findMatchingBacktestTemplate(
  recipe: BacktestRecipe,
  templates: BacktestLibraryItem[],
  preferredId?: string | null,
): BacktestLibraryItem | null {
  const preferred = preferredId
    ? (templates.find((row) => row.id === preferredId) ?? null)
    : null;
  if (preferred && recipesMatchReplayFields(recipe, preferred.recipe)) {
    return preferred;
  }
  return (
    templates.find((row) => recipesMatchReplayFields(recipe, row.recipe)) ??
    null
  );
}

export function findMatchingBacktestDeskBot(
  recipe: BacktestRecipe,
  deskBots: BacktestDeskBot[],
): BacktestDeskBot | null {
  return (
    deskBots.find((row) => recipesMatchReplayFields(recipe, row.recipe)) ??
    null
  );
}

export function formatBacktestDeskMatch(bot: {
  name: string;
  deskName: string;
}): string {
  return `${bot.deskName} · ${bot.name}`;
}

export function parseBacktestRecipeJson(raw: unknown): BacktestRecipe | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const kind = (value as { kind?: string }).kind;
  if (kind !== "dca" && kind !== "perps") {
    return null;
  }
  const parsed = parseTemplateRecipe(value, kind, TEMPLATE_RECIPE_VERSION);
  if (!parsed.ok) {
    return null;
  }
  if (parsed.recipe.kind !== "dca" && parsed.recipe.kind !== "perps") {
    return null;
  }
  return parsed.recipe;
}

export type BacktestFieldIssue = {
  field:
    | "startKind"
    | "armPrice"
    | "clipSize"
    | "entrySource"
    | "formAction"
    | "size"
    | "triggerPrice";
  message: string;
};

export function userBacktestFieldIssues(
  recipe: BacktestRecipe,
): BacktestFieldIssue[] {
  if (recipe.kind === "dca") {
    const issues: BacktestFieldIssue[] = [];
    if (recipe.startKind === "webhook") {
      issues.push({
        field: "startKind",
        message: "Webhook start cannot be replayed. Pick Price or Indicator.",
      });
    } else if (recipe.startKind === "immediate") {
      issues.push({
        field: "startKind",
        message: "Manual start cannot be replayed. Pick Price or Indicator.",
      });
    }
    if (
      recipe.startKind === "price" &&
      !(Number(recipe.armTrigger?.price) > 0)
    ) {
      issues.push({
        field: "armPrice",
        message: "Enter a start price.",
      });
    }
    const hasBudget =
      recipe.maxValue != null &&
      recipe.maxValue > 0 &&
      recipe.maxClips != null &&
      recipe.maxClips > 0;
    if (!(recipe.clipSize > 0) && !hasBudget) {
      issues.push({
        field: "clipSize",
        message: "Enter a clip size.",
      });
    }
    return issues;
  }
  const issues: BacktestFieldIssue[] = [];
  if (recipe.entrySource === "webhook") {
    issues.push({
      field: "entrySource",
      message: "Webhook entry cannot be replayed. Use a price When.",
    });
  }
  if (recipe.formAction === "close_long" || recipe.formAction === "close_short") {
    issues.push({
      field: "formAction",
      message: "Flatten rules cannot be replayed. Pick Buy or Sell.",
    });
  }
  const size = Number(String(recipe.size).replace(/,/g, "").trim());
  if (!(size > 0)) {
    issues.push({
      field: "size",
      message: "Enter a size.",
    });
  }
  const trigger = Number(String(recipe.triggerPrice).replace(/,/g, "").trim());
  if (recipe.entrySource !== "webhook" && !(trigger > 0)) {
    issues.push({
      field: "triggerPrice",
      message: "Enter a When price.",
    });
  }
  return issues;
}

export function canQueueUserBacktest(
  recipe: BacktestRecipe,
): { ok: true } | { ok: false; error: string } {
  const issue = userBacktestFieldIssues(recipe)[0];
  if (issue) {
    return { ok: false, error: issue.message };
  }
  return { ok: true };
}

export function decideBacktestTemplateActions(input: {
  status: string;
  ownerUserId: string | null;
  memberId: string;
  isAdmin?: boolean;
  recipe: BacktestRecipe;
  source: {
    id: string;
    name: string;
    recipe: BacktestRecipe;
    visibility?: string;
  } | null;
  linked: { id: string; name: string; visibility: string } | null;
  matchingTemplate?: {
    id: string;
    name: string;
    visibility?: string;
  } | null;
  matchingDeskBot?: { name: string; deskName: string } | null;
}): {
  canAttach: boolean;
  canSaveAs: boolean;
  canSaveAsPlatform: boolean;
  applyTemplateId: string | null;
  linkedName: string | null;
  sourceName: string | null;
  matchingTemplateId: string | null;
  matchingTemplateName: string | null;
  matchingDeskLabel: string | null;
} {
  const owns = input.ownerUserId === input.memberId;
  const done = input.status === "done";
  const linkedLibrary =
    input.linked &&
    templateIsLibraryRow(input.linked.visibility as TemplateVisibility)
      ? input.linked
      : null;
  const sourceMatch =
    input.source &&
    recipesMatchReplayFields(input.recipe, input.source.recipe)
      ? input.source
      : null;
  const match =
    input.matchingTemplate !== undefined
      ? input.matchingTemplate
      : sourceMatch;
  const canAttach = Boolean(done && owns && match && !linkedLibrary);
  const canSaveAs = Boolean(done && owns && !match && !linkedLibrary);
  const matchIsPlatform = match?.visibility === "platform";
  const linkedIsPlatform = input.linked?.visibility === "platform";
  const canSaveAsPlatform = Boolean(
    done && input.isAdmin && !matchIsPlatform && !linkedIsPlatform,
  );
  return {
    canAttach,
    canSaveAs,
    canSaveAsPlatform,
    applyTemplateId: linkedLibrary?.id ?? null,
    linkedName: linkedLibrary?.name ?? null,
    sourceName: input.source?.name ?? null,
    matchingTemplateId: match?.id ?? null,
    matchingTemplateName: match?.name ?? null,
    matchingDeskLabel: input.matchingDeskBot
      ? formatBacktestDeskMatch(input.matchingDeskBot)
      : null,
  };
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
      {
        label: "Clip",
        value: `${formatParamNumber(recipe.clipSize)} ${recipe.sizeUnit}`,
      },
      {
        label: "Size multiplier",
        value: formatParamNumber(recipe.sizeMultiplier),
      },
      {
        label: "Averaging",
        value:
          recipe.dipPct != null
            ? `${formatParamNumber(recipe.dipPct)}% dip`
            : recipe.intervalMinutes != null
              ? `${recipe.intervalMinutes}m`
              : recipe.dcaMode,
      },
      {
        label: "Max clips",
        value: recipe.maxClips == null ? "—" : String(recipe.maxClips),
      },
      {
        label: "Max value",
        value:
          recipe.maxValue == null
            ? "—"
            : recipe.maxValueKind === "percent"
              ? `${formatParamNumber(recipe.maxValue)}% of account`
              : `${formatParamNumber(recipe.maxValue)} USDT`,
      },
      {
        label: "Take profit",
        value:
          recipe.takeProfitPct == null
            ? "Off"
            : `${formatParamNumber(recipe.takeProfitPct)}%`,
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
    {
      label: "Size",
      value: `${formatParamNumber(recipe.size)} ${recipe.sizeUnit}`,
    },
    {
      label: "When",
      value: `${compareMark(recipe.triggerCompare)} ${formatParamNumber(recipe.triggerPrice)}`,
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
