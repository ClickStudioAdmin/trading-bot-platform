import assert from "node:assert/strict";
import { emptyCaps, emptyFeatures } from "./catalog";
import { parsePlanForm } from "./form";
import {
  effectiveCap,
  emptyPlanTrials,
  featureAccess,
  missingTrialGrants,
  parsePlanTrials,
  planTrialOffers,
  trialEndIso,
  trialMark,
  trialPhase,
} from "./trials";

const now = Date.parse("2026-10-09T00:00:00.000Z");
const plan = {
  features: emptyFeatures(),
  caps: { ...emptyCaps(), max_stored_backtests: 0, max_paper_desks: 2, max_bots: null },
  trials: {
    features: {
      research_backtest: { days: 14 },
      replay_backtests: { days: 14 },
      desk_dca: { days: 7 },
    },
    caps: {
      max_stored_backtests: { days: 14, limit: 3 },
      max_paper_desks: { days: 14, limit: 2 },
      max_bots: { days: 14, limit: 5 },
    },
  },
};
plan.features.desk_dca = true;

assert.deepEqual(emptyPlanTrials(), { features: {}, caps: {} });
assert.equal(parsePlanTrials(null).features.research_backtest, undefined);
assert.equal(
  parsePlanTrials({
    features: { research_backtest: { days: 14 }, nope: { days: 3 }, desk_dca: { days: 0 } },
    caps: { max_stored_backtests: { days: 14, limit: 3 }, max_bots: { days: 2 } },
  }).features.research_backtest?.days,
  14,
);
assert.equal(
  parsePlanTrials({
    caps: { max_stored_backtests: { days: 14, limit: 3 } },
  }).caps.max_stored_backtests?.limit,
  3,
);

const offers = planTrialOffers(plan);
assert.deepEqual(
  offers.map((offer) => offer.key).sort(),
  ["max_stored_backtests", "replay_backtests", "research_backtest"],
);

const first = missingTrialGrants({ offers, existing: [], nowMs: now });
assert.equal(first.length, 3);
assert.equal(first[0].endsAt, trialEndIso(now, 14));
const again = missingTrialGrants({
  offers,
  existing: first,
  nowMs: now + 86_400_000,
});
assert.equal(again.length, 0);

assert.equal(trialPhase(first[0].endsAt, now), "active");
assert.equal(trialPhase(first[0].endsAt, Date.parse(first[0].endsAt)), "ended");
assert.equal(featureAccess({ included: true, phase: "active" }), "included");
assert.equal(featureAccess({ included: false, phase: "active" }), "trial");
assert.equal(featureAccess({ included: false, phase: "ended" }), "closed");
assert.equal(
  effectiveCap({
    standing: 0,
    offer: offers.find((offer) => offer.key === "max_stored_backtests") ?? null,
    phase: "active",
  }),
  3,
);
assert.equal(
  effectiveCap({
    standing: 0,
    offer: offers.find((offer) => offer.key === "max_stored_backtests") ?? null,
    phase: "ended",
  }),
  0,
);
assert.equal(effectiveCap({ standing: null, offer: null, phase: null }), null);

const activeMark = trialMark({
  plan,
  row: { kind: "feature", key: "research_backtest", label: "Backtesting Tool" },
  grant: first[0],
  nowMs: now,
});
assert.equal(activeMark?.phase, "active");
assert.equal(activeMark?.label, "14-day trial");
assert.equal(activeMark?.keepStanding, false);

const offerMark = trialMark({
  plan,
  row: { kind: "feature", key: "replay_backtests", label: "Replay Backtests" },
  grant: null,
  nowMs: now,
});
assert.equal(offerMark?.phase, "offer");
assert.equal(offerMark?.endsAt, null);

const included = trialMark({
  plan,
  row: { kind: "feature", key: "desk_dca", label: "DCA" },
  grant: { endsAt: first[0].endsAt },
  nowMs: now,
});
assert.equal(included, null);

const form = new FormData();
form.set("name", "Free");
form.set("visibility", "public");
form.set("trial_on_research_backtest", "1");
form.set("trial_days_research_backtest", "14");
form.set("trial_on_replay_backtests", "1");
form.set("trial_days_replay_backtests", "14");
form.set("cap_max_stored_backtests", "0");
form.set("trial_on_max_stored_backtests", "1");
form.set("trial_limit_max_stored_backtests", "3");
form.set("trial_days_max_stored_backtests", "14");
const parsed = parsePlanForm(form);
assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.equal(parsed.values.trials.features.research_backtest?.days, 14);
  assert.equal(parsed.values.trials.caps.max_stored_backtests?.limit, 3);
  assert.equal(parsed.values.features.research_backtest, false);
}

const missingDays = new FormData();
missingDays.set("name", "Free");
missingDays.set("visibility", "public");
missingDays.set("trial_on_research_backtest", "1");
assert.equal(parsePlanForm(missingDays).ok, false);

const lowLimit = new FormData();
lowLimit.set("name", "Free");
lowLimit.set("visibility", "public");
lowLimit.set("cap_max_paper_desks", "2");
lowLimit.set("trial_on_max_paper_desks", "1");
lowLimit.set("trial_limit_max_paper_desks", "2");
lowLimit.set("trial_days_max_paper_desks", "14");
assert.equal(parsePlanForm(lowLimit).ok, false);

const ignoredCap = new FormData();
ignoredCap.set("name", "Free");
ignoredCap.set("visibility", "public");
ignoredCap.set("cap_max_paper_desks", "2");
ignoredCap.set("trial_limit_max_paper_desks", "2");
ignoredCap.set("trial_days_max_paper_desks", "14");
const ignored = parsePlanForm(ignoredCap);
assert.equal(ignored.ok, true);
if (ignored.ok) {
  assert.equal(ignored.values.trials.caps.max_paper_desks, undefined);
}

console.log("membership trial checks passed");
