import assert from "node:assert/strict";
import {
  affiliateRatesOk,
  assignablePlans,
  canArchivePlan,
  canDeletePlan,
  defaultAssignablePlanId,
  comparePlanCell,
  rowUnlockIndex,
  sortCompareSectionRows,
  emptyCaps,
  emptyFeatures,
  formatBacktestTimeframe,
  formatPlanCap,
  formatPlanPrice,
  parseCaps,
  parseFeatures,
  PLAN_CAP_KEYS,
  adminPlanSections,
  PLAN_COMPARE_SECTIONS,
  PLAN_FEATURE_KEYS,
  clonedPlanName,
  publicCatalogPlans,
  slugifyPlanName,
  type MembershipPlan,
} from "./catalog";
import { clonePlanValues, parsePlanForm, parsePlanId } from "./form";

assert.equal(emptyFeatures().desk_dca, false);
assert.equal(emptyCaps().max_demo_desks, null);
assert.equal(parseFeatures({ desk_dca: true, nope: true }).desk_dca, true);
assert.equal(parseFeatures({ desk_dca: true }).desk_scale_in, false);
assert.equal(parseFeatures({}).affiliate_pay_subscription, false);
assert.equal(
  parseFeatures({ affiliate_pay_subscription: true }).affiliate_pay_subscription,
  true,
);
assert.equal(parseCaps({ max_demo_desks: 2, max_paper_desks: "nope" }).max_demo_desks, 2);
assert.equal(parseCaps({ max_demo_desks: 2 }).max_paper_desks, null);
assert.equal(parseCaps({ max_demo_desks: 1, max_live_env_desks: 3 }).max_demo_desks, 1);
assert.equal(parseCaps({ max_demo_desks: 1, max_live_env_desks: 3 }).max_live_env_desks, 3);

assert.equal(affiliateRatesOk(20, 5, 0), true);
assert.equal(affiliateRatesOk(80, 20, 1), false);
assert.equal(affiliateRatesOk(-1, 0, 0), false);
assert.equal(affiliateRatesOk(20, 5, 80), false);
assert.equal(affiliateRatesOk(10, 10, 10, 10, 10), true);
assert.equal(affiliateRatesOk(20, 20, 20, 20, 21), false);

assert.equal(slugifyPlanName(" Plus Plan "), "plus-plan");
assert.equal(clonedPlanName("Plus"), "Plus copy");
assert.equal(clonedPlanName("A".repeat(40)).length, 40);
assert.ok(clonedPlanName("A".repeat(40)).endsWith(" copy"));
assert.equal(formatPlanPrice(0), "Free");
assert.equal(formatPlanPrice(29), "$29 / month");
assert.equal(formatPlanCap(null), "Unlimited");
assert.equal(formatPlanCap(2), "2");
assert.equal(formatBacktestTimeframe(null), "Unlimited");
assert.equal(formatBacktestTimeframe(1), "1 year");
assert.equal(formatBacktestTimeframe(3), "3 years");

const unused = {
  isDefault: false,
  memberCount: 0,
  archivedAt: null,
};
assert.equal(canDeletePlan(unused), true);
assert.equal(canArchivePlan(unused), true);
assert.equal(canDeletePlan({ isDefault: true, memberCount: 0 }), false);
assert.equal(canDeletePlan({ isDefault: false, memberCount: 3 }), false);
assert.equal(
  canArchivePlan({ isDefault: true, archivedAt: null }),
  false,
);
assert.equal(
  canArchivePlan({ isDefault: false, archivedAt: "2026-09-11T00:00:00Z" }),
  false,
);
const livePlan = {
  id: "live",
  archivedAt: null,
  isDefault: true,
  visibility: "public" as const,
};
const archivedPlan = {
  id: "old",
  archivedAt: "2026-09-11T00:00:00Z",
  isDefault: false,
  visibility: "public" as const,
};
const draftPlan = {
  id: "draft",
  archivedAt: null,
  isDefault: false,
  visibility: "draft" as const,
};
assert.deepEqual(assignablePlans([livePlan, archivedPlan]).map((p) => p.id), [
  "live",
]);
assert.deepEqual(
  assignablePlans([livePlan, archivedPlan], "old").map((p) => p.id),
  ["live", "old"],
);
assert.equal(defaultAssignablePlanId([archivedPlan, livePlan]), "live");
assert.deepEqual(
  assignablePlans([livePlan, draftPlan]).map((plan) => plan.id),
  ["live"],
);

