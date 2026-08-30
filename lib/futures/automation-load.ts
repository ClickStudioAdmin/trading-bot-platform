import {
  blockedFuturesRuleDeletes,
  FUTURES_RULE_IN_USE,
  futuresAutomationToRow,
  parseFuturesAutomationRow,
  type FuturesAutomationRule,
} from "./automation";
import { getSessionContext } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadFuturesAutomationRules(
  accountId?: string,
): Promise<FuturesAutomationRule[]> {
  const session = await getSessionContext();
  const supabase = createServiceClient();
  const id = accountId ?? session?.account.id;
  if (!supabase || !id || (!accountId && !session)) {
    return [];
  }
  const { data, error } = await supabase
    .from("futures_automation_rules")
    .select("*")
    .eq("account_id", id)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error || !data) {
    return [];
  }
  return data.map((row) =>
    parseFuturesAutomationRow(row as Record<string, unknown>),
  );
}

export async function listFuturesAutomationRuleIdsInUse(
  accountId: string,
  supabaseClient?: SupabaseClient,
): Promise<string[]> {
  const supabase = supabaseClient ?? createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data } = await supabase
    .from("futures_positions")
    .select("rule_id")
    .eq("account_id", accountId)
    .eq("status", "open")
    .not("rule_id", "is", null);
  return [
    ...new Set(
      (data ?? [])
        .map((row) => String((row as { rule_id?: unknown }).rule_id ?? "").trim())
        .filter(Boolean),
    ),
  ];
}

export async function futuresAutomationsAreRunning(
  accountId: string,
): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) {
    return false;
  }
  const { data } = await supabase
    .from("futures_automation_rules")
    .select("id")
    .eq("account_id", accountId)
    .neq("mode", "disabled")
    .limit(1);
  return (data ?? []).length > 0;
}

export async function saveFuturesAutomationRules(input: {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  rules: FuturesAutomationRule[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing, error: loadError } = await input.supabase
    .from("futures_automation_rules")
    .select("id")
    .eq("account_id", input.accountId);
  if (loadError) {
    return { ok: false, error: loadError.message };
  }
  const keep = new Set(
    input.rules.map((rule) => rule.id).filter((id): id is string => Boolean(id)),
  );
  const stale = (existing ?? [])
    .map((row) => String((row as { id: string }).id))
    .filter((id) => !keep.has(id));
  if (stale.length > 0) {
    const inUse = await listFuturesAutomationRuleIdsInUse(
      input.accountId,
      input.supabase,
    );
    const blocked = blockedFuturesRuleDeletes(stale, inUse);
    if (blocked.length > 0) {
      return { ok: false, error: FUTURES_RULE_IN_USE };
    }
    const { error } = await input.supabase
      .from("futures_automation_rules")
      .delete()
      .eq("account_id", input.accountId)
      .in("id", stale);
    if (error) {
      return { ok: false, error: error.message };
    }
  }
  for (const rule of input.rules) {
    const row = futuresAutomationToRow(input.userId, input.accountId, rule);
    if (rule.id) {
      const { error } = await input.supabase
        .from("futures_automation_rules")
        .update(row)
        .eq("id", rule.id)
        .eq("account_id", input.accountId);
      if (error) {
        return { ok: false, error: error.message };
      }
    } else {
      const { error } = await input.supabase
        .from("futures_automation_rules")
        .insert(row);
      if (error) {
        return { ok: false, error: error.message };
      }
    }
  }
  return { ok: true };
}
