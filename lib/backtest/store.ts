import { createServiceClient } from "@/lib/supabase/admin";
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";
import { parseDcaIndicatorTimeframe } from "@/lib/dca/indicators";
import { parseTemplateRecipe } from "@/lib/templates/recipe";
import {
  backtestLinkHighlight,
  estimateBacktestBars,
  parseBacktestStatus,
  parseBacktestClipIndex,
  parseBacktestFillReason,
  normalizeBacktestLeverage,
  parseFeePreset,
  type BacktestDeskType,
  type BacktestLinkHighlight,
  type BacktestFeePreset,
  type BacktestRecipe,
  type BacktestRun,
  type BacktestStats,
  type BacktestStatus,
  type SimulatedOrder,
} from "./model";

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
): BacktestRecipe | null {
  const parsed = parseTemplateRecipe(raw, deskType, 1);
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
  const recipe = parseRecipe(row.recipe, deskType);
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
    venue: String(row.venue ?? "bybit"),
    venueEnvironment: row.venue_environment
      ? String(row.venue_environment)
      : null,
    symbol: String(row.symbol ?? recipe.symbol),
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
    error: row.error ? String(row.error) : null,
    createdAtMs: asTime(row.created_at),
    finishedAtMs: row.finished_at ? asTime(row.finished_at) : null,
    parentRunId: row.parent_run_id ? String(row.parent_run_id) : null,
    comparableSymbols: parseComparableSymbolList(row.comparable_symbols),
  };
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
    status: input.status ?? "queued",
    recipe: input.recipe,
    stats: input.stats ?? null,
    orders: input.orders ?? [],
    error: input.error ?? null,
    ...(input.finished ? { finished_at: new Date().toISOString() } : {}),
  };
  const first = await supabase.from("backtest_runs").insert(columns).select("*").single();
  if (!first.error && first.data) {
    return parseBacktestRunRow(first.data as Record<string, unknown>);
  }
  if (!first.error || !/leverage/i.test(first.error.message)) {
    return null;
  }
  const { leverage: _leverage, ...withoutLeverage } = columns;
  const retry = await supabase
    .from("backtest_runs")
    .insert(withoutLeverage)
    .select("*")
    .single();
  if (retry.error || !retry.data) {
    return null;
  }
  return parseBacktestRunRow(retry.data as Record<string, unknown>);
}

export async function updateBacktestRun(
  id: string,
  patch: {
    status: BacktestStatus;
    stats?: BacktestStats | null;
    orders?: SimulatedOrder[];
    error?: string | null;
    finished?: boolean;
  },
): Promise<BacktestRun | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("backtest_runs")
    .update({
      status: patch.status,
      ...(patch.stats !== undefined ? { stats: patch.stats } : {}),
      ...(patch.orders !== undefined ? { orders: patch.orders } : {}),
      ...(patch.error !== undefined ? { error: patch.error } : {}),
      ...(patch.finished
        ? { finished_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", id)
    .in("status", ["queued", "running"])
    .select("*")
    .maybeSingle();
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
    recipe: patch.recipe,
    comparable_symbols: patch.comparableSymbols,
    status: "queued",
    error: null,
  };
  const first = await supabase
    .from("backtest_runs")
    .update(columns)
    .eq("id", id)
    .eq("status", "draft")
    .select("*")
    .maybeSingle();
  if (!first.error && first.data) {
    return parseBacktestRunRow(first.data as Record<string, unknown>);
  }
  if (!first.error || !/leverage/i.test(first.error.message)) {
    return first.data
      ? parseBacktestRunRow(first.data as Record<string, unknown>)
      : null;
  }
  const { leverage: _leverage, ...withoutLeverage } = columns;
  const { data, error } = await supabase
    .from("backtest_runs")
    .update(withoutLeverage)
    .eq("id", id)
    .eq("status", "draft")
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
  parentRunId?: string;
  studyId?: string;
  limit?: number;
}): Promise<BacktestRun[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  let query = supabase
    .from("backtest_runs")
    .select("*")
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 80);
  if (input.publishedOnly) {
    query = query.is("user_id", null);
  } else if (input.userId) {
    query = query.or(`user_id.eq.${input.userId},user_id.is.null`);
  }
  const { data, error } = await query;
  const rows = !error && data
    ? data
        .map((row) => parseBacktestRunRow(row as Record<string, unknown>))
        .filter((row): row is BacktestRun => Boolean(row))
    : [];
  if (error || rows.length === 0) {
    if (error && (input.standaloneOnly || input.primaryOnly || input.studyId || input.parentRunId)) {
      const fallback = await supabase
        .from("backtest_runs")
        .select("*")
        .neq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(input.limit ?? 80);
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
    parentRunId?: string;
    studyId?: string;
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
    if (row.status === "draft") {
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
  if (isAdmin) {
    return true;
  }
  return run.userId === userId || run.userId === null;
}

export function canDeleteBacktestRun(
  run: Pick<BacktestRun, "userId">,
  userId: string,
  isAdmin: boolean,
): boolean {
  if (isAdmin) {
    return true;
  }
  return run.userId === userId;
}

export async function listLinkedBacktestRuns(
  templateIds: string[],
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
    linked[run.templateId] = backtestLinkHighlight(run);
  }
  return linked;
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
  const { data: queued } = await supabase
    .from("backtest_runs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(20);
  const rows = (queued ?? [])
    .map((row) => parseBacktestRunRow(row as Record<string, unknown>))
    .filter((row): row is BacktestRun => Boolean(row));
  const chosen = rows.find((row) => {
    if (!input?.maxBars || input.maxBars <= 0) {
      return true;
    }
    return estimateBacktestBars(row.fromMs, row.toMs, row.interval) <= input.maxBars;
  });
  if (!chosen) {
    return null;
  }
  const { data: claimed } = await supabase
    .from("backtest_runs")
    .update({
      status: "running",
      claimed_at: new Date().toISOString(),
    })
    .eq("id", chosen.id)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();
  if (!claimed) {
    return null;
  }
  return parseBacktestRunRow(claimed as Record<string, unknown>);
}
