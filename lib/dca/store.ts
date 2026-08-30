import {
  dcaPlaybookConflict,
  dcaPlaybookIsRunning,
  parseDcaPlaybookRow,
  type DcaLegState,
  type DcaPlaybook,
  type DcaPlaybookConfig,
} from "./playbook";
import { createServiceClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FuturesSide } from "@/lib/futures/model";

function configColumns(config: DcaPlaybookConfig): Record<string, unknown> {
  return {
    name: config.name,
    symbol: config.symbol,
    direction: config.direction,
    start_kind: config.startKind,
    webhook_id: config.webhookId,
    dca_mode: config.dcaMode,
    clip_size: config.clipSize,
    size_unit: config.sizeUnit,
    max_clips: config.maxClips,
    max_value: config.maxValue,
    dip_pct: config.dipPct,
    interval_minutes: config.intervalMinutes,
    size_multiplier: config.sizeMultiplier,
    deviation_multiplier: config.deviationMultiplier,
    take_profit_pct: config.takeProfitPct,
    stop_loss_pct: config.stopLossPct,
    take_profit_basis: config.takeProfitBasis,
    stop_loss_basis: config.stopLossBasis,
    take_profit_order_type: config.takeProfitOrderType,
    stop_loss_order_type: config.stopLossOrderType,
    breakeven_activation_pct: config.breakevenActivationPct,
    breakeven_offset_pct: config.breakevenOffsetPct,
    trailing_trigger_pct: config.trailingTriggerPct,
    trailing_pct: config.trailingPct,
    arm_trigger_by: config.armTrigger?.triggerBy ?? null,
    arm_compare: config.armTrigger?.compare ?? null,
    arm_price: config.armTrigger?.price ?? null,
    disarm_trigger_by: config.disarmTrigger?.triggerBy ?? null,
    disarm_compare: config.disarmTrigger?.compare ?? null,
    disarm_price: config.disarmTrigger?.price ?? null,
    indicator_kind: config.indicatorKind,
    indicator_timeframe: config.indicatorTimeframe,
    indicator_compare: config.indicatorCompare,
    indicator_level: config.indicatorLevel,
  };
}

function idleLegColumns(prefix: "long" | "short"): Record<string, unknown> {
  return {
    [`${prefix}_status`]: "idle",
    [`${prefix}_clips_filled`]: 0,
    [`${prefix}_last_clip_price`]: null,
    [`${prefix}_last_clip_at`]: null,
    [`${prefix}_first_fill_price`]: null,
    [`${prefix}_breakeven_done`]: false,
  };
}

function legColumns(
  side: FuturesSide,
  patch: Partial<DcaLegState>,
): Record<string, unknown> {
  const prefix = side;
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) {
    row[`${prefix}_status`] = patch.status;
  }
  if (patch.clipsFilled !== undefined) {
    row[`${prefix}_clips_filled`] = patch.clipsFilled;
  }
  if (patch.lastClipPrice !== undefined) {
    row[`${prefix}_last_clip_price`] = patch.lastClipPrice;
  }
  if (patch.lastClipAtMs !== undefined) {
    row[`${prefix}_last_clip_at`] =
      patch.lastClipAtMs === null
        ? null
        : new Date(patch.lastClipAtMs).toISOString();
  }
  if (patch.firstFillPrice !== undefined) {
    row[`${prefix}_first_fill_price`] = patch.firstFillPrice;
  }
  if (patch.breakevenDone !== undefined) {
    row[`${prefix}_breakeven_done`] = patch.breakevenDone;
  }
  return row;
}

function saveError(error: { code?: string; message?: string } | null): string {
  if (error?.code === "23505") {
    return "A bot already covers that contract.";
  }
  return error?.message ?? "Could not save the bot.";
}

export async function listDcaPlaybooksForAccount(
  accountId: string,
  supabaseClient?: SupabaseClient,
): Promise<DcaPlaybook[]> {
  const supabase = supabaseClient ?? createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("dca_playbooks")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });
  if (error || !data) {
    return [];
  }
  return data
    .map((row) => parseDcaPlaybookRow(row as Record<string, unknown>))
    .filter((row): row is DcaPlaybook => Boolean(row));
}

