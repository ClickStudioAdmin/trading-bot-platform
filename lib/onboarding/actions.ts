"use server";

import {
  bindConnectionToDesk,
  insertTradingAccount,
  listTradingAccounts,
} from "@/lib/accounts/store";
import {
  deskDisplayMode,
  formatDeskDisplayMode,
} from "@/lib/accounts/model";
import { AFFILIATES_PATH } from "@/lib/auth/onboarding-path";
import {
  requireVerifiedEmail,
  setActiveAccountId,
} from "@/lib/auth/session";
import { createMemberExchangeConnection } from "@/lib/exchanges/member-connection";
import { connectionFitsDesk } from "@/lib/exchanges/venues";
import {
  listConnectionDeskBinds,
  listExchangeConnections,
} from "@/lib/exchanges/store";
import { writeEventLog } from "@/lib/logs/write";
import { listOnboardingFolders } from "@/lib/onboarding/catalog";
import {
  appliesStillToRun,
  desksStillToCreate,
  parseSetupDraft,
  starterTemplateAllowed,
  validateSetupForFinish,
  type SetupDraft,
  type SetupSummary,
} from "@/lib/onboarding/model";
import {
  claimOnboardingFinish,
  completeMemberOnboarding,
  dismissOnboardingSummary,
  loadMemberOnboarding,
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

export async function skipSetup(): Promise<void> {
  const member = await requirePlatformMember();
  await skipMemberOnboarding(member.id);
  refreshSetupChrome();
  redirect("/account");
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

export async function finishSetup(raw: string): Promise<{ ok: false; error: string }> {
  const member = await requirePlatformMember();
  const parsed = parseSetupDraft(raw);
  if (!parsed.ok) {
    return parsed;
  }
  const accounts = await listTradingAccounts(member.id);
  const ownedIds = new Set(
    parsed.draft.desks
      .map((desk) => desk.accountId)
      .filter((id): id is string => Boolean(id)),
  );
  const foreign = accounts.filter((account) => !ownedIds.has(account.id));
  if (foreign.length > 0 && ownedIds.size === 0) {
    await skipMemberOnboarding(member.id);
    refreshSetupChrome();
    redirect("/account");
  }
  const claimed = await claimOnboardingFinish(member.id);
  if (!claimed.ok) {
    if (claimed.done) {
      redirect("/account");
    }
    return { ok: false, error: claimed.error };
  }
  const draft = mergeClaimedDraft(parsed.draft, claimed.row.draft);
  const folders = await listOnboardingFolders();
  const binds = await listConnectionDeskBinds(member.id);
  const boundConnectionIds = binds
    .filter((bind) => !ownedIds.has(bind.accountId))
    .map((bind) => bind.connectionId);
  const ready = validateSetupForFinish({
    draft,
    existingNames: accounts
      .filter((account) => !ownedIds.has(account.id))
      .map((account) => account.name),
    blocks: [],
    folders,
    boundConnectionIds,
  });
  if (!ready.ok) {
    await saveOnboardingDraft(member.id, draft);
    return ready;
  }
  const working = ready.draft;
  const connections = await listExchangeConnections(member.id);
  for (const desk of desksStillToCreate(working.desks)) {
    let connectionId: string | null = null;
    if (desk.mode === "live" && desk.connectionId && !desk.bindLater) {
      const match = connections.find((row) => row.id === desk.connectionId);
      if (!match || match.status !== "active") {
        await saveOnboardingDraft(member.id, working);
        return { ok: false, error: "Pick an exchange key saved on this login." };
      }
      const fit = connectionFitsDesk({
        deskVenue: desk.venue,
        deskEnvironment: desk.environmentId,
        connectionVenue: match.venue,
        connectionEnvironment: match.environment,
      });
      if (!fit.ok) {
        await saveOnboardingDraft(member.id, working);
        return fit;
      }
      connectionId = match.id;
    }
    const created = await insertTradingAccount(
      member.id,
      desk.name,
      desk.mode,
      desk.deskType,
      {
        venue: desk.venue,
        venueEnvironment: desk.mode === "live" ? desk.environmentId : null,
      },
    );
    if (!created) {
      await saveOnboardingDraft(member.id, working);
      return {
        ok: false,
        error: "Could not create that desk. The name may already be in use.",
      };
    }
    desk.accountId = created.id;
    await saveOnboardingProgress({ userId: member.id, draft: working });
    if (connectionId) {
      const bound = await bindConnectionToDesk({
        userId: member.id,
        accountId: created.id,
        deskType: desk.deskType,
        connectionId,
        venue: created.venue,
        venueEnvironment: created.venueEnvironment,
      });
      if (bound.error) {
        await saveOnboardingDraft(member.id, working);
        return { ok: false, error: bound.error };
      }
    }
    await writeEventLog({
      scope: "system",
      event: "account.created",
      message: `Created ${desk.mode} desk ${desk.name}`,
      userId: member.id,
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
    await saveOnboardingProgress({ userId: member.id, draft: working });
  }

  const botLines: SetupSummary["bots"] = [];
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
      botLines.push({ name: item.deskName, detail: "That starter bot is not available." });
      continue;
    }
    const result = await applyTemplateToDesk({
      userId: member.id,
      accountId: item.accountId,
      templateId: item.templateId,
    });
    if (result.ok) {
      working.applied.push(item.key);
      botLines.push({
        name: result.name,
        detail: result.skipped
          ? "Skipped"
          : "Loaded idle or disabled. Nothing is trading.",
      });
    } else {
      botLines.push({
        name: result.name,
        detail: result.error ?? "Could not load that bot.",
      });
    }
    await saveOnboardingProgress({ userId: member.id, draft: working });
  }

  const summary: SetupSummary = {
    desks: working.desks.map((desk) => ({
      name: desk.name,
      detail: deskSummaryDetail(desk),
    })),
    bots: botLines,
    dismissed: false,
  };
  const tour = working.tourChoice === "yes" ? "in_progress" : "declined";
  const done = await completeMemberOnboarding({
    userId: member.id,
    summary,
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
  redirect("/account");
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
  if (stored.desks.length === 0) {
    return {
      ...submitted,
      applied: [...new Set([...submitted.applied, ...stored.applied])],
    };
  }
  const storedByKey = new Map(stored.desks.map((desk) => [desk.key, desk]));
  return {
    ...submitted,
    applied: [...new Set([...submitted.applied, ...stored.applied])],
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
