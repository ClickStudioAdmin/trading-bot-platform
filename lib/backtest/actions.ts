"use server";

import { memberIsAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import { loadDeskCandles } from "@/lib/market/desk-klines";
import { parseCandleInterval, parseCandleSymbol, parseCandleVenue, type CandleBar } from "@/lib/market/candles";
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
  BACKTEST_FEE_PRESETS,
  backtestShouldRunInline,
  estimateBacktestBars,
  parseBacktestDateRange,
  parseComparableSymbols,
  parseFeePreset,
  parseStartingBalance,
} from "./model";
import { canBacktestPerpsRecipe, replayPerpsPriceCross } from "./replay";
import {
  canDeleteBacktestRun,
  canReadBacktestRun,
  countBacktestRunsForTemplate,
  deleteBacktestRun,
  deleteBacktestStudy,
  insertBacktestRun,
  insertBacktestStudy,
  listBacktestRuns,
  loadBacktestRun,
  loadBacktestStudy,
  updateBacktestRun,
  updateBacktestStudy,
} from "./store";
import { executeBacktestRun } from "./execute";
import { expandStudyScenarios, STUDY_CANDLE_LIMIT } from "./study";
import { loadStudySeed } from "./study-seeds";

export type BacktestActionResult = {
  ok: boolean;
  error?: string;
  runId?: string;
  studyId?: string;
  scenarioCount?: number;
};

