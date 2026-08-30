"use server";

import { memberIsAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import { loadDeskCandles } from "@/lib/market/desk-klines";
import { parseCandleInterval, parseCandleSymbol, parseCandleVenue } from "@/lib/market/candles";
import type { BacktestRecipe } from "./model";
import { canBacktestDcaRecipe, replayDcaPlaybook } from "./replay-dca";
import {
  deleteTemplate,
  findNamedTemplate,
  insertTemplate,
  loadTemplateById,
  templateIsSharedWith,
} from "@/lib/templates/store";
import { revalidatePath } from "next/cache";
import {
  BACKTEST_CANDLE_LIMIT,
  BACKTEST_FEE_PRESETS,
  parseBacktestDateRange,
  parseFeePreset,
  parseStartingBalance,
} from "./model";
import { canBacktestPerpsRecipe, replayPerpsPriceCross } from "./replay";
import {
  canDeleteBacktestRun,
  canReadBacktestRun,
  countBacktestRunsForTemplate,
  deleteBacktestRun,
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

function uniqueBacktestName(name: string, suffix: string): string {
  const base = name.trim() || "Backtest";
  const label = `${base} · ${suffix}`.slice(0, 80);
  return label;
}

async function snapshotBacktestedTemplate(input: {
  userId: string | null;
  recipe: BacktestRecipe;
  published: boolean;
  suffix: string;
}): Promise<string | null> {
  const name = uniqueBacktestName(input.recipe.name, input.suffix);
  const deskType = input.recipe.kind;
  const existing = await findNamedTemplate({
    visibility: "backtested",
    userId: input.published ? null : input.userId,
    deskType,
    name,
  });
  if (existing) {
    return existing.id;
  }
  const created = await insertTemplate({
    userId: input.published ? null : input.userId,
    visibility: "backtested",
    deskType,
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
    const allowed =
      run.recipe.kind === "dca"
        ? canBacktestDcaRecipe(run.recipe)
        : canBacktestPerpsRecipe(run.recipe);
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
      limit: BACKTEST_CANDLE_LIMIT,
    });
    if (candles.length < 8) {
      await updateBacktestRun(runId, {
        status: "failed",
        error: "Not enough candles in that window.",
        finished: true,
      });
      return { ok: false, error: "Not enough candles in that window.", runId };
    }
    const replayed =
      run.recipe.kind === "dca"
        ? replayDcaPlaybook({
            bars: candles,
            recipe: run.recipe,
            feeRate: run.feeRate,
            startingUsdt: run.startingUsdt,
          })
        : replayPerpsPriceCross({
            bars: candles,
            recipe: run.recipe,
            feeRate: run.feeRate,
            startingUsdt: run.startingUsdt,
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

async function canUseTemplate(
  template: { visibility: string; userId: string | null; id: string },
  userId: string,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) {
    return true;
  }
  if (template.visibility === "platform" || template.userId === userId) {
    return true;
  }
  if (template.visibility === "backtested" && template.userId === null) {
    return true;
  }
  return templateIsSharedWith(userId, template.id);
}

export async function queueTemplateBacktestAction(
  formData: FormData,
): Promise<BacktestActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const template = await loadTemplateById(String(formData.get("templateId") ?? ""));
  if (!template || !(await canUseTemplate(template, auth.member.id, auth.isAdmin))) {
    return { ok: false, error: "Pick a saved template to backtest." };
  }
  if (template.recipe.kind !== "perps" && template.recipe.kind !== "dca") {
    return { ok: false, error: "Only Perps bots and DCA templates can be backtested." };
  }
  const allowed =
    template.recipe.kind === "dca"
      ? canBacktestDcaRecipe(template.recipe)
      : canBacktestPerpsRecipe(template.recipe);
  if (!allowed.ok) {
    return allowed;
  }
  const interval = parseCandleInterval(formData.get("interval"));
  if (!interval) {
    return { ok: false, error: "Pick a timeframe." };
  }
  const range = parseBacktestDateRange(
    formData.get("fromDate"),
    formData.get("toDate"),
    interval,
  );
  if (!range.ok) {
    return range;
  }
  const balance = parseStartingBalance(formData.get("startingBalance"));
  if (!balance.ok) {
    return balance;
  }
  const venue = parseCandleVenue(formData.get("venue")) ?? "bybit";
  const symbol =
    parseCandleSymbol(formData.get("symbol") ?? template.recipe.symbol) ??
    template.recipe.symbol;
  const feePreset = parseFeePreset(formData.get("feePreset"));
  const recipe = { ...template.recipe, symbol };
  const snapshotId = await snapshotBacktestedTemplate({
    userId: auth.member.id,
    recipe,
    published: false,
    suffix: "backtest",
  });
  const run = await insertBacktestRun({
    userId: auth.member.id,
    templateId: snapshotId,
    venue,
    venueEnvironment:
      String(formData.get("venueEnvironment") ?? "").trim() || null,
    symbol,
    interval,
    fromMs: range.fromMs,
    toMs: range.toMs,
    feePreset,
    feeRate: BACKTEST_FEE_PRESETS[feePreset].rate,
    startingUsdt: balance.startingUsdt,
    recipe,
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
    startingUsdt: run.startingUsdt,
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
  if (
    !template ||
    (template.recipe.kind !== "perps" && template.recipe.kind !== "dca")
  ) {
    return { ok: false, error: "Pick a Perps bots or DCA template." };
  }
  const allowed =
    template.recipe.kind === "dca"
      ? canBacktestDcaRecipe(template.recipe)
      : canBacktestPerpsRecipe(template.recipe);
  if (!allowed.ok) {
    return allowed;
  }
  const venue = parseCandleVenue(formData.get("venue")) ?? "bybit";
  const interval = parseCandleInterval(formData.get("interval"));
  if (!interval) {
    return { ok: false, error: "Pick a timeframe." };
  }
  const range = parseBacktestDateRange(
    formData.get("fromDate"),
    formData.get("toDate"),
    interval,
  );
  if (!range.ok) {
    return range;
  }
  const balance = parseStartingBalance(formData.get("startingBalance"));
  if (!balance.ok) {
    return balance;
  }
  const feePreset = parseFeePreset(formData.get("feePreset"));
  const symbols = String(formData.get("symbols") ?? "")
    .split(/[\s,]+/)
    .map((row) => parseCandleSymbol(row))
    .filter((row): row is string => Boolean(row));
  const unique = [...new Set(symbols)].slice(0, SWEEP_CAP);
  if (unique.length === 0) {
    return { ok: false, error: "Enter at least one contract." };
  }
  const fromMs = range.fromMs;
  const toMs = range.toMs;
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
      startingUsdt: balance.startingUsdt,
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

export async function deleteBacktestAction(
  formData: FormData,
): Promise<BacktestActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const run = await loadBacktestRun(String(formData.get("runId") ?? ""));
  if (!run || !canDeleteBacktestRun(run, auth.member.id, auth.isAdmin)) {
    return { ok: false, error: "That run was not found." };
  }
  const templateId = run.templateId;
  const deleted = await deleteBacktestRun(run.id);
  if (!deleted.ok) {
    return deleted;
  }
  if (templateId) {
    const leftover = await countBacktestRunsForTemplate(templateId);
    if (leftover === 0) {
      const template = await loadTemplateById(templateId);
      if (template?.visibility === "backtested") {
        await deleteTemplate(templateId);
      }
    }
  }
  revalidateBacktests();
  return { ok: true, runId: run.id };
}

