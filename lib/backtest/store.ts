import { createServiceClient } from "@/lib/supabase/admin";
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";
import { parseDcaIndicatorTimeframe } from "@/lib/dca/indicators";
import {
  attachedTemplateHref,
  attachedTemplateName,
  inheritPlatformBacktests,
  matchingPlatformTemplateIds,
} from "@/lib/backtest/library";
import {
  listSharedTemplates,
  loadTemplatesByIds,
} from "@/lib/templates/store";
import {
  isTemplateDeskType,
  parseTemplateRecipe,
  TEMPLATE_RECIPE_VERSION,
  type TemplateRecipe,
} from "@/lib/templates/recipe";
import {
  backtestLinkHighlight,
  memberCanReadBacktestRun,
  templateBacktestLinksByTemplate,
  type AttachedBacktestRow,
  type TemplateBacktestLink,
  estimateBacktestBars,
  parseBacktestStatus,
  parseBacktestClipIndex,
  parseBacktestFillReason,
  normalizeBacktestLeverage,
  parseFeePreset,
  parseComparableSymbols,
  readBacktestName,
  type BacktestDeskType,
  type BacktestLinkHighlight,
  type BacktestFeePreset,
  type BacktestRecipe,
  type BacktestRun,
  type BacktestStats,
  type BacktestStatus,
  type SimulatedOrder,
} from "./model";
import { parseReplayEvents } from "./events";
import {
  parseBacktestProgressCount,
  parseBacktestProgressPhase,
} from "./progress";

function asTime(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function parseSimulatedOrders(raw: unknown): SimulatedOrder[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const rows: SimulatedOrder[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    const action =
      row.action === "sell" || row.action === "flatten" ? row.action : "buy";
    const side = row.side === "short" ? "short" : "long";
    const qty = Number(row.qty);
    const price = Number(row.price);
    const atMs = Number(row.atMs);
    if (!(qty > 0) || !(price > 0) || !(atMs > 0)) {
      continue;
    }
    rows.push({
      atMs,
      action,
      side,
      qty,
      price,
      feeUsdt: Number(row.feeUsdt) || 0,
      realizedUsdt:
        row.realizedUsdt == null ? null : Number(row.realizedUsdt),
      reason: parseBacktestFillReason(row.reason),
      clipIndex: parseBacktestClipIndex(row.clipIndex),
    });
  }
  return rows;
}

function parseStats(raw: unknown): BacktestStats | null {
  if (raw == null || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  return {
    trades: Number(row.trades) || 0,
    wins: Number(row.wins) || 0,
    winRate: Number(row.winRate) || 0,
    realizedUsdt: Number(row.realizedUsdt) || 0,
    maxDrawdownUsdt: Number(row.maxDrawdownUsdt) || 0,
    profitFactor:
      row.profitFactor == null || !Number.isFinite(Number(row.profitFactor))
        ? null
        : Number(row.profitFactor),
    timeInMarket: Number(row.timeInMarket) || 0,
    openQty: Number(row.openQty) || 0,
    openSide:
      row.openSide === "short" || row.openSide === "long" ? row.openSide : null,
    markUsdt: Number(row.markUsdt) || 0,
    lastPrice:
      row.lastPrice == null || !Number.isFinite(Number(row.lastPrice))
        ? null
        : Number(row.lastPrice),
    startingUsdt: Number(row.startingUsdt) || 0,
    endingUsdt: Number(row.endingUsdt) || 0,
    returnPct:
      row.returnPct == null || !Number.isFinite(Number(row.returnPct))
        ? null
        : Number(row.returnPct),
  };
}

function parseRecipe(
  raw: unknown,
  deskType: BacktestDeskType,
  venue: string,
): BacktestRecipe | null {
  const parsed = parseTemplateRecipe(raw, deskType, 1, venue);
  if (!parsed.ok) {
    return null;
  }
  if (parsed.recipe.kind !== "perps" && parsed.recipe.kind !== "dca") {
    return null;
  }
  return parsed.recipe;
}

export function parseBacktestRunRow(
  row: Record<string, unknown>,
): BacktestRun | null {
  const status = parseBacktestStatus(row.status);
  const interval = parseDcaIndicatorTimeframe(row.interval);
  const deskType: BacktestDeskType =
    row.desk_type === "dca" ? "dca" : "perps";
  const venue = String(row.venue ?? "bybit");
  const recipe = parseRecipe(row.recipe, deskType, venue);
  if (!status || !interval || !recipe) {
    return null;
  }
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    templateId: row.template_id ? String(row.template_id) : null,
    sourceTemplateId: row.source_template_id
      ? String(row.source_template_id)
      : null,
    studyId: row.study_id ? String(row.study_id) : null,
    deskType,
    venue,
    venueEnvironment: row.venue_environment
      ? String(row.venue_environment)
      : null,
    symbol: recipe.symbol,
    interval,
    fromMs: Number(row.from_ms) || 0,
    toMs: Number(row.to_ms) || 0,
    startingUsdt: Number(row.starting_balance_usdt) || 0,
    leverage: normalizeBacktestLeverage(row.leverage),
    feePreset: parseFeePreset(row.fee_preset),
    feeRate: Number(row.fee_rate) || 0,
    status,
    recipe,
    stats: parseStats(row.stats),
    orders: parseSimulatedOrders(row.orders),
    replayEvents: parseReplayEvents(row.replay_events),
    error: row.error ? String(row.error) : null,
    createdAtMs: asTime(row.created_at),
    finishedAtMs: row.finished_at ? asTime(row.finished_at) : null,
    parentRunId: row.parent_run_id ? String(row.parent_run_id) : null,
    comparableSymbols: parseComparableSymbols(
      parseComparableSymbolList(row.comparable_symbols),
      recipe.symbol,
      venue,
    ),
    name: readBacktestName(row.name),
    progressDone: parseBacktestProgressCount(row.progress_done),
    progressTotal: parseBacktestProgressCount(row.progress_total),
    progressPhase: parseBacktestProgressPhase(row.progress_phase),
  };
}

function unknownBacktestColumn(message: string, column: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes(column.toLowerCase()) &&
    (text.includes("schema cache") || text.includes("does not exist"))
  );
}

