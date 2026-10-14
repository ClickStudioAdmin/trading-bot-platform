"use server";

import {
  bindConnectionToDesk,
  insertTradingAccount,
  listTradingAccounts,
  teardownAllTradingAccounts,
  teardownTradingAccountsById,
} from "@/lib/accounts/store";
import {
  deskDisplayMode,
  formatDeskDisplayMode,
} from "@/lib/accounts/model";
import { AFFILIATES_PATH } from "@/lib/auth/onboarding-path";
import {
  clearActiveAccountId,
  requireVerifiedEmail,
  setActiveAccountId,
} from "@/lib/auth/session";
import { stepUpError } from "@/lib/auth/step-up-guard";
import { STEP_UP_FIELD } from "@/lib/auth/step-up";
import { createMemberExchangeConnection } from "@/lib/exchanges/member-connection";
import { connectionFitsDesk } from "@/lib/exchanges/venues";
import {
  deleteExchangeConnection,
  deleteMemberExchangeConnections,
  listConnectionDeskBinds,
  listExchangeConnections,
} from "@/lib/exchanges/store";
import { writeEventLog } from "@/lib/logs/write";
import { loadDeskTypeAccess } from "@/lib/membership/load-desk-type-access";
import { loadQuotaAccess } from "@/lib/membership/load-quota-access";
import {
  quotaAccessFor,
  quotaKeyForDesk,
  quotaRoomMessage,
} from "@/lib/membership/entitlements";
import { startAppliedStarterBot } from "@/lib/onboarding/arm";
import { listOnboardingFolders } from "@/lib/onboarding/catalog";
import {
  appliesStillToRun,
  desksStillToCreate,
  devAccountResetAllowed,
  emptySetupDraft,
  parseSetupDraft,
  setupCloseSkipsCreate,
  setupWizardResetPlan,
  starterTemplateAllowed,
  tourAfterSetupClose,
  validateSetupForFinish,
  type SetupDraft,
  type SetupSummary,
} from "@/lib/onboarding/model";
import {
  claimOnboardingFinish,
  clearMemberOnboarding,
  completeMemberOnboarding,
  dismissOnboardingSummary,
  loadMemberOnboarding,
  resetMemberOnboardingDraft,
  saveOnboardingDraft,
  saveOnboardingProgress,
  setOnboardingTour,
  skipMemberOnboarding,
} from "@/lib/onboarding/store";
import { applyTemplateToDesk } from "@/lib/templates/apply";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function refreshSetupChrome() {
  revalidatePath("/", "layout");
  revalidatePath("/account");
  revalidatePath("/account/setup");
  revalidatePath("/account/sub-accounts");
  revalidatePath("/account/templates");
}

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

function setupErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const clean = message.replace(/\s+/g, " ").trim();
  return (clean || "Could not finish setup.").slice(0, 180);
}

async function requirePlatformMember() {
  const member = await requireVerifiedEmail();
  if (!member.platformMember) {
    redirect(AFFILIATES_PATH);
  }
  return member;
}

export async function saveSetupDraft(
  raw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const member = await requirePlatformMember();
  const parsed = parseSetupDraft(raw);
  if (!parsed.ok) {
    return parsed;
  }
  const saved = await saveOnboardingDraft(member.id, parsed.draft);
  if (!saved) {
    return { ok: false, error: "Could not save setup." };
  }
  return { ok: true };
}

export async function saveSetupConnection(formData: FormData): Promise<
  | {
      ok: true;
      connection: {
        id: string;
        venue: string;
        environment: string;
        label: string | null;
        fingerprint: string;
        status: "active";
      };
    }
  | { ok: false; error: string }
