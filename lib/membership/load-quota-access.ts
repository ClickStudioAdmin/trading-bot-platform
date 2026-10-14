import type { TradingAccountMode } from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import { emptyCaps } from "@/lib/membership/catalog";
import {
  QUOTA_CAP_KEYS,
  quotaAccessFor,
  quotaAccessList,
  quotaKeyAfterBind,
  quotaKeyForDesk,
  quotaRoomMessage,
  type CapUnlockCandidate,
  type QuotaAccess,
  type QuotaCapKey,
} from "@/lib/membership/entitlements";
import { getMemberBilling } from "@/lib/membership/billing-store";
import {
  getMembershipPlan,
  listCatalogMembershipPlans,
} from "@/lib/membership/store";
import { loadPlanUsageCounts } from "@/lib/membership/plan-usage";
import { ensureMemberTrialGrants } from "@/lib/membership/trial-store";
import { emptyPlanTrials, type PlanTrials } from "@/lib/membership/trials";
import type { PlanCaps } from "@/lib/membership/catalog";

export async function loadQuotaAccess(
  userId: string,
  desks?: readonly {
    id: string;
    mode: TradingAccountMode;
    venueEnvironment: string | null;
  }[],
): Promise<QuotaAccess[]> {
  const accounts =
    desks ??
    (await listTradingAccounts(userId)).map((desk) => ({
      id: desk.id,
      mode: desk.mode,
      venueEnvironment: desk.venueEnvironment,
    }));
  const billing = await getMemberBilling(userId);
  const [planResult, catalog, usage] = await Promise.all([
    billing ? getMembershipPlan(billing.planId) : Promise.resolve(null),
    listCatalogMembershipPlans(),
    loadPlanUsageCounts({
      userId,
      accountIds: accounts.map((desk) => desk.id),
      desks: accounts,
    }),
  ]);
  const plan = planResult && planResult.ok ? planResult.plan : null;
  const plans: CapUnlockCandidate[] = catalog.ok
    ? catalog.plans.map((row) => ({
        name: row.name,
        visibility: row.visibility,
        archivedAt: row.archivedAt,
        priceUsd: row.priceUsd,
        sortOrder: row.sortOrder,
        features: row.features,
        caps: row.caps,
      }))
    : [];
  let grants: { key: string; endsAt: string }[] = [];
  let trials: PlanTrials = plan?.trials ?? emptyPlanTrials();
  let nowMs = Date.now();
  if (plan) {
    const ensured = await ensureMemberTrialGrants({
      userId,
      plan,
      keys: QUOTA_CAP_KEYS,
    });
    if (ensured.ok) {
      grants = ensured.grants;
      nowMs = ensured.nowMs;
    } else {
      trials = emptyPlanTrials();
    }
  }
  return quotaAccessList({
    caps: plan ? plan.caps : closedQuotaCaps(),
    trials,
    grants,
    nowMs,
    plans,
    used: {
      max_paper_desks: usage.max_paper_desks,
      max_demo_desks: usage.max_demo_desks,
      max_live_env_desks: usage.max_live_env_desks,
      max_bots: usage.max_bots,
    },
  });
}

export async function deniedQuotaMessage(
  userId: string,
  key: QuotaCapKey,
  adding = 1,
): Promise<string | null> {
  const access = await loadQuotaAccess(userId);
  return quotaRoomMessage(quotaAccessFor(access, key), adding);
}

export async function deniedDeskQuotaMessage(
  userId: string,
  desk: { mode: TradingAccountMode; venueEnvironment: string | null },
  adding = 1,
): Promise<string | null> {
  return deniedQuotaMessage(userId, quotaKeyForDesk(desk), adding);
}

export async function deniedBindQuotaMessage(input: {
  userId: string;
  currentEnvironment: string | null;
  nextEnvironment: string | null;
}): Promise<string | null> {
  const key = quotaKeyAfterBind({
    currentEnvironment: input.currentEnvironment,
    nextEnvironment: input.nextEnvironment,
  });
  if (!key) {
    return null;
  }
  return deniedQuotaMessage(input.userId, key, 1);
}

function closedQuotaCaps(): PlanCaps {
  const caps = emptyCaps();
  for (const key of QUOTA_CAP_KEYS) {
    caps[key] = 0;
  }
  return caps;
}