function withoutColumn(
  row: Record<string, unknown>,
  column: string,
): Record<string, unknown> {
  const next = { ...row };
  delete next[column];
  return next;
}

function parseComparableSymbolList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => String(item ?? "").trim().toUpperCase())
    .filter((item) => item.length >= 2 && item.length <= 32);
}

export async function insertBacktestRun(input: {
  userId: string | null;
  templateId: string | null;
  sourceTemplateId?: string | null;
  studyId?: string | null;
  venue: string;
  venueEnvironment: string | null;
  symbol: string;
  interval: DcaIndicatorTimeframe;
  fromMs: number;
  toMs: number;
  feePreset: BacktestFeePreset;
  feeRate: number;
  startingUsdt: number;
  leverage?: number;
  name?: string | null;
  recipe: BacktestRecipe;
  status?: BacktestStatus;
  stats?: BacktestStats | null;
  orders?: SimulatedOrder[];
  error?: string | null;
  finished?: boolean;
  parentRunId?: string | null;
  comparableSymbols?: string[];
}): Promise<BacktestRun | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const columns = {
    user_id: input.userId,
    template_id: input.templateId,
    source_template_id: input.sourceTemplateId ?? null,
    study_id: input.studyId ?? null,
    parent_run_id: input.parentRunId ?? null,
    comparable_symbols: input.comparableSymbols ?? [],
    desk_type: input.recipe.kind,
    venue: input.venue,
    venue_environment: input.venueEnvironment,
    symbol: input.symbol,
    interval: input.interval,
    from_ms: input.fromMs,
    to_ms: input.toMs,
    fee_preset: input.feePreset,
    fee_rate: input.feeRate,
    starting_balance_usdt: input.startingUsdt,
    leverage: normalizeBacktestLeverage(input.leverage),
    name: readBacktestName(input.name),
    status: input.status ?? "queued",
    recipe: input.recipe,
    stats: input.stats ?? null,
    orders: input.orders ?? [],
    error: input.error ?? null,
    ...(input.finished ? { finished_at: new Date().toISOString() } : {}),
  };
  let payload: Record<string, unknown> = columns;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await supabase
      .from("backtest_runs")
      .insert(payload)
      .select("*")
      .single();
    if (!result.error && result.data) {
      return parseBacktestRunRow(result.data as Record<string, unknown>);
    }
    if (!result.error) {
      return null;
    }
    if ("name" in payload && unknownBacktestColumn(result.error.message, "name")) {
      payload = withoutColumn(payload, "name");
      continue;
    }
    if ("leverage" in payload && /leverage/i.test(result.error.message)) {
      payload = withoutColumn(payload, "leverage");
      continue;
    }
    return null;
  }
  return null;
}