> {
  const member = await requirePlatformMember();
  const accounts = await listTradingAccounts(member.id);
  if (accounts.length > 0) {
    return { ok: false, error: "Add keys from Exchanges after setup." };
  }
  const stepUp = await stepUpError(member.id, formData.get(STEP_UP_FIELD));
  if (stepUp) {
    return { ok: false, error: stepUp };
  }
  const written = await createMemberExchangeConnection({
    userId: member.id,
    formData,
  });
  if (!written.ok) {
    await writeEventLog({
      level: "error",
      scope: "system",
      event: "exchange.verify_failed",
      message: written.error,
      userId: member.id,
      data: { source: "onboarding" },
    });
    return written;
  }
  await writeEventLog({
    scope: "system",
    event: "exchange.saved",
    message: "Connected an exchange key during setup",
    userId: member.id,
    data: {
      venue: written.connection.venue,
      environment: written.connection.environment,
      fingerprint: written.connection.fingerprint,
    },
  });
  revalidatePath("/account/exchanges");
  revalidatePath("/account/sub-accounts");
  return { ok: true, connection: written.connection };
}

/** Create desks and load starter bots, then leave setup pending so the tour can show them. */
export async function createSetupBeforeTour(
  raw: string,
): Promise<{ ok: true; draft: SetupDraft } | { ok: false; error: string }> {
  try {
    const member = await requirePlatformMember();
    const prepared = await materializeSetup(member.id, raw);
    if (!prepared.ok) {
      return prepared;
    }
    const saved = await saveOnboardingDraft(member.id, prepared.draft);
    if (!saved) {
      return { ok: false, error: "Could not save setup." };
    }
    refreshSetupChrome();
    return { ok: true, draft: prepared.draft };
  } catch (error) {
    if (isNextRedirect(error)) {
      throw error;
    }
    return { ok: false, error: setupErrorMessage(error) };
  }
}

export async function finishSetup(
  raw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    return await finishSetupNow(raw);
  } catch (error) {
    if (isNextRedirect(error)) {
      throw error;
    }
    return { ok: false, error: setupErrorMessage(error) };
  }
}

async function finishSetupNow(
  raw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const member = await requirePlatformMember();
  const parsed = parseSetupDraft(raw);
  if (!parsed.ok) {
    return parsed;
  }
  const existing = await loadMemberOnboarding(member.id);
  const skipCreate = setupCloseSkipsCreate({
    status: existing?.status ?? null,
    readyForTour: existing?.draft.readyForTour === true,
  });
  let working: SetupDraft;
  if (skipCreate && existing) {
    working = mergeClaimedDraft(parsed.draft, existing.draft);
  } else {
    const prepared = await materializeSetup(member.id, raw);
    if (!prepared.ok) {
      return prepared;
    }
    working = prepared.draft;
  }
  const tour = tourAfterSetupClose(parsed.draft.tourChoice);
  const done = await completeMemberOnboarding({
    userId: member.id,
    summary: working.summary ?? {
      desks: working.desks.map((desk) => ({
        name: desk.name,
        detail: deskSummaryDetail(desk),
      })),
      bots: [],
      issues: [],
      dismissed: false,
    },
    tour,
    createdAccountIds: working.desks
      .map((desk) => desk.accountId)
      .filter((id): id is string => Boolean(id)),
    applied: working.applied,
  });
  if (!done) {
    return { ok: false, error: "Could not finish setup." };
  }
  const last = [...working.desks].reverse().find((desk) => desk.accountId);
  if (last?.accountId) {
    await setActiveAccountId(last.accountId);
  }
  refreshSetupChrome();
  return { ok: true };
}

