import { createServiceClient } from "@/lib/supabase/admin";
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";
import { parseDcaIndicatorTimeframe } from "@/lib/dca/indicators";
import { parseTemplateRecipe } from "@/lib/templates/recipe";
import {
  parseBacktestStatus,
  parseFeePreset,
  type BacktestDeskType,
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
    feePreset: parseFeePreset(row.fee_preset),
    feeRate: Number(row.fee_rate) || 0,
    status,
    recipe,
    stats: parseStats(row.stats),
    orders: parseSimulatedOrders(row.orders),
    error: row.error ? String(row.error) : null,
    createdAtMs: asTime(row.created_at),
    finishedAtMs: row.finished_at ? asTime(row.finished_at) : null,
  };
}

export async function insertBacktestRun(input: {
  userId: string | null;
  templateId: string | null;
  venue: string;
  venueEnvironment: string | null;
  symbol: string;
  interval: DcaIndicatorTimeframe;
  fromMs: number;
  toMs: number;
  feePreset: BacktestFeePreset;
  feeRate: number;
  startingUsdt: number;
  recipe: BacktestRecipe;
}): Promise<BacktestRun | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("backtest_runs")
    .insert({
      user_id: input.userId,
      template_id: input.templateId,
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
      status: "queued",
      recipe: input.recipe,
      orders: [],
    })
    .select("*")
    .single();
  if (error || !data) {
    return null;
  }
  return parseBacktestRunRow(data as Record<string, unknown>);
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
  if (input.publishedOnly) {
    query = query.is("user_id", null);
  } else if (input.userId) {
    query = query.or(`user_id.eq.${input.userId},user_id.is.null`);
  }
  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  return data
    .map((row) => parseBacktestRunRow(row as Record<string, unknown>))
    .filter((row): row is BacktestRun => Boolean(row));
}

export async function listAllBacktestRuns(limit = 120): Promise<BacktestRun[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("backtest_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) {
    return [];
  }
  return data
    .map((row) => parseBacktestRunRow(row as Record<string, unknown>))
    .filter((row): row is BacktestRun => Boolean(row));
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
