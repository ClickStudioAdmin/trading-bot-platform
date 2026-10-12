import { applyDcaVerb } from "@/lib/dca/run";
import { rejectUnsignedBybitSymbol } from "@/lib/exchanges/agreement-store";
import {
  loadFuturesAutomationRuleById,
  upsertFuturesAutomationRules,
} from "@/lib/futures/automation-load";
import { paperLayerToRow, parsePaperRulesRow } from "@/lib/engine/rules";
import { writeEventLog } from "@/lib/logs/write";
import { setupDeskCanStartBots, type SetupDesk } from "@/lib/onboarding/model";
import { createServiceClient } from "@/lib/supabase/admin";
import type { AppliedDeskItem } from "@/lib/templates/apply";

/** Start a bot that setup just created, using the same arm or enable path as the desk. */
export async function startAppliedStarterBot(input: {
  userId: string;
  desk: SetupDesk;
  applied: AppliedDeskItem;
}): Promise<{ ok: true; detail: string } | { ok: false; error: string }> {
  if (!input.desk.accountId) {
    return { ok: false, error: "That desk was not created." };
  }
  if (!setupDeskCanStartBots(input.desk)) {
    return { ok: false, error: "Bind a key before this bot can start." };
  }
  if (input.applied.deskType === "dca") {
    const armed = await applyDcaVerb({
      playbook: input.applied.playbook,
      mode: input.desk.mode,
      verb: "arm",
      source: "manual",
    });
    if (!armed.ok) {
      return armed;
    }
    return { ok: true, detail: armed.message };
  }
  if (input.applied.deskType === "perps") {
    return enablePerpsRule({
      userId: input.userId,
      desk: input.desk,
      ruleId: input.applied.rule.id,
    });
  }
  return enableCarryLayer({
    userId: input.userId,
    desk: input.desk,
    layerId: input.applied.layer.id,
  });
}

async function enablePerpsRule(input: {
  userId: string;
  desk: SetupDesk;
  ruleId: string;
}): Promise<{ ok: true; detail: string } | { ok: false; error: string }> {
  const accountId = input.desk.accountId;
  if (!accountId || !input.ruleId) {
    return { ok: false, error: "Could not start that bot." };
  }
  const rule = await loadFuturesAutomationRuleById(accountId, input.ruleId);
  if (!rule) {
    return { ok: false, error: "Could not start that bot." };
  }
  const unsigned = await rejectUnsignedBybitSymbol({
    live: input.desk.mode === "live",
    venue: input.desk.venue,
    connectionId: input.desk.connectionId,
    symbol: rule.symbol,
    previousSymbol: rule.symbol,
    active: true,
  });
  if (unsigned) {
    return { ok: false, error: unsigned };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Could not start that bot." };
  }
  const saved = await upsertFuturesAutomationRules({
    supabase,
    userId: input.userId,
    accountId,
    rules: [{ ...rule, mode: "active" }],
  });
  if (!saved.ok) {
    return saved;
  }
  await writeEventLog({
    scope: "strategy",
    event: "automations.saved",
    message: `Enabled ${rule.name} from setup`,
    userId: input.userId,
    accountId,
    strategy: "futures",
    data: { ruleId: rule.id, mode: "active", source: "onboarding" },
  });
  return { ok: true, detail: "Enabled." };
}

async function enableCarryLayer(input: {
  userId: string;
  desk: SetupDesk;
  layerId: string;
}): Promise<{ ok: true; detail: string } | { ok: false; error: string }> {
  const accountId = input.desk.accountId;
  const id = Number(input.layerId);
  if (!accountId || !Number.isInteger(id)) {
    return { ok: false, error: "Could not start that bot." };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Could not start that bot." };
  }
  const { data, error } = await supabase
    .from("paper_rules")
    .select("*")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "Could not start that bot." };
  }
  const layer = parsePaperRulesRow(data as Record<string, unknown>, 0);
  const payload = paperLayerToRow(
    input.userId,
    { ...layer, mode: "active" },
    accountId,
  );
  const rest = Object.fromEntries(
    Object.entries(payload).filter(([key]) => key !== "sort_order"),
  );
  const updated = await supabase
    .from("paper_rules")
    .update(rest)
    .eq("id", id)
    .eq("account_id", accountId);
  if (updated.error) {
    return { ok: false, error: updated.error.message };
  }
  const settings = await supabase.from("paper_engine_settings").upsert({
    user_id: input.userId,
    account_id: accountId,
    enabled: true,
    updated_at: new Date().toISOString(),
  });
  if (settings.error) {
    return { ok: false, error: settings.error.message };
  }
  await writeEventLog({
    scope: "strategy",
    event: "automations.saved",
    message: `Enabled ${layer.name} from setup`,
    userId: input.userId,
    accountId,
    strategy: "cash-and-carry",
    data: { ruleId: id, mode: "active", source: "onboarding" },
  });
  return { ok: true, detail: "Enabled." };
}
