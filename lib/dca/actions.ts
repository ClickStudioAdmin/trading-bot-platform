"use server";

import { requirePerpsUiSession } from "@/lib/accounts/guard";
import { parseDcaPlaybookForm, parseDcaPlaybookId } from "@/lib/dca/playbook";
import { applyDcaVerb, parseDcaPlaybookVerb } from "@/lib/dca/run";
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

export async function saveDcaPlaybookAction(formData: FormData) {
  const session = await requirePerpsUiSession();
  if (session.account.deskType !== "dca") {
    fail("This desk is not a DCA desk.");
  }
  const parsed = parseDcaPlaybookForm(formData);
  if (!parsed.ok) {
    fail(parsed.error);
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
  revalidatePath(FUTURES_PATHS.automations);
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

export async function runDcaPlaybookVerb(formData: FormData) {
  const session = await requirePerpsUiSession();
  if (session.account.deskType !== "dca") {
    fail("This desk is not a DCA desk.");
  }
  const parsedVerb = parseDcaPlaybookVerb(formData.get("verb"));
  if (!parsedVerb) {
    fail("Choose Arm, Disarm, or Close playbook.");
  }
  const { verb, side } = parsedVerb;
  const parsed = parseDcaPlaybookForm(formData);
  if (!parsed.ok) {
    fail(parsed.error);
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
