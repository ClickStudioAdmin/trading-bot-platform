import {
  accountDeleteBlockers,
  DEFAULT_ACCOUNT_NAME,
  parseTradingAccountRow,
  type AccountDeleteBlock,
  type TradingAccount,
  type TradingAccountMode,
} from "@/lib/accounts/model";
import { memberDisplayName } from "@/lib/members/sync";
import { createServiceClient } from "@/lib/supabase/admin";

export type TradingAccountOption = TradingAccount & {
  ownerName: string;
};

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

export async function listAllTradingAccounts(): Promise<TradingAccountOption[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("trading_accounts")
    .select("*")
    .order("created_at", { ascending: true });
  if (error || !data) {
    return [];
  }
  const accounts = data.map((row) =>
    parseTradingAccountRow(row as Record<string, unknown>),
  );
  const userIds = [...new Set(accounts.map((account) => account.userId))];
  const owners = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("user_id, name, email")
      .in("user_id", userIds);
    for (const row of members ?? []) {
      const id = String((row as { user_id: string }).user_id);
      owners.set(
        id,
        memberDisplayName(
          String((row as { email: string }).email),
          String((row as { name?: string }).name ?? ""),
        ),
      );
    }
  }
  return accounts.map((account) => ({
    ...account,
    ownerName: owners.get(account.userId) ?? "Member",
  }));
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
  return insertTradingAccount(userId, DEFAULT_ACCOUNT_NAME, "paper");
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

export type AccountUsage = {
  openCount: number;
  automationsRunning: boolean;
  blocks: AccountDeleteBlock[];
};

export async function loadAccountUsage(
  accounts: TradingAccount[],
): Promise<Map<string, AccountUsage>> {
  const accountCount = accounts.length;
  const usage = new Map<string, AccountUsage>();
  for (const account of accounts) {
    usage.set(account.id, {
      openCount: 0,
      automationsRunning: false,
      blocks: accountDeleteBlockers({
        accountCount,
        openCount: 0,
        automationsRunning: false,
        mode: account.mode,
      }),
    });
  }
  if (accounts.length === 0) {
    return usage;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return usage;
  }
  const accountIds = accounts.map((account) => account.id);
  const [{ data: openRows }, { data: settings }, { data: rules }] =
    await Promise.all([
      supabase
        .from("paper_carries")
        .select("account_id")
        .in("account_id", accountIds)
        .in("status", ["open", "closing"]),
      supabase
        .from("paper_engine_settings")
        .select("account_id, enabled")
        .in("account_id", accountIds),
      supabase.from("paper_rules").select("account_id").in("account_id", accountIds),
    ]);
  const openCount = new Map<string, number>();
  for (const row of openRows ?? []) {
    const id = String((row as { account_id: string }).account_id);
    openCount.set(id, (openCount.get(id) ?? 0) + 1);
  }
  const enabled = new Set(
    (settings ?? [])
      .filter((row) => Boolean((row as { enabled?: unknown }).enabled))
      .map((row) => String((row as { account_id: string }).account_id)),
  );
  const withRules = new Set(
    (rules ?? []).map((row) => String((row as { account_id: string }).account_id)),
  );
  for (const account of accounts) {
    const opens = openCount.get(account.id) ?? 0;
    const automationsRunning =
      enabled.has(account.id) && withRules.has(account.id);
    usage.set(account.id, {
      openCount: opens,
      automationsRunning,
      blocks: accountDeleteBlockers({
        accountCount,
        openCount: opens,
        automationsRunning,
        mode: account.mode,
      }),
    });
  }
  return usage;
}

export async function deleteTradingAccountRow(
  userId: string,
  accountId: string,
): Promise<{ error: string | null }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { error: "Auth is not configured." };
  }
  const accounts = await listTradingAccounts(userId);
  const target = accounts.find((account) => account.id === accountId);
  if (!target) {
    return { error: "That account was not found." };
  }
  const usage = await loadAccountUsage(accounts);
  const blocks = usage.get(accountId)?.blocks ?? ["last"];
  if (blocks.length > 0) {
    return {
      error:
        blocks[0] === "last"
          ? "Keep at least one account."
          : blocks[0] === "open"
            ? "Close or flatten open positions first."
            : "Turn off automations first.",
    };
  }
  const { error: orderError } = await supabase
    .from("paper_orders")
    .delete()
    .eq("account_id", accountId)
    .eq("user_id", userId);
  if (orderError) {
    return { error: orderError.message };
  }
  const { error: carryError } = await supabase
    .from("paper_carries")
    .delete()
    .eq("account_id", accountId)
    .eq("user_id", userId);
  if (carryError) {
    return { error: carryError.message };
  }
  const { error: ruleError } = await supabase
    .from("paper_rules")
    .delete()
    .eq("account_id", accountId)
    .eq("user_id", userId);
  if (ruleError) {
    return { error: ruleError.message };
  }
  const { error: settingsError } = await supabase
    .from("paper_engine_settings")
    .delete()
    .eq("account_id", accountId)
    .eq("user_id", userId);
  if (settingsError) {
    return { error: settingsError.message };
  }
  const { error } = await supabase
    .from("trading_accounts")
    .delete()
    .eq("id", accountId)
    .eq("user_id", userId);
  return { error: error?.message ?? null };
}
