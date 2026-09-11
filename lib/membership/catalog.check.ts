import assert from "node:assert/strict";
import {
  affiliateRatesOk,
  canArchivePlan,
  canDeletePlan,
  comparePlanCell,
  rowUnlockIndex,
  sortCompareSectionRows,
  emptyCaps,
  emptyFeatures,
  formatPlanCap,
  formatPlanPrice,
  parseCaps,
  parseFeatures,
  PLAN_CAP_KEYS,
  PLAN_COMPARE_SECTIONS,
  PLAN_FEATURE_KEYS,
  publicCatalogPlans,
  slugifyPlanName,
  type MembershipPlan,
} from "./catalog";
import { parsePlanForm, parsePlanId } from "./form";

assert.equal(emptyFeatures().desk_dca, false);
assert.equal(emptyCaps().max_desks, null);
assert.equal(parseFeatures({ desk_dca: true, nope: true }).desk_dca, true);
assert.equal(parseFeatures({ desk_dca: true }).desk_scale_in, false);
assert.equal(parseCaps({ max_desks: 2, max_live_desks: "nope" }).max_desks, 2);
assert.equal(parseCaps({ max_desks: 2 }).max_live_desks, null);

assert.equal(affiliateRatesOk(20, 5, 0), true);
assert.equal(affiliateRatesOk(80, 20, 1), false);
assert.equal(affiliateRatesOk(-1, 0, 0), false);
assert.equal(affiliateRatesOk(20, 5, 80), false);

assert.equal(slugifyPlanName(" Plus Plan "), "plus-plan");
assert.equal(formatPlanPrice(0), "Free");
assert.equal(formatPlanPrice(29), "$29 / month");
assert.equal(formatPlanCap(null), "Unlimited");
assert.equal(formatPlanCap(2), "2");

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

const create = new FormData();
create.set("name", " Plus ");
create.set("sortOrder", "2");
create.set("priceUsd", "29");
create.set("public", "1");
create.set("feature_desk_dca", "1");
create.set("feature_mode_live", "1");
create.set("cap_max_desks", "4");
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
  assert.equal(parsed.values.caps.max_desks, 4);
  assert.equal(parsed.values.caps.max_live_desks, null);
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
badCap.set("cap_max_desks", "1.5");
assert.equal(parsePlanForm(badCap).ok, false);

assert.equal(parsePlanId("not-a-uuid"), null);
assert.ok(parsePlanId("2f1c7d5a-3b9e-4a11-9c22-0d4e6f8a1b30"));

const archived: MembershipPlan = {
  id: "2f1c7d5a-3b9e-4a11-9c22-0d4e6f8a1b30",
  slug: "old",
  name: "Old",
  sortOrder: 9,
  public: true,
  archivedAt: "2026-09-11T00:00:00Z",
  isDefault: false,
  priceUsd: 10,
  stripePriceId: null,
  affiliateL1Pct: 0,
  affiliateL2Pct: 0,
  affiliateL3Pct: 0,
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

assert.deepEqual(
  PLAN_COMPARE_SECTIONS.map((section) => section.title),
  ["Desks", "Automation", "Copy Trading", "Backtesting", "Affiliates", "Extras"],
);
const compareFeatureKeys = PLAN_COMPARE_SECTIONS.flatMap((section) =>
  section.rows.filter((row) => row.kind === "feature").map((row) => row.key),
);
const compareCapKeys = PLAN_COMPARE_SECTIONS.flatMap((section) =>
  section.rows.filter((row) => row.kind === "cap").map((row) => row.key),
);
assert.deepEqual([...compareFeatureKeys].sort(), [...PLAN_FEATURE_KEYS].sort());
assert.deepEqual([...compareCapKeys].sort(), [...PLAN_CAP_KEYS].sort());
const desks = PLAN_COMPARE_SECTIONS.find((section) => section.title === "Desks");
assert.ok(desks);
assert.equal(desks.rows[0].kind, "feature");
assert.equal(desks.rows.some((row) => row.kind === "cap" && row.key === "max_desks"), true);
assert.equal(
  desks.rows.some((row) => row.kind === "feature" && row.key === "mode_live"),
  true,
);
const extras = PLAN_COMPARE_SECTIONS.find((section) => section.title === "Extras");
assert.ok(extras);
assert.equal(
  extras.rows.some((row) => row.kind === "feature" && row.key === "research_chart"),
  true,
);
assert.equal(
  comparePlanCell(
    { ...live, features: { ...emptyFeatures(), desk_dca: true }, caps: { ...emptyCaps(), max_desks: 2 } },
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
    { ...live, features: emptyFeatures(), caps: { ...emptyCaps(), max_desks: 2 } },
    { kind: "cap", key: "max_desks", label: "Max desks" },
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
    { ...live, features: emptyFeatures(), caps: { ...emptyCaps(), max_live_desks: 0 } },
    { kind: "cap", key: "max_live_desks", label: "Max Live" },
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

const freePlan: MembershipPlan = {
  ...live,
  id: "free",
  slug: "free",
  name: "Free",
  sortOrder: 0,
  features: { ...emptyFeatures(), desk_dca: true, mode_paper: true },
  caps: { ...emptyCaps(), max_desks: 2, max_live_desks: 0 },
};
const plusPlan: MembershipPlan = {
  ...live,
  id: "plus",
  slug: "plus",
  name: "Plus",
  features: { ...freePlan.features, mode_live: true },
  caps: { ...emptyCaps(), max_desks: 4, max_live_desks: 2 },
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
    key: "max_live_desks",
    label: "Max Live",
  }),
  1,
);
const modeRows = sortCompareSectionRows(
  [freePlan, plusPlan, proPlan],
  [
    { kind: "feature", key: "mode_live", label: "Live" },
    { kind: "feature", key: "mode_paper", label: "Paper" },
    { kind: "cap", key: "max_live_desks", label: "Max Live" },
  ],
);
assert.deepEqual(
  modeRows.map((row) => row.key),
  ["mode_paper", "mode_live", "max_live_desks"],
);

console.log("membership catalog checks passed");
