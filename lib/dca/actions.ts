"use server";

import { requirePerpsUiSession } from "@/lib/accounts/guard";
import {
  dcaConfigMaxOrderError,
  dcaPlaybookIsRunning,
  dcaStartListens,
  parseDcaPlaybookForm,
  parseDcaPlaybookId,
  parseDcaSaveIntent,
  type DcaPlaybook,
  type DcaPlaybookConfig,
} from "@/lib/dca/playbook";
import {
  applyDcaVerb,
  lastPriceFor,
  parseDcaPlaybookVerb,
  syncDcaPlaybookWorking,
} from "@/lib/dca/run";
import { loadUsdtLinearPerps } from "@/lib/exchanges/bybit/perp";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";
import { loadHyperliquidLinearPerps } from "@/lib/venues/hyperliquid/market";
import {
  deleteDcaPlaybook,
  loadDcaPlaybookById,
  saveDcaPlaybook,
} from "@/lib/dca/store";
import { writeEventLog } from "@/lib/logs/write";
import { withQuery } from "@/lib/accounts/model";
import { safeFuturesReturnPath } from "@/lib/futures/path";
import { FUTURES_PATHS, FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { deskActionError, type DeskActionResult } from "@/lib/ui/desk-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type DcaDeskActionResult = DeskActionResult & {
  playbook?: DcaPlaybook;
  deletedId?: string;
};

async function syncRunningPlaybookWorking(input: {
  playbook: Parameters<typeof syncDcaPlaybookWorking>[0]["playbook"];
  mode: Parameters<typeof syncDcaPlaybookWorking>[0]["mode"];
}): Promise<void> {
  if (!dcaPlaybookIsRunning(input.playbook)) {
    return;
  }
  await syncDcaPlaybookWorking({
    playbook: input.playbook,
    mode: input.mode,
  });
}

export async function saveDcaPlaybookAction(
  formData: FormData,
): Promise<DcaDeskActionResult> {
  return saveDcaPlaybookWith("save", formData);
}

export async function saveAndArmDcaPlaybookAction(
  formData: FormData,
): Promise<DcaDeskActionResult> {
  return saveDcaPlaybookWith("arm", formData);
}

async function rejectIfOverMaxOrder(
  config: DcaPlaybookConfig,
  desk: { venue: string; venueEnvironment: string | null },
): Promise<string | null> {
  const pairs =
    desk.venue === "hyperliquid"
      ? await loadHyperliquidLinearPerps(
          hyperliquidInfoEnvironment(desk.venueEnvironment),
        ).catch(() => [])
      : await loadUsdtLinearPerps().catch(() => []);
  const pair = pairs.find((row) => row.symbol === config.symbol);
  if (!pair) {
    return "That contract is not available.";
  }
  const lastPrice = await lastPriceFor(config.symbol, desk);
  return dcaConfigMaxOrderError({
    config,
    lastPrice,
    maxQty: pair.maxQty,
    maxMktQty: pair.maxMktQty,
    baseCoin: pair.baseCoin,
  });
}

async function saveDcaPlaybookWith(
  intentRaw: string,
  formData: FormData,
): Promise<DcaDeskActionResult> {
  const session = await requirePerpsUiSession();
  if (session.account.deskType !== "dca") {
    return deskActionError("This desk is not a DCA desk.");
  }
  const parsed = parseDcaPlaybookForm(formData, session.account.venue);
  if (!parsed.ok) {
    return deskActionError(parsed.error);
  }
  const overMax = await rejectIfOverMaxOrder(parsed.config, session.account);
  if (overMax) {
    return deskActionError(overMax);
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return deskActionError("Auth is not configured.");
  }
  const saved = await saveDcaPlaybook({
    supabase,
    userId: session.member.id,
    accountId: session.account.id,
    config: parsed.config,
    id: parseDcaPlaybookId(formData.get("playbookId")),
  });
  if (!saved.ok) {
    return deskActionError(saved.error);
  }
  await writeEventLog({
    scope: "strategy",
    event: "dca.saved",
    message: "Saved DCA bot",
    userId: session.member.id,
    accountId: session.account.id,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      playbookId: saved.playbook.id,
      ruleName: parsed.config.name,
      symbol: parsed.config.symbol,
      side: parsed.config.direction,
    },
  });
  await syncRunningPlaybookWorking({
    playbook: saved.playbook,
    mode: session.account.mode,
  });
  if (dcaPlaybookIsRunning(saved.playbook)) {
    revalidatePath(FUTURES_PATHS.positions);
  }
  const intent = parseDcaSaveIntent(intentRaw);
  if (intent === "arm" && dcaStartListens(parsed.config.startKind)) {
    const armed = await applyDcaVerb({
      playbook: saved.playbook,
      mode: session.account.mode,
      verb: "arm",
    });
    if (!armed.ok) {
      return deskActionError(armed.error);
    }
    revalidatePath(FUTURES_PATHS.positions);
    const playbook =
      (await loadDcaPlaybookById(saved.playbook.id, session.account.id)) ??
      saved.playbook;
    return { ok: true, notice: armed.message, playbook };
  }
  return { ok: true, notice: "Bot saved.", playbook: saved.playbook };
}

