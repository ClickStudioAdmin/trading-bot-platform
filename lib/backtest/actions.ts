"use server";

import { memberIsAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import { loadDeskCandles } from "@/lib/market/desk-klines";
import { parseCandleInterval, parseCandleSymbol, parseCandleVenue } from "@/lib/market/candles";
import {
  snapshotPerpsRecipe,
  type PerpsTemplateRecipe,
} from "@/lib/templates/recipe";
import { parseFuturesAutomationForm } from "@/lib/futures/automation";
import {
  findNamedTemplate,
  insertTemplate,
  loadTemplateById,
} from "@/lib/templates/store";
import { revalidatePath } from "next/cache";
import {
  BACKTEST_FEE_PRESETS,
  parseFeePreset,
  parseWindowDays,
} from "./model";
import { canBacktestPerpsRecipe, replayPerpsPriceCross } from "./replay";
import {
  canReadBacktestRun,
  insertBacktestRun,
  loadBacktestRun,
  updateBacktestRun,
} from "./store";

export type BacktestActionResult = {
  ok: boolean;
  error?: string;
  runId?: string;
};

const SWEEP_CAP = 10;

function revalidateBacktests() {
  revalidatePath("/account/backtests");
  revalidatePath("/admin/backtests");
  revalidatePath("/account/templates");
}

async function requireMember() {
  const member = await getSessionMember();
  if (!member) {
    return { ok: false as const, error: "Sign in to continue." };
  }
  return {
    ok: true as const,
    member,
    isAdmin: memberIsAdmin(member),
  };
}

function recipeFromForm(formData: FormData):
  | { ok: true; recipe: PerpsTemplateRecipe }
  | { ok: false; error: string } {
  const parsed = parseFuturesAutomationForm(formData);
  if (!parsed.ok) {
    return parsed;
  }
  const rule = parsed.rules[0];
  if (!rule) {
    return { ok: false, error: "Save this bot before backtesting." };
  }
  return { ok: true, recipe: snapshotPerpsRecipe(rule) };
}

function uniqueBacktestName(name: string, suffix: string): string {
  const base = name.trim() || "Backtest";
  const label = `${base} · ${suffix}`.slice(0, 80);
  return label;
}

async function snapshotBacktestedTemplate(input: {
  userId: string | null;
  recipe: PerpsTemplateRecipe;
  published: boolean;
  suffix: string;
}): Promise<string | null> {
  const name = uniqueBacktestName(input.recipe.name, input.suffix);
  const existing = await findNamedTemplate({
    visibility: "backtested",
    userId: input.published ? null : input.userId,
    deskType: "perps",
    name,
  });
  if (existing) {
    return existing.id;
  }
  const created = await insertTemplate({
    userId: input.published ? null : input.userId,
    visibility: "backtested",
    deskType: "perps",
    name,
    description: "Frozen backtest snapshot. Apply stays idle.",
    recipe: input.recipe,
  });
  return created.ok ? created.template.id : null;
}

async function executeRun(runId: string): Promise<BacktestActionResult> {
  const run = await loadBacktestRun(runId);
  if (!run) {
    return { ok: false, error: "That run was not found." };
  }
  await updateBacktestRun(runId, { status: "running" });
  try {
    const allowed = canBacktestPerpsRecipe(run.recipe);
    if (!allowed.ok) {
      await updateBacktestRun(runId, {
        status: "failed",
        error: allowed.error,
        finished: true,
      });
      return { ok: false, error: allowed.error, runId };
    }
    const candles = await loadDeskCandles({
      venue: run.venue,
      venueEnvironment: run.venueEnvironment,
      symbol: run.symbol,
      interval: run.interval,
      fromMs: run.fromMs,
      toMs: run.toMs,
      limit: 1500,
    });
    if (candles.length < 8) {
      await updateBacktestRun(runId, {
        status: "failed",
        error: "Not enough candles in that window.",
        finished: true,
      });
      return { ok: false, error: "Not enough candles in that window.", runId };
    }
    const replayed = replayPerpsPriceCross({
      bars: candles,
      recipe: run.recipe,
      feeRate: run.feeRate,
    });
    await updateBacktestRun(runId, {
      status: "done",
      stats: replayed.stats,
      orders: replayed.orders,
      error: null,
      finished: true,
    });
    return { ok: true, runId };
  } catch {
    await updateBacktestRun(runId, {
      status: "failed",
      error: "Replay failed.",
      finished: true,
    });
    return { ok: false, error: "Replay failed.", runId };
  }
}

export async function queuePerpsBacktestAction(
  formData: FormData,
): Promise<BacktestActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const recipeResult = recipeFromForm(formData);
  if (!recipeResult.ok) {
    return recipeResult;
  }
  const allowed = canBacktestPerpsRecipe(recipeResult.recipe);
  if (!allowed.ok) {
    return allowed;
  }
  const ruleId = String(formData.get("r0_id") ?? formData.get("ruleId") ?? "").trim();
  if (!ruleId) {
    return { ok: false, error: "Save this bot first, then Backtest." };
  }
  const venue = parseCandleVenue(formData.get("venue") ?? formData.get("deskVenue")) ?? "bybit";
  const symbol =
    parseCandleSymbol(formData.get("symbol") ?? recipeResult.recipe.symbol) ??
    recipeResult.recipe.symbol;
  const interval =
    parseCandleInterval(formData.get("interval")) ?? "60";
  const days = parseWindowDays(formData.get("windowDays"));
  const feePreset = parseFeePreset(formData.get("feePreset"));
  const toMs = Date.now();
  const fromMs = toMs - days * 24 * 60 * 60 * 1000;
  const templateId = await snapshotBacktestedTemplate({
    userId: auth.member.id,
    recipe: recipeResult.recipe,
    published: false,
    suffix: "backtest",
  });
  const run = await insertBacktestRun({
    userId: auth.member.id,
    templateId,
    venue,
    venueEnvironment: String(formData.get("venueEnvironment") ?? "").trim() || null,
    symbol,
    interval,
    fromMs,
    toMs,
    feePreset,
    feeRate: BACKTEST_FEE_PRESETS[feePreset].rate,
    recipe: { ...recipeResult.recipe, symbol },
  });
  if (!run) {
    return { ok: false, error: "Could not queue the backtest." };
  }
  const result = await executeRun(run.id);
  revalidateBacktests();
  return result;
}

