import { deskPath, formatDeskType } from "@/lib/accounts/model";
import {
  backtestRunTitle,
  memberCanReadBacktestRun,
  templateBacktestLinks,
  type AttachedBacktestRow,
  type BacktestRecipe,
  type TemplateBacktestLink,
} from "@/lib/backtest/model";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { templatePageHref } from "@/lib/templates/library-tab";
import {
  parseTemplateRecipe,
  recipesMatchReplayFields,
  type PerpsTemplateRecipe,
  templateIsLibraryRow,
  TEMPLATE_RECIPE_VERSION,
  type TemplateRecipe,
  type TemplateVisibility,
} from "@/lib/templates/recipe";

export type BacktestLibraryItem = {
  id: string;
  name: string;
  description?: string | null;
  recipe: BacktestRecipe;
  visibility?: string;
};

export type BacktestDeskBot = {
  id: string;
  name: string;
  symbol: string;
  kind: "dca" | "flex";
  deskId: string;
  deskName: string;
  recipe: BacktestRecipe;
  venue: string;
  venueEnvironment: string | null;
};

export function toBacktestLibraryItem(row: {
  id: string;
  name?: string | null;
  description?: string | null;
  recipe: { kind: string; name?: string };
  visibility?: string;
  symbol?: string;
  parentRunId?: string | null;
}): BacktestLibraryItem | null {
  if (row.recipe.kind !== "flex" && row.recipe.kind !== "dca") {
    return null;
  }
  const recipeName = String(row.recipe.name ?? "").trim();
  const name =
    row.name?.trim() ||
    (row.symbol
      ? backtestRunTitle({
          recipe: { name: recipeName || "Backtest" },
          symbol: row.symbol,
          parentRunId: row.parentRunId ?? null,
        })
      : recipeName) ||
    "Backtest";
  const description = row.description?.trim() || null;
  return {
    id: row.id,
    name,
    recipe: row.recipe as BacktestRecipe,
    ...(description ? { description } : {}),
    ...(row.visibility !== undefined ? { visibility: row.visibility } : {}),
  };
}

function hasAttachedBacktests<T>(value: T | undefined): boolean {
  if (value == null) {
    return false;
  }
  return !Array.isArray(value) || value.length > 0;
}

/**
 * A user template with the same replay settings as a platform template shows
 * that platform template's finished runs. The user row keeps its own runs.
 */
export function inheritPlatformBacktests<T>(
  templates: ReadonlyArray<{
    id: string;
    visibility: string;
    recipe: TemplateRecipe;
  }>,
  byTemplateId: Record<string, T>,
): Record<string, T> {
  const next: Record<string, T> = { ...byTemplateId };
  const platform = templates.filter((row) => row.visibility === "platform");
  for (const template of templates) {
    if (template.visibility !== "user" || hasAttachedBacktests(next[template.id])) {
      continue;
    }
    if (template.recipe.kind !== "dca" && template.recipe.kind !== "flex") {
      continue;
    }
    const twin = platform.find(
      (row) =>
        (row.recipe.kind === "dca" || row.recipe.kind === "flex") &&
        hasAttachedBacktests(byTemplateId[row.id]) &&
        recipesMatchReplayFields(template.recipe, row.recipe),
    );
    if (!twin) {
      continue;
    }
    const value = byTemplateId[twin.id];
    if (value != null) {
      next[template.id] = value;
    }
  }
  return next;
}

