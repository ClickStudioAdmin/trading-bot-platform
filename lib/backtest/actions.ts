"use server";

import { memberIsAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import { parseCandleSymbol, parseCandleVenue } from "@/lib/market/candles";
import type { BacktestRecipe } from "./model";
import {
  canQueueUserBacktest,
  parseBacktestRecipeJson,
  readBacktestRecipeJson,
} from "./library";
import { placeSavedTemplate } from "@/lib/templates/actions";
import {
  deleteTemplate,
  insertTemplate,
  loadTemplateById,
  templateIsSharedWith,
} from "@/lib/templates/store";
import { applyRecipeToDesk, automationsPathForDeskType } from "@/lib/templates/apply";
import { parseTemplateName, recipesMatchReplayFields } from "@/lib/templates/recipe";
import { revalidatePath } from "next/cache";
import {
  BACKTEST_CANDLE_LIMIT,
  BACKTEST_FEE_PRESETS,
  DEFAULT_LEVERAGE,
  DEFAULT_STARTING_USDT,
  backtestShouldRunInline,
  backtestTapeInterval,
  comparableBacktestName,
  defaultBacktestDates,
  estimateBacktestBars,
  parseBacktestDates,
  parseComparableSymbols,
  parseFeePreset,
  parseBacktestLeverage,
  parseStartingBalance,
} from "./model";
import {
  canDeleteBacktestRun,
  canReadBacktestRun,
  claimBacktestRunById,
  countBacktestRunsForTemplate,
  deleteBacktestRun,
  insertBacktestRun,
  linkBacktestRunTemplate,
  listBacktestRuns,
  loadBacktestRun,
  promoteDraftBacktestRun,
  updateBacktestRun,
} from "./store";
import { executeBacktestRun } from "./execute";

export type BacktestActionResult = {
  ok: boolean;
  error?: string;
  runId?: string;
  notes?: string[];
};

function revalidateBacktests(extra?: string) {
  revalidatePath("/account/backtests");
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
  const loaded = readBacktestRecipeJson(formData.get("recipe"));
  if (!loaded.ok) {
    return loaded;
  }
  const recipe = loaded.recipe;
  const allowed = canQueueUserBacktest(recipe);
  if (!allowed.ok) {
    return allowed;
  }
  const dates = defaultBacktestDates();
  const range = parseBacktestDates(dates.from, dates.to);
  if (!range.ok) {
    return range;
  }
  const interval = backtestTapeInterval(recipe, range.fromMs, range.toMs);
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
    interval,
    fromMs: range.fromMs,
    toMs: range.toMs,
    feePreset: "vip0_taker",
    feeRate: BACKTEST_FEE_PRESETS.vip0_taker.rate,
    startingUsdt: DEFAULT_STARTING_USDT,
    leverage: DEFAULT_LEVERAGE,
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
  const loaded = readBacktestRecipeJson(formData.get("recipe"));
  let recipe = loaded.ok ? loaded.recipe : null;
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
    return {
      ok: false,
      error: loaded.ok
        ? "Load a bot or pick a template to backtest."
        : loaded.error,
    };
  }
  const allowed = canQueueUserBacktest(recipe);
  if (!allowed.ok) {
    return allowed;
  }
  const range = parseBacktestDates(
    formData.get("fromDate"),
    formData.get("toDate"),
  );
  if (!range.ok) {
    return range;
  }
  const interval = backtestTapeInterval(recipe, range.fromMs, range.toMs);
  if (
    estimateBacktestBars(range.fromMs, range.toMs, interval) >
    BACKTEST_CANDLE_LIMIT
  ) {
    return {
      ok: false,
      error:
        "That window is too long for this timeframe. Use a shorter range or a higher timeframe.",
    };
  }
  const balance = parseStartingBalance(formData.get("startingBalance"));
  if (!balance.ok) {
    return balance;
  }
  const leverage = parseBacktestLeverage(formData.get("leverage"));
  if (!leverage.ok) {
    return leverage;
  }
  const venue = parseCandleVenue(formData.get("venue")) ?? "bybit";
  const symbol =
    parseCandleSymbol(formData.get("symbol") ?? recipe.symbol) ?? recipe.symbol;
  const queuedRecipe = { ...recipe, symbol };
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
    leverage: leverage.leverage,
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
    const comparableRecipe = {
      ...queuedRecipe,
      symbol: comparable,
      name: comparableBacktestName(queuedRecipe.name, comparable),
    };
    await insertBacktestRun({
      userId: auth.member.id,
      templateId: null,
      sourceTemplateId: null,
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
      leverage: leverage.leverage,
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

export async function nudgeBacktestRunAction(
  runId: string,
): Promise<BacktestActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  const run = await loadBacktestRun(runId);
  if (!run || !canReadBacktestRun(run, auth.member.id, auth.isAdmin)) {
    return { ok: false, error: "That run was not found." };
  }
  if (
    run.status === "done" ||
    run.status === "failed" ||
    run.status === "cancelled" ||
    run.status === "draft"
  ) {
    return { ok: true, runId: run.id };
  }
  if (run.status === "running") {
    return { ok: true, runId: run.id };
  }
  const claimed = await claimBacktestRunById(run.id);
  if (!claimed) {
    return { ok: true, runId: run.id };
  }
  const result = await executeBacktestRun(claimed.id);
  const children = await listBacktestRuns({ parentRunId: claimed.id, limit: 20 });
  for (const child of children) {
    if (child.status === "queued") {
      await executeBacktestRun(child.id);
    }
  }
  revalidateBacktests(`/account/backtests/${run.id}`);
  return result;
}

export async function applyBacktestToDeskAction(
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
  const named = parseTemplateName(
    String(formData.get("name") ?? "").trim() || run.recipe.name,
  );
  if (!named.ok) {
    return { ok: false, error: named.error };
  }
  const accountId = String(formData.get("accountId") ?? "").trim();
  if (!accountId) {
    return { ok: false, error: "Choose a desk." };
  }
  const result = await applyRecipeToDesk({
    userId: auth.member.id,
    accountId,
    recipe: run.recipe,
    name: named.name,
  });
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not add that bot." };
  }
  revalidatePath(automationsPathForDeskType(run.deskType));
  return {
    ok: true,
    runId: run.id,
    notes: result.notes,
  };
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
  const templateId =
    String(formData.get("templateId") ?? "").trim() ||
    run.sourceTemplateId ||
    "";
  if (!templateId) {
    return { ok: false, error: "No matching template to attach." };
  }
  const source = await loadTemplateById(templateId);
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
  const placed = await placeSavedTemplate({
    templateId: created.template.id,
    userId: auth.member.id,
    isAdmin: auth.isAdmin,
    visibility: "user",
    deskType: run.recipe.kind,
    folderIds: formData
      .getAll("folderId")
      .map((value) => String(value).trim())
      .filter(Boolean),
    newFolderName: String(formData.get("newFolderName") ?? "").trim() || null,
  });
  if (!placed.ok) {
    return { ok: false, error: placed.error };
  }
  revalidateBacktests(`/account/backtests/${run.id}`);
  revalidatePath("/account/templates");
  return { ok: true, runId: run.id };
}

export async function saveBacktestAsPlatformTemplateAction(
  formData: FormData,
): Promise<BacktestActionResult> {
  const auth = await requireMember();
  if (!auth.ok) {
    return auth;
  }
  if (!auth.isAdmin) {
    return { ok: false, error: "Only an admin can save a platform template." };
  }
  const run = await loadBacktestRun(String(formData.get("runId") ?? ""));
  if (!run || !canReadBacktestRun(run, auth.member.id, auth.isAdmin)) {
    return { ok: false, error: "That run was not found." };
  }
  if (run.status !== "done") {
    return { ok: false, error: "Save a finished run." };
  }
  const requested = String(formData.get("name") ?? "").trim() || run.recipe.name;
  const names = [requested, uniqueBacktestName(requested, run.symbol)];
  const starterPack = formData.get("starterPack") === "1";
  let created: Awaited<ReturnType<typeof insertTemplate>> | null = null;
  for (const name of names) {
    created = await insertTemplate({
      userId: null,
      visibility: "platform",
      deskType: run.recipe.kind,
      name,
      description: "Saved from a backtest. Enable on the desk yourself.",
      recipe: run.recipe,
      starterPack,
    });
    if (created.ok || created.code !== "name_taken") {
      break;
    }
  }
  if (!created || !created.ok) {
    return { ok: false, error: created?.error ?? "Could not save that template." };
  }
  const placed = await placeSavedTemplate({
    templateId: created.template.id,
    userId: auth.member.id,
    isAdmin: true,
    visibility: "platform",
    deskType: run.recipe.kind,
    folderIds: formData
      .getAll("folderId")
      .map((value) => String(value).trim())
      .filter(Boolean),
    newFolderName: String(formData.get("newFolderName") ?? "").trim() || null,
  });
  if (!placed.ok) {
    return { ok: false, error: placed.error };
  }
  revalidateBacktests(`/account/backtests/${run.id}`);
  revalidatePath("/admin/templates");
  revalidatePath("/account/templates");
  return { ok: true, runId: run.id };
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