async function materializeSetup(
  userId: string,
  raw: string,
): Promise<{ ok: true; draft: SetupDraft } | { ok: false; error: string }> {
  const parsed = parseSetupDraft(raw);
  if (!parsed.ok) {
    return parsed;
  }
  const accounts = await listTradingAccounts(userId);
  const ownedIds = new Set(
    parsed.draft.desks
      .map((desk) => desk.accountId)
      .filter((id): id is string => Boolean(id)),
  );
  const foreign = accounts.filter((account) => !ownedIds.has(account.id));
  if (foreign.length > 0 && ownedIds.size === 0) {
    await skipMemberOnboarding(userId);
    refreshSetupChrome();
    redirect("/account");
  }
  const claimed = await claimOnboardingFinish(userId);
  if (!claimed.ok) {
    if (claimed.done) {
      redirect("/account");
    }
    return { ok: false, error: claimed.error };
  }
  const draft = mergeClaimedDraft(parsed.draft, claimed.row.draft);
  const folders = await listOnboardingFolders();
  const binds = await listConnectionDeskBinds(userId);
  const boundConnectionIds = binds
    .filter((bind) => !ownedIds.has(bind.accountId))
    .map((bind) => bind.connectionId);
  const deskTypes = await loadDeskTypeAccess(userId);
  const ready = validateSetupForFinish({
    draft,
    existingNames: accounts
      .filter((account) => !ownedIds.has(account.id))
      .map((account) => account.name),
    blocks: [],
    folders,
    boundConnectionIds,
    denied: deskTypes.flatMap((row) =>
      row.allowed || !row.message
        ? []
        : [{ deskType: row.deskType, message: row.message }],
    ),
  });
  if (!ready.ok) {
    await saveOnboardingDraft(userId, draft);
    return ready;
  }
  const working = ready.draft;
  const connections = await listExchangeConnections(userId);
  const quotas = await loadQuotaAccess(userId);
  const bandAdds = {
    max_paper_desks: 0,
    max_demo_desks: 0,
    max_live_env_desks: 0,
    max_bots: 0,
  };
  for (const desk of desksStillToCreate(working.desks)) {
    const key = quotaKeyForDesk({
      mode: desk.mode,
      venueEnvironment: desk.mode === "live" ? desk.environmentId : null,
    });
    bandAdds[key] += 1;
    const message = quotaRoomMessage(
      quotaAccessFor(quotas, key),
      bandAdds[key],
    );
    if (message) {
      await saveOnboardingDraft(userId, working);
      return { ok: false, error: message };
    }
  }
  const botAdds = appliesStillToRun(working.desks, working.applied).length;
  const botMessage = quotaRoomMessage(
    quotaAccessFor(quotas, "max_bots"),
    botAdds,
  );
  if (botMessage) {
    await saveOnboardingDraft(userId, working);
    return { ok: false, error: botMessage };
  }
  for (const desk of desksStillToCreate(working.desks)) {
    let connectionId: string | null = null;
    if (desk.mode === "live" && desk.connectionId && !desk.bindLater) {
      const match = connections.find((row) => row.id === desk.connectionId);
      if (!match || match.status !== "active") {
        await saveOnboardingDraft(userId, working);
        return { ok: false, error: "Pick an exchange key saved on this login." };
      }
      const fit = connectionFitsDesk({
        deskVenue: desk.venue,
        deskEnvironment: desk.environmentId,
        connectionVenue: match.venue,
        connectionEnvironment: match.environment,
      });
      if (!fit.ok) {
        await saveOnboardingDraft(userId, working);
        return fit;
      }
      connectionId = match.id;
    }
    const created = await insertTradingAccount(
      userId,
      desk.name,
      desk.mode,
      desk.deskType,
      {
        venue: desk.venue,
        venueEnvironment: desk.mode === "live" ? desk.environmentId : null,
      },
    );
    if (!created) {
      await saveOnboardingDraft(userId, working);
      return {
        ok: false,
        error: "Could not create that desk. The name may already be in use.",
      };
    }
    desk.accountId = created.id;
    await saveOnboardingProgress({ userId, draft: working });
    if (connectionId) {
      const bound = await bindConnectionToDesk({
        userId,
        accountId: created.id,
        deskType: desk.deskType,
        connectionId,
        venue: created.venue,
        venueEnvironment: created.venueEnvironment,
      });
      if (bound.error) {
        await saveOnboardingDraft(userId, working);
        return { ok: false, error: bound.error };
      }
    }
    await writeEventLog({
      scope: "system",
      event: "account.created",
      message: `Created ${desk.mode} desk ${desk.name}`,
      userId,
      accountId: created.id,
      data: {
        mode: desk.mode,
        name: desk.name,
        deskType: desk.deskType,
        venue: desk.venue,
        venueEnvironment: desk.environmentId,
        source: "onboarding",
        ...(connectionId ? { exchangeConnectionId: connectionId } : {}),
      },
    });
    await saveOnboardingProgress({ userId, draft: working });
  }

  const botLines: SetupSummary["bots"] = [...(working.summary?.bots ?? [])];
  const issues: SetupSummary["issues"] = [];
  for (const item of appliesStillToRun(working.desks, working.applied)) {
    if (
      !starterTemplateAllowed({
        folders,
        deskType:
          working.desks.find((desk) => desk.accountId === item.accountId)
            ?.deskType ?? "dca",
        templateId: item.templateId,
      })
    ) {
      issues.push({
        name: item.deskName,
        message: "That starter bot is not available.",
      });
      continue;
    }
    let result: Awaited<ReturnType<typeof applyTemplateToDesk>>;
    try {
      result = await applyTemplateToDesk({
        userId,
        accountId: item.accountId,
        templateId: item.templateId,
      });
    } catch (error) {
      if (isNextRedirect(error)) {
        throw error;
      }
      issues.push({
        name: item.deskName,
        message: setupErrorMessage(error),
      });
      continue;
    }
    if (result.ok && !result.skipped) {
      working.applied.push(item.key);
      const desk = working.desks.find((row) => row.accountId === item.accountId);
      const start =
        !result.skipped &&
        result.applied &&
        desk?.armTemplateIds.includes(item.templateId);
      let detail = result.skipped
        ? "Skipped"
        : "Loaded idle or disabled. Nothing is trading.";
      if (start && desk && result.applied) {
        const started = await startAppliedStarterBot({
          userId,
          desk,
          applied: result.applied,
        });
        if (started.ok) {
          detail = started.detail;
        } else {
          desk.armTemplateIds = desk.armTemplateIds.filter(
            (id) => id !== item.templateId,
          );
          detail = `Loaded, but not started. ${started.error}`;
          issues.push({
            name: `${desk.name} · ${result.name}`,
            message: detail,
          });
        }
      }
      botLines.push({
        name: result.name,
        detail,
      });
    } else {
      const botName = result.name && result.name !== "Skipped" ? result.name : item.deskName;
      issues.push({
        name: botName === item.deskName ? item.deskName : `${item.deskName} · ${botName}`,
        message: result.error ?? "Could not load that bot.",
      });
    }
    working.summary = {
      desks: working.desks.map((desk) => ({
        name: desk.name,
        detail: deskSummaryDetail(desk),
      })),
      bots: botLines,
      issues,
      dismissed: false,
    };
    await saveOnboardingProgress({ userId, draft: working });
  }

  working.summary = {
    desks: working.desks.map((desk) => ({
      name: desk.name,
      detail: deskSummaryDetail(desk),
    })),
    bots: botLines,
    issues,
    dismissed: false,
  };
  working.readyForTour = true;
  await saveOnboardingProgress({ userId, draft: working });
  return { ok: true, draft: working };
}

