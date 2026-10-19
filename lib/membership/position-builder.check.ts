import assert from "node:assert/strict";
import { emptyCaps, emptyFeatures, type PlanFeatures } from "./catalog";
import { parsePlanForm } from "./form";
import {
  positionBuilderAccess,
  positionBuilderNotAllowedMessage,
  positionBuilderTrialEndedMessage,
  positionBuilderTrialOpenMessage,
  type UnlockCandidate,
} from "./entitlements";
import { emptyPlanTrials, type PlanTrials } from "./trials";
import {
  countPositionBuilderParts,
  emptyPositionBuilderCounts,
  positionBuilderGrew,
  positionBuilderSaveDenial,
} from "./position-builder";

const nowMs = Date.parse("2026-10-14T00:00:00.000Z");

function features(on: Partial<PlanFeatures> = {}): PlanFeatures {
  return { ...emptyFeatures(), ...on };
}

function plus(): UnlockCandidate {
  return {
    name: "Plus",
    visibility: "public",
    archivedAt: null,
    priceUsd: 20,
    sortOrder: 2,
    features: features({ position_builder: true }),
  };
}

function access(input: {
  on?: Partial<PlanFeatures>;
  trials?: PlanTrials;
  grants?: { key: string; endsAt: string }[];
  plans?: UnlockCandidate[];
}) {
  return positionBuilderAccess({
    features: features(input.on),
    trials: input.trials ?? emptyPlanTrials(),
    grants: input.grants ?? [],
    nowMs,
    plans: input.plans ?? [],
  });
}

assert.equal(
  positionBuilderNotAllowedMessage("Plus"),
  "Position Builder is not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(
  positionBuilderNotAllowedMessage(null),
  "Position Builder is not allowed on your plan.",
);
assert.equal(
  positionBuilderTrialEndedMessage("01/10/2026"),
  "Your free trial of Position Builder ended on 01/10/2026.",
);
assert.equal(
  positionBuilderTrialOpenMessage("28/10/2026"),
  "Position Builder is in a free trial until 28/10/2026.",
);