export async function updateBacktestRun(
  id: string,
  patch: {
    status: BacktestStatus;
    stats?: BacktestStats | null;
    orders?: SimulatedOrder[];
    replayEvents?: BacktestRun["replayEvents"];
    error?: string | null;
    finished?: boolean;
  },
): Promise<BacktestRun | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const columns = {
    status: patch.status,
    ...(patch.stats !== undefined ? { stats: patch.stats } : {}),
    ...(patch.orders !== undefined ? { orders: patch.orders } : {}),
    ...(patch.replayEvents !== undefined
      ? { replay_events: patch.replayEvents }
      : {}),
    ...(patch.error !== undefined ? { error: patch.error } : {}),
    ...(patch.finished ? { finished_at: new Date().toISOString() } : {}),
  };
  const first = await supabase
    .from("backtest_runs")
    .update(columns)
    .eq("id", id)
    .in("status", ["queued", "running"])
    .select("*")
    .maybeSingle();
  const missingColumn =
    first.error != null && /replay_events/i.test(first.error.message);
  const { data, error } = missingColumn
    ? await supabase
        .from("backtest_runs")
        .update({
          status: patch.status,
          ...(patch.stats !== undefined ? { stats: patch.stats } : {}),
          ...(patch.orders !== undefined ? { orders: patch.orders } : {}),
          ...(patch.error !== undefined ? { error: patch.error } : {}),
          ...(patch.finished ? { finished_at: new Date().toISOString() } : {}),
        })
        .eq("id", id)
        .in("status", ["queued", "running"])
        .select("*")
        .maybeSingle()
    : first;
  if (error || !data) {
    return null;
  }
  return parseBacktestRunRow(data as Record<string, unknown>);
}

export async function promoteDraftBacktestRun(
  id: string,
  patch: {
    templateId: string | null;
    sourceTemplateId: string | null;
    venue: string;
    venueEnvironment: string | null;
    symbol: string;
    interval: DcaIndicatorTimeframe;
    fromMs: number;
    toMs: number;
    feePreset: BacktestFeePreset;
    feeRate: number;
    startingUsdt: number;
    leverage: number;
    name?: string | null;
    recipe: BacktestRecipe;
    comparableSymbols: string[];
  },
): Promise<BacktestRun | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const columns = {
    template_id: patch.templateId,
    source_template_id: patch.sourceTemplateId,
    desk_type: patch.recipe.kind,
    venue: patch.venue,
    venue_environment: patch.venueEnvironment,
    symbol: patch.symbol,
    interval: patch.interval,
    from_ms: patch.fromMs,
    to_ms: patch.toMs,
    fee_preset: patch.feePreset,
    fee_rate: patch.feeRate,
    starting_balance_usdt: patch.startingUsdt,
    leverage: normalizeBacktestLeverage(patch.leverage),
    name: readBacktestName(patch.name),
    recipe: patch.recipe,
    comparable_symbols: patch.comparableSymbols,
    status: "queued",
    error: null,
  };
  let payload: Record<string, unknown> = columns;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await supabase
      .from("backtest_runs")
      .update(payload)
      .eq("id", id)
      .eq("status", "draft")
      .select("*")
      .maybeSingle();
    if (!result.error && result.data) {
      return parseBacktestRunRow(result.data as Record<string, unknown>);
    }
    if (!result.error) {
      return null;
    }
    if ("name" in payload && unknownBacktestColumn(result.error.message, "name")) {
      payload = withoutColumn(payload, "name");
      continue;
    }
    if ("leverage" in payload && /leverage/i.test(result.error.message)) {
      payload = withoutColumn(payload, "leverage");
      continue;
    }
    return null;
  }
  return null;
}