export async function loadDcaPlaybookById(
  id: string,
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
    .eq("id", id)
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
  const { data, error } = await supabase
    .from("dca_playbooks")
    .select("*")
    .order("created_at", { ascending: true });
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
  id?: string | null;
}): Promise<{ ok: true; playbook: DcaPlaybook } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const existing = input.id
    ? await loadDcaPlaybookById(input.id, input.accountId, input.supabase)
    : null;
  if (input.id && !existing) {
    return { ok: false, error: "That bot was not found." };
  }
  const siblings = await listDcaPlaybooksForAccount(
    input.accountId,
    input.supabase,
  );
  if (
    dcaPlaybookConflict(siblings, {
      id: existing?.id,
      symbol: input.config.symbol,
    })
  ) {
    return {
      ok: false,
      error: "A bot already covers that contract.",
    };
  }
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
      return { ok: false, error: saveError(error) };
    }
    const playbook = parseDcaPlaybookRow(data as Record<string, unknown>);
    if (!playbook) {
      return { ok: false, error: "Could not save the bot." };
    }
    return { ok: true, playbook };
  }
  const { data, error } = await input.supabase
    .from("dca_playbooks")
    .insert({
      user_id: input.userId,
      account_id: input.accountId,
      ...configColumns(input.config),
      ...idleLegColumns("long"),
      ...idleLegColumns("short"),
      updated_at: now,
    })
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: saveError(error) };
  }
  const playbook = parseDcaPlaybookRow(data as Record<string, unknown>);
  if (!playbook) {
      return { ok: false, error: "Could not save the bot." };
  }
  return { ok: true, playbook };
}

export async function deleteDcaPlaybook(input: {
  supabase: SupabaseClient;
  id: string;
  accountId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await loadDcaPlaybookById(
    input.id,
    input.accountId,
    input.supabase,
  );
  if (!existing) {
    return { ok: false, error: "That bot was not found." };
  }
  if (dcaPlaybookIsRunning(existing)) {
    return {
      ok: false,
      error: "Stop adding or close this bot before removing it.",
    };
  }
  const { error } = await input.supabase
    .from("dca_playbooks")
    .delete()
    .eq("id", input.id)
    .eq("account_id", input.accountId);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export type DcaPlaybookPatch = {
  armConditionTrue?: boolean;
  disarmConditionTrue?: boolean;
  longIndicatorTrue?: boolean;
  shortIndicatorTrue?: boolean;
  long?: Partial<DcaLegState>;
  short?: Partial<DcaLegState>;
};

export async function patchDcaPlaybook(input: {
  supabase: SupabaseClient;
  id: string;
  patch: DcaPlaybookPatch;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row: Record<string, unknown> = {};
  if (input.patch.long || input.patch.short) {
    row.updated_at = new Date().toISOString();
  }
  if (input.patch.armConditionTrue !== undefined) {
    row.arm_condition_true = input.patch.armConditionTrue;
  }
  if (input.patch.disarmConditionTrue !== undefined) {
    row.disarm_condition_true = input.patch.disarmConditionTrue;
  }
  if (input.patch.longIndicatorTrue !== undefined) {
    row.long_indicator_true = input.patch.longIndicatorTrue;
  }
  if (input.patch.shortIndicatorTrue !== undefined) {
    row.short_indicator_true = input.patch.shortIndicatorTrue;
  }
  if (input.patch.long) {
    Object.assign(row, legColumns("long", input.patch.long));
  }
  if (input.patch.short) {
    Object.assign(row, legColumns("short", input.patch.short));
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

export async function patchDcaLeg(input: {
  supabase: SupabaseClient;
  id: string;
  side: FuturesSide;
  patch: Partial<DcaLegState>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return patchDcaPlaybook({
    supabase: input.supabase,
    id: input.id,
    patch: { [input.side]: input.patch },
  });
}

export async function resetDcaLeg(input: {
  supabase: SupabaseClient;
  id: string;
  side: FuturesSide;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return patchDcaLeg({
    supabase: input.supabase,
    id: input.id,
    side: input.side,
    patch: {
      status: "idle",
      clipsFilled: 0,
      lastClipPrice: null,
      lastClipAtMs: null,
      firstFillPrice: null,
      breakevenDone: false,
    },
  });
}

export async function resetDcaPlaybook(input: {
  supabase: SupabaseClient;
  id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return patchDcaPlaybook({
    supabase: input.supabase,
    id: input.id,
    patch: {
      armConditionTrue: false,
      disarmConditionTrue: false,
      longIndicatorTrue: false,
      shortIndicatorTrue: false,
      long: {
        status: "idle",
        clipsFilled: 0,
        lastClipPrice: null,
        lastClipAtMs: null,
        firstFillPrice: null,
        breakevenDone: false,
      },
      short: {
        status: "idle",
        clipsFilled: 0,
        lastClipPrice: null,
        lastClipAtMs: null,
        firstFillPrice: null,
        breakevenDone: false,
      },
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
    .or(
      "long_status.in.(armed,stop_adding),short_status.in.(armed,stop_adding)",
    )
    .limit(1);
  return (data ?? []).length > 0;
}