function revalidateBacktests(extra?: string) {
  revalidatePath("/account/backtests");
  revalidatePath("/admin/backtests");
  revalidatePath("/account/templates");
  if (extra) {
    revalidatePath(extra);
  }
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
  const comparables = parseComparableSymbols(
    [
      ...formData.getAll("comparable"),
      String(formData.get("comparables") ?? ""),
    ],
    symbol,
  );
  const feePreset = parseFeePreset(formData.get("feePreset"));
  const recipe = { ...template.recipe, symbol };
  const snapshotId = await snapshotBacktestedTemplate({
    userId: auth.member.id,
    recipe,
    published: false,
    suffix: "backtest",
  });
  const venueEnvironment =
    String(formData.get("venueEnvironment") ?? "").trim() || null;
  const run = await insertBacktestRun({
    userId: auth.member.id,
    templateId: snapshotId,
    venue,
    venueEnvironment,
    symbol,
    interval,
    fromMs: range.fromMs,
    toMs: range.toMs,
    feePreset,
    feeRate: BACKTEST_FEE_PRESETS[feePreset].rate,
    startingUsdt: balance.startingUsdt,
    recipe,
    comparableSymbols: comparables,
  });
  if (!run) {
    return { ok: false, error: "Could not queue the backtest." };
  }
  for (const comparable of comparables) {
    const comparableRecipe = { ...template.recipe, symbol: comparable };
    await insertBacktestRun({
      userId: auth.member.id,
      templateId: snapshotId,
      parentRunId: run.id,
      venue,
      venueEnvironment,
      symbol: comparable,
      interval,
      fromMs: range.fromMs,
      toMs: range.toMs,
      feePreset,
      feeRate: BACKTEST_FEE_PRESETS[feePreset].rate,
      startingUsdt: balance.startingUsdt,
      recipe: comparableRecipe,
    });
  }
  const bars = estimateBacktestBars(range.fromMs, range.toMs, interval);
  const inline = backtestShouldRunInline(bars, 1 + comparables.length);
  if (inline) {
    const result = await executeBacktestRun(run.id);
    const children = await listBacktestRuns({ parentRunId: run.id, limit: 20 });
    for (const child of children) {
      if (child.status === "queued") {
        await executeBacktestRun(child.id);
      }
    }
    revalidateBacktests(`/account/backtests/${run.id}`);
    return result;
  }
  revalidateBacktests(`/account/backtests/${run.id}`);
  return { ok: true, runId: run.id };
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

export async function startBacktestStudyAction(
  formData: FormData,
): Promise<BacktestActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  if (!auth.isAdmin) {
    return { ok: false, error: "Only admins can run a study." };
  }
  const seed = await loadStudySeed(String(formData.get("seedKey") ?? ""));
  if (!seed) {
    return { ok: false, error: "Pick a desk bot to study." };
  }
  const range = parseBacktestDateRange(
    formData.get("fromDate"),
    formData.get("toDate"),
    "D",
  );
  if (!range.ok) {
    return range;
  }
  const balance = parseStartingBalance(formData.get("startingBalance"));
  if (!balance.ok) {
    return balance;
  }
  const expanded = expandStudyScenarios(
    seed.recipe,
    range.fromMs,
    range.toMs,
  );
  if (expanded.scenarios.length === 0) {
    return {
      ok: false,
      error:
        "That window does not fit any study timeframe, or this bot cannot expand into scenarios.",
    };
  }
  const venue = parseCandleVenue(formData.get("venue")) ?? seed.venue;
  const venueEnvironment =
    String(formData.get("venueEnvironment") ?? "").trim() ||
    seed.venueEnvironment;
  const feePreset = parseFeePreset("vip0_taker");
  const symbol = seed.recipe.symbol;
  const studyName = `${seed.label} · ${new Date(range.fromMs).toISOString().slice(0, 10)}–${new Date(range.toMs).toISOString().slice(0, 10)}`;
  const study = await insertBacktestStudy({
    userId: auth.member.id,
    accountId: seed.accountId,
    name: studyName.slice(0, 120),
    deskType: seed.deskType,
    venue,
    venueEnvironment,
    symbol,
    fromMs: range.fromMs,
    toMs: range.toMs,
    startingUsdt: balance.startingUsdt,
    seedRecipe: seed.recipe,
    scenarioCount: expanded.scenarios.length,
  });
  if (!study) {
    return { ok: false, error: "Could not start that study." };
  }
  const candlesByInterval = new Map<string, CandleBar[]>();
  let saved = 0;
  try {
    for (const scenario of expanded.scenarios) {
      let candles = candlesByInterval.get(scenario.interval);
      if (!candles) {
        candles = await loadDeskCandles({
          venue,
          venueEnvironment,
          symbol,
          interval: scenario.interval,
          fromMs: range.fromMs,
          toMs: range.toMs,
          limit: STUDY_CANDLE_LIMIT,
        });
        candlesByInterval.set(scenario.interval, candles);
      }
      if (candles.length < 8) {
        await insertBacktestRun({
          userId: auth.member.id,
          templateId: null,
          studyId: study.id,
          venue,
          venueEnvironment,
          symbol,
          interval: scenario.interval,
          fromMs: range.fromMs,
          toMs: range.toMs,
          feePreset,
          feeRate: BACKTEST_FEE_PRESETS[feePreset].rate,
          startingUsdt: balance.startingUsdt,
          recipe: scenario.recipe,
          status: "failed",
          error: "Not enough candles in that window.",
          finished: true,
        });
        saved += 1;
        continue;
      }
      const allowed =
        scenario.recipe.kind === "dca"
          ? canBacktestDcaRecipe(scenario.recipe)
          : canBacktestPerpsRecipe(scenario.recipe);
      if (!allowed.ok) {
        await insertBacktestRun({
          userId: auth.member.id,
          templateId: null,
          studyId: study.id,
          venue,
          venueEnvironment,
          symbol,
          interval: scenario.interval,
          fromMs: range.fromMs,
          toMs: range.toMs,
          feePreset,
          feeRate: BACKTEST_FEE_PRESETS[feePreset].rate,
          startingUsdt: balance.startingUsdt,
          recipe: scenario.recipe,
          status: "failed",
          error: allowed.error,
          finished: true,
        });
        saved += 1;
        continue;
      }
      const replayed =
        scenario.recipe.kind === "dca"
          ? replayDcaPlaybook({
              bars: candles,
              recipe: scenario.recipe,
              feeRate: BACKTEST_FEE_PRESETS[feePreset].rate,
              startingUsdt: balance.startingUsdt,
            })
          : replayPerpsPriceCross({
              bars: candles,
              recipe: scenario.recipe,
              feeRate: BACKTEST_FEE_PRESETS[feePreset].rate,
              startingUsdt: balance.startingUsdt,
            });
      await insertBacktestRun({
        userId: auth.member.id,
        templateId: null,
        studyId: study.id,
        venue,
        venueEnvironment,
        symbol,
        interval: scenario.interval,
        fromMs: range.fromMs,
        toMs: range.toMs,
        feePreset,
        feeRate: BACKTEST_FEE_PRESETS[feePreset].rate,
        startingUsdt: balance.startingUsdt,
        recipe: scenario.recipe,
        status: "done",
        stats: replayed.stats,
        orders: replayed.orders,
        error: null,
        finished: true,
      });
      saved += 1;
    }
    await updateBacktestStudy(study.id, {
      status: "done",
      scenarioCount: saved,
      error: null,
      finished: true,
    });
    revalidateBacktests(`/admin/backtests/studies/${study.id}`);
    return { ok: true, studyId: study.id, scenarioCount: saved };
  } catch {
    await updateBacktestStudy(study.id, {
      status: "failed",
      scenarioCount: saved,
      error: "Study replay failed.",
      finished: true,
    });
    revalidateBacktests(`/admin/backtests/studies/${study.id}`);
    return { ok: false, error: "Study replay failed.", studyId: study.id };
  }
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

export async function deleteBacktestStudyAction(
  formData: FormData,
): Promise<BacktestActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  if (!auth.isAdmin) {
    return { ok: false, error: "Admin only." };
  }
  const studyId = String(formData.get("studyId") ?? "");
  const study = await loadBacktestStudy(studyId);
  if (!study) {
    return { ok: false, error: "That study was not found." };
  }
  const deleted = await deleteBacktestStudy(study.id);
  if (!deleted.ok) {
    return deleted;
  }
  revalidateBacktests(`/admin/backtests/studies/${study.id}`);
  return { ok: true, studyId: study.id };
}

