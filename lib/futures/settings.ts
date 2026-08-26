import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { getSessionContext } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FuturesRiskCaps } from "./risk";

const SETTINGS_COLUMNS =
  "account_id, strategy_id, user_id, exchange_connection_id, reduce_only, max_qty_per_symbol, max_notional_per_symbol, max_open_rows";

export type FuturesSettings = {
  connectionId: string | null;
  reduceOnly: boolean;
} & FuturesRiskCaps;

const EMPTY_SETTINGS: FuturesSettings = {
  connectionId: null,
  reduceOnly: false,
  maxQtyPerSymbol: null,
  maxNotionalPerSymbol: null,
  maxOpenRows: null,
};

function asPositiveOrNull(raw: unknown): number | null {
  const value = Number(raw);
  return value > 0 && Number.isFinite(value) ? value : null;
}

function parseSettingsRow(row: Record<string, unknown>): FuturesSettings {
  const connectionId = String(row.exchange_connection_id ?? "").trim();
  const maxOpenRows = asPositiveOrNull(row.max_open_rows);
  return {
    connectionId: connectionId || null,
    reduceOnly: Boolean(row.reduce_only),
    maxQtyPerSymbol: asPositiveOrNull(row.max_qty_per_symbol),
    maxNotionalPerSymbol: asPositiveOrNull(row.max_notional_per_symbol),
    maxOpenRows:
      maxOpenRows !== null && Number.isInteger(maxOpenRows) ? maxOpenRows : null,
  };
}

export async function selectStrategySettings(
  supabase: SupabaseClient,
  filter: { accountId: string; strategyId?: string },
): Promise<Record<string, unknown> | null> {
  let query = supabase
    .from("strategy_settings")
    .select(SETTINGS_COLUMNS)
    .eq("account_id", filter.accountId);
  if (filter.strategyId) {
    query = query.eq("strategy_id", filter.strategyId);
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as Record<string, unknown>;
}

export async function loadFuturesSettings(
  accountId?: string,
): Promise<FuturesSettings> {
  try {
    const session = await getSessionContext();
    const supabase = createServiceClient();
    const id = accountId ?? session?.account.id;
    if (!supabase || !id || (!accountId && !session)) {
      return EMPTY_SETTINGS;
    }
    const row = await selectStrategySettings(supabase, {
      accountId: id,
      strategyId: FUTURES_STRATEGY_ID,
    });
    if (!row) {
      return EMPTY_SETTINGS;
    }
    return parseSettingsRow(row);
  } catch {
    return EMPTY_SETTINGS;
  }
}

export async function listFuturesConnectionIds(
  supabase: SupabaseClient,
  accountIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (accountIds.length === 0) {
    return out;
  }
  const { data } = await supabase
    .from("strategy_settings")
    .select("account_id, exchange_connection_id")
    .eq("strategy_id", FUTURES_STRATEGY_ID)
    .in("account_id", accountIds);
  for (const row of data ?? []) {
    const accountId = String((row as { account_id: string }).account_id);
    const connectionId = String(
      (row as { exchange_connection_id?: string }).exchange_connection_id ?? "",
    ).trim();
    if (accountId && connectionId) {
      out.set(accountId, connectionId);
    }
  }
  return out;
}
