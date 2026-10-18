import {
  countOwnedSavedBacktests,
  countQueuedBacktestsInCycle,
} from "@/lib/backtest/store";
import { activeBillingCycle } from "@/lib/membership/billing";
import { emptyCaps, emptyFeatures, type PlanCaps } from "@/lib/membership/catalog";
import {
  RESEARCH_CAP_KEYS,
  RESEARCH_FEATURE_KEYS,
  queueBacktestDenial,
  replayClickDenial,
  researchGateAccess,
  type ResearchGateAccess,
  type ResearchNotice,
} from "@/lib/membership/entitlements";
import { getMemberBilling } from "@/lib/membership/billing-store";
import {
  getMembershipPlan,
  listCatalogMembershipPlans,
} from "@/lib/membership/store";
import { ensureMemberTrialGrants } from "@/lib/membership/trial-store";
import { emptyPlanTrials } from "@/lib/membership/trials";

export async function loadResearchGateAccess(
  userId: string,
): Promise<ResearchGateAccess> {
  const billing = await getMemberBilling(userId);
  const cycle = activeBillingCycle({
    periodEnd: billing?.periodEnd ?? null,
    anchorMs: billing?.createdAt ? Date.parse(billing.createdAt) : null,
  });
  const [planResult, catalog, savedUsed, monthlyUsed] = await Promise.all([
    billing ? getMembershipPlan(billing.planId) : Promise.resolve(null),
    listCatalogMembershipPlans(),
    countOwnedSavedBacktests(userId),
    cycle ? countQueuedBacktestsInCycle(userId, cycle) : Promise.resolve(null),
  ]);
  const plan = planResult && planResult.ok ? planResult.plan : null;
  const plans = catalog.ok ? catalog.plans : [];
  let grants: { key: string; endsAt: string }[] = [];
  let trials = plan?.trials ?? emptyPlanTrials();
  let nowMs = Date.now();
  if (plan) {
    const ensured = await ensureMemberTrialGrants({
      userId,
      plan,
      keys: [...RESEARCH_FEATURE_KEYS, ...RESEARCH_CAP_KEYS],
    });
    if (ensured.ok) {
      grants = ensured.grants;
      nowMs = ensured.nowMs;
    } else {
      trials = emptyPlanTrials();
    }
  }
  return researchGateAccess({
    features: plan?.features ?? emptyFeatures(),
    caps: plan ? plan.caps : closedResearchCaps(),
    trials,
    grants,
    nowMs,
    plans,
    monthlyUsed: monthlyUsed ?? 0,
    monthlyCountOk: cycle != null && monthlyUsed != null,
    savedUsed: savedUsed ?? 0,
    savedCountOk: savedUsed != null,
  });
}

export async function deniedAttachBacktestMessage(
  userId: string,
): Promise<string | null> {
  const gate = await loadResearchGateAccess(userId);
  return gate.attach.allowed ? null : gate.attach.message;
}

export async function deniedReplayMessage(
  userId: string,
): Promise<ResearchNotice | null> {
  const gate = await loadResearchGateAccess(userId);
  return replayClickDenial(gate);
}

export async function deniedNewReplayIndicatorsMessage(
  userId: string,
): Promise<string | null> {
  const gate = await loadResearchGateAccess(userId);
  return gate.indicators.allowed ? null : gate.indicators.message;
}

export async function deniedQueueBacktestMessage(
  userId: string,
  input: { variant: boolean; adding: number; fromMs: number; toMs: number },
): Promise<string | null> {
  const gate = await loadResearchGateAccess(userId);
  if (!gate.backtest.allowed) {
    return gate.backtest.message;
  }
  if (input.variant && !gate.optimize.allowed) {
    return gate.optimize.message;
  }
  if (gate.monthly.limit != null && !gate.monthlyCountOk) {
    return "Could not check your backtests this billing cycle.";
  }
  if (gate.saved.limit != null && !gate.savedCountOk) {
    return "Could not check your saved backtests.";
  }
  return queueBacktestDenial(gate, input)?.message ?? null;
}

function closedResearchCaps(): PlanCaps {
  const caps = emptyCaps();
  for (const key of RESEARCH_CAP_KEYS) {
    caps[key] = 0;
  }
  return caps;
}