const create = new FormData();
create.set("name", " Plus ");
create.set("sortOrder", "2");
create.set("priceUsd", "29");
create.set("visibility", "public");
create.set("feature_desk_dca", "1");
create.set("feature_mode_live", "1");
create.set("cap_max_paper_desks", "4");
create.set("affiliateL1Pct", "10");
create.set("affiliateL2Pct", "5");
create.set("affiliateL3Pct", "0");
const parsed = parsePlanForm(create);
assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.equal(parsed.values.name, "Plus");
  assert.equal(parsed.values.slug, "plus");
  assert.equal(parsed.values.priceUsd, 29);
  assert.equal(parsed.values.features.desk_dca, true);
  assert.equal(parsed.values.features.desk_scale_in, false);
  assert.equal(parsed.values.caps.max_paper_desks, 4);
  assert.equal(parsed.values.caps.max_demo_desks, null);
  assert.equal(parsed.values.affiliateL1Pct, 10);
}

const overRates = new FormData();
overRates.set("name", "Pro");
overRates.set("affiliateL1Pct", "50");
overRates.set("affiliateL2Pct", "40");
overRates.set("affiliateL3Pct", "20");
assert.equal(parsePlanForm(overRates).ok, false);

const badCap = new FormData();
badCap.set("name", "Pro");
badCap.set("visibility", "public");
badCap.set("cap_max_paper_desks", "1.5");
assert.equal(parsePlanForm(badCap).ok, false);

const draftDefault = new FormData();
draftDefault.set("name", "Soon");
draftDefault.set("visibility", "draft");
draftDefault.set("isDefault", "1");
assert.equal(parsePlanForm(draftDefault).ok, false);

assert.equal(parsePlanId("not-a-uuid"), null);
assert.ok(parsePlanId("2f1c7d5a-3b9e-4a11-9c22-0d4e6f8a1b30"));

const archived: MembershipPlan = {
  id: "2f1c7d5a-3b9e-4a11-9c22-0d4e6f8a1b30",
  slug: "old",
  name: "Old",
  sortOrder: 9,
  visibility: "public",
  preview: false,
  archivedAt: "2026-09-11T00:00:00Z",
  isDefault: false,
  priceUsd: 10,
  stripePriceId: null,
  affiliateL1Pct: 0,
  affiliateL2Pct: 0,
  affiliateL3Pct: 0,
  affiliateL4Pct: 0,
  affiliateL5Pct: 0,
  features: emptyFeatures(),
  caps: emptyCaps(),
  createdAt: "2026-09-11T00:00:00Z",
  updatedAt: "2026-09-11T00:00:00Z",
  memberCount: 0,
};
const live: MembershipPlan = {
  ...archived,
  id: "3f1c7d5a-3b9e-4a11-9c22-0d4e6f8a1b31",
  slug: "plus",
  name: "Plus",
  sortOrder: 1,
  archivedAt: null,
};
assert.deepEqual(
  publicCatalogPlans([archived, live]).map((plan) => plan.slug),
  ["plus"],
);
const cloned = clonePlanValues(live);
assert.equal(cloned.name, "Plus copy");
assert.equal(cloned.visibility, "draft");
assert.equal(cloned.preview, false);
assert.equal(cloned.isDefault, false);
assert.equal(cloned.stripePriceId, null);
assert.equal(cloned.priceUsd, live.priceUsd);
assert.deepEqual(cloned.features, live.features);
const privatePlan: MembershipPlan = {
  ...live,
  id: "4f1c7d5a-3b9e-4a11-9c22-0d4e6f8a1b32",
  slug: "vip",
  visibility: "private",
};
const draftPreview: MembershipPlan = {
  ...live,
  id: "5f1c7d5a-3b9e-4a11-9c22-0d4e6f8a1b33",
  slug: "soon",
  sortOrder: 8,
  visibility: "draft",
  preview: true,
};
assert.deepEqual(
  publicCatalogPlans([live, privatePlan, draftPreview]).map((plan) => plan.slug),
  ["plus"],
);
assert.deepEqual(
  publicCatalogPlans([live, privatePlan, draftPreview], {
    currentPlanId: privatePlan.id,
  }).map((plan) => plan.slug),
  ["plus", "vip"],
);
assert.deepEqual(
  publicCatalogPlans(
    [
      {
        ...privatePlan,
        name: "VIP",
        sortOrder: 2,
        archivedAt: "2026-09-11T00:00:00Z",
      },
      live,
    ],
    { currentPlanId: privatePlan.id },
  ).map((plan) => plan.slug),
  ["plus", "vip"],
);
assert.deepEqual(
  publicCatalogPlans([live, draftPreview], { includePreviewDrafts: true }).map(
    (plan) => plan.slug,
  ),
  ["plus", "soon"],
);

