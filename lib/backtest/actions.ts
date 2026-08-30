"use server";

import { memberIsAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import { loadDeskCandles } from "@/lib/market/desk-klines";
import { parseCandleInterval, parseCandleSymbol, parseCandleVenue, type CandleBar } from "@/lib/market/candles";
import type { BacktestRecipe } from "./model";
import { parseBacktestRecipeJson } from "./library";
import { canBacktestDcaRecipe, replayDcaPlaybook } from "./replay-dca";
import {
  deleteTemplate,
  findNamedTemplate,
  insertTemplate,
  loadTemplateById,
  templateIsSharedWith,
} from "@/lib/templates/store";
import { recipesMatchReplayFields } from "@/lib/templates/recipe";
import { revalidatePath } from "next/cache";
import {
  BACKTEST_FEE_PRESETS,
  DEFAULT_STARTING_USDT,
  backtestShouldRunInline,
  defaultBacktestDates,
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
  linkBacktestRunTemplate,
  listBacktestRuns,
  loadBacktestRun,
  loadBacktestStudy,
  promoteDraftBacktestRun,
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

function recipeAllowed(recipe: BacktestRecipe) {
  return recipe.kind === "dca"
    ? canBacktestDcaRecipe(recipe)
    : canBacktestPerpsRecipe(recipe);
}

async function resolveSourceTemplateId(
  rawId: string,
  recipe: BacktestRecipe,
  userId: string,
  isAdmin: boolean,
): Promise<string | null> {
  if (!rawId) {
    return null;
  }
  const template = await loadTemplateById(rawId);
  if (
    !template ||
    (template.recipe.kind !== "dca" && template.recipe.kind !== "perps") ||
    !(await canUseTemplate(template, userId, isAdmin))
  ) {
    return null;
  }
  return recipesMatchReplayFields(recipe, template.recipe) ? template.id : null;
}

export async function seedBacktestDraftAction(
  formData: FormData,
): Promise<BacktestActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const recipe = parseBacktestRecipeJson(formData.get("recipe"));
  if (!recipe) {
    return { ok: false, error: "Complete the bot before backtesting." };
  }
  const allowed = recipeAllowed(recipe);
  if (!allowed.ok) {
    return allowed;
  }
  const dates = defaultBacktestDates();
  const range = parseBacktestDateRange(dates.from, dates.to, "60");
  if (!range.ok) {
    return range;
  }
  const venue = parseCandleVenue(formData.get("venue")) ?? "bybit";
  const venueEnvironment =
    String(formData.get("venueEnvironment") ?? "").trim() || null;
  const sourceTemplateId = await resolveSourceTemplateId(
    String(formData.get("sourceTemplateId") ?? ""),
    recipe,
    auth.member.id,
    auth.isAdmin,
  );
  const run = await insertBacktestRun({
    userId: auth.member.id,
    templateId: null,
    sourceTemplateId,
    venue,
    venueEnvironment,
    symbol: recipe.symbol,
    interval: "60",
    fromMs: range.fromMs,
    toMs: range.toMs,
    feePreset: "vip0_taker",
    feeRate: BACKTEST_FEE_PRESETS.vip0_taker.rate,
    startingUsdt: DEFAULT_STARTING_USDT,
    recipe,
    status: "draft",
  });
  if (!run) {
    return { ok: false, error: "Could not open a backtest draft." };
  }
  revalidateBacktests();
  return { ok: true, runId: run.id };
}

export async function queueTemplateBacktestAction(
  formData: FormData,
): Promise<BacktestActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  let recipe = parseBacktestRecipeJson(formData.get("recipe"));
  const pickedTemplateId = String(formData.get("templateId") ?? "").trim();
  if (!recipe && pickedTemplateId) {
    const template = await loadTemplateById(pickedTemplateId);
    if (
      template &&
      (template.recipe.kind === "dca" || template.recipe.kind === "perps") &&
      (await canUseTemplate(template, auth.member.id, auth.isAdmin))
    ) {
      recipe = template.recipe;
    }
  }
  if (!recipe) {
    return { ok: false, error: "Load a bot or pick a template to backtest." };
  }
  const allowed = recipeAllowed(recipe);
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
    parseCandleSymbol(formData.get("symbol") ?? recipe.symbol) ?? recipe.symbol;
  const queuedRecipe =
    recipe.kind === "dca" && recipe.startKind === "indicator"
      ? { ...recipe, symbol, indicatorTimeframe: interval }
      : { ...recipe, symbol };
  const comparables = parseComparableSymbols(
    [
      ...formData.getAll("comparable"),
      String(formData.get("comparables") ?? ""),
    ],
    symbol,
  );
  const feePreset = parseFeePreset(formData.get("feePreset"));
  const venueEnvironment =
    String(formData.get("venueEnvironment") ?? "").trim() || null;
  const sourceTemplateId = await resolveSourceTemplateId(
    String(formData.get("sourceTemplateId") ?? pickedTemplateId),
    queuedRecipe,
    auth.member.id,
    auth.isAdmin,
  );
  const draftId = String(formData.get("draftId") ?? "").trim();
  const draft = draftId ? await loadBacktestRun(draftId) : null;
  const canPromote =
    draft &&
    draft.status === "draft" &&
    draft.userId === auth.member.id;
  const queuedFields = {
    templateId: null as string | null,
    sourceTemplateId,
    venue,
    venueEnvironment,
    symbol,
    interval,
    fromMs: range.fromMs,
    toMs: range.toMs,
    feePreset,
    feeRate: BACKTEST_FEE_PRESETS[feePreset].rate,
    startingUsdt: balance.startingUsdt,
    recipe: queuedRecipe,
    comparableSymbols: comparables,
  };
  const run = canPromote
    ? await promoteDraftBacktestRun(draft.id, queuedFields)
    : await insertBacktestRun({
        userId: auth.member.id,
        ...queuedFields,
      });
  if (!run) {
    return { ok: false, error: "Could not queue the backtest." };
  }
  for (const comparable of comparables) {
    const comparableRecipe = { ...queuedRecipe, symbol: comparable };
    await insertBacktestRun({
      userId: auth.member.id,
      templateId: null,
      sourceTemplateId,
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

export async function attachBacktestToTemplateAction(
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
  if (run.status !== "done" || run.userId !== auth.member.id) {
    return { ok: false, error: "Attach a finished run you own." };
  }
  if (!run.sourceTemplateId) {
    return { ok: false, error: "This run was not loaded from a template." };
  }
  const source = await loadTemplateById(run.sourceTemplateId);
  if (
    !source ||
    (source.recipe.kind !== "dca" && source.recipe.kind !== "perps") ||
    !(await canUseTemplate(source, auth.member.id, auth.isAdmin))
  ) {
    return { ok: false, error: "That template is no longer available." };
  }
  if (!recipesMatchReplayFields(run.recipe, source.recipe)) {
    return {
      ok: false,
      error: "The bot was edited. Save as a new template instead.",
    };
  }
  if (run.templateId && run.templateId !== source.id) {
    const linked = await loadTemplateById(run.templateId);
    if (linked && (linked.visibility === "user" || linked.visibility === "platform")) {
      return { ok: false, error: "This run is already attached to a template." };
    }
  }
  const linked = await linkBacktestRunTemplate(run.id, source.id);
  if (!linked) {
    return { ok: false, error: "Could not attach that run." };
  }
  revalidateBacktests(`/account/backtests/${run.id}`);
  return { ok: true, runId: run.id };
}

export async function saveBacktestAsTemplateAction(
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
  if (run.status !== "done" || run.userId !== auth.member.id) {
    return { ok: false, error: "Save a finished run you own." };
  }
  if (run.templateId) {
    const linked = await loadTemplateById(run.templateId);
    if (linked && (linked.visibility === "user" || linked.visibility === "platform")) {
      return { ok: false, error: "This run is already attached to a template." };
    }
  }
  const requested = String(formData.get("name") ?? "").trim() || run.recipe.name;
  const names = [requested, uniqueBacktestName(requested, run.symbol)];
  let created: Awaited<ReturnType<typeof insertTemplate>> | null = null;
  for (const name of names) {
    created = await insertTemplate({
      userId: auth.member.id,
      visibility: "user",
      deskType: run.recipe.kind,
      name,
      description: "Saved from a backtest. Enable on the desk yourself.",
      recipe: run.recipe,
    });
    if (created.ok || created.code !== "name_taken") {
      break;
    }
  }
  if (!created || !created.ok) {
    return { ok: false, error: created?.error ?? "Could not save that template." };
  }
  const linked = await linkBacktestRunTemplate(run.id, created.template.id);
  if (!linked) {
    return { ok: false, error: "Saved the template but could not link this run." };
  }
  revalidateBacktests(`/account/backtests/${run.id}`);
  return { ok: true, runId: run.id };
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

