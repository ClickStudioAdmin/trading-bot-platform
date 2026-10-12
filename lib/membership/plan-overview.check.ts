import assert from "node:assert/strict";
import { emptyCaps, emptyFeatures, PLAN_COMPARE_SECTIONS } from "./catalog";
import {
  overviewPlanGroups,
  planDeskCounts,
  usageNearLimit,
  type PlanOverviewGroup,
  type PlanUsageCounts,
} from "./plan-overview";

const features = emptyFeatures();
features.desk_perps = true;
features.desk_dca = true;
features.extras_templates = true;
features.copy_share = true;
features.research_backtest = true;

const caps = emptyCaps();
caps.max_paper_desks = 2;
caps.max_demo_desks = 1;
caps.max_live_env_desks = 0;
caps.max_bots = null;
caps.max_copy_follows = 2;
caps.max_followers_accepted = 5;
caps.max_stored_backtests = 3;
caps.max_backtest_years = 2;
caps.affiliate_max_depth = 3;

const rates = {
  affiliateL1Pct: 20,
  affiliateL2Pct: 0,
  affiliateL3Pct: 0,
  affiliateL4Pct: 0,
  affiliateL5Pct: 0,
};

const plan = { features, caps, ...rates };

const usage: PlanUsageCounts = {
  max_paper_desks: 2,
  max_demo_desks: 0,
  max_live_env_desks: 1,
  max_bots: 4,
  max_copy_follows: 3,
  max_followers_accepted: 2,
  max_stored_backtests: 3,
};

const groups = overviewPlanGroups(plan, usage);

assert.deepEqual(
  groups.map((group) => group.title),
  PLAN_COMPARE_SECTIONS.map((section) => section.title),
);

function line(source: PlanOverviewGroup[], title: string, key: string) {
  const group = source.find((item) => item.title === title);
  assert.ok(group, title);
  const found = group.lines.find((item) => item.key === key);
  assert.ok(found, `${title} ${key}`);
  return found;
}

assert.equal(line(groups, "Manual Desk Types", "feature:desk_perps").included, true);
assert.equal(line(groups, "Manual Desk Types", "feature:desk_perps").text, "Included");
assert.equal(
  line(groups, "Automated Desk Types", "feature:desk_cash_and_carry").text,
  "—",
);
assert.equal(
  line(groups, "Replay Studio", "feature:replay_backtests").text,
  "—",
);
assert.equal(
  line(groups, "Replay Studio", "feature:replay_chart_indicators").included,
  false,
);
assert.equal(
  line(groups, "Replay Studio", "feature:replay_strategy_optimization").text,
  "—",
);

assert.equal(
  line(groups, "Maximum Desks (any type)", "cap:max_paper_desks").text,
  "2 of 2",
);
assert.equal(
  line(groups, "Maximum Desks (any type)", "cap:max_paper_desks").over,
  true,
);
assert.equal(
  line(groups, "Maximum Desks (any type)", "cap:max_demo_desks").text,
  "0 of 1",
);
assert.equal(
  line(groups, "Maximum Desks (any type)", "cap:max_live_env_desks").text,
  "1 of 0",
);
assert.equal(
  line(groups, "Maximum Desks (any type)", "cap:max_live_env_desks").over,
  true,
);
assert.equal(line(groups, "Bots & Templates", "cap:max_bots").text, "4 of Unlimited");
assert.equal(line(groups, "Bots & Templates", "feature:extras_templates").included, true);
assert.equal(
  line(groups, "Copy Trading", "cap:max_copy_follows").text,
  "3 of 2",
);
assert.equal(line(groups, "Copy Trading", "cap:max_copy_follows").over, true);
assert.equal(
  line(groups, "Copy Trading", "cap:max_followers_accepted").text,
  "2 of 5",
);
assert.equal(
  line(groups, "Copy Trading", "cap:max_followers_accepted").note,
  "Highest on one desk",
);
assert.equal(line(groups, "Backtesting", "cap:max_stored_backtests").text, "3 of 3");
assert.equal(line(groups, "Backtesting", "cap:max_backtest_years").text, "2 years");
assert.equal(usageNearLimit(8, 10), false);
assert.equal(usageNearLimit(9, 10), true);
assert.equal(usageNearLimit(67, 75), false);
assert.equal(usageNearLimit(68, 75), true);
assert.equal(usageNearLimit(496, 75), true);
assert.equal(usageNearLimit(4, null), false);
assert.equal(usageNearLimit(0, 0), false);
assert.equal(line(groups, "Affiliates", "cap:affiliate_max_depth").text, "3");
assert.equal(line(groups, "Affiliates", "rate:l1").text, "20%");
assert.equal(line(groups, "Affiliates", "rate:l2").text, "—");

