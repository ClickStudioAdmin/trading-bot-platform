import {
  accountDeleteBlockers,
  DEFAULT_ACCOUNT_NAME,
  DESK_NAME_TAKEN,
  formatDeleteBlockers,
  parseTradingAccountRow,
  type AccountDeleteBlock,
  type DeskType,
  type TradingAccount,
  type TradingAccountMode,
} from "@/lib/accounts/model";
import { memberDisplayName } from "@/lib/members/sync";
import { dcaLegStatusesOn } from "@/lib/accounts/desk-list";
import { countArmedRules } from "@/lib/accounts/overview";
import { selectPaperEngineSettings } from "@/lib/engine/settings";
import {
  connectionFitsDesk,
  parseStoredVenueEnvironment,
} from "@/lib/exchanges/venues";
import { exclusiveConnectionBindError } from "@/lib/exchanges/connections";
import {
  listConnectionDeskBinds,
  listExchangeConnections,
} from "@/lib/exchanges/store";
import { listFuturesConnectionIds } from "@/lib/futures/settings";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { devResetDeskOrder } from "@/lib/onboarding/model";
import { createServiceClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

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

export async function loadTradingAccountById(
  id: string,
): Promise<TradingAccount | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("trading_accounts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return parseTradingAccountRow(data as Record<string, unknown>);
}

/** Legacy helper. New members land on Overview and create a desk when they want. */
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
  return insertTradingAccount(
    userId,
    DEFAULT_ACCOUNT_NAME,
    "paper",
    "cash_and_carry",
  );
}

export async function insertTradingAccount(
  userId: string,
  name: string,
  mode: TradingAccountMode,
  deskType: DeskType,
  options: {
    venue?: string;
    venueEnvironment?: string | null;
    copyOfAccountId?: string | null;
  } = {},
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
      desk_type: deskType,
      venue: options.venue ?? "bybit",
      venue_environment: options.venueEnvironment ?? null,
      copy_of_account_id: options.copyOfAccountId ?? null,
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

export async function applyDeskBindRules(input: {
  userId: string;
  account: {
    id: string;
    venue: string;
    venueEnvironment: string | null;
  };
  connectionId: string;
}): Promise<{ error: string | null }> {
  const connections = await listExchangeConnections(input.userId);
  const match = connections.find((item) => item.id === input.connectionId);
  if (!match) {
    return { error: "Pick an exchange key saved on this login." };
  }
  const fit = connectionFitsDesk({
    deskVenue: input.account.venue,
    deskEnvironment: input.account.venueEnvironment,
    connectionVenue: match.venue,
    connectionEnvironment: match.environment,
  });
  if (!fit.ok) {
    return { error: fit.error };
  }
  const taken = exclusiveConnectionBindError({
    connectionId: input.connectionId,
    currentAccountId: input.account.id,
    binds: await listConnectionDeskBinds(input.userId),
  });
  if (taken) {
    return { error: taken };
  }
  if (input.account.venueEnvironment || match.status !== "active") {
    return { error: null };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { error: "Auth is not configured." };
  }
  const locked = parseStoredVenueEnvironment(
    input.account.venue,
    match.environment,
  );
  if (!locked) {
    return { error: null };
  }
  const { error } = await supabase
    .from("trading_accounts")
    .update({ venue_environment: locked })
    .eq("id", input.account.id)
    .eq("user_id", input.userId)
    .is("venue_environment", null);
  return { error: error?.message ?? null };
}

export async function bindConnectionToDesk(input: {
  userId: string;
  accountId: string;
  deskType: DeskType;
  connectionId: string;
  venue?: string;
  venueEnvironment?: string | null;
}): Promise<{ error: string | null }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { error: "Auth is not configured." };
  }
  const bound = await applyDeskBindRules({
    userId: input.userId,
    account: {
      id: input.accountId,
      venue: input.venue ?? "bybit",
      venueEnvironment: input.venueEnvironment ?? null,
    },
    connectionId: input.connectionId,
  });
  if (bound.error) {
    return bound;
  }
  const now = new Date().toISOString();
  if (input.deskType === "cash_and_carry") {
    const { error } = await supabase.from("paper_engine_settings").upsert(
      {
        user_id: input.userId,
        account_id: input.accountId,
        exchange_connection_id: input.connectionId,
        updated_at: now,
      },
      { onConflict: "account_id" },
    );
    return { error: error?.message ?? null };
  }
  const { error } = await supabase.from("strategy_settings").upsert(
    {
      user_id: input.userId,
      account_id: input.accountId,
      strategy_id: FUTURES_STRATEGY_ID,
      exchange_connection_id: input.connectionId,
      updated_at: now,
    },
    { onConflict: "account_id,strategy_id" },
  );
  return { error: error?.message ?? null };
}