assert.deepEqual(
  PLAN_COMPARE_SECTIONS.map((section) => section.title),
  [
    "Manual Desk Types",
    "Automated Desk Types",
    "Maximum Desks (any type)",
    "Bots & Templates",
    "Webhooks",
    "Copy Trading",
    "Backtesting",
    "Affiliates",
  ],
);
const compareFeatureKeys = PLAN_COMPARE_SECTIONS.flatMap((section) =>
  section.rows.filter((row) => row.kind === "feature").map((row) => row.key),
);
const compareCapKeys = PLAN_COMPARE_SECTIONS.flatMap((section) =>
  section.rows.filter((row) => row.kind === "cap").map((row) => row.key),
);
const hiddenCompareFeatures = new Set<string>([
  "venue_non_bybit",
  "affiliate_enroll",
  "mode_paper",
  "mode_live",
  "desk_scale_in",
  "extras_advanced_dca",
]);
assert.equal(
  compareFeatureKeys.some((key) => hiddenCompareFeatures.has(key)),
  false,
);
assert.deepEqual(
  [...compareFeatureKeys].sort(),
  [...PLAN_FEATURE_KEYS].filter((key) => !hiddenCompareFeatures.has(key)).sort(),
);
assert.deepEqual([...compareCapKeys].sort(), [...PLAN_CAP_KEYS].sort());
const manualDesks = PLAN_COMPARE_SECTIONS.find(
  (section) => section.title === "Manual Desk Types",
);
assert.ok(manualDesks);
assert.equal(manualDesks.rows[0].kind, "feature");
assert.equal(manualDesks.rows[0].key, "desk_perps");
assert.equal(
  manualDesks.rows.find((row) => row.kind === "feature" && row.key === "desk_perps")
    ?.label,
  "Perps",
);
const automatedDesks = PLAN_COMPARE_SECTIONS.find(
  (section) => section.title === "Automated Desk Types",
);
assert.ok(automatedDesks);
assert.equal(
  automatedDesks.rows.some((row) => row.kind === "feature" && row.key === "desk_dca"),
  true,
);
const deskResources = PLAN_COMPARE_SECTIONS.find(
  (section) => section.title === "Maximum Desks (any type)",
);
assert.ok(deskResources);
assert.equal(
  deskResources.rows.some((row) => row.kind === "cap" && row.key === "max_paper_desks"),
  true,
);
assert.equal(
  deskResources.rows.some((row) => row.kind === "cap" && row.key === "max_demo_desks"),
  true,
);
assert.equal(
  deskResources.rows.some((row) => row.kind === "cap" && row.key === "max_live_env_desks"),
  true,
);
assert.equal(
  deskResources.rows.some((row) => row.kind === "feature" && row.key === "mode_live"),
  false,
);
const backtesting = PLAN_COMPARE_SECTIONS.find(
  (section) => section.title === "Backtesting",
);
assert.ok(backtesting);
assert.equal(backtesting.fixedOrder, true);
assert.equal(backtesting.rows[0].kind, "feature");
assert.equal(backtesting.rows[0].key, "research_backtest");
const affiliates = PLAN_COMPARE_SECTIONS.find(
  (section) => section.title === "Affiliates",
);
assert.ok(affiliates);
assert.equal(affiliates.fixedOrder, true);
assert.equal(affiliates.rows[0].kind, "cap");
assert.equal(affiliates.rows[0].key, "affiliate_max_depth");
assert.equal(
  affiliates.rows.at(-1)?.kind,
  "feature",
);
assert.equal(
  affiliates.rows.at(-1)?.key,
  "affiliate_pay_subscription",
);
const adminSections = adminPlanSections();
assert.deepEqual(
  adminSections.map((section) => section.title),
  PLAN_COMPARE_SECTIONS.map((section) => section.title),
);
for (const [index, section] of PLAN_COMPARE_SECTIONS.entries()) {
  assert.deepEqual(
    adminSections[index].rows.map((row) => `${row.kind}:${row.key}`),
    section.rows.map((row) => `${row.kind}:${row.key}`),
  );
}
assert.equal(
  comparePlanCell(
    { ...live, features: { ...emptyFeatures(), desk_dca: true }, caps: { ...emptyCaps(), max_paper_desks: 2 } },
    { kind: "feature", key: "desk_dca", label: "DCA" },
  ).kind,
  "tick",
);
assert.equal(
  comparePlanCell(
    { ...live, features: emptyFeatures(), caps: emptyCaps() },
    { kind: "feature", key: "mode_live", label: "Live" },
  ).kind,
  "cross",
);
assert.deepEqual(
  comparePlanCell(
    { ...live, features: emptyFeatures(), caps: { ...emptyCaps(), max_paper_desks: 2 } },
    { kind: "cap", key: "max_paper_desks", label: "Paper Trading" },
  ),
  { kind: "value", text: "2" },
);
assert.deepEqual(
  comparePlanCell(
    { ...live, features: emptyFeatures(), caps: emptyCaps(), affiliateL1Pct: 20 },
    { kind: "rate", key: "l1", label: "L1" },
  ),
  { kind: "value", text: "20%" },
);
assert.equal(
  comparePlanCell(
    { ...live, features: emptyFeatures(), caps: { ...emptyCaps(), max_demo_desks: 0 } },
    { kind: "cap", key: "max_demo_desks", label: "Max Demo" },
  ).kind,
  "cross",
);
assert.equal(
  comparePlanCell(
    { ...live, features: emptyFeatures(), caps: emptyCaps(), affiliateL1Pct: 0 },
    { kind: "rate", key: "l1", label: "L1" },
  ).kind,
  "cross",
);
assert.equal(
  comparePlanCell(
    {
      ...live,
      features: emptyFeatures(),
      caps: { ...emptyCaps(), max_followers_accepted: null },
    },
    { kind: "cap", key: "max_followers_accepted", label: "Max followers" },
  ).kind,
  "cross",
);
assert.deepEqual(
  comparePlanCell(
    {
      ...live,
      features: { ...emptyFeatures(), copy_share: true },
      caps: { ...emptyCaps(), max_followers_accepted: null },
    },
    { kind: "cap", key: "max_followers_accepted", label: "Max followers" },
  ),
  { kind: "value", text: "Unlimited" },
);

