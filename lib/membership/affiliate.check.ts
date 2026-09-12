import assert from "node:assert/strict";
import {
  canCreateCommissionInvoice,
  commissionUsd,
  conversionPct,
  enrollState,
  generateReferralCode,
  holdHasElapsed,
  holdUntilIso,
  parseAffiliateHoldDays,
  parseAffiliateMaxDepth,
  parseAffiliateMinPayout,
  parseOptionalReferralCode,
  parseReferralCode,
  parseUsdtNetworks,
  ratePctForLevel,
  referralShareUrl,
  resolveEarnDepth,
  walkUpline,
  withdrawDecision,
  wouldCreateReferralCycle,
} from "./affiliate";

assert.equal(parseAffiliateMaxDepth(2).ok, true);
assert.equal(parseAffiliateMaxDepth(5).ok, true);
assert.equal(parseAffiliateMaxDepth(6).ok, false);
assert.equal(parseAffiliateMaxDepth(0).ok, false);
assert.equal(parseAffiliateHoldDays(0).ok, true);
assert.equal(parseAffiliateHoldDays(-1).ok, false);
assert.equal(parseAffiliateMinPayout("50").ok, true);
assert.deepEqual(parseUsdtNetworks("ethereum, Arbitrum"), {
  ok: true,
  networks: ["ethereum", "arbitrum"],
});
assert.equal(parseUsdtNetworks("").ok, false);

assert.equal(parseReferralCode("ab-12").ok, true);
assert.equal(parseOptionalReferralCode("").ok, true);
if (parseOptionalReferralCode("").ok) {
  assert.equal(parseOptionalReferralCode("").ok, true);
}
const emptyCode = parseOptionalReferralCode("   ");
assert.equal(emptyCode.ok, true);
if (emptyCode.ok) {
  assert.equal(emptyCode.code, null);
}

assert.equal(generateReferralCode(Uint8Array.from([0, 1, 2, 3])).length, 4);
assert.equal(resolveEarnDepth(5, 2), 2);
assert.equal(resolveEarnDepth(2, 5), 2);
assert.equal(resolveEarnDepth(2, null), 2);
assert.equal(ratePctForLevel([10, 5, 0], 1, 2), 10);
assert.equal(ratePctForLevel([10, 5, 0], 2, 1), 0);
assert.equal(ratePctForLevel([10, 0, 2], 2, 3), 0);
assert.equal(commissionUsd(19, 10), 1.9);
assert.equal(commissionUsd(0.009, 10), 0);

assert.equal(holdHasElapsed(holdUntilIso(1_000, 0), 1_000), true);
assert.equal(holdHasElapsed(holdUntilIso(1_000, 1), 1_000), false);

assert.equal(enrollState({ currentEnroll: true, lastEnrollPlanId: null }), "enrolled");
assert.equal(
  enrollState({ currentEnroll: false, lastEnrollPlanId: "plan-1" }),
  "lost",
);
assert.equal(
  enrollState({ currentEnroll: false, lastEnrollPlanId: null }),
  "never",
);

assert.equal(
  canCreateCommissionInvoice({ method: "stripe", status: "paid", amountUsd: 19 }),
  true,
);
assert.equal(
  canCreateCommissionInvoice({ method: "comp", status: "paid", amountUsd: 19 }),
  false,
);

const hops = [
  { userId: "b", referrerUserId: "a" },
  { userId: "c", referrerUserId: "b" },
];
assert.deepEqual(walkUpline(hops, "c", 5), [
  { earnerUserId: "b", level: 1 },
  { earnerUserId: "a", level: 2 },
]);
assert.equal(wouldCreateReferralCycle(hops, "a", "c"), true);
assert.equal(wouldCreateReferralCycle(hops, "d", "a"), false);
assert.equal(wouldCreateReferralCycle([], "a", "a"), true);

assert.equal(
  withdrawDecision({
    enrollState: "enrolled",
    arrears: false,
    payableUsd: 50,
    minPayoutUsd: 50,
  }).ok,
  true,
);
assert.equal(
  withdrawDecision({
    enrollState: "lost",
    arrears: false,
    payableUsd: 80,
    minPayoutUsd: 50,
  }).ok,
  false,
);
assert.equal(
  withdrawDecision({
    enrollState: "enrolled",
    arrears: true,
    payableUsd: 80,
    minPayoutUsd: 50,
  }).ok,
  false,
);
assert.equal(
  withdrawDecision({
    enrollState: "enrolled",
    arrears: false,
    payableUsd: 49.99,
    minPayoutUsd: 50,
  }).ok,
  false,
);

assert.equal(conversionPct(4, 1), 25);
assert.equal(conversionPct(0, 0), 0);
assert.equal(
  referralShareUrl("https://app.example", "AB12"),
  "https://app.example/?ref=AB12",
);

console.log("membership affiliate checks passed");