export type AccountUsage = {
  openCount: number;
  carryOpenCount: number;
  futuresOpenCount: number;
  workingCount: number;
  /** Every saved bot, including ones that are off. */
  botCount: number;
  /** Armed rules, plus DCA playbooks with a leg armed or stop-adding. */
  botsOn: number;
  automationsRunning: boolean;
  reduceOnly: boolean;
  strategyConnectionId: string | null;
  futuresConnectionId: string | null;
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
      carryOpenCount: 0,
      futuresOpenCount: 0,
      workingCount: 0,
      botCount: 0,
      botsOn: 0,
      automationsRunning: false,
      reduceOnly: false,
      strategyConnectionId: null,
      futuresConnectionId: null,
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
  const [{ data: openRows }, { data: futuresOpenRows }, { data: futuresWorkingRows }, settings, ruleRows, futuresRuleRows, futuresBinds, dcaRows] =
    await Promise.all([
    supabase
      .from("paper_carries")
      .select("account_id")
      .in("account_id", accountIds)
      .in("status", ["open", "closing"]),
    supabase
      .from("futures_positions")
      .select("account_id")
      .in("account_id", accountIds)
      .in("status", ["open", "closing"]),
    supabase
      .from("futures_working_orders")
      .select("account_id")
      .in("account_id", accountIds)
      .in("status", ["open", "cancelling"]),
    selectPaperEngineSettings(supabase, { accountIds }),
    selectPaperRuleModes(supabase, accountIds),
    selectFuturesAutomationModes(supabase, accountIds),
    listFuturesConnectionIds(supabase, accountIds),
    supabase
      .from("dca_playbooks")
      .select("account_id, long_status, short_status")
      .in("account_id", accountIds),
  ]);
  const carryOpenCount = new Map<string, number>();
  const futuresOpenCount = new Map<string, number>();
  const workingCount = new Map<string, number>();
  for (const row of openRows ?? []) {
    const id = String((row as { account_id: string }).account_id);
    carryOpenCount.set(id, (carryOpenCount.get(id) ?? 0) + 1);
  }
  for (const row of futuresOpenRows ?? []) {
    const id = String((row as { account_id: string }).account_id);
    futuresOpenCount.set(id, (futuresOpenCount.get(id) ?? 0) + 1);
  }
  for (const row of futuresWorkingRows ?? []) {
    const id = String((row as { account_id: string }).account_id);
    workingCount.set(id, (workingCount.get(id) ?? 0) + 1);
  }
  const reduceOnlyIds = new Set(
    settings
      .filter((row) => Boolean(row.reduce_only))
      .map((row) => String(row.account_id)),
  );
  const ruleModes = new Map<string, unknown[]>();
  function pushRuleMode(row: Record<string, unknown>) {
    const id = String(row.account_id ?? "");
    if (!id) {
      return;
    }
    const modes = ruleModes.get(id) ?? [];
    modes.push(row.mode);
    ruleModes.set(id, modes);
  }
  for (const row of ruleRows) {
    pushRuleMode(row);
  }
  for (const row of futuresRuleRows) {
    pushRuleMode(row);
  }
  const dcaBotCount = new Map<string, number>();
  const dcaBotsOn = new Map<string, number>();
  for (const row of dcaRows.data ?? []) {
    const typed = row as {
      account_id?: string;
      long_status?: string;
      short_status?: string;
    };
    const id = String(typed.account_id ?? "");
    if (!id) {
      continue;
    }
    dcaBotCount.set(id, (dcaBotCount.get(id) ?? 0) + 1);
    if (dcaLegStatusesOn(typed.long_status, typed.short_status)) {
      dcaBotsOn.set(id, (dcaBotsOn.get(id) ?? 0) + 1);
    }
  }
  const connectionByAccount = new Map<string, string>();
  for (const row of settings) {
    const accountId = String(row.account_id ?? "");
    const connectionId = String(row.exchange_connection_id ?? "").trim();
    if (accountId && connectionId) {
      connectionByAccount.set(accountId, connectionId);
    }
  }
  for (const account of accounts) {
    const carries = carryOpenCount.get(account.id) ?? 0;
    const futures = futuresOpenCount.get(account.id) ?? 0;
    const working = workingCount.get(account.id) ?? 0;
    const opens = carries + futures;
    const rules = ruleModes.get(account.id) ?? [];
    const botsOn = countArmedRules(rules) + (dcaBotsOn.get(account.id) ?? 0);
    const botCount = rules.length + (dcaBotCount.get(account.id) ?? 0);
    const automationsRunning = botsOn > 0;
    const reduceOnly = reduceOnlyIds.has(account.id);
    usage.set(account.id, {
      openCount: opens,
      carryOpenCount: carries,
      futuresOpenCount: futures,
      workingCount: working,
      botCount,
      botsOn,
      automationsRunning,
      reduceOnly,
      strategyConnectionId: connectionByAccount.get(account.id) ?? null,
      futuresConnectionId: futuresBinds.get(account.id) ?? null,
      blocks: accountDeleteBlockers({
        accountCount,
        openCount: opens + working,
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
    return { error: `${formatDeleteBlockers(blocks)}.` };
  }
  return teardownTradingAccount(supabase, userId, accountId);
}

/** Removes every desk on the login, including the last one and any open rows. */
export async function teardownAllTradingAccounts(
  userId: string,
): Promise<{ error: string | null }> {
  const accounts = await listTradingAccounts(userId);
  return teardownTradingAccountsById(
    userId,
    accounts.map((account) => account.id),
  );
}

/** Removes these desks on the login, including the last one and any open rows. */
export async function teardownTradingAccountsById(
  userId: string,
  accountIds: readonly string[],
): Promise<{ error: string | null }> {
  if (accountIds.length === 0) {
    return { error: null };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { error: "Auth is not configured." };
  }
  const wanted = new Set(accountIds);
  const accounts = await listTradingAccounts(userId);
  for (const account of devResetDeskOrder(
    accounts.filter((row) => wanted.has(row.id)),
  )) {
    const removed = await teardownTradingAccount(supabase, userId, account.id);
    if (removed.error) {
      return removed;
    }
  }
  return { error: null };
}

async function teardownTradingAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<{ error: string | null }> {
  const { error: receiptError } = await supabase
    .from("futures_command_receipts")
    .delete()
    .eq("account_id", accountId)
    .eq("user_id", userId);
  if (receiptError) {
    return { error: receiptError.message };
  }
  const { error: unbindError } = await supabase
    .from("paper_engine_settings")
    .update({ exchange_connection_id: null, updated_at: new Date().toISOString() })
    .eq("account_id", accountId)
    .eq("user_id", userId);
  if (unbindError) {
    return { error: unbindError.message };
  }
  const { error: futuresUnbindError } = await supabase
    .from("strategy_settings")
    .update({ exchange_connection_id: null, updated_at: new Date().toISOString() })
    .eq("account_id", accountId)
    .eq("user_id", userId);
  if (futuresUnbindError) {
    return { error: futuresUnbindError.message };
  }
  const { error: futuresWorkingError } = await supabase
    .from("futures_working_orders")
    .delete()
    .eq("account_id", accountId)
    .eq("user_id", userId);
  if (futuresWorkingError) {
    return { error: futuresWorkingError.message };
  }
  const { error: futuresOrderError } = await supabase
    .from("futures_orders")
    .delete()
    .eq("account_id", accountId)
    .eq("user_id", userId);
  if (futuresOrderError) {
    return { error: futuresOrderError.message };
  }
  const { error: futuresPositionError } = await supabase
    .from("futures_positions")
    .delete()
    .eq("account_id", accountId)
    .eq("user_id", userId);
  if (futuresPositionError) {
    return { error: futuresPositionError.message };
  }
  const { error: futuresRuleError } = await supabase
    .from("futures_automation_rules")
    .delete()
    .eq("account_id", accountId)
    .eq("user_id", userId);
  if (futuresRuleError) {
    return { error: futuresRuleError.message };
  }
  const { error: strategySettingsError } = await supabase
    .from("strategy_settings")
    .delete()
    .eq("account_id", accountId)
    .eq("user_id", userId);
  if (strategySettingsError) {
    return { error: strategySettingsError.message };
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

export async function renameTradingAccountRow(
  userId: string,
  accountId: string,
  name: string,
): Promise<{ error: string | null }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { error: "Auth is not configured." };
  }
  const { error } = await supabase
    .from("trading_accounts")
    .update({ name })
    .eq("id", accountId)
    .eq("user_id", userId);
  if (error?.code === "23505") {
    return { error: DESK_NAME_TAKEN };
  }
  return { error: error?.message ?? null };
}

async function selectFuturesAutomationModes(
  supabase: SupabaseClient,
  accountIds: string[],
): Promise<Record<string, unknown>[]> {
  const result = await supabase
    .from("futures_automation_rules")
    .select("account_id, mode")
    .in("account_id", accountIds);
  if (result.error) {
    return [];
  }
  return (result.data ?? []) as unknown as Record<string, unknown>[];
}

async function selectPaperRuleModes(
  supabase: SupabaseClient,
  accountIds: string[],
): Promise<Record<string, unknown>[]> {
  const full = await supabase
    .from("paper_rules")
    .select("account_id, mode")
    .in("account_id", accountIds);
  if (!full.error) {
    return (full.data ?? []) as unknown as Record<string, unknown>[];
  }
  const fallback = await supabase
    .from("paper_rules")
    .select("account_id")
    .in("account_id", accountIds);
  return (fallback.data ?? []) as unknown as Record<string, unknown>[];
}