function deskSummaryDetail(desk: SetupDraft["desks"][number]): string {
  const display = formatDeskDisplayMode(
    deskDisplayMode({
      mode: desk.mode,
      venueEnvironment: desk.environmentId,
    }),
  );
  if (desk.mode === "paper") {
    return display;
  }
  return desk.connectionId
    ? `${display}. Key bound. Nothing is trading.`
    : `${display}. Bind the key in Desk Settings. Nothing is trading.`;
}

function mergeClaimedDraft(submitted: SetupDraft, stored: SetupDraft): SetupDraft {
  const applied = [...new Set([...submitted.applied, ...stored.applied])];
  const summary = submitted.summary ?? stored.summary;
  const readyForTour = submitted.readyForTour || stored.readyForTour;
  if (stored.desks.length === 0) {
    return { ...submitted, applied, summary, readyForTour };
  }
  const storedByKey = new Map(stored.desks.map((desk) => [desk.key, desk]));
  return {
    ...submitted,
    applied,
    summary,
    readyForTour,
    desks: submitted.desks.map((desk) => {
      const previous = storedByKey.get(desk.key);
      if (!previous?.accountId) {
        return desk;
      }
      return { ...desk, accountId: previous.accountId };
    }),
  };
}

export async function dismissSetupSummary(): Promise<void> {
  const member = await requirePlatformMember();
  await dismissOnboardingSummary(member.id);
  revalidatePath("/account");
}