export async function publishBacktestAction(
  formData: FormData,
): Promise<BacktestActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const run = await loadBacktestRun(String(formData.get("runId") ?? ""));
  if (!run || !canReadBacktestRun(run, auth.member.id, auth.isAdmin)) {
    return { ok: false, error: "That run was not found." };
  }
  if (run.status !== "done") {
    return { ok: false, error: "Publish a finished run." };
  }
  if (!auth.isAdmin && run.userId !== auth.member.id) {
    return { ok: false, error: "Only the owner can publish this run." };
  }
  const templateId = await snapshotBacktestedTemplate({
    userId: null,
    recipe: run.recipe,
    published: true,
    suffix: run.symbol,
  });
  if (!templateId) {
    return { ok: false, error: "Could not publish that snapshot." };
  }
  const copy = await insertBacktestRun({
    userId: null,
    templateId,
    venue: run.venue,
    venueEnvironment: run.venueEnvironment,
    symbol: run.symbol,
    interval: run.interval,
    fromMs: run.fromMs,
    toMs: run.toMs,
    feePreset: run.feePreset,
    feeRate: run.feeRate,
    recipe: run.recipe,
  });
  if (!copy) {
    return { ok: false, error: "Could not copy the run." };
  }
  await updateBacktestRun(copy.id, {
    status: "done",
    stats: run.stats,
    orders: run.orders,
    error: null,
    finished: true,
  });
  revalidateBacktests();
  return { ok: true, runId: copy.id };
}

export async function sweepPerpsBacktestFormAction(
  formData: FormData,
): Promise<void> {
  await sweepPerpsBacktestAction(formData);
}

export async function sweepPerpsBacktestAction(
  formData: FormData,
): Promise<BacktestActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  if (!auth.isAdmin) {
    return { ok: false, error: "Only admins can sweep." };
  }
  const template = await loadTemplateById(String(formData.get("templateId") ?? ""));
  if (!template || template.recipe.kind !== "perps") {
    return { ok: false, error: "Pick a Perps bots template." };
  }
  const allowed = canBacktestPerpsRecipe(template.recipe);
  if (!allowed.ok) {
    return allowed;
  }
  const venue = parseCandleVenue(formData.get("venue")) ?? "bybit";
  const interval = parseCandleInterval(formData.get("interval")) ?? "60";
  const days = parseWindowDays(formData.get("windowDays"));
  const feePreset = parseFeePreset(formData.get("feePreset"));
  const symbols = String(formData.get("symbols") ?? "")
    .split(/[\s,]+/)
    .map((row) => parseCandleSymbol(row))
    .filter((row): row is string => Boolean(row));
  const unique = [...new Set(symbols)].slice(0, SWEEP_CAP);
  if (unique.length === 0) {
    return { ok: false, error: "Enter at least one contract." };
  }
  const toMs = Date.now();
  const fromMs = toMs - days * 24 * 60 * 60 * 1000;
  let lastId: string | undefined;
  for (const symbol of unique) {
    const recipe = { ...template.recipe, symbol };
    const templateId = await snapshotBacktestedTemplate({
      userId: null,
      recipe,
      published: true,
      suffix: symbol,
    });
    const run = await insertBacktestRun({
      userId: auth.member.id,
      templateId,
      venue,
      venueEnvironment:
        String(formData.get("venueEnvironment") ?? "").trim() || null,
      symbol,
      interval,
      fromMs,
      toMs,
      feePreset,
      feeRate: BACKTEST_FEE_PRESETS[feePreset].rate,
      recipe,
    });
    if (!run) {
      continue;
    }
    await executeRun(run.id);
    lastId = run.id;
  }
  revalidateBacktests();
  if (!lastId) {
    return { ok: false, error: "Could not queue the sweep." };
  }
  return { ok: true, runId: lastId };
}