export async function clearBacktestParentRun(
  id: string,
): Promise<BacktestRun | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("backtest_runs")
    .update({ parent_run_id: null })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return parseBacktestRunRow(data as Record<string, unknown>);
}

export async function setBacktestComparableSymbols(
  id: string,
  comparableSymbols: string[],
): Promise<BacktestRun | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("backtest_runs")
    .update({ comparable_symbols: comparableSymbols })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return parseBacktestRunRow(data as Record<string, unknown>);
}

export async function unlinkBacktestRunTemplate(
  id: string,
  templateId: string,
): Promise<BacktestRun | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("backtest_runs")
    .update({ template_id: null })
    .eq("id", id)
    .eq("template_id", templateId)
    .eq("status", "done")
    .select("*")
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return parseBacktestRunRow(data as Record<string, unknown>);
}

export async function linkBacktestRunTemplate(
  id: string,
  templateId: string,
): Promise<BacktestRun | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("backtest_runs")
    .update({ template_id: templateId })
    .eq("id", id)
    .eq("status", "done")
    .select("*")
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return parseBacktestRunRow(data as Record<string, unknown>);
}

export async function loadBacktestRun(id: string): Promise<BacktestRun | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("backtest_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return parseBacktestRunRow(data as Record<string, unknown>);
}

