import assert from "node:assert/strict";
import {
  canCreateCommissionInvoice,
  commissionUsd,
  conversionPct,
  generateReferralCode,
  holdHasElapsed,
  holdUntilIso,
  firstTouchReferralCode,
  parseAffiliateCookieDays,
  parseAffiliateHoldDays,
  affiliateLandingLabel,
  affiliateLandingPath,
  affiliateLinkKindLabel,
  affiliateLinkShareUrl,
  affiliateRowShareUrl,
  affiliatePortalPath,
  generateAffiliateLinkSlug,
  parseAffiliateLanding,
  parseAffiliateLabel,
  parseAffiliateLinkSlug,
  parseAffiliatePortalTab,
  parseAffiliateMaxDepth,
  parseAffiliateMinPayout,
  parseOptionalReferralCode,
  affiliateRateSource,
  parsePayoutNetwork,
  parseProgramDefaultRates,
  parseReferralCode,
  ratePctForLevel,
  referralShareUrl,
  resolveEarnDepth,
  unpaidUsesProgramAffiliateRates,
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
assert.equal(parseAffiliateCookieDays(30).ok, true);
assert.equal(parseAffiliateCookieDays(0).ok, false);
assert.equal(parseAffiliateCookieDays(3651).ok, false);
assert.equal(firstTouchReferralCode("AB12", "CD34"), "AB12");
assert.equal(firstTouchReferralCode(null, "cd-34"), "CD-34");
assert.equal(firstTouchReferralCode(null, null), null);
assert.equal(parseAffiliateMinPayout("50").ok, true);
assert.deepEqual(
  parseProgramDefaultRates({ l1: "10", l2: "5", l3: 0, l4: 0, l5: 0 }),
  {
    ok: true,
    defaultL1Pct: 10,
    defaultL2Pct: 5,
    defaultL3Pct: 0,
    defaultL4Pct: 0,
    defaultL5Pct: 0,
  },
);
assert.equal(
  parseProgramDefaultRates({ l1: 80, l2: 20, l3: 1, l4: 0, l5: 0 }).ok,
  false,
);
assert.equal(affiliateRateSource({ platformMember: false, pastDue: false }), "program");
assert.equal(affiliateRateSource({ platformMember: true, pastDue: true }), "program");
assert.equal(affiliateRateSource({ platformMember: true, pastDue: false }), "plan");

assert.deepEqual(parsePayoutNetwork("arbitrum-sepolia", ["arbitrum-sepolia"]), {
  ok: true,
  network: "arbitrum-sepolia",
});
assert.equal(parsePayoutNetwork("ethereum", ["arbitrum-sepolia"]).ok, false);

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

assert.equal(unpaidUsesProgramAffiliateRates("past_due"), true);
assert.equal(unpaidUsesProgramAffiliateRates("active"), false);
assert.equal(unpaidUsesProgramAffiliateRates("comp"), false);
assert.equal(unpaidUsesProgramAffiliateRates("canceled"), false);

assert.equal(holdHasElapsed(holdUntilIso(1_000, 0), 1_000), true);
assert.equal(holdHasElapsed(holdUntilIso(1_000, 1), 1_000), false);

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
    arrears: false,
    payableUsd: 50,
    minPayoutUsd: 50,
  }).ok,
  true,
);
assert.equal(
  withdrawDecision({
    arrears: true,
    payableUsd: 80,
    minPayoutUsd: 50,
  }).ok,
  false,
);
assert.equal(
  withdrawDecision({
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
  "https://app.example/affiliates?ref=AB12",
);
assert.equal(parseAffiliatePortalTab("network"), "network");
assert.equal(parseAffiliatePortalTab("links"), "links");
assert.equal(parseAffiliatePortalTab("nope"), "overview");
assert.equal(
  affiliatePortalPath("payouts", { saved: "withdraw" }),
  "/affiliates?tab=payouts&saved=withdraw",
);
assert.equal(
  affiliatePortalPath("links", { saved: "campaign" }),
  "/affiliates?tab=links&saved=campaign",
);
assert.equal(parseAffiliateLanding("home").ok, true);
assert.equal(parseAffiliateLanding("affiliates").ok, true);
assert.equal(parseAffiliateLanding("pricing").ok, false);
assert.equal(affiliateLandingPath("home"), "/");
assert.equal(affiliateLandingPath("affiliates"), "/affiliates");
assert.equal(affiliateLandingLabel("home"), "Home page");
assert.equal(
  affiliateLinkShareUrl("https://app.example", "AB12CD"),
  "https://app.example/r/AB12CD",
);
assert.equal(affiliateLinkKindLabel("system"), "System");
assert.equal(affiliateLinkKindLabel("custom"), "Custom");
assert.equal(
  affiliateRowShareUrl("https://app.example", { kind: "system", slug: "AB12" }),
  "https://app.example/affiliates?ref=AB12",
);
assert.equal(
  affiliateRowShareUrl("https://app.example", {
    kind: "custom",
    slug: "AB12CD",
  }),
  "https://app.example/r/AB12CD",
);
assert.deepEqual(parseAffiliateLinkSlug("ab12cd"), {
  ok: true,
  slug: "AB12CD",
});
assert.equal(parseAffiliateLinkSlug("ab").ok, false);
assert.equal(parseAffiliateLabel("Spring", 40, "Enter a name.").ok, true);
assert.equal(parseAffiliateLabel("", 40, "Enter a name.").ok, false);
assert.equal(generateAffiliateLinkSlug(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7])).length, 8);

console.log("membership affiliate checks passed");
