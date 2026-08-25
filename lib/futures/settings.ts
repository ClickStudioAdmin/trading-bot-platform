import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { getSessionContext } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FuturesSettings = {
  connectionId: string | null;
  reduceOnly: boolean;
};

export async function selectStrategySettings(
  supabase: SupabaseClient,
  filter: { accountId: string; strategyId?: string },
): Promise<Record<string, unknown> | null> {
  let query = supabase
    .from("strategy_settings")
    .select(
      "account_id, strategy_id, user_id, exchange_connection_id, reduce_only",
    )
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
    if (!session || !supabase || !id) {
      return { connectionId: null, reduceOnly: false };
    }
    const row = await selectStrategySettings(supabase, {
      accountId: id,
      strategyId: FUTURES_STRATEGY_ID,
    });
    if (!row) {
      return { connectionId: null, reduceOnly: false };
    }
    const connectionId = String(row.exchange_connection_id ?? "").trim();
    return {
      connectionId: connectionId || null,
      reduceOnly: Boolean(row.reduce_only),
    };
  } catch {
    return { connectionId: null, reduceOnly: false };
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