export async function listBacktestRuns(input: {
  userId?: string | null;
  publishedOnly?: boolean;
  standaloneOnly?: boolean;
  primaryOnly?: boolean;
  childrenOnly?: boolean;
  parentRunId?: string;
  studyId?: string;
  includeDrafts?: boolean;
  limit?: number;
}): Promise<BacktestRun[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  let query = supabase
    .from("backtest_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 80);
  if (!input.includeDrafts) {
    query = query.neq("status", "draft");
  }
  if (input.publishedOnly) {
    query = query.is("user_id", null);
  } else if (input.userId) {
    query = query.or(`user_id.eq.${input.userId},user_id.is.null`);
  }
  if (input.standaloneOnly) {
    query = query.is("study_id", null);
  }
  if (input.primaryOnly) {
    query = query.is("parent_run_id", null);
  }
  if (input.childrenOnly) {
    query = query.not("parent_run_id", "is", null);
  }
  if (input.parentRunId) {
    query = query.eq("parent_run_id", input.parentRunId);
  }
  if (input.studyId) {
    query = query.eq("study_id", input.studyId);
  }
  const { data, error } = await query;
  const rows = !error && data
    ? data
        .map((row) => parseBacktestRunRow(row as Record<string, unknown>))
        .filter((row): row is BacktestRun => Boolean(row))
    : [];
  if (error || rows.length === 0) {
    if (
      error &&
      (input.standaloneOnly ||
        input.primaryOnly ||
        input.childrenOnly ||
        input.studyId ||
        input.parentRunId)
    ) {
      let fallbackQuery = supabase
        .from("backtest_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(input.limit ?? 80);
      if (!input.includeDrafts) {
        fallbackQuery = fallbackQuery.neq("status", "draft");
      }
      const fallback = await fallbackQuery;
      const parsed = (fallback.data ?? [])
        .map((row) => parseBacktestRunRow(row as Record<string, unknown>))
        .filter((row): row is BacktestRun => Boolean(row));
      return filterBacktestRuns(parsed, input);
    }
  }
  return filterBacktestRuns(rows, input);
}

function filterBacktestRuns(
  rows: BacktestRun[],
  input: {
    userId?: string | null;
    publishedOnly?: boolean;
    standaloneOnly?: boolean;
    primaryOnly?: boolean;
    childrenOnly?: boolean;
    parentRunId?: string;
    studyId?: string;
    includeDrafts?: boolean;
  },
): BacktestRun[] {
  return rows.filter((row) => {
    if (input.publishedOnly && row.userId != null) {
      return false;
    }
    if (
      input.userId &&
      !input.publishedOnly &&
      row.userId != null &&
      row.userId !== input.userId
    ) {
      return false;
    }
    if (input.studyId && row.studyId !== input.studyId) {
      return false;
    }
    if (input.standaloneOnly && row.studyId) {
      return false;
    }
    if (input.parentRunId && row.parentRunId !== input.parentRunId) {
      return false;
    }
    if (input.primaryOnly && row.parentRunId) {
      return false;
    }
    if (input.childrenOnly && !row.parentRunId) {
      return false;
    }
    if (!input.includeDrafts && row.status === "draft") {
      return false;
    }
    return true;
  });
}

export function canReadBacktestRun(
  run: BacktestRun,
  userId: string,
  isAdmin: boolean,
): boolean {
  return memberCanReadBacktestRun(run, userId, isAdmin);
}

export async function listAttachedBacktestLinks(
  templateId: string,
  viewerId: string,
  isAdmin: boolean,
): Promise<TemplateBacktestLink[]> {
  const id = templateId.trim();
  if (!id) {
    return [];
  }
  const grouped = await listAttachedBacktestLinksByTemplate(
    [id],
    viewerId,
    isAdmin,
  );
  return grouped[id] ?? [];
}

export async function listAttachedBacktestLinksByTemplate(
  templateIds: string[],
  viewerId: string,
  isAdmin: boolean,
): Promise<Record<string, TemplateBacktestLink[]>> {
  const ids = [...new Set(templateIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) {
    return {};
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return {};
  }
  const recipes = await loadBacktestTemplateRecipes(supabase, ids);
  const queryIds = [
    ...new Set([...ids, ...matchingPlatformTemplateIds(recipes, ids)]),
  ];
  const { data, error } = await supabase
    .from("backtest_runs")
    .select(
      "id, user_id, name, symbol, parent_run_id, from_ms, to_ms, created_at, recipe, status, template_id, interval, leverage, stats, orders",
    )
    .in("template_id", queryIds)
    .eq("status", "done")
    .order("created_at", { ascending: false });
  if (error || !data) {
    return {};
  }
  const rows: Array<AttachedBacktestRow & { templateId: string }> = [];
  for (const item of data) {
    const row = item as Record<string, unknown>;
    const parsed = attachedBacktestRow(row);
    const templateId = row.template_id ? String(row.template_id) : "";
    if (!parsed || !templateId) {
      continue;
    }
    rows.push({ ...parsed, templateId });
  }
  const grouped = inheritPlatformBacktests(
    recipes,
    templateBacktestLinksByTemplate(rows, viewerId, isAdmin),
  );
  const links: Record<string, TemplateBacktestLink[]> = {};
  for (const id of ids) {
    const value = grouped[id];
    if (value && value.length > 0) {
      links[id] = value;
    }
  }
  return links;
}

async function loadBacktestTemplateRecipes(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  ids: string[],
): Promise<
  Array<{ id: string; visibility: string; recipe: TemplateRecipe }>
> {
  const [requested, platform] = await Promise.all([
    supabase
      .from("automation_templates")
      .select("id, visibility, desk_type, recipe, recipe_version")
      .in("id", ids),
    supabase
      .from("automation_templates")
      .select("id, visibility, desk_type, recipe, recipe_version")
      .eq("visibility", "platform"),
  ]);
  const seen = new Set<string>();
  const recipes: Array<{
    id: string;
    visibility: string;
    recipe: TemplateRecipe;
  }> = [];
  for (const item of [...(requested.data ?? []), ...(platform.data ?? [])]) {
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? "");
    if (!id || seen.has(id) || !isTemplateDeskType(row.desk_type)) {
      continue;
    }
    const parsed = parseTemplateRecipe(
      row.recipe,
      row.desk_type,
      Number(row.recipe_version) || TEMPLATE_RECIPE_VERSION,
    );
    if (!parsed.ok) {
      continue;
    }
    seen.add(id);
    recipes.push({
      id,
      visibility: String(row.visibility ?? ""),
      recipe: parsed.recipe,
    });
  }
  return recipes;
}

function attachedBacktestRow(
  row: Record<string, unknown>,
): AttachedBacktestRow | null {
  const status = parseBacktestStatus(row.status);
  if (!status) {
    return null;
  }
  const recipe = row.recipe;
  const recipeName =
    recipe && typeof recipe === "object" && "name" in recipe
      ? String((recipe as { name: unknown }).name ?? "")
      : "";
  const recipeSymbol =
    recipe && typeof recipe === "object" && "symbol" in recipe
      ? String((recipe as { symbol: unknown }).symbol ?? "")
      : "";
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    status,
    name: readBacktestName(row.name),
    symbol: recipeSymbol || String(row.symbol ?? ""),
    recipeName,
    parentRunId: row.parent_run_id ? String(row.parent_run_id) : null,
    fromMs: Number(row.from_ms) || 0,
    toMs: Number(row.to_ms) || 0,
    createdAtMs: asTime(row.created_at),
    interval: parseDcaIndicatorTimeframe(row.interval),
    leverage: normalizeBacktestLeverage(row.leverage),
    stats: parseStats(row.stats),
    orders: parseSimulatedOrders(row.orders),
  };
}

export { canDeleteBacktestRun } from "./model";

export async function listLinkedBacktestRuns(
  templateIds: string[],
  viewer?: { userId: string; isAdmin: boolean },
): Promise<Record<string, BacktestLinkHighlight>> {
  const ids = [...new Set(templateIds.filter(Boolean))];
  const linked: Record<string, BacktestLinkHighlight> = {};
  if (ids.length === 0) {
    return linked;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return linked;
  }
  const { data, error } = await supabase
    .from("backtest_runs")
    .select("*")
    .in("template_id", ids)
    .eq("status", "done")
    .order("created_at", { ascending: false });
  if (error || !data) {
    return linked;
  }
  for (const item of data) {
    const run = parseBacktestRunRow(item as Record<string, unknown>);
    if (!run?.templateId || linked[run.templateId]) {
      continue;
    }
    if (
      viewer &&
      !memberCanReadBacktestRun(run, viewer.userId, viewer.isAdmin)
    ) {
      continue;
    }
    linked[run.templateId] = backtestLinkHighlight(run);
  }
  return linked;
}

/** Saved runs this login owns. Drafts and published rows do not count. */
export async function countOwnedSavedBacktests(
  userId: string,
): Promise<number | null> {
  const supabase = createServiceClient();
  if (!supabase || !userId) {
    return null;
  }
  const { count, error } = await supabase
    .from("backtest_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "draft");
  if (error || count == null) {
    return null;
  }
  return count;
}

export async function countBacktestRunsForTemplate(
  templateId: string,
): Promise<number> {
  const supabase = createServiceClient();
  if (!supabase) {
    return 0;
  }
  const { count, error } = await supabase
    .from("backtest_runs")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId);
  if (error) {
    return 0;
  }
  return count ?? 0;
}

export async function deleteBacktestRun(id: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase.from("backtest_runs").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function touchBacktestProgress(
  id: string,
  input: {
    done: number;
    total: number;
    phase: "candles" | "replay";
  },
): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  const total = Math.max(0, Math.floor(input.total));
  const raw = Math.max(0, Math.floor(input.done));
  const done = total > 0 ? Math.min(total, raw) : raw;
  const { error } = await supabase
    .from("backtest_runs")
    .update({
      progress_done: done,
      progress_total: total,
      progress_phase: input.phase,
    })
    .eq("id", id)
    .eq("status", "running");
  if (error && !/progress_/i.test(error.message)) {
    console.error(`backtest progress ${id}`, error.message);
  }
}

export async function touchBacktestClaim(id: string): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  await supabase
    .from("backtest_runs")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "running");
}

