import { createServiceClient } from "@/lib/supabase/admin";
import {
  parseCopySizeMode,
  type CopySizeMode,
  type DeskCopySettings,
} from "./model";

const EMPTY_SETTINGS = {
  scale: 1,
  sizeMode: "balance" as CopySizeMode,
  sizePercent: null,
  sizeBookUsdt: null,
  paused: false,
  maxDailyLossUsdt: null,
  maxOpenNotionalUsdt: null,
  maxDrawdownPct: null,
  maxAdverseMovePct: null,
  equityPeakUsdt: null,
};

function asPositiveOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function asPercentOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 100 ? parsed : null;
}

function parseSettingsRow(
  accountId: string,
  row: Record<string, unknown> | null,
): DeskCopySettings {
  if (!row) {
    return { accountId, ...EMPTY_SETTINGS };
  }
  const scale = Number(row.scale);
  const sizeMode = parseCopySizeMode(row.size_mode);
  return {
    accountId,
    scale: Number.isFinite(scale) && scale > 0 && scale <= 1 ? scale : 1,
    sizeMode,
    sizePercent:
      sizeMode === "percent" ? asPositiveOrNull(row.size_percent) : null,
    sizeBookUsdt:
      sizeMode === "fixed" ? asPositiveOrNull(row.size_book_usdt) : null,
    paused: row.paused === true,
    maxDailyLossUsdt: asPositiveOrNull(row.max_daily_loss_usdt),
    maxOpenNotionalUsdt: asPositiveOrNull(row.max_open_notional_usdt),
    maxDrawdownPct: asPercentOrNull(row.max_drawdown_pct),
    maxAdverseMovePct: asPercentOrNull(row.max_adverse_move_pct),
    equityPeakUsdt: asPositiveOrNull(row.equity_peak_usdt),
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
      "account_id, scale, size_mode, size_percent, size_book_usdt, paused, max_daily_loss_usdt, max_open_notional_usdt, max_drawdown_pct, max_adverse_move_pct, equity_peak_usdt",
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
  sizeMode?: CopySizeMode;
  sizePercent?: number | null;
  sizeBookUsdt?: number | null;
  paused?: boolean;
  maxDailyLossUsdt?: number | null;
  maxOpenNotionalUsdt?: number | null;
  maxDrawdownPct?: number | null;
  maxAdverseMovePct?: number | null;
  equityPeakUsdt?: number | null;
  resetEquityPeak?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const current = await loadDeskCopySettings(input.accountId);
  const sizeMode = input.sizeMode ?? current.sizeMode;
  const now = new Date().toISOString();
  const { error } = await supabase.from("desk_copy_settings").upsert(
    {
      account_id: input.accountId,
      scale: input.scale ?? current.scale,
      size_mode: sizeMode,
      size_percent:
        sizeMode === "percent"
          ? (input.sizePercent === undefined
              ? current.sizePercent
              : input.sizePercent)
          : null,
      size_book_usdt:
        sizeMode === "fixed"
          ? (input.sizeBookUsdt === undefined
              ? current.sizeBookUsdt
              : input.sizeBookUsdt)
          : null,
      paused: input.paused ?? current.paused,
      max_daily_loss_usdt:
        input.maxDailyLossUsdt === undefined
          ? current.maxDailyLossUsdt
          : input.maxDailyLossUsdt,
      max_open_notional_usdt:
        input.maxOpenNotionalUsdt === undefined
          ? current.maxOpenNotionalUsdt
          : input.maxOpenNotionalUsdt,
      max_drawdown_pct:
        input.maxDrawdownPct === undefined
          ? current.maxDrawdownPct
          : input.maxDrawdownPct,
      max_adverse_move_pct:
        input.maxAdverseMovePct === undefined
          ? current.maxAdverseMovePct
          : input.maxAdverseMovePct,
      equity_peak_usdt: input.resetEquityPeak
        ? null
        : input.equityPeakUsdt === undefined
          ? current.equityPeakUsdt
          : input.equityPeakUsdt,
      updated_at: now,
    },
    { onConflict: "account_id" },
  );
  if (error) {
    return { ok: false, error: "Could not save copy settings." };
  }
  return { ok: true };
}
