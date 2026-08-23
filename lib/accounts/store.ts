import {
  parseTradingAccountRow,
  type TradingAccount,
  type TradingAccountMode,
} from "@/lib/accounts/model";
import { createServiceClient } from "@/lib/supabase/admin";

export async function listTradingAccounts(
  userId: string,
): Promise<TradingAccount[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("trading_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error || !data) {
    return [];
  }
  return data.map((row) =>
    parseTradingAccountRow(row as Record<string, unknown>),
  );
}

export async function ensureDefaultPaperAccount(
  userId: string,
): Promise<TradingAccount | null> {
  const existing = await listTradingAccounts(userId);
  const paper = existing.find((account) => account.mode === "paper");
  if (paper) {
    return paper;
  }
  if (existing[0]) {
    return existing[0];
  }
  return insertTradingAccount(userId, "Paper", "paper");
}

export async function insertTradingAccount(
  userId: string,
  name: string,
  mode: TradingAccountMode,
): Promise<TradingAccount | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("trading_accounts")
    .insert({
      user_id: userId,
      name,
      mode,
    })
    .select("*")
    .single();
  if (error || !data) {
    return null;
  }
  const account = parseTradingAccountRow(data as Record<string, unknown>);
  await supabase.from("paper_engine_settings").insert({
    user_id: userId,
    account_id: account.id,
    enabled: false,
  });
  return account;
}

export async function otherPaperAccountsRunning(
  userId: string,
  currentAccountId: string,
): Promise<TradingAccount[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const accounts = (await listTradingAccounts(userId)).filter(
    (account) =>
      account.id !== currentAccountId && account.mode === "paper",
  );
  if (accounts.length === 0) {
    return [];
  }
  const ids = accounts.map((account) => account.id);
  const [{ data: settings }, { data: rules }] = await Promise.all([
    supabase
      .from("paper_engine_settings")
      .select("account_id, enabled")
      .in("account_id", ids),
    supabase.from("paper_rules").select("account_id").in("account_id", ids),
  ]);
  const enabled = new Set(
    (settings ?? [])
      .filter((row) => Boolean((row as { enabled?: unknown }).enabled))
      .map((row) => String((row as { account_id: string }).account_id)),
  );
  const withRules = new Set(
    (rules ?? []).map((row) => String((row as { account_id: string }).account_id)),
  );
  return accounts.filter(
    (account) => enabled.has(account.id) && withRules.has(account.id),
  );
}
