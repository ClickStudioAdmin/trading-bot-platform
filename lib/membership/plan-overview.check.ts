import assert from "node:assert/strict";
import { emptyCaps, emptyFeatures } from "./catalog";
import {
  overviewPlanPrivileges,
  overviewPlanUsage,
  planDeskCounts,
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

const plan = { features, caps };

assert.deepEqual(
  overviewPlanPrivileges(plan).map((group) => [group.title, group.items]),
  [
    ["Manual Desk Types", ["Perps"]],
    ["Automated Desk Types", ["DCA"]],
    ["Bots & Templates", ["Save Templates"]],
    ["Copy Trading", ["Desk Sharing - Private"]],
    ["Backtesting", ["Backtesting Tool"]],
  ],
);

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

const usage: PlanUsageCounts = {
  max_paper_desks: 2,
  max_demo_desks: 0,
  max_live_env_desks: 1,
  max_bots: 4,
  max_copy_follows: 3,
  max_followers_accepted: 2,
  max_stored_backtests: 3,
};

const rows = overviewPlanUsage(plan, usage);
function row(key: string) {
  const found = rows.find((item) => item.key === key);
  assert.ok(found, key);
  return found;
}

assert.equal(row("max_paper_desks").text, "2 of 2");
assert.equal(row("max_paper_desks").over, false);
assert.equal(row("max_demo_desks").text, "0 of 1");
assert.equal(row("max_live_env_desks").text, "1 of 0");
assert.equal(row("max_live_env_desks").over, true);
assert.equal(row("max_bots").text, "4 of Unlimited");
assert.equal(row("max_copy_follows").text, "3 of 2");
assert.equal(row("max_copy_follows").over, true);
assert.equal(row("max_followers_accepted").text, "2 of 5");
assert.equal(row("max_followers_accepted").note, "Highest on one desk");
assert.equal(row("max_stored_backtests").text, "3 of 3");
assert.equal(row("max_backtest_years").text, "2 years");
assert.equal(row("affiliate_max_depth").text, "3");

const closed = overviewPlanUsage(
  {
    features: emptyFeatures(),
    caps: { ...emptyCaps(), max_paper_desks: 0, max_backtest_years: 0 },
  },
  { ...usage, max_paper_desks: 0, max_followers_accepted: 4 },
);
assert.equal(
  closed.find((item) => item.key === "max_paper_desks")?.text,
  "Not included",
);
assert.equal(
  closed.find((item) => item.key === "max_followers_accepted")?.text,
  "Not included",
);
assert.equal(
  closed.find((item) => item.key === "max_backtest_years")?.text,
  "Not included",
);
assert.equal(overviewPlanPrivileges({ features: emptyFeatures(), caps }).length, 0);