/** Platform templates whose replay settings match a requested user template. */
export function matchingPlatformTemplateIds(
  templates: ReadonlyArray<{
    id: string;
    visibility: string;
    recipe: TemplateRecipe;
  }>,
  requestedIds: ReadonlyArray<string>,
): string[] {
  const requested = new Set(requestedIds);
  const platform = templates.filter((row) => row.visibility === "platform");
  const ids: string[] = [];
  for (const template of templates) {
    if (!requested.has(template.id) || template.visibility !== "user") {
      continue;
    }
    if (template.recipe.kind !== "dca" && template.recipe.kind !== "flex") {
      continue;
    }
    for (const row of platform) {
      if (row.recipe.kind !== "dca" && row.recipe.kind !== "flex") {
        continue;
      }
      if (!recipesMatchReplayFields(template.recipe, row.recipe)) {
        continue;
      }
      ids.push(row.id);
    }
  }
  return [...new Set(ids)];
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

export type SavedBacktestMatch = {
  id: string;
  name: string;
  recipe: BacktestRecipe;
};

export function toSavedBacktestMatch(run: {
  id: string;
  name?: string | null;
  status: string;
  recipe: BacktestRecipe;
  symbol: string;
  parentRunId: string | null;
}): SavedBacktestMatch | null {
  if (run.status !== "done") {
    return null;
  }
  return {
    id: run.id,
    name: backtestRunTitle(run),
    recipe: run.recipe,
  };
}

export function findMatchingSavedBacktest(
  recipe: BacktestRecipe | null | undefined,
  runs: readonly SavedBacktestMatch[],
): SavedBacktestMatch | null {
  if (!recipe) {
    return null;
  }
  return (
    runs.find((run) => recipesMatchReplayFields(recipe, run.recipe)) ?? null
  );
}

/**
 * Newest matching draft for this user.
 * Callers pass drafts newest first. A finished run and another user's draft do not match.
 * Name is ignored, the same as other replay matches.
 */
export function findMatchingDraftBacktest<
  T extends {
    id: string;
    status: string;
    userId: string | null;
    recipe: BacktestRecipe;
  },
>(
  recipe: BacktestRecipe | null | undefined,
  userId: string,
  drafts: readonly T[],
): T | null {
  if (!recipe || !userId) {
    return null;
  }
  return (
    drafts.find(
      (row) =>
        row.status === "draft" &&
        row.userId === userId &&
        recipesMatchReplayFields(recipe, row.recipe),
    ) ?? null
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

/** `flex:<id>` or `dca:<id>` for the New Backtest bot list. */
export function deskBacktestBotParam(raw: string): string {
  const value = raw.trim();
  const sep = value.indexOf(":");
  const kind = value.slice(0, sep);
  const id = value.slice(sep + 1).trim();
  if ((kind !== "dca" && kind !== "flex") || !id) {
    return "";
  }
  return `${kind}:${id}`;
}

/**
 * Which Bot or Template row opens selected.
 * A click from a saved desk bot wins. A template link is next.
 * A recipe that still matches a desk bot fills Bot when neither id was passed.
 */
export function backtestOpenedSourceId(input: {
  deskBotId?: string | null;
  templateId?: string | null;
  deskBotIds: readonly string[];
  templateIds: readonly string[];
  matchedDeskBotId?: string | null;
}): string {
  const deskBotId = deskBacktestBotParam(String(input.deskBotId ?? ""));
  if (deskBotId && input.deskBotIds.includes(deskBotId)) {
    return deskBotId;
  }
  const templateId = String(input.templateId ?? "").trim();
  if (templateId && input.templateIds.includes(templateId)) {
    return templateId;
  }
  const matched = deskBacktestBotParam(String(input.matchedDeskBotId ?? ""));
  if (matched && input.deskBotIds.includes(matched)) {
    return matched;
  }
  return "";
}

export type BacktestListDesk = {
  id: string;
  name: string;
  deskType: "dca" | "flex";
};

export type BacktestRunDeskIndex = {
  desks: BacktestListDesk[];
  /** Desk ids whose current bot recipe still matches this run. A run can match more than one desk. */
  runDeskIds: Record<string, string[]>;
};

function backtestDeskBotKey(kind: string, symbol: string): string {
  return `${kind}:${symbol.trim().toUpperCase()}`;
}

/**
 * Saved-list desk filter. Desks come from the member's replayable bots.
 * A run is on a desk when one of those bots still matches the recipe.
 */
export function indexBacktestRunsByDesk(
  runs: readonly { id: string; recipe: BacktestRecipe }[],
  bots: readonly BacktestDeskBot[],
  listedDesks: readonly BacktestListDesk[] = [],
): BacktestRunDeskIndex {
  const desks: BacktestListDesk[] = [];
  const seenDesk = new Set<string>();
  const seeded = [
    ...listedDesks,
    ...bots.map((bot) => ({
      id: bot.deskId,
      name: bot.deskName,
      deskType: bot.kind,
    })),
  ];
  for (const desk of seeded) {
    const id = desk.id.trim();
    if (!id || seenDesk.has(id)) {
      continue;
    }
    seenDesk.add(id);
    desks.push({
      id,
      name: desk.name.trim() || "Desk",
      deskType: desk.deskType,
    });
  }
  desks.sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  );
  const byKey = new Map<string, BacktestDeskBot[]>();
  for (const bot of bots) {
    const key = backtestDeskBotKey(bot.recipe.kind, bot.recipe.symbol);
    const list = byKey.get(key) ?? [];
    list.push(bot);
    byKey.set(key, list);
  }
  const runDeskIds: Record<string, string[]> = {};
  for (const run of runs) {
    const candidates = byKey.get(
      backtestDeskBotKey(run.recipe.kind, run.recipe.symbol),
    );
    if (!candidates || candidates.length === 0) {
      continue;
    }
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const bot of candidates) {
      if (seen.has(bot.deskId)) {
        continue;
      }
      if (!recipesMatchReplayFields(run.recipe, bot.recipe)) {
        continue;
      }
      seen.add(bot.deskId);
      ids.push(bot.deskId);
    }
    if (ids.length > 0) {
      runDeskIds[run.id] = ids;
    }
  }
  return { desks, runDeskIds };
}

/**
 * Desk choices for the saved list. A selected desk type leaves only desks of
 * that type. All desks stays available so the type filter can stand alone.
 */
export function backtestDeskFilterChoices(
  desks: readonly BacktestListDesk[],
  typeFilter: "all" | BacktestListDesk["deskType"],
): BacktestListDesk[] {
  if (typeFilter === "all") {
    return [...desks];
  }
  return desks.filter((desk) => desk.deskType === typeFilter);
}

/**
 * Desk type choices for the saved list. A selected desk leaves only that
 * desk's type. All desk types stays available so the desk filter can stand alone.
 */
export function backtestDeskTypeFilterChoices(
  desks: readonly BacktestListDesk[],
  deskId: string,
): Array<"all" | BacktestListDesk["deskType"]> {
  if (deskId === "all") {
    return ["all", "flex", "dca"];
  }
  const desk = desks.find((row) => row.id === deskId);
  if (!desk) {
    return ["all", "flex", "dca"];
  }
  return ["all", desk.deskType];
}

/** Desk names that collide get the type in front so the filter can tell them apart. */
export function backtestDeskFilterLabel(
  desk: BacktestListDesk,
  desks: readonly BacktestListDesk[],
): string {
  const name = desk.name.trim() || "Desk";
  const clash = desks.some(
    (row) => row.id !== desk.id && row.name.trim() === desk.name.trim(),
  );
  if (!clash) {
    return name;
  }
  return `${formatDeskType(desk.deskType)} · ${name}`;
}

export type BacktestDeskBotOption = {
  id: string;
  name: string;
  symbol: string;
  kind: "dca" | "flex";
  deskId: string;
  deskName: string;
  venue: string;
  venueEnvironment: string | null;
};

/** Desk fields on a candidate row. `name` on that row is the bot, not the desk. */
export function backtestOptionDesk(option: BacktestDeskBotOption): {
  id: string;
  name: string;
  venue: string;
  venueEnvironment: string | null;
} {
  return {
    id: option.deskId,
    name: option.deskName,
    venue: option.venue,
    venueEnvironment: option.venueEnvironment,
  };
}

/** Same symbol and kind. The full recipe is loaded only for these rows. */
export function deskBacktestBotCandidates<
  T extends { kind: "dca" | "flex"; symbol: string },
>(options: readonly T[], recipe: { kind: string; symbol: string }): T[] {
  const symbol = recipe.symbol.trim().toUpperCase();
  if (recipe.kind !== "dca" && recipe.kind !== "flex") {
    return [];
  }
  return options.filter(
    (row) =>
      row.kind === recipe.kind && row.symbol.trim().toUpperCase() === symbol,
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

/** Any saved template recipe, including Cash and Carry. Rejects a stale or partial payload. */
export function parseListedRecipe(raw: unknown): TemplateRecipe | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const kind = (raw as { kind?: unknown }).kind;
  if (kind !== "dca" && kind !== "flex" && kind !== "cash_and_carry") {
    return null;
  }
  const parsed = parseTemplateRecipe(raw, kind, TEMPLATE_RECIPE_VERSION);
  return parsed.ok ? parsed.recipe : null;
}

/**
 * Finished runs whose recipe still matches each bot. A run can sit on more
 * than one bot when those bots share a recipe. Newest first.
 */
export function backtestLinksForBotRecipes(input: {
  bots: readonly { id: string; recipe: TemplateRecipe }[];
  runs: readonly (AttachedBacktestRow & { recipe: TemplateRecipe })[];
  viewerId: string;
  isAdmin: boolean;
}): Record<string, TemplateBacktestLink[]> {
  const links: Record<string, TemplateBacktestLink[]> = {};
  for (const bot of input.bots) {
    const id = bot.id.trim();
    if (!id) {
      continue;
    }
    const rows = input.runs.filter(
      (run) =>
        run.status === "done" &&
        memberCanReadBacktestRun(
          { userId: run.userId },
          input.viewerId,
          input.isAdmin,
        ) &&
        recipesMatchReplayFields(bot.recipe, run.recipe),
    );
    const visible = templateBacktestLinks(rows, input.viewerId, input.isAdmin);
    if (visible.length > 0) {
      links[id] = visible;
    }
  }
  return links;
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
  if (kind !== "dca" && kind !== "flex") {
    return { ok: false, error: "Load a bot or pick a template to backtest." };
  }
  const parsed = parseTemplateRecipe(value, kind, TEMPLATE_RECIPE_VERSION);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.recipe.kind !== "dca" && parsed.recipe.kind !== "flex") {
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
    const shortKind =
      recipe.direction === "both"
        ? (recipe.shortStartKind ?? recipe.startKind)
        : null;
    if (recipe.startKind === "webhook" || shortKind === "webhook") {
      issues.push({
        field: "startKind",
        message: "Webhook triggers can't be backtested.",
      });
    } else if (recipe.startKind === "immediate") {
      issues.push({
        field: "startKind",
        message: "Manual start cannot be replayed. Pick Price, Indicator, or Trend.",
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
    if (recipe.startKind === "indicator" || recipe.startKind === "trend") {
      if (!recipe.indicatorKind || !recipe.indicatorTimeframe) {
        issues.push({
          field: "startKind",
          message: "Choose Indicator or Trend settings.",
        });
      }
    }
    if (recipe.startKind === "retrace" && !(recipe.retrace && recipe.retrace.pct > 0)) {
      issues.push({
        field: "startKind",
        message: "Enter a retrace %.",
      });
    }
    if (recipe.direction === "both" && shortKind === "price") {
      const price = recipe.shortStartKind
        ? recipe.shortArmTrigger?.price
        : (recipe.shortArmTrigger?.price ?? recipe.armTrigger?.price);
      if (!(Number(price) > 0)) {
        issues.push({
          field: "shortArmPrice",
          message: "Enter a Short start price.",
        });
      }
    }
    if (
      recipe.direction === "both" &&
      (shortKind === "indicator" || shortKind === "trend")
    ) {
      const kind = recipe.shortStartKind
        ? recipe.shortIndicatorKind
        : (recipe.shortIndicatorKind ?? recipe.indicatorKind);
      const timeframe = recipe.shortStartKind
        ? recipe.shortIndicatorTimeframe
        : (recipe.shortIndicatorTimeframe ?? recipe.indicatorTimeframe);
      if (!kind || !timeframe) {
        issues.push({
          field: "startKind",
          message: "Choose Short Indicator or Trend settings.",
        });
      }
    }
    if (recipe.direction === "both" && shortKind === "retrace") {
      const spec = recipe.shortStartKind
        ? recipe.shortRetrace
        : (recipe.shortRetrace ?? recipe.retrace);
      if (!(spec && spec.pct > 0)) {
        issues.push({
          field: "startKind",
          message: "Enter a Short retrace %.",
        });
      }
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
      message: "Flatten rules cannot be replayed. Pick Long or Short.",
    });
  }
  const size = Number(String(recipe.size).replace(/,/g, "").trim());
  if (recipe.entrySource !== "" && !(size > 0)) {
    issues.push({
      field: "size",
      message: "Enter a size.",
    });
  }
  issues.push(
    ...flexEntryFieldIssues({
      entrySource: recipe.entrySource,
      triggerPrice: recipe.triggerPrice,
      indicator: recipe.indicator,
      retrace: recipe.retrace,
      short: false,
    }),
  );
  if (recipe.direction === "both" && recipe.shortEntry) {
    const short = recipe.shortEntry;
    issues.push(
      ...flexEntryFieldIssues({
        entrySource: short.entrySource,
        triggerPrice: String(short.triggerPrice),
        indicator: short.indicator,
        retrace: short.retrace,
        short: true,
      }),
    );
  }
  return issues;
}

function flexEntryFieldIssues(input: {
  entrySource: PerpsTemplateRecipe["entrySource"];
  triggerPrice: string;
  indicator?: PerpsTemplateRecipe["indicator"];
  retrace?: PerpsTemplateRecipe["retrace"];
  short: boolean;
}): BacktestFieldIssue[] {
  if (input.entrySource === "webhook") {
    return input.short
      ? [
          {
            field: "entrySource",
            message: "Webhook entry cannot be replayed. Use a price When.",
          },
        ]
      : [];
  }
  if (input.entrySource === "indicator" || input.entrySource === "trend") {
    if (!input.indicator?.kind || !input.indicator.timeframe) {
      return [
        {
          field: "entrySource",
          message: input.short
            ? "Choose Short Indicator or Trend settings."
            : "Choose Indicator or Trend settings.",
        },
      ];
    }
    return [];
  }
  if (input.entrySource === "retrace") {
    if (!(input.retrace && input.retrace.pct > 0)) {
      return [
        {
          field: "triggerPrice",
          message: input.short ? "Enter a Short retrace %." : "Enter a retrace %.",
        },
      ];
    }
    return [];
  }
  if (input.entrySource !== "price") {
    return [
      {
        field: "entrySource",
        message: input.short
          ? "Select a Short condition type."
          : "Select a condition type.",
      },
    ];
  }
  const trigger = Number(String(input.triggerPrice).replace(/,/g, "").trim());
  if (!(trigger > 0)) {
    return [
      {
        field: "triggerPrice",
        message: input.short ? "Enter a Short When price." : "Enter a When price.",
      },
    ];
  }
  return [];
}

/** One line per problem. Form issues win, so a hidden field on a stale recipe stays off the list. */
export function backtestQueueIssueLines(
  formIssues: readonly string[],
  queueError: string | null,
): string[] {
  const source =
    formIssues.length > 0 ? formIssues : queueError ? [queueError] : [];
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const issue of source) {
    const text = issue.trim();
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    lines.push(text);
  }
  return lines;
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
  const canSaveAsPlatform = Boolean(
    done && input.isAdmin && linkedLibrary?.visibility !== "platform",
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

export { recipeParamRows } from "@/lib/backtest/param-sections";

/** The saved-list Template column. Attachment is `template_id`, not the template they loaded from. */
export function attachedTemplateName(
  template: { name: string; visibility: string; userId: string | null },
  viewer: { userId: string; isAdmin: boolean; shared: boolean },
): string | null {
  const name = template.name.trim();
  if (!name) {
    return null;
  }
  const visible =
    viewer.isAdmin ||
    template.visibility === "platform" ||
    template.userId === viewer.userId ||
    (template.visibility === "backtested" && template.userId == null) ||
    viewer.shared;
  return visible ? name : null;
}

/** Where the saved-list Template name opens. */
export function attachedTemplateHref(
  template: { id: string; visibility: string; userId: string | null },
  viewer: { userId: string; isAdmin: boolean; shared: boolean },
): string {
  if (template.visibility === "platform" && viewer.isAdmin) {
    return templatePageHref(template.id, "admin");
  }
  if (
    viewer.shared &&
    template.userId !== viewer.userId &&
    template.visibility !== "platform"
  ) {
    return templatePageHref(template.id, "shared");
  }
  return templatePageHref(template.id, "account");
}