const closed = access({ plans: [plus()] });
assert.equal(closed.allowed, false);
assert.equal(
  closed.message,
  "Position Builder is not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(closed.upgradePlan, "Plus");

const unnamed = access({
  plans: [
    {
      ...plus(),
      name: "Secret",
      visibility: "private",
      priceUsd: 1,
    },
  ],
});
assert.equal(unnamed.allowed, false);
assert.equal(unnamed.upgradePlan, null);
assert.equal(unnamed.message, "Position Builder is not allowed on your plan.");

const open = access({
  trials: { features: { position_builder: { days: 14 } }, caps: {} },
  grants: [{ key: "position_builder", endsAt: "2026-10-28T00:00:00.000Z" }],
  plans: [plus()],
});
assert.equal(open.allowed, true);
assert.equal(open.message, "Position Builder is in a free trial until 28/10/2026.");

const ended = access({
  trials: { features: { position_builder: { days: 14 } }, caps: {} },
  grants: [{ key: "position_builder", endsAt: "2026-10-01T00:00:00.000Z" }],
  plans: [plus()],
});
assert.equal(ended.allowed, false);
assert.equal(
  ended.message,
  "Your free trial of Position Builder ended on 01/10/2026.",
);
assert.equal(ended.upgradePlan, "Plus");

const endedPrivate = access({
  trials: { features: { position_builder: { days: 14 } }, caps: {} },
  grants: [{ key: "position_builder", endsAt: "2026-10-01T00:00:00.000Z" }],
});
assert.equal(endedPrivate.upgradePlan, null);
assert.equal(
  endedPrivate.message,
  "Your free trial of Position Builder ended on 01/10/2026.",
);

const included = access({ on: { position_builder: true } });
assert.equal(included.allowed, true);
assert.equal(included.message, null);

const kept = countPositionBuilderParts({
  entryStack: { leaves: [{}, {}], joins: ["and", "or"] },
  addStack: { leaves: [{}], joins: ["and"] },
  exitActions: [{ groups: [{ rows: [{}] }, { rows: [] }] }],
});
assert.deepEqual(kept, { conditions: 4, groups: 2, actions: 1 });
assert.equal(positionBuilderGrew(kept, kept), false);
assert.equal(
  positionBuilderGrew(kept, { conditions: 3, groups: 2, actions: 1 }),
  false,
);
assert.equal(
  positionBuilderGrew(kept, { conditions: 5, groups: 2, actions: 1 }),
  true,
);
assert.equal(
  positionBuilderGrew(kept, { conditions: 4, groups: 3, actions: 1 }),
  true,
);
assert.equal(
  positionBuilderGrew(kept, { conditions: 4, groups: 2, actions: 2 }),
  true,
);

const grown = { conditions: 5, groups: 2, actions: 1 };
assert.equal(positionBuilderSaveDenial(included, kept, grown), null);
assert.equal(positionBuilderSaveDenial(open, kept, grown), null);
assert.equal(positionBuilderSaveDenial(ended, kept, kept), null);
assert.equal(
  positionBuilderSaveDenial(ended, kept, { conditions: 3, groups: 1, actions: 0 }),
  null,
);
assert.equal(
  positionBuilderSaveDenial(ended, kept, grown),
  "Your free trial of Position Builder ended on 01/10/2026.",
);
assert.equal(
  positionBuilderSaveDenial(closed, emptyPositionBuilderCounts(), {
    conditions: 1,
    groups: 0,
    actions: 0,
  }),
  "Position Builder is not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(
  positionBuilderSaveDenial(unnamed, emptyPositionBuilderCounts(), {
    conditions: 0,
    groups: 0,
    actions: 1,
  }),
  "Position Builder is not allowed on your plan.",
);

assert.deepEqual(
  countPositionBuilderParts({
    confirm: { kind: "rsi" },
    shortEntryStack: { leaves: [{}], joins: ["and"] },
    shortConfirm: { kind: "rsi" },
    exitStack: { leaves: [{}, {}], joins: ["or", "and"] },
  }),
  { conditions: 4, groups: 1, actions: 0 },
);
assert.deepEqual(countPositionBuilderParts(null), emptyPositionBuilderCounts());

const form = new FormData();
form.set("name", "Plus");
form.set("sortOrder", "2");
form.set("priceUsd", "20");
form.set("visibility", "public");
form.set("feature_position_builder", "1");
form.set("trial_on_position_builder", "1");
form.set("trial_days_position_builder", "14");
for (const key of ["affiliateL1Pct", "affiliateL2Pct", "affiliateL3Pct", "affiliateL4Pct", "affiliateL5Pct"]) {
  form.set(key, "0");
}
const parsed = parsePlanForm(form);
assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.equal(parsed.values.features.position_builder, true);
  assert.equal(parsed.values.trials.features.position_builder?.days, 14);
  assert.equal(parsed.values.caps.max_bots, null);
}

const trialOnly = new FormData();
trialOnly.set("name", "Free");
trialOnly.set("sortOrder", "1");
trialOnly.set("priceUsd", "0");
trialOnly.set("visibility", "public");
trialOnly.set("trial_on_position_builder", "1");
trialOnly.set("trial_days_position_builder", "7");
for (const key of ["affiliateL1Pct", "affiliateL2Pct", "affiliateL3Pct", "affiliateL4Pct", "affiliateL5Pct"]) {
  trialOnly.set(key, "0");
}
const trialParsed = parsePlanForm(trialOnly);
assert.equal(trialParsed.ok, true);
if (trialParsed.ok) {
  assert.equal(trialParsed.values.features.position_builder, false);
  assert.equal(trialParsed.values.trials.features.position_builder?.days, 7);
}

assert.equal(emptyCaps().max_bots, null);

console.log("position builder plan checks passed");
