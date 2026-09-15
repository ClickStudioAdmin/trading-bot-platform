import type { TradingAccount } from "@/lib/accounts/model";
import { loadTradingAccountById as loadDesk } from "@/lib/accounts/store";
import type { EventLogInput } from "@/lib/logs/write";
import { listGasWalletBalances } from "@/lib/membership/gas-monitor";
import {
  getGasWalletStatus,
  listBillingChains,
  listUnsweptDepositTxs,
} from "@/lib/membership/wallet-store";
import { memberDisplayName } from "@/lib/members/sync";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  deskOrderFailedKey,
  deskSyncFailedKey,
  exchangeVerifyFailedKey,
  operatorDeskCriticalKey,
  operatorGasLowKey,
  operatorSweepKey,
} from "./catalog";
import { notificationCopy } from "./copy";
import {
  CRITICAL_LOG_EVENTS,
  criticalDeskHref,
  criticalFamily,
  repeatingOrderShouldNotify,
  venueLabel,
} from "./critical-model";
import { notify } from "./notify";
import { loadOperatorEmails } from "./operators";

export {
  CRITICAL_LOG_EVENTS,
  criticalDeskHref,
  criticalFamily,
  repeatingOrderShouldNotify,
  venueLabel,
};

const REPEAT_WINDOW_MS = 30 * 60 * 1000;
const CRITICAL_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export async function notifyFromCriticalLog(
  input: EventLogInput,
): Promise<void> {
  if (
    !(CRITICAL_LOG_EVENTS as readonly string[]).includes(input.event) ||
    !input.userId
  ) {
    return;
  }
  if (input.event === "exchange.verify_failed") {
    await notifyExchangeVerifyFailed(input);
    return;
  }
  if (!input.accountId) {
    return;
  }
  const desk = await loadDesk(input.accountId);
  if (!desk || desk.mode !== "live") {
    return;
  }
  if (input.event === "dca.sync_failed") {
    await notifyDeskSyncFailed({
      userId: input.userId,
      desk,
      detail: input.message,
    });
    return;
  }
  const recent = await countRecentAccountEvents(
    input.accountId,
    input.event,
    REPEAT_WINDOW_MS,
  );
  if (!repeatingOrderShouldNotify(recent)) {
    return;
  }
  await notifyDeskOrderFailed({
    userId: input.userId,
    desk,
    detail: input.message,
    family: criticalFamily(
      String(input.data?.symbol ?? input.data?.action ?? "order"),
    ),
  });
}

export async function notifySweepFailed(input: {
  depositTxId: string;
  chainName: string;
  detail: string;
}): Promise<void> {
  const operators = await loadOperatorEmails();
  await notify({
    template: "operator_sweep_failed",
    entityKey: operatorSweepKey(input.depositTxId),
    toEmail: operators,
    notice: notificationCopy.operator_sweep_failed({
      chain: input.chainName,
      detail: input.detail,
    }),
  });
}

export async function notifyGasLow(input: {
  chainId: string;
  chainName: string;
  balanceEth: string;
  thresholdEth: string;
}): Promise<void> {
  const operators = await loadOperatorEmails();
  await notify({
    template: "operator_gas_low",
    entityKey: operatorGasLowKey(input.chainId),
    toEmail: operators,
    notice: notificationCopy.operator_gas_low({
      chain: input.chainName,
      balanceEth: input.balanceEth,
      thresholdEth: input.thresholdEth,
    }),
  });
}

export async function watchOperatorGasWallets(): Promise<number> {
  const gas = await getGasWalletStatus();
  if (!gas.configured || !gas.address) {
    return 0;
  }
  const listed = await listBillingChains();
  if (listed.length === 0) {
    return 0;
  }
  const rows = await listGasWalletBalances(gas.address, listed, gas.lowEth);
  let low = 0;
  for (const row of rows) {
    if (!row.low || !row.balanceEth) {
      continue;
    }
    low += 1;
    await notifyGasLow({
      chainId: row.chainId,
      chainName: row.name,
      balanceEth: row.balanceEth,
      thresholdEth: gas.lowEth,
    });
  }
  return low;
}

export async function countMemberDeskCritical(
  userId: string,
  liveAccountIds: readonly string[],
): Promise<number> {
  if (!userId || liveAccountIds.length === 0) {
    return 0;
  }
  const ids = await loadCriticalAccountIds({
    userId,
    accountIds: liveAccountIds,
  });
  return ids.size;
}

export async function countAdminDeskCritical(): Promise<number> {
  const ids = await loadCriticalAccountIds({});
  if (ids.size === 0) {
    return 0;
  }
  const live = await liveAccountIdSet([...ids]);
  return [...ids].filter((id) => live.has(id)).length;
}

export async function countSweepFailed(): Promise<number> {
  const rows = await listUnsweptDepositTxs();
  return rows.length;
}

export async function countGasLow(): Promise<number> {
  const gas = await getGasWalletStatus();
  if (!gas.configured || !gas.address) {
    return 0;
  }
  const listed = await listBillingChains();
  if (listed.length === 0) {
    return 0;
  }
  const rows = await listGasWalletBalances(gas.address, listed, gas.lowEth);
  return rows.filter((row) => row.low).length;
}

