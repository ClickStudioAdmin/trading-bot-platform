"use server";

import { requirePerpsUiSession } from "@/lib/accounts/guard";
import {
  dcaConfigMaxOrderError,
  dcaPlaybookIsRunning,
  dcaStartListens,
  parseDcaPlaybookForm,
  parseDcaPlaybookId,
  parseDcaSaveIntent,
  type DcaPlaybookConfig,
} from "@/lib/dca/playbook";
import {
  applyDcaVerb,
  lastPriceFor,
  parseDcaPlaybookVerb,
  syncDcaPlaybookWorking,
} from "@/lib/dca/run";
import { loadUsdtLinearPerps } from "@/lib/exchanges/bybit/perp";
import {
  deleteDcaPlaybook,
  saveDcaPlaybook,
} from "@/lib/dca/store";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_PATHS, FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function fail(message: string): never {
  redirect(
    `${FUTURES_PATHS.automations}?error=${encodeURIComponent(message)}`,
  );
}

function succeed(notice: string): never {
  redirect(
    `${FUTURES_PATHS.automations}?saved=1&notice=${encodeURIComponent(notice)}`,
  );
}

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

export async function saveDcaPlaybookAction(formData: FormData) {
  await saveDcaPlaybookWith("save", formData);
}

export async function saveAndArmDcaPlaybookAction(formData: FormData) {
  await saveDcaPlaybookWith("arm", formData);
}

async function rejectIfOverMaxOrder(config: DcaPlaybookConfig): Promise<void> {
  const pairs = await loadUsdtLinearPerps().catch(() => []);
  const pair = pairs.find((row) => row.symbol === config.symbol);
  if (!pair) {
    fail("That contract is not available.");
  }
  const lastPrice = await lastPriceFor(config.symbol);
  const error = dcaConfigMaxOrderError({
    config,
    lastPrice,
    maxQty: pair.maxQty,
    maxMktQty: pair.maxMktQty,
    baseCoin: pair.baseCoin,
  });
  if (error) {
    fail(error);
  }
}

async function saveDcaPlaybookWith(
  intentRaw: string,
  formData: FormData,
): Promise<void> {
  const session = await requirePerpsUiSession();
  if (session.account.deskType !== "dca") {
    fail("This desk is not a DCA desk.");
  }
  const parsed = parseDcaPlaybookForm(formData);
  if (!parsed.ok) {
    fail(parsed.error);
  }
  await rejectIfOverMaxOrder(parsed.config);
  const supabase = createServiceClient();
  if (!supabase) {
    fail("Auth is not configured.");
  }
  const saved = await saveDcaPlaybook({
    supabase,
    userId: session.member.id,
    accountId: session.account.id,
    config: parsed.config,
    id: parseDcaPlaybookId(formData.get("playbookId")),
  });
  if (!saved.ok) {
    fail(saved.error);
  }
  await writeEventLog({
    scope: "strategy",
    event: "dca.saved",
    message: "Saved DCA playbook",
    userId: session.member.id,
    accountId: session.account.id,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      playbookId: saved.playbook.id,
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
  revalidatePath(FUTURES_PATHS.automations);
  const intent = parseDcaSaveIntent(intentRaw);
  if (intent === "arm" && dcaStartListens(parsed.config.startKind)) {
    const armed = await applyDcaVerb({
      playbook: saved.playbook,
      mode: session.account.mode,
      verb: "arm",
    });
    if (!armed.ok) {
      fail(armed.error);
    }
    revalidatePath(FUTURES_PATHS.positions);
    succeed(armed.message);
  }
  succeed("Playbook saved.");
}

export async function deleteDcaPlaybookAction(formData: FormData) {
  const session = await requirePerpsUiSession();
  if (session.account.deskType !== "dca") {
    fail("This desk is not a DCA desk.");
  }
  const id = parseDcaPlaybookId(formData.get("playbookId"));
  if (!id) {
    fail("That playbook was not found.");
  }
  const supabase = createServiceClient();
  if (!supabase) {
    fail("Auth is not configured.");
  }
  const deleted = await deleteDcaPlaybook({
    supabase,
    id,
    accountId: session.account.id,
  });
  if (!deleted.ok) {
    fail(deleted.error);
  }
  await writeEventLog({
    scope: "strategy",
    event: "dca.deleted",
    message: "Removed DCA playbook",
    userId: session.member.id,
    accountId: session.account.id,
    strategy: FUTURES_STRATEGY_ID,
    data: { playbookId: id },
  });
  revalidatePath(FUTURES_PATHS.automations);
  succeed("Playbook removed.");
}

export async function runDcaArmAction(formData: FormData) {
  await runDcaPlaybookVerb("arm", formData);
}

export async function runDcaArmLongAction(formData: FormData) {
  await runDcaPlaybookVerb("arm-long", formData);
}

export async function runDcaArmShortAction(formData: FormData) {
  await runDcaPlaybookVerb("arm-short", formData);
}

export async function runDcaDisarmAction(formData: FormData) {
  await runDcaPlaybookVerb("disarm", formData);
}

export async function runDcaClosePlaybookAction(formData: FormData) {
  await runDcaPlaybookVerb("close-playbook", formData);
}

export async function runDcaPlaybookVerb(
  verbRaw: string,
  formData: FormData,
) {
  const session = await requirePerpsUiSession();
  if (session.account.deskType !== "dca") {
    fail("This desk is not a DCA desk.");
  }
  const parsedVerb =
    parseDcaPlaybookVerb(verbRaw) ??
    parseDcaPlaybookVerb(formData.get("verb"));
  if (!parsedVerb) {
    fail("Choose Arm, Disarm, or Close playbook.");
  }
  const { verb, side } = parsedVerb;
  const parsed = parseDcaPlaybookForm(formData);
  if (!parsed.ok) {
    fail(parsed.error);
  }
  if (verb === "arm") {
    await rejectIfOverMaxOrder(parsed.config);
  }
  const supabase = createServiceClient();
  if (!supabase) {
    fail("Auth is not configured.");
  }
  const saved = await saveDcaPlaybook({
    supabase,
    userId: session.member.id,
    accountId: session.account.id,
    config: parsed.config,
    id: parseDcaPlaybookId(formData.get("playbookId")),
  });
  if (!saved.ok) {
    fail(saved.error);
  }
  const result = await applyDcaVerb({
    playbook: saved.playbook,
    mode: session.account.mode,
    verb,
    side,
  });
  if (!result.ok) {
    fail(result.error);
  }
  revalidatePath(FUTURES_PATHS.automations);
  revalidatePath(FUTURES_PATHS.positions);
  succeed(result.message);
}
