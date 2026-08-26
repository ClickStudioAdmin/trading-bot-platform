"use server";

import { requirePerpsUiSession } from "@/lib/accounts/guard";
import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import { applyDcaVerb, type DcaVerb } from "@/lib/dca/run";
import { saveDcaPlaybook } from "@/lib/dca/store";
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
    data: { symbol: parsed.config.symbol, side: parsed.config.side },
  });
  revalidatePath(FUTURES_PATHS.automations);
  succeed("Playbook saved.");
}

export async function runDcaPlaybookVerb(formData: FormData) {
  const session = await requirePerpsUiSession();
  if (session.account.deskType !== "dca") {
    fail("This desk is not a DCA desk.");
  }
  const verb = String(formData.get("verb") ?? "").trim() as DcaVerb | "";
  if (verb !== "arm" && verb !== "disarm" && verb !== "close-playbook") {
    fail("Choose Arm, Disarm, or Close playbook.");
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
  });
  if (!saved.ok) {
    fail(saved.error);
  }
  const result = await applyDcaVerb({
    playbook: saved.playbook,
    mode: session.account.mode,
    verb,
  });
  if (!result.ok) {
    fail(result.error);
  }
  revalidatePath(FUTURES_PATHS.automations);
  revalidatePath(FUTURES_PATHS.positions);
  succeed(result.message);
}
