import { createServiceClient } from "@/lib/supabase/admin";
import type { DeskCopySettings } from "./model";

const EMPTY_SETTINGS = {
  scale: 1,
  paused: false,
  maxDailyLossUsdt: null,
  maxOpenNotionalUsdt: null,
} as const;

function asPositiveOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseSettingsRow(
  accountId: string,
  row: Record<string, unknown> | null,
): DeskCopySettings {
  if (!row) {
    return { accountId, ...EMPTY_SETTINGS };
  }
  const scale = Number(row.scale);
  return {
    accountId,
    scale: Number.isFinite(scale) && scale > 0 && scale <= 1 ? scale : 1,
    paused: row.paused === true,
    maxDailyLossUsdt: asPositiveOrNull(row.max_daily_loss_usdt),
    maxOpenNotionalUsdt: asPositiveOrNull(row.max_open_notional_usdt),
  };
}

export async function loadDeskCopySettings(
  accountId: string,
): Promise<DeskCopySettings> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { accountId, ...EMPTY_SETTINGS };
  }
  const { data, error } = await supabase
    .from("desk_copy_settings")
    .select(
      "account_id, scale, paused, max_daily_loss_usdt, max_open_notional_usdt",
    )
    .eq("account_id", accountId)
    .maybeSingle();
  if (error || !data) {
    return { accountId, ...EMPTY_SETTINGS };
  }
  return parseSettingsRow(accountId, data as Record<string, unknown>);
}

export async function saveDeskCopySettings(input: {
  accountId: string;
  scale?: number;
  paused?: boolean;
  maxDailyLossUsdt?: number | null;
  maxOpenNotionalUsdt?: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const current = await loadDeskCopySettings(input.accountId);
  const now = new Date().toISOString();
  const { error } = await supabase.from("desk_copy_settings").upsert(
    {
      account_id: input.accountId,
      scale: input.scale ?? current.scale,
      paused: input.paused ?? current.paused,
      max_daily_loss_usdt:
        input.maxDailyLossUsdt === undefined
          ? current.maxDailyLossUsdt
          : input.maxDailyLossUsdt,
      max_open_notional_usdt:
        input.maxOpenNotionalUsdt === undefined
          ? current.maxOpenNotionalUsdt
          : input.maxOpenNotionalUsdt,
      updated_at: now,
    },
    { onConflict: "account_id" },
  );
  if (error) {
    return { ok: false, error: "Could not save copy settings." };
  }
  return { ok: true };
}
