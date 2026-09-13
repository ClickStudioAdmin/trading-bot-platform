import { listMembershipPlans } from "./lib/membership/store";
import { loadAffiliateSettings } from "./lib/membership/affiliate-store";

const listed = await listMembershipPlans();
const settings = await loadAffiliateSettings();
if (!listed.ok) {
  console.log(listed.error);
  process.exit(1);
}
console.log(
  JSON.stringify(
    {
      programMaxDepth: settings.maxDepth,
      defaultRates: [
        settings.defaultL1Pct,
        settings.defaultL2Pct,
        settings.defaultL3Pct,
        settings.defaultL4Pct,
        settings.defaultL5Pct,
      ],
      plans: listed.plans.map((plan) => ({
        name: plan.name,
        slug: plan.slug,
        priceUsd: plan.priceUsd,
        visibility: plan.visibility,
        l1: plan.affiliateL1Pct,
        l2: plan.affiliateL2Pct,
        l3: plan.affiliateL3Pct,
        l4: plan.affiliateL4Pct,
        l5: plan.affiliateL5Pct,
        earnCap: plan.caps.affiliate_max_depth ?? null,
      })),
    },
    null,
    2,
  ),
);