const freePlan: MembershipPlan = {
  ...live,
  id: "free",
  slug: "free",
  name: "Free",
  sortOrder: 0,
  features: { ...emptyFeatures(), desk_dca: true, mode_paper: true },
  caps: { ...emptyCaps(), max_paper_desks: 2, max_demo_desks: 0 },
};
const plusPlan: MembershipPlan = {
  ...live,
  id: "plus",
  slug: "plus",
  name: "Plus",
  features: { ...freePlan.features, mode_live: true },
  caps: { ...emptyCaps(), max_paper_desks: 4, max_demo_desks: 2 },
};
const proPlan: MembershipPlan = {
  ...live,
  id: "pro",
  slug: "pro",
  name: "Pro",
  features: { ...plusPlan.features, copy_follow: true },
  caps: plusPlan.caps,
};
assert.equal(
  rowUnlockIndex([freePlan, plusPlan, proPlan], {
    kind: "feature",
    key: "desk_dca",
    label: "DCA",
  }),
  0,
);
assert.equal(
  rowUnlockIndex([freePlan, plusPlan, proPlan], {
    kind: "feature",
    key: "mode_live",
    label: "Live",
  }),
  1,
);
assert.equal(
  rowUnlockIndex([freePlan, plusPlan, proPlan], {
    kind: "feature",
    key: "copy_follow",
    label: "Follow",
  }),
  2,
);
assert.equal(
  rowUnlockIndex([freePlan, plusPlan, proPlan], {
    kind: "cap",
    key: "max_demo_desks",
    label: "Max Demo",
  }),
  1,
);
const modeRows = sortCompareSectionRows(
  [freePlan, plusPlan, proPlan],
  [
    { kind: "feature", key: "mode_live", label: "Live" },
    { kind: "feature", key: "mode_paper", label: "Paper" },
    { kind: "cap", key: "max_demo_desks", label: "Max Demo" },
  ],
);
assert.deepEqual(
  modeRows.map((row) => row.key),
  ["mode_paper", "mode_live", "max_demo_desks"],
);

console.log("membership catalog checks passed");
