import assert from "node:assert/strict";
import { emptyFeatures, type PlanFeatures } from "@/lib/membership/catalog";
import { emptyPlanTrials, type PlanTrials } from "@/lib/membership/trials";
import {
  allowedDeskTypes,
  cheapestPublicPlanName,
  deniedDeskTypeMessage,
  deskTypeAccessList,
  deskTypeUpgradeMessage,
  type UnlockCandidate,
} from "@/lib/membership/entitlements";

const nowMs = Date.parse("2026-10-14T00:00:00.000Z");

function features(on: Partial<PlanFeatures> = {}): PlanFeatures {
  return { ...emptyFeatures(), ...on };
}

function unlock(
  name: string,
  extra: Partial<UnlockCandidate> & { on?: Partial<PlanFeatures> } = {},
): UnlockCandidate {
  return {
    name,
    visibility: extra.visibility ?? "public",
    archivedAt: extra.archivedAt ?? null,
    priceUsd: extra.priceUsd ?? 0,
    sortOrder: extra.sortOrder ?? 0,
    features: features(extra.on),
  };
}

function access(input: {
  on?: Partial<PlanFeatures>;
  trials?: PlanTrials;
  grants?: { key: string; endsAt: string }[];
  plans?: UnlockCandidate[];
}) {
  return deskTypeAccessList({
    features: features(input.on),
    trials: input.trials ?? emptyPlanTrials(),
    grants: input.grants ?? [],
    nowMs,
    plans: input.plans ?? [],
  });
}

function row(
  rows: ReturnType<typeof access>,
  deskType: "dca" | "perps" | "perps_bots" | "cash_and_carry" | "signal_follower",
) {
  const found = rows.find((item) => item.deskType === deskType);
  assert.ok(found);
  return found;
}

const plus = unlock("Plus", { priceUsd: 20, sortOrder: 2, on: { desk_dca: true } });

assert.equal(
  deskTypeUpgradeMessage("dca", "Plus"),
  "DCA desks are not allowed on your plan. Upgrade to Plus to enable it.",
);

const closed = access({ plans: [plus] });
assert.equal(row(closed, "dca").allowed, false);
assert.equal(
  row(closed, "dca").message,
  "DCA desks are not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(row(closed, "perps").allowed, false);
assert.equal(
  row(closed, "perps_bots").message,
  "Perps bots desks are not allowed on your plan.",
);

const included = access({ on: { desk_dca: true }, plans: [plus] });
assert.equal(row(included, "dca").allowed, true);
assert.equal(row(included, "dca").message, null);

const secret = unlock("Secret", {
  visibility: "private",
  priceUsd: 1,
  sortOrder: 0,
  on: { desk_dca: true },
});
const named = access({ plans: [secret, plus] });
assert.equal(
  row(named, "dca").message,
  "DCA desks are not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(
  cheapestPublicPlanName(
    [
      unlock("Archive", {
        priceUsd: 0,
        archivedAt: "2026-01-01T00:00:00.000Z",
        on: { desk_dca: true },
      }),
      unlock("Draft", {
        visibility: "draft",
        priceUsd: 0,
        on: { desk_dca: true },
      }),
      unlock("Pro", { priceUsd: 20, sortOrder: 1, on: { desk_dca: true } }),
      plus,
    ],
    "desk_dca",
  ),
  "Pro",
);

const none = access({ plans: [secret] });
assert.equal(
  row(none, "dca").message,
  "DCA desks are not allowed on your plan.",
);
assert.equal(
  deniedDeskTypeMessage(none, "dca"),
  "DCA desks are not allowed on your plan.",
);
assert.equal(deniedDeskTypeMessage(included, "dca"), null);

const openGrant = access({
  trials: { features: { desk_dca: { days: 14 } }, caps: {} },
  grants: [{ key: "desk_dca", endsAt: "2026-10-28T00:00:00.000Z" }],
});
assert.equal(row(openGrant, "dca").allowed, true);
assert.equal(
  row(openGrant, "dca").message,
  "DCA is in a free trial until 28/10/2026.",
);

const unstarted = access({
  trials: { features: { desk_dca: { days: 14 } }, caps: {} },
});
assert.equal(row(unstarted, "dca").allowed, true);
assert.equal(row(unstarted, "dca").message, "DCA is in a free trial.");

const ended = access({
  trials: { features: { desk_dca: { days: 14 } }, caps: {} },
  grants: [{ key: "desk_dca", endsAt: "2026-10-01T00:00:00.000Z" }],
  plans: [plus],
});
assert.equal(row(ended, "dca").allowed, false);
assert.equal(
  row(ended, "dca").message,
  "Your free trial of DCA ended on 01/10/2026.",
);

const includedBeatsTrial = access({
  on: { desk_dca: true },
  trials: { features: { desk_dca: { days: 14 } }, caps: {} },
  grants: [{ key: "desk_dca", endsAt: "2026-10-01T00:00:00.000Z" }],
});
assert.equal(row(includedBeatsTrial, "dca").allowed, true);
assert.equal(row(includedBeatsTrial, "dca").message, null);

assert.deepEqual(allowedDeskTypes(closed), []);
assert.deepEqual(allowedDeskTypes(included), ["dca"]);

console.log("desk type entitlement checks passed");