export async function claimBacktestRunById(
  id: string,
): Promise<BacktestRun | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data } = await supabase
    .from("backtest_runs")
    .update({
      status: "running",
      claimed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();
  if (!data) {
    return null;
  }
  return parseBacktestRunRow(data as Record<string, unknown>);
}

/** Queued rows, and running rows whose claim has gone quiet, can be taken. */
export function backtestRowIsClaimable(input: {
  status: string;
  claimedAtMs: number | null;
  nowMs: number;
  staleMs: number;
  bars: number;
  maxBars: number;
}): boolean {
  const stale =
    input.status === "running" &&
    input.claimedAtMs != null &&
    input.claimedAtMs < input.nowMs - input.staleMs;
  if (input.status !== "queued" && !stale) {
    return false;
  }
  if (!(input.maxBars > 0)) {
    return true;
  }
  return input.bars <= input.maxBars;
}

export async function claimQueuedBacktestRun(input?: {
  maxBars?: number;
  staleMinutes?: number;
}): Promise<BacktestRun | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.rpc("backtest_claim_queued_run", {
    p: {
      stale_minutes: input?.staleMinutes ?? 15,
      max_bars: input?.maxBars ?? 0,
    },
  });
  if (!error && Array.isArray(data) && data[0]) {
    return parseBacktestRunRow(data[0] as Record<string, unknown>);
  }
  const staleMs = (input?.staleMinutes ?? 15) * 60_000;
  const staleBefore = new Date(Date.now() - staleMs).toISOString();
  const { data: queued } = await supabase
    .from("backtest_runs")
    .select("*")
    .or(
      `status.eq.queued,and(status.eq.running,claimed_at.lt."${staleBefore}")`,
    )
    .order("created_at", { ascending: true })
    .limit(20);
  const nowMs = Date.now();
  const rows = (queued ?? [])
    .map((row) => {
      const raw = row as Record<string, unknown>;
      const parsed = parseBacktestRunRow(raw);
      return parsed ? { raw, parsed } : null;
    })
    .filter((row): row is { raw: Record<string, unknown>; parsed: BacktestRun } =>
      Boolean(row),
    );
  const chosen = rows.find((row) => {
    const claimedAt = row.raw.claimed_at;
    const claimedAtMs =
      claimedAt == null ? null : new Date(String(claimedAt)).getTime();
    return backtestRowIsClaimable({
      status: String(row.raw.status ?? ""),
      claimedAtMs: Number.isFinite(claimedAtMs) ? claimedAtMs : null,
      nowMs,
      staleMs,
      bars: estimateBacktestBars(row.parsed.fromMs, row.parsed.toMs, row.parsed.interval),
      maxBars: input?.maxBars ?? 0,
    });
  });
  if (!chosen) {
    return null;
  }
  let claim = supabase
    .from("backtest_runs")
    .update({
      status: "running",
      claimed_at: new Date().toISOString(),
    })
    .eq("id", chosen.parsed.id);
  claim =
    chosen.parsed.status === "running"
      ? claim.eq("status", "running").lt("claimed_at", staleBefore)
      : claim.eq("status", "queued");
  const { data: claimed } = await claim.select("*").maybeSingle();
  if (!claimed) {
    return null;
  }
  return parseBacktestRunRow(claimed as Record<string, unknown>);
}

