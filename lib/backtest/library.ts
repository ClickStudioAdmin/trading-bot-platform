import { deskPath } from "@/lib/accounts/model";
import type { BacktestRecipe } from "@/lib/backtest/model";
import { DCA_INDICATOR_TIMEFRAME_LABELS } from "@/lib/dca/indicators";
import { formatGroupedNumberInput } from "@/lib/paper/open";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
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
  deskId: string;
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

export function deskBotAutomationsHref(bot: {
  id: string;
  deskId: string;
}): string {
  const sep = bot.id.indexOf(":");
  const botId = sep >= 0 ? bot.id.slice(sep + 1) : bot.id;
  return `${deskPath(FUTURES_PATHS.automations, bot.deskId)}#bot-${botId}`;
}

export type BacktestLibraryFolder = {
  id: string;
  name: string;
  visibility?: string;
  sharedByEmail?: string | null;
  items: Array<{ templateId: string; sortOrder?: number }>;
};

export type BacktestLibraryGroup = {
  id: string;
  label: string;
  items: BacktestLibraryItem[];
};

export function groupBacktestLibrary(
  templates: BacktestLibraryItem[],
  folders: BacktestLibraryFolder[],
): BacktestLibraryGroup[] {
  const byId = new Map(templates.map((row) => [row.id, row]));
  const filed = new Set<string>();
  const nameCounts = new Map<string, number>();
  for (const folder of folders) {
    nameCounts.set(folder.name, (nameCounts.get(folder.name) ?? 0) + 1);
  }
  const groups: BacktestLibraryGroup[] = [];
  const sorted = [...folders].sort((left, right) => {
    const rank =
      backtestFolderRank(left) - backtestFolderRank(right);
    if (rank !== 0) {
      return rank;
    }
    return left.name.localeCompare(right.name);
  });
  for (const folder of sorted) {
    const items = [...folder.items]
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
      .flatMap((item) => {
        const row = byId.get(item.templateId);
        return row ? [row] : [];
      })
      .filter((row, index, rows) => rows.findIndex((item) => item.id === row.id) === index);
    if (items.length === 0) {
      continue;
    }
    for (const row of items) {
      filed.add(row.id);
    }
    groups.push({
      id: folder.id,
      label: backtestFolderLabel(folder, (nameCounts.get(folder.name) ?? 1) > 1),
      items,
    });
  }
  const loose = templates.filter((row) => !filed.has(row.id));
  if (loose.length > 0) {
    groups.push({ id: "no-folder", label: "No folder", items: loose });
  }
  return groups;
}

function backtestFolderRank(folder: BacktestLibraryFolder): number {
  if (folder.visibility === "platform") {
    return 0;
  }
  if (folder.sharedByEmail) {
    return 1;
  }
  return 2;
}

function backtestFolderLabel(
  folder: BacktestLibraryFolder,
  nameClash: boolean,
): string {
  if (folder.visibility === "platform" && nameClash) {
    return `Platform · ${folder.name}`;
  }
  if (folder.sharedByEmail && nameClash) {
    return `${folder.name} · shared`;
  }
  return folder.name;
}

export function readBacktestRecipeJson(
  raw: unknown,
): { ok: true; recipe: BacktestRecipe } | { ok: false; error: string } {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return { ok: false, error: "Load a bot or pick a template to backtest." };
    }
  }
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Load a bot or pick a template to backtest." };
  }
  const kind = (value as { kind?: string }).kind;
  if (kind !== "dca" && kind !== "perps") {
    return { ok: false, error: "Load a bot or pick a template to backtest." };
  }
  const parsed = parseTemplateRecipe(value, kind, TEMPLATE_RECIPE_VERSION);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.recipe.kind !== "dca" && parsed.recipe.kind !== "perps") {
    return { ok: false, error: "Load a bot or pick a template to backtest." };
  }
  return { ok: true, recipe: parsed.recipe };
}

export function parseBacktestRecipeJson(raw: unknown): BacktestRecipe | null {
  const parsed = readBacktestRecipeJson(raw);
  return parsed.ok ? parsed.recipe : null;
}

export type BacktestFieldIssue = {
  field:
    | "startKind"
    | "armPrice"
    | "shortArmPrice"
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
        message:
          recipe.direction === "both"
            ? "Enter a Long start price."
            : "Enter a start price.",
      });
    }
    if (
      recipe.startKind === "price" &&
      recipe.direction === "both" &&
      !(Number(recipe.shortArmTrigger?.price) > 0)
    ) {
      issues.push({
        field: "shortArmPrice",
        message: "Enter a Short start price.",
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
  const canSaveAsPlatform = Boolean(done && input.isAdmin);
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

function dcaIndicatorSideLabel(input: {
  kind: DcaTemplateRecipe["indicatorKind"];
  compare: DcaTemplateRecipe["indicatorCompare"];
  level: number | null | undefined;
  timeframe: DcaTemplateRecipe["indicatorTimeframe"];
}): string {
  const kind =
    input.kind === "ema_cross"
      ? "EMA"
      : input.kind === "macd"
        ? "MACD"
        : input.kind === "rsi"
          ? "RSI"
          : "Indicator";
  const when =
    input.compare === "cross_lte"
      ? "crosses below"
      : input.compare === "cross_gte"
        ? "crosses above"
        : input.compare === "lte"
          ? "at or below"
          : input.compare === "gte"
            ? "at or above"
            : input.compare === "pair"
              ? "9/21 cross"
              : (input.compare ?? "");
  const level = input.level != null ? ` ${input.level}` : "";
  const timeframe = input.timeframe
    ? ` · ${DCA_INDICATOR_TIMEFRAME_LABELS[input.timeframe] ?? input.timeframe}`
    : "";
  return `${kind} ${when}${level}${timeframe}`.trim();
}

function dcaStartLabel(recipe: DcaTemplateRecipe): string {
  if (recipe.startKind === "immediate") {
    return "Manual";
  }
  if (recipe.startKind === "webhook") {
    return "Signal";
  }
  if (recipe.startKind === "price" && recipe.armTrigger) {
    const long = `Price ${compareMark(recipe.armTrigger.compare)} ${recipe.armTrigger.price}`;
    if (recipe.direction === "both" && recipe.shortArmTrigger) {
      return `${long} / Price ${compareMark(recipe.shortArmTrigger.compare)} ${recipe.shortArmTrigger.price}`;
    }
    return long;
  }
  if (recipe.startKind === "indicator") {
    const long = dcaIndicatorSideLabel({
      kind: recipe.indicatorKind,
      compare: recipe.indicatorCompare,
      level: recipe.indicatorLevel,
      timeframe: recipe.indicatorTimeframe,
    });
    if (recipe.direction === "both" && recipe.shortIndicatorKind) {
      return `${long} / ${dcaIndicatorSideLabel({
        kind: recipe.shortIndicatorKind,
        compare: recipe.shortIndicatorCompare ?? null,
        level: recipe.shortIndicatorLevel,
        timeframe: recipe.shortIndicatorTimeframe ?? null,
      })}`;
    }
    return long;
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