export async function resetDevAccount(
  previous: { error: string } | null,
  formData?: FormData,
): Promise<{ error: string } | null> {
  void previous;
  if (!devAccountResetAllowed()) {
    return { error: "Reset is only available outside production." };
  }
  const member = await requirePlatformMember();
  const stepUp = await stepUpError(member.id, formData?.get(STEP_UP_FIELD));
  if (stepUp) {
    return { error: stepUp };
  }
  const desks = await teardownAllTradingAccounts(member.id);
  if (desks.error) {
    return { error: desks.error };
  }
  const keys = await deleteMemberExchangeConnections(member.id);
  if (keys.error) {
    return { error: keys.error };
  }
  const setup = await clearMemberOnboarding(member.id);
  if (setup.error) {
    return { error: setup.error };
  }
  await clearActiveAccountId();
  refreshSetupChrome();
  redirect("/account");
}

/** Clears this setup and returns the wizard to the explainer. */
export async function resetSetupWizard(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const member = await requirePlatformMember();
  const row = await loadMemberOnboarding(member.id);
  if (row && row.status !== "pending" && row.status !== "finishing") {
    return { ok: false, error: "Setup is already finished." };
  }
  const [accounts, connections, binds] = await Promise.all([
    listTradingAccounts(member.id),
    listExchangeConnections(member.id),
    listConnectionDeskBinds(member.id),
  ]);
  const draft = row?.draft ?? emptySetupDraft();
  const plan = setupWizardResetPlan({
    ownedAccountIds: accounts.map((account) => account.id),
    createdAccountIds: row?.createdAccountIds ?? [],
    draftAccountIds: draft.desks
      .map((desk) => desk.accountId)
      .filter((id): id is string => Boolean(id)),
    ownedConnectionIds: connections.map((connection) => connection.id),
    draftConnectionIds: draft.desks
      .map((desk) => desk.connectionId)
      .filter((id): id is string => Boolean(id)),
    binds,
  });
  const removed = await teardownTradingAccountsById(member.id, plan.accountIds);
  if (removed.error) {
    return { ok: false, error: removed.error };
  }
  for (const connectionId of plan.connectionIds) {
    const deleted = await deleteExchangeConnection({
      userId: member.id,
      connectionId,
    });
    if (deleted.error) {
      return { ok: false, error: deleted.error };
    }
  }
  if (plan.accountIds.length > 0) {
    await clearActiveAccountId();
  }
  const saved = await resetMemberOnboardingDraft(member.id);
  if (!saved) {
    return { ok: false, error: "Could not reset setup." };
  }
  refreshSetupChrome();
  return { ok: true };
}

export async function startPlatformTour(): Promise<void> {
  const member = await requirePlatformMember();
  await setOnboardingTour({
    userId: member.id,
    tour: "in_progress",
    tourStep: 0,
  });
  refreshSetupChrome();
  redirect("/account");
}

export async function setPlatformTourStep(step: number): Promise<void> {
  const member = await requirePlatformMember();
  const row = await loadMemberOnboarding(member.id);
  if (row?.tour !== "in_progress") {
    return;
  }
  await setOnboardingTour({
    userId: member.id,
    tour: "in_progress",
    tourStep: Math.max(0, Math.min(20, Math.floor(step))),
  });
}

export async function skipPlatformTour(): Promise<void> {
  const member = await requirePlatformMember();
  await setOnboardingTour({
    userId: member.id,
    tour: "skipped",
    tourStep: 0,
  });
  refreshSetupChrome();
}

export async function completePlatformTour(): Promise<void> {
  const member = await requirePlatformMember();
  await setOnboardingTour({
    userId: member.id,
    tour: "completed",
    tourStep: 0,
  });
  refreshSetupChrome();
}

export async function loadSetupTourState(): Promise<{
  active: boolean;
  step: number;
} | null> {
  const member = await requireVerifiedEmail();
  if (!member.platformMember) {
    return null;
  }
  const row = await loadMemberOnboarding(member.id);
  if (row?.tour !== "in_progress") {
    return { active: false, step: 0 };
  }
  return { active: true, step: row.tourStep };
}