export async function deleteDcaPlaybookAction(
  formData: FormData,
): Promise<DcaDeskActionResult> {
  const session = await requirePerpsUiSession();
  if (session.account.deskType !== "dca") {
    return deskActionError("This desk is not a DCA desk.");
  }
  const id = parseDcaPlaybookId(formData.get("playbookId"));
  if (!id) {
    return deskActionError("That bot was not found.");
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return deskActionError("Auth is not configured.");
  }
  const deleted = await deleteDcaPlaybook({
    supabase,
    id,
    accountId: session.account.id,
  });
  if (!deleted.ok) {
    return deskActionError(deleted.error);
  }
  await writeEventLog({
    scope: "strategy",
    event: "dca.deleted",
    message: "Removed DCA bot",
    userId: session.member.id,
    accountId: session.account.id,
    strategy: FUTURES_STRATEGY_ID,
    data: { playbookId: id },
  });
  return { ok: true, notice: "Bot removed.", deletedId: id };
}

export async function runDcaArmAction(
  formData: FormData,
): Promise<DcaDeskActionResult> {
  return runDcaPlaybookVerb("arm", formData);
}

export async function runDcaArmLongAction(
  formData: FormData,
): Promise<DcaDeskActionResult> {
  return runDcaPlaybookVerb("arm-long", formData);
}

export async function runDcaArmShortAction(
  formData: FormData,
): Promise<DcaDeskActionResult> {
  return runDcaPlaybookVerb("arm-short", formData);
}

export async function runDcaDisarmAction(
  formData: FormData,
): Promise<DcaDeskActionResult> {
  return runDcaPlaybookVerb("disarm", formData);
}

export async function runDcaClosePlaybookAction(
  formData: FormData,
): Promise<DcaDeskActionResult> {
  return runDcaPlaybookVerb("close-playbook", formData);
}

export async function closeDcaPlaybookFromRow(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const session = await requirePerpsUiSession();
  if (session.account.deskType !== "dca") {
    redirect(withQuery(next, { paperError: "This desk is not a DCA desk." }));
  }
  const id = parseDcaPlaybookId(formData.get("playbookId"));
  if (!id) {
    redirect(withQuery(next, { paperError: "That bot was not found." }));
  }
  const playbook = await loadDcaPlaybookById(id, session.account.id);
  if (!playbook) {
    redirect(withQuery(next, { paperError: "That bot was not found." }));
  }
  const result = await applyDcaVerb({
    playbook,
    mode: session.account.mode,
    verb: "close-playbook",
  });
  if (!result.ok) {
    redirect(withQuery(next, { paperError: result.error }));
  }
  revalidatePath(FUTURES_PATHS.automations);
  revalidatePath(FUTURES_PATHS.positions);
  revalidatePath(FUTURES_PATHS.root);
  redirect(
    withQuery(next, {
      paper:
        session.account.mode === "live"
          ? "live-playbook-closed"
          : "playbook-closed",
    }),
  );
}

export async function runDcaPlaybookVerb(
  verbRaw: string,
  formData: FormData,
): Promise<DcaDeskActionResult> {
  const session = await requirePerpsUiSession();
  if (session.account.deskType !== "dca") {
    return deskActionError("This desk is not a DCA desk.");
  }
  const parsedVerb =
    parseDcaPlaybookVerb(verbRaw) ??
    parseDcaPlaybookVerb(formData.get("verb"));
  if (!parsedVerb) {
    return deskActionError("Choose Arm, Disarm, or Close bot.");
  }
  const { verb, side } = parsedVerb;
  const parsed = parseDcaPlaybookForm(formData, session.account.venue);
  if (!parsed.ok) {
    return deskActionError(parsed.error);
  }
  if (verb === "arm") {
    const overMax = await rejectIfOverMaxOrder(
      parsed.config,
      session.account,
    );
    if (overMax) {
      return deskActionError(overMax);
    }
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return deskActionError("Auth is not configured.");
  }
  const saved = await saveDcaPlaybook({
    supabase,
    userId: session.member.id,
    accountId: session.account.id,
    config: parsed.config,
    id: parseDcaPlaybookId(formData.get("playbookId")),
  });
  if (!saved.ok) {
    return deskActionError(saved.error);
  }
  const result = await applyDcaVerb({
    playbook: saved.playbook,
    mode: session.account.mode,
    verb,
    side,
  });
  if (!result.ok) {
    return deskActionError(result.error);
  }
  revalidatePath(FUTURES_PATHS.positions);
  const playbook =
    (await loadDcaPlaybookById(saved.playbook.id, session.account.id)) ??
    saved.playbook;
  return { ok: true, notice: result.message, playbook };
}
