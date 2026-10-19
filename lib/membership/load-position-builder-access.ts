import { emptyFeatures } from "@/lib/membership/catalog";
import {
  POSITION_BUILDER_FEATURE,
  positionBuilderAccess,
  positionBuilderNotAllowedMessage,
  type PositionBuilderAccess,
} from "@/lib/membership/entitlements";
import { getMemberBilling } from "@/lib/membership/billing-store";
import {
  getMembershipPlan,
  listCatalogMembershipPlans,
} from "@/lib/membership/store";
import { ensureMemberTrialGrants } from "@/lib/membership/trial-store";
import { emptyPlanTrials } from "@/lib/membership/trials";

export async function loadPositionBuilderAccess(
  userId: string,
): Promise<PositionBuilderAccess> {
  const billing = await getMemberBilling(userId);
  const [planResult, catalog] = await Promise.all([
    billing ? getMembershipPlan(billing.planId) : Promise.resolve(null),
    listCatalogMembershipPlans(),
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
      keys: [POSITION_BUILDER_FEATURE],
    });
    if (ensured.ok) {
      grants = ensured.grants;
      nowMs = ensured.nowMs;
    } else {
      trials = emptyPlanTrials();
    }
  }
  const access = positionBuilderAccess({
    features: plan?.features ?? emptyFeatures(),
    trials,
    grants,
    nowMs,
    plans,
  });
  if (!access.allowed && !access.message) {
    return {
      allowed: false,
      message: positionBuilderNotAllowedMessage(null),
      upgradePlan: null,
    };
  }
  return access;
}
