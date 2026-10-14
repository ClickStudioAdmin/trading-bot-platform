import { emptyFeatures } from "@/lib/membership/catalog";
import {
  TEMPLATE_FEATURE_KEYS,
  templateFeatureAccessFor,
  templateFeatureAccessList,
  type TemplateFeatureAccess,
  type TemplateFeatureKey,
} from "@/lib/membership/entitlements";
import { getMemberBilling } from "@/lib/membership/billing-store";
import {
  getMembershipPlan,
  listCatalogMembershipPlans,
} from "@/lib/membership/store";
import { ensureMemberTrialGrants } from "@/lib/membership/trial-store";
import { emptyPlanTrials } from "@/lib/membership/trials";

export async function loadTemplateFeatureAccess(
  userId: string,
): Promise<TemplateFeatureAccess[]> {
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
      keys: TEMPLATE_FEATURE_KEYS,
    });
    if (ensured.ok) {
      grants = ensured.grants;
      nowMs = ensured.nowMs;
    } else {
      trials = emptyPlanTrials();
    }
  }
  return templateFeatureAccessList({
    features: plan?.features ?? emptyFeatures(),
    trials,
    grants,
    nowMs,
    plans,
  });
}

export async function deniedTemplateFeatureMessage(
  userId: string,
  key: TemplateFeatureKey,
): Promise<string | null> {
  const row = templateFeatureAccessFor(
    await loadTemplateFeatureAccess(userId),
    key,
  );
  if (!row || row.allowed) {
    return null;
  }
  return row.message;
}
