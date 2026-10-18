import { countQueuedBacktestsInCycle } from "@/lib/backtest/store";
import type { TradingAccountMode } from "@/lib/accounts/model";
import { activeBillingCycle } from "@/lib/membership/billing";
import { getMemberBilling } from "@/lib/membership/billing-store";
import {
  emptyPlanUsageCounts,
  planDeskCounts,
  type PlanUsageCounts,
} from "@/lib/membership/plan-overview";
import { createServiceClient } from "@/lib/supabase/admin";

export async function loadPlanUsageCounts(input: {
  userId: string;
  accountIds: readonly string[];
  desks: readonly {
    mode: TradingAccountMode;
    venueEnvironment: string | null;
    copyOfAccountId?: string | null;
  }[];
}): Promise<PlanUsageCounts> {
  const counts: PlanUsageCounts = {
    ...emptyPlanUsageCounts(),
    ...planDeskCounts(input.desks),
  };
  const supabase = createServiceClient();
  if (!supabase || !input.userId) {
    return counts;
  }
  const accountIds = input.accountIds.filter(Boolean);
  const billing = await getMemberBilling(input.userId);
  const cycle = activeBillingCycle({
    periodEnd: billing?.periodEnd ?? null,
    anchorMs: billing?.createdAt ? Date.parse(billing.createdAt) : null,
  });
  const [bots, backtests, monthly, followers] = await Promise.all([
    countBotRows(supabase, accountIds),
    countRows(
      supabase.from("backtest_runs").select("id", { count: "exact", head: true }).eq(
        "user_id",
        input.userId,
      ),
    ),
    cycle
      ? countQueuedBacktestsInCycle(input.userId, cycle)
      : Promise.resolve(0),
    countBusiestDeskFollowers(supabase, accountIds),
  ]);
  counts.max_bots = bots;
  counts.max_stored_backtests = backtests;
  counts.max_backtests_per_month = monthly ?? 0;
  counts.max_followers_accepted = followers;
  return counts;
}

type CountQuery = PromiseLike<{
  count: number | null;
  error: { message: string } | null;
}>;

async function countRows(query: CountQuery): Promise<number> {
  const { count, error } = await query;
  if (error) {
    return 0;
  }
  return count ?? 0;
}

async function countBotRows(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  accountIds: readonly string[],
): Promise<number> {
  if (accountIds.length === 0) {
    return 0;
  }
  const [rules, futures, playbooks] = await Promise.all([
    countRows(
      supabase
        .from("paper_rules")
        .select("id", { count: "exact", head: true })
        .in("account_id", [...accountIds]),
    ),
    countRows(
      supabase
        .from("futures_automation_rules")
        .select("id", { count: "exact", head: true })
        .in("account_id", [...accountIds]),
    ),
    countRows(
      supabase
        .from("dca_playbooks")
        .select("id", { count: "exact", head: true })
        .in("account_id", [...accountIds]),
    ),
  ]);
  return rules + futures + playbooks;
}

async function countBusiestDeskFollowers(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  accountIds: readonly string[],
): Promise<number> {
  if (accountIds.length === 0) {
    return 0;
  }
  const { data, error } = await supabase
    .from("desk_copy_shares")
    .select("parent_account_id")
    .in("parent_account_id", [...accountIds])
    .in("status", ["invited", "active"]);
  if (error || !data) {
    return 0;
  }
  const byDesk = new Map<string, number>();
  for (const row of data) {
    const id = String((row as { parent_account_id?: string }).parent_account_id ?? "");
    if (!id) {
      continue;
    }
    byDesk.set(id, (byDesk.get(id) ?? 0) + 1);
  }
  let highest = 0;
  for (const count of byDesk.values()) {
    if (count > highest) {
      highest = count;
    }
  }
  return highest;
}