assert.deepEqual(
  planDeskCounts([
    { mode: "paper", venueEnvironment: null, copyOfAccountId: null },
    { mode: "paper", venueEnvironment: null, copyOfAccountId: "parent" },
    { mode: "live", venueEnvironment: "demo", copyOfAccountId: null },
    { mode: "live", venueEnvironment: "testnet", copyOfAccountId: null },
    { mode: "live", venueEnvironment: "live", copyOfAccountId: null },
    { mode: "live", venueEnvironment: null, copyOfAccountId: null },
  ]),
  {
    max_paper_desks: 2,
    max_demo_desks: 2,
    max_live_env_desks: 2,
    max_copy_follows: 1,
  },
);

const closed = overviewPlanGroups(
  {
    features: emptyFeatures(),
    caps: { ...emptyCaps(), max_paper_desks: 0, max_backtest_years: 0 },
    affiliateL1Pct: 0,
    affiliateL2Pct: 0,
    affiliateL3Pct: 0,
    affiliateL4Pct: 0,
    affiliateL5Pct: 0,
  },
  { ...usage, max_paper_desks: 0, max_followers_accepted: 4 },
);
assert.equal(
  line(closed, "Maximum Desks (any type)", "cap:max_paper_desks").text,
  "—",
);
assert.equal(
  line(closed, "Copy Trading", "cap:max_followers_accepted").text,
  "—",
);
assert.equal(line(closed, "Copy Trading", "cap:max_followers_accepted").note, null);
assert.equal(line(closed, "Backtesting", "cap:max_backtest_years").text, "—");
assert.ok(closed.find((group) => group.title === "Replay Studio"));
assert.equal(closed.length, PLAN_COMPARE_SECTIONS.length);

const trialFeatures = emptyFeatures();
const trialCaps = emptyCaps();
trialCaps.max_stored_backtests = 0;
trialCaps.max_backtest_years = 1;
const trialPlan = {
  features: trialFeatures,
  caps: trialCaps,
  trials: {
    features: { research_backtest: { days: 14 }, replay_backtests: { days: 14 } },
    caps: {
      max_stored_backtests: { days: 14, limit: 3 },
      max_backtest_years: { days: 14, limit: 3 },
    },
  },
  affiliateL1Pct: 0,
  affiliateL2Pct: 0,
  affiliateL3Pct: 0,
  affiliateL4Pct: 0,
  affiliateL5Pct: 0,
};
const openTrials = overviewPlanGroups(trialPlan, usage, {
  grants: [
    { key: "research_backtest", startedAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-10-15T00:00:00.000Z" },
    { key: "replay_backtests", startedAt: "2026-09-01T00:00:00.000Z", endsAt: "2026-09-15T00:00:00.000Z" },
    { key: "max_stored_backtests", startedAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-10-15T00:00:00.000Z" },
    { key: "max_backtest_years", startedAt: "2026-09-01T00:00:00.000Z", endsAt: "2026-09-15T00:00:00.000Z" },
  ],
  nowMs: Date.parse("2026-10-09T00:00:00.000Z"),
});
assert.equal(
  line(openTrials, "Backtesting", "feature:research_backtest").text,
  "14-day trial",
);
assert.equal(
  line(openTrials, "Backtesting", "feature:research_backtest").trial?.phase,
  "active",
);
assert.equal(
  line(openTrials, "Replay Studio", "feature:replay_backtests").text,
  "Trial ended",
);
assert.equal(
  line(openTrials, "Backtesting", "cap:max_stored_backtests").text,
  "3 of 3 · trial",
);
const years = line(openTrials, "Backtesting", "cap:max_backtest_years");
assert.equal(years.text, "1 year");
assert.equal(years.trial?.phase, "ended");
assert.equal(years.trial?.emphasize, false);