async function notifyDeskSyncFailed(input: {
  userId: string;
  desk: TradingAccount;
  detail: string;
}): Promise<void> {
  const href = criticalDeskHref(input.desk);
  const venue = venueLabel(input.desk.venue);
  const operators = await loadOperatorEmails();
  const memberLabel = await loadMemberLabel(input.userId);
  await notify({
    template: "desk_sync_failed",
    userId: input.userId,
    entityKey: deskSyncFailedKey(input.desk.id),
    notice: notificationCopy.desk_sync_failed({
      deskName: input.desk.name,
      venue,
      detail: input.detail,
      href,
    }),
  });
  await notify({
    template: "operator_desk_critical",
    entityKey: operatorDeskCriticalKey(input.desk.id, "sync"),
    toEmail: operators,
    notice: notificationCopy.operator_desk_critical({
      memberLabel,
      deskName: input.desk.name,
      venue,
      detail: input.detail,
    }),
  });
}

async function notifyDeskOrderFailed(input: {
  userId: string;
  desk: TradingAccount;
  detail: string;
  family: string;
}): Promise<void> {
  const href = criticalDeskHref(input.desk);
  const venue = venueLabel(input.desk.venue);
  const operators = await loadOperatorEmails();
  const memberLabel = await loadMemberLabel(input.userId);
  await notify({
    template: "desk_order_failed",
    userId: input.userId,
    entityKey: deskOrderFailedKey(input.desk.id, input.family),
    notice: notificationCopy.desk_order_failed({
      deskName: input.desk.name,
      venue,
      detail: input.detail,
      href,
    }),
  });
  await notify({
    template: "operator_desk_critical",
    entityKey: operatorDeskCriticalKey(input.desk.id, input.family),
    toEmail: operators,
    notice: notificationCopy.operator_desk_critical({
      memberLabel,
      deskName: input.desk.name,
      venue,
      detail: input.detail,
    }),
  });
}

async function notifyExchangeVerifyFailed(input: EventLogInput): Promise<void> {
  if (!input.userId) {
    return;
  }
  const connectionId = String(
    input.data?.connectionId ?? input.data?.fingerprint ?? "new",
  );
  const venue = venueLabel(String(input.data?.venue ?? ""));
  const connectionName = venue || "Exchange key";
  const operators = await loadOperatorEmails();
  const memberLabel = await loadMemberLabel(input.userId);
  await notify({
    template: "exchange_verify_failed",
    userId: input.userId,
    entityKey: exchangeVerifyFailedKey(connectionId),
    notice: notificationCopy.exchange_verify_failed({
      connectionName,
      venue: venue || "venue",
    }),
  });
  if (input.accountId) {
    const desk = await loadDesk(input.accountId);
    if (desk?.mode === "live") {
      await notify({
        template: "operator_desk_critical",
        entityKey: operatorDeskCriticalKey(desk.id, "verify"),
        toEmail: operators,
        notice: notificationCopy.operator_desk_critical({
          memberLabel,
          deskName: desk.name,
          venue: venue || venueLabel(desk.venue),
          detail: input.message,
        }),
      });
    }
  }
}

async function countRecentAccountEvents(
  accountId: string,
  event: string,
  windowMs: number,
): Promise<number> {
  const supabase = createServiceClient();
  if (!supabase || !accountId) {
    return 0;
  }
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await supabase
    .from("event_logs")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("event", event)
    .gte("created_at", since);
  if (error) {
    return 0;
  }
  return count ?? 0;
}

async function loadCriticalAccountIds(input: {
  userId?: string;
  accountIds?: readonly string[];
}): Promise<Set<string>> {
  const supabase = createServiceClient();
  if (!supabase) {
    return new Set();
  }
  const since = new Date(Date.now() - CRITICAL_LOOKBACK_MS).toISOString();
  let query = supabase
    .from("event_logs")
    .select("account_id")
    .in("event", [...CRITICAL_LOG_EVENTS])
    .gte("created_at", since)
    .not("account_id", "is", null)
    .limit(400);
  if (input.userId) {
    query = query.eq("user_id", input.userId);
  }
  if (input.accountIds && input.accountIds.length > 0) {
    query = query.in("account_id", [...input.accountIds]);
  }
  const { data, error } = await query;
  if (error || !data) {
    return new Set();
  }
  return new Set(
    data
      .map((row) => String(row.account_id ?? "").trim())
      .filter(Boolean),
  );
}

async function liveAccountIdSet(accountIds: string[]): Promise<Set<string>> {
  const supabase = createServiceClient();
  if (!supabase || accountIds.length === 0) {
    return new Set();
  }
  const { data } = await supabase
    .from("trading_accounts")
    .select("id")
    .in("id", accountIds)
    .eq("mode", "live");
  return new Set((data ?? []).map((row) => String(row.id)));
}

async function loadMemberLabel(userId: string): Promise<string> {
  const supabase = createServiceClient();
  if (!supabase) {
    return "Member";
  }
  const { data } = await supabase
    .from("members")
    .select("email, name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) {
    return "Member";
  }
  return memberDisplayName(String(data.email ?? ""), String(data.name ?? ""));
}