export type AttachedTemplateColumn = {
  name: string;
  href: string;
};

/** Names for the saved-list Template column. Hidden templates and missing rows are omitted. */
export async function listAttachedTemplateNames(
  templateIds: Array<string | null | undefined>,
  userId: string,
  isAdmin: boolean,
): Promise<Record<string, AttachedTemplateColumn>> {
  const ids = [
    ...new Set(
      templateIds.map((id) => id?.trim() ?? "").filter((id) => id.length > 0),
    ),
  ];
  if (ids.length === 0) {
    return {};
  }
  const templates = await loadTemplatesByIds(ids);
  const needsShare = templates.some(
    (row) =>
      attachedTemplateName(row, { userId, isAdmin, shared: false }) == null &&
      row.name.trim().length > 0,
  );
  const sharedIds = new Set<string>();
  if (needsShare) {
    const shared = await listSharedTemplates({ userId });
    for (const row of shared) {
      sharedIds.add(row.id);
    }
  }
  const names: Record<string, AttachedTemplateColumn> = {};
  for (const row of templates) {
    const viewer = {
      userId,
      isAdmin,
      shared: sharedIds.has(row.id),
    };
    const name = attachedTemplateName(row, viewer);
    if (name) {
      names[row.id] = { name, href: attachedTemplateHref(row, viewer) };
    }
  }
  return names;
}
