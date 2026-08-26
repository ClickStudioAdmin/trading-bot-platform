import {
  parseDcaPlaybookRow,
  type DcaPlaybook,
  type DcaPlaybookConfig,
  type DcaStatus,
} from "./playbook";
import { createServiceClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

function configColumns(config: DcaPlaybookConfig): Record<string, unknown> {
  return {
    name: config.name,
    symbol: config.symbol,
    side: config.side,
    clip_size: config.clipSize,
    size_unit: config.sizeUnit,
    max_clips: config.maxClips,
    max_value: config.maxValue,
    dip_pct: config.dipPct,
    interval_minutes: config.intervalMinutes,
    take_profit_pct: config.takeProfitPct,
    stop_loss_pct: config.stopLossPct,
    arm_trigger_by: config.armTrigger?.triggerBy ?? null,
    arm_compare: config.armTrigger?.compare ?? null,
    arm_price: config.armTrigger?.price ?? null,
    disarm_trigger_by: config.disarmTrigger?.triggerBy ?? null,
    disarm_compare: config.disarmTrigger?.compare ?? null,
    disarm_price: config.disarmTrigger?.price ?? null,
  };
}

export async function loadDcaPlaybook(
  accountId: string,
  supabaseClient?: SupabaseClient,
): Promise<DcaPlaybook | null> {
  const supabase = supabaseClient ?? createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("dca_playbooks")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return parseDcaPlaybookRow(data as Record<string, unknown>);
}

export async function listDcaPlaybooks(
  supabaseClient?: SupabaseClient,
): Promise<DcaPlaybook[]> {
  const supabase = supabaseClient ?? createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase.from("dca_playbooks").select("*");
  if (error || !data) {
    return [];
  }
  return data
    .map((row) => parseDcaPlaybookRow(row as Record<string, unknown>))
    .filter((row): row is DcaPlaybook => Boolean(row));
}

export async function saveDcaPlaybook(input: {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  config: DcaPlaybookConfig;
}): Promise<{ ok: true; playbook: DcaPlaybook } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const existing = await loadDcaPlaybook(input.accountId, input.supabase);
  if (existing) {
    const { data, error } = await input.supabase
      .from("dca_playbooks")
      .update({
        ...configColumns(input.config),
        updated_at: now,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Could not save the playbook." };
    }
    const playbook = parseDcaPlaybookRow(data as Record<string, unknown>);
    if (!playbook) {
      return { ok: false, error: "Could not save the playbook." };
    }
    return { ok: true, playbook };
  }
  const { data, error } = await input.supabase
    .from("dca_playbooks")
    .insert({
      user_id: input.userId,
      account_id: input.accountId,
      ...configColumns(input.config),
      status: "idle",
      clips_filled: 0,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save the playbook." };
  }
  const playbook = parseDcaPlaybookRow(data as Record<string, unknown>);
  if (!playbook) {
    return { ok: false, error: "Could not save the playbook." };
  }
  return { ok: true, playbook };
}

export async function patchDcaPlaybook(input: {
  supabase: SupabaseClient;
  id: string;
  patch: {
    status?: DcaStatus;
    clipsFilled?: number;
    lastClipPrice?: number | null;
    lastClipAtMs?: number | null;
    armConditionTrue?: boolean;
    disarmConditionTrue?: boolean;
  };
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.patch.status !== undefined) {
    row.status = input.patch.status;
  }
  if (input.patch.clipsFilled !== undefined) {
    row.clips_filled = input.patch.clipsFilled;
  }
  if (input.patch.lastClipPrice !== undefined) {
    row.last_clip_price = input.patch.lastClipPrice;
  }
  if (input.patch.lastClipAtMs !== undefined) {
    row.last_clip_at =
      input.patch.lastClipAtMs === null
        ? null
        : new Date(input.patch.lastClipAtMs).toISOString();
  }
  if (input.patch.armConditionTrue !== undefined) {
    row.arm_condition_true = input.patch.armConditionTrue;
  }
  if (input.patch.disarmConditionTrue !== undefined) {
    row.disarm_condition_true = input.patch.disarmConditionTrue;
  }
  const { error } = await input.supabase
    .from("dca_playbooks")
    .update(row)
    .eq("id", input.id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function resetDcaPlaybook(input: {
  supabase: SupabaseClient;
  id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return patchDcaPlaybook({
    supabase: input.supabase,
    id: input.id,
    patch: {
      status: "idle",
      clipsFilled: 0,
      lastClipPrice: null,
      lastClipAtMs: null,
      armConditionTrue: false,
      disarmConditionTrue: false,
    },
  });
}

export async function dcaPlaybooksAreRunning(
  accountId: string,
): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) {
    return false;
  }
  const { data } = await supabase
    .from("dca_playbooks")
    .select("id")
    .eq("account_id", accountId)
    .in("status", ["armed", "stop_adding"])
    .limit(1);
  return (data ?? []).length > 0;
}
