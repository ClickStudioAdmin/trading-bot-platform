import assert from "node:assert/strict";
import {
  canCreateCommissionInvoice,
  commissionReversalUsd,
  commissionUsd,
  countsTowardEarnedCommission,
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
  canArchiveAffiliateLink,
  affiliateLinkShareUrl,
  affiliateRowShareUrl,
  affiliateNetworkPath,
  affiliatePortalPath,
  affiliatePortalPagePath,
  affiliateListQueryParams,
  matchesAffiliateArchiveStatus,
  matchesAffiliateNeedle,
  parseAffiliatePortalListQuery,
  affiliateDownlineRowHref,
  affiliateOrgChartNodeHtml,
  affiliateOrgLevelBadge,
  affiliateOrgPlanLabel,
  affiliateOrgRunRateLabel,
  affiliateOrgRunRateUsd,
  affiliateDownlinePersonMeta,
  affiliateNetworkLabel,
  sortDownlineNewestFirst,
  sumAffiliateOrgRunRate,
  affiliatePageLabel,
  escapeHtmlText,
  flattenAffiliateOrgChart,
  searchAffiliateOrgChart,
  affiliateOrgPathToRoot,
  AFFILIATE_ORG_MIN_ZOOM,
  AFFILIATE_ORG_ROOT_ID,
  affiliateOrgAutoZoom,
  affiliateOrgUserZoomedOut,
  affiliatePortalPageForIndex,
  paginateAffiliateList,
  parseAffiliateNetworkView,
  parseAffiliateOrgLayout,
  affiliateOrgLayoutLabel,
  parseAffiliateOrgDensity,
  affiliateOrgDensityLabel,
  AFFILIATE_ORG_DEFAULT_DENSITY,
  parseAffiliatePortalPage,
  AFFILIATE_PORTAL_PAGE_SIZE,
  generateAffiliateLinkSlug,
  affiliateAirdropCsv,
  chunkPayoutsForAirdropFiles,
  mergePayoutsForAirdrop,
  parsePayoutFileMaxAmount,
  parsePayoutFileMaxRows,
  parsePayoutFileNetwork,
  parseAffiliateAlias,
  parseAffiliateLanding,
  parseAffiliateLabel,
  parsePayoutFileStatus,
  parsePayoutStatus,
  adminPayoutsPath,
  isOpenWalletWithdraw,
  openWithdrawUsd,
  parsePayoutBook,
  payoutEligibleForAirdropFile,
  payoutStatusLabel,
  shortenPayoutAddress,
  summarizeAdminPayoutQueue,
  parseAffiliateLinkSlug,
  parseAffiliatePortalTab,
  parseAffiliateMaxDepth,
  parseAffiliateMinPayout,
  parseAutoPayoutUsd,
  parseOptionalReferralCode,
  autoPayoutDecision,
  affiliateRateSource,
  parsePayoutAmount,
  parsePayoutNetwork,
  parseProgramDefaultRates,
  pickCommissionsForPayout,
  parseReferralCode,
  ratePctForLevel,
  affiliateRateCardRows,
  referralShareUrl,
  resolveEarnDepth,
  unpaidUsesProgramAffiliateRates,
  walkUpline,
  withdrawAmountDecision,
  withdrawDecision,
  wouldCreateReferralCycle,
} from "./affiliate";
import { buildAffiliateTree } from "./affiliate-store";

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
assert.equal(
  countsTowardEarnedCommission({ status: "payable", amountUsd: 10 }),
  true,
);
assert.equal(
  countsTowardEarnedCommission({ status: "void", amountUsd: 10 }),
  false,
);
assert.equal(
  countsTowardEarnedCommission({ status: "void", amountUsd: -10 }),
  true,
);
assert.equal(commissionReversalUsd(12.5), -12.5);
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
assert.deepEqual(
  affiliateRateCardRows([15, 10, 0, 0, 0], 5).map((row) => ({
    level: row.level,
    active: row.active,
    ratePct: row.ratePct,
  })),
  [
    { level: 1, active: true, ratePct: 15 },
    { level: 2, active: true, ratePct: 10 },
    { level: 3, active: false, ratePct: 0 },
    { level: 4, active: false, ratePct: 0 },
    { level: 5, active: false, ratePct: 0 },
  ],
);
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
assert.equal(
  (
    withdrawDecision({
      arrears: false,
      payableUsd: 80,
      minPayoutUsd: 100,
      balanceNoun: "Account Balance",
    }) as { ok: false; reason: string }
  ).reason,
  "Account Balance must be at least $100.00.",
);
assert.deepEqual(parsePayoutAmount("75.5"), { ok: true, amountUsd: 75.5 });
assert.equal(parsePayoutAmount("").ok, false);
assert.equal(
  withdrawAmountDecision({
    payableUsd: 120,
    minPayoutUsd: 50,
    amountUsd: 50,
  }).ok,
  true,
);
assert.equal(
  withdrawAmountDecision({
    payableUsd: 120,
    minPayoutUsd: 50,
    amountUsd: 49.99,
  }).ok,
  false,
);
assert.equal(
  withdrawAmountDecision({
    payableUsd: 120,
    minPayoutUsd: 50,
    amountUsd: 120.01,
  }).ok,
  false,
);
assert.deepEqual(
  pickCommissionsForPayout(
    [{ amountUsd: 40 }, { amountUsd: 40 }, { amountUsd: 40 }],
    50,
  ).map((row) => row.amountUsd),
  [40, 40],
);
assert.deepEqual(
  pickCommissionsForPayout(
    [{ amountUsd: 40 }, { amountUsd: 40 }, { amountUsd: 40 }],
    120,
  ).map((row) => row.amountUsd),
  [40, 40, 40],
);
assert.equal(parseAutoPayoutUsd("50", 50).ok, false);
assert.deepEqual(parseAutoPayoutUsd("50.01", 50), { ok: true, usd: 50.01 });
assert.equal(
  autoPayoutDecision({
    autoPayout: true,
    autoPayoutUsd: 80,
    minPayoutUsd: 50,
    payableUsd: 80,
    arrears: false,
    address: "0xabc",
    network: "arbitrum",
  }).ok,
  true,
);
assert.equal(
  autoPayoutDecision({
    autoPayout: true,
    autoPayoutUsd: 80,
    minPayoutUsd: 50,
    payableUsd: 79.99,
    arrears: false,
    address: "0xabc",
    network: "arbitrum",
  }).ok,
  false,
);
assert.equal(
  autoPayoutDecision({
    autoPayout: true,
    autoPayoutUsd: 50,
    minPayoutUsd: 50,
    payableUsd: 80,
    arrears: false,
    address: "0xabc",
    network: "arbitrum",
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
assert.equal(parseAffiliatePortalTab("campaigns"), "campaigns");
assert.equal(parseAffiliatePortalTab("links"), "links");
assert.equal(parseAffiliatePortalTab("referrals"), "referrals");
assert.equal(parseAffiliatePortalTab("payouts"), "payouts");
assert.equal(parseAffiliatePortalTab("settings"), "settings");
assert.equal(parseAffiliatePortalTab("nope"), "overview");
assert.equal(parseAffiliateNetworkView("chart"), "chart");
assert.equal(parseAffiliateNetworkView("list"), "list");
assert.equal(parseAffiliateNetworkView("nope"), "list");
assert.equal(parseAffiliateOrgLayout("left"), "left");
assert.equal(parseAffiliateOrgLayout("right"), "right");
assert.equal(parseAffiliateOrgLayout("bottom"), "bottom");
assert.equal(parseAffiliateOrgLayout("nope"), "top");
assert.equal(affiliateOrgLayoutLabel("top"), "Top");
assert.equal(affiliateOrgLayoutLabel("left"), "Left");
assert.equal(parseAffiliateOrgDensity("wide"), "wide");
assert.equal(parseAffiliateOrgDensity("nope"), "compact");
assert.equal(parseAffiliateOrgDensity(null), AFFILIATE_ORG_DEFAULT_DENSITY);
assert.equal(affiliateOrgDensityLabel("compact"), "Compact");
assert.equal(affiliateOrgDensityLabel("wide"), "Wide");
assert.equal(affiliateNetworkPath("list"), "/affiliates?tab=network");
assert.equal(
  affiliateNetworkPath("list", 2),
  "/affiliates?tab=network&page=2",
);
assert.equal(affiliateNetworkPath("chart"), "/affiliates?tab=network&view=chart");
assert.equal(
  affiliateNetworkPath("chart", 3),
  "/affiliates?tab=network&view=chart",
);
assert.equal(parsePayoutBook("main"), "main");
assert.equal(parsePayoutBook("affiliate"), "affiliate");
assert.equal(parsePayoutBook("nope"), "affiliate");
assert.equal(adminPayoutsPath("affiliate"), "/admin/affiliates");
assert.equal(
  adminPayoutsPath("main"),
  "/admin/billing?tab=withdrawals",
);
assert.equal(
  adminPayoutsPath("main", { saved: "files", count: "2" }),
  "/admin/billing?tab=withdrawals&saved=files&count=2",
);
assert.equal(isOpenWalletWithdraw("requested"), true);
assert.equal(isOpenWalletWithdraw("pending"), true);
assert.equal(isOpenWalletWithdraw("paid"), false);
assert.equal(
  openWithdrawUsd([
    { status: "requested", amountUsd: 40 },
    { status: "pending", amountUsd: 10 },
    { status: "paid", amountUsd: 99 },
  ]),
  50,
);
assert.equal(
  affiliatePortalPath("payouts", { saved: "withdraw" }),
  "/affiliates?tab=payouts&saved=withdraw",
);
assert.equal(
  affiliatePortalPath("campaigns", { saved: "campaign" }),
  "/affiliates?tab=campaigns&saved=campaign",
);
assert.equal(AFFILIATE_PORTAL_PAGE_SIZE, 20);
assert.equal(parseAffiliatePortalPage("3"), 3);
assert.equal(parseAffiliatePortalPage("0"), 1);
assert.equal(parseAffiliatePortalPage("nope"), 1);
assert.equal(affiliatePortalPagePath("network", 1), "/affiliates?tab=network");
assert.equal(
  affiliatePortalPagePath("network", 2),
  "/affiliates?tab=network&page=2",
);
assert.equal(
  affiliatePortalPagePath("referrals", 2, { q: "ada", status: "payable" }),
  "/affiliates?tab=referrals&q=ada&status=payable&page=2",
);
assert.equal(
  affiliateNetworkPath("list", 2, { status: "paid" }),
  "/affiliates?tab=network&status=paid&page=2",
);
{
  const query = parseAffiliatePortalListQuery("campaigns", {
    q: " spring ",
    status: "archived",
    sort: "signups",
    dir: "desc",
  });
  assert.deepEqual(query, {
    q: "spring",
    status: "archived",
    sort: "signups",
    dir: "desc",
  });
  assert.deepEqual(affiliateListQueryParams(query, "campaigns"), {
    q: "spring",
    status: "archived",
    sort: "signups",
    dir: "desc",
  });
  assert.equal(parseAffiliatePortalListQuery("campaigns", { status: "nope" }).status, "");
  assert.equal(parseAffiliatePortalListQuery("payouts", {}).sort, "date");
  assert.equal(parseAffiliatePortalListQuery("payouts", {}).dir, "desc");
}
assert.equal(matchesAffiliateNeedle("ada", "Ada Lovelace", "paid"), true);
assert.equal(matchesAffiliateNeedle("zzz", "Ada"), false);
assert.equal(matchesAffiliateArchiveStatus(null, "active"), true);
assert.equal(matchesAffiliateArchiveStatus("2026-01-01", "active"), false);
assert.equal(matchesAffiliateArchiveStatus("2026-01-01", "archived"), true);
assert.equal(affiliatePortalPageForIndex(0), 1);
assert.equal(affiliatePortalPageForIndex(19), 1);
assert.equal(affiliatePortalPageForIndex(20), 2);
assert.equal(affiliatePortalPageForIndex(-1), 1);
{
  const listed = paginateAffiliateList(
    Array.from({ length: 45 }, (_, index) => index + 1),
    2,
  );
  assert.equal(listed.page, 2);
  assert.equal(listed.pageCount, 3);
  assert.deepEqual(listed.rows, Array.from({ length: 20 }, (_, index) => index + 21));
  assert.equal(listed.from, 21);
  assert.equal(listed.to, 40);
  assert.equal(
    affiliatePageLabel(listed),
    "Showing 21–40 of 45",
  );
}
assert.equal(
  paginateAffiliateList(["a"], 9).page,
  1,
);
assert.equal(
  affiliateDownlineRowHref(
    "b",
    Array.from({ length: 21 }, (_, index) => ({
      userId: index === 20 ? "b" : `a${index}`,
    })),
  ),
  "/affiliates?tab=network&page=2#downline-b",
);
{
  const rows = flattenAffiliateOrgChart([
    {
      userId: "a",
      label: "Ann",
      level: 1,
      paid: true,
      children: [
        {
          userId: "b",
          label: "Bob",
          level: 2,
          paid: false,
          children: [],
        },
      ],
    },
  ]);
  assert.equal(rows[0]?.id, AFFILIATE_ORG_ROOT_ID);
  assert.equal(rows[0]?.parentId, null);
  assert.equal(rows[0]?.childCount, 1);
  assert.equal(rows[1]?.id, "a");
  assert.equal(rows[1]?.parentId, AFFILIATE_ORG_ROOT_ID);
  assert.equal(rows[2]?.id, "b");
  assert.equal(rows[2]?.parentId, "a");
  assert.equal(rows.length, 3);
}
assert.equal(affiliateOrgUserZoomedOut(AFFILIATE_ORG_MIN_ZOOM), false);
assert.equal(affiliateOrgUserZoomedOut(1.25), false);
assert.equal(affiliateOrgUserZoomedOut(0.8), true);
assert.equal(
  affiliateOrgAutoZoom({
    fitScale: 0.4,
    currentScale: AFFILIATE_ORG_MIN_ZOOM,
  }),
  AFFILIATE_ORG_MIN_ZOOM,
);
assert.equal(
  affiliateOrgAutoZoom({
    fitScale: 2,
    currentScale: AFFILIATE_ORG_MIN_ZOOM,
  }),
  2,
);
assert.equal(
  affiliateOrgAutoZoom({
    fitScale: 2,
    currentScale: 0.7,
  }),
  0.7,
);
assert.equal(
  affiliateOrgAutoZoom({
    fitScale: 1.1,
    currentScale: 1.8,
  }),
  1.8,
);
{
  const children = new Map<string, string[]>([
    ["root", ["a"]],
    ["a", ["b"]],
  ]);
  const tree = buildAffiliateTree(
    [
      {
        userId: "a",
        level: 1,
        label: "Ann",
        attributedAt: "2026-01-01T00:00:00.000Z",
        firstPaidAt: "2026-01-02T00:00:00.000Z",
        planPriceUsd: 10,
        planName: "Plus",
        campaignId: null,
        linkId: null,
      },
      {
        userId: "b",
        level: 2,
        label: "Bob",
        attributedAt: "2026-01-03T00:00:00.000Z",
        firstPaidAt: null,
        planPriceUsd: 0,
        planName: null,
        campaignId: null,
        linkId: null,
      },
    ],
    children,
    "root",
    { ratePctForLevel: (level) => (level === 1 ? 20 : 10) },
  );
  assert.equal(tree.length, 1);
  assert.equal(tree[0]?.label, "Ann");
  assert.equal(tree[0]?.paid, true);
  assert.equal(tree[0]?.planName, "Plus");
  assert.equal(tree[0]?.runRateUsd, 2);
  assert.equal(tree[0]?.children[0]?.label, "Bob");
  assert.equal(tree[0]?.children[0]?.paid, false);
  assert.equal(tree[0]?.children[0]?.runRateUsd, 0);
}
assert.equal(escapeHtmlText(`<x & "y">`), "&lt;x &amp; &quot;y&quot;&gt;");
assert.equal(
  affiliateOrgChartNodeHtml(
    {
      id: "a",
      parentId: "you",
      label: "Ann <x>",
      level: 1,
      paid: true,
      childCount: 0,
    },
    "/affiliates?tab=network#downline-a",
  ).includes("Ann &lt;x&gt;"),
  true,
);
{
  const rows = flattenAffiliateOrgChart([
    {
      userId: "a",
      label: "Ann",
      level: 1,
      paid: true,
      children: [
        {
          userId: "b",
          label: "Bob Smith",
          level: 2,
          paid: false,
          children: [],
        },
      ],
    },
  ]);
  assert.deepEqual(
    searchAffiliateOrgChart(rows, "bo").map((hit) => hit.id),
    ["b"],
  );
  assert.equal(searchAffiliateOrgChart(rows, "you")[0]?.id, AFFILIATE_ORG_ROOT_ID);
  assert.deepEqual(affiliateOrgPathToRoot(rows, "b"), [
    "b",
    "a",
    AFFILIATE_ORG_ROOT_ID,
  ]);
  assert.equal(searchAffiliateOrgChart(rows, "zzz").length, 0);
  const many = flattenAffiliateOrgChart(
    Array.from({ length: 12 }, (_, index) => ({
      userId: `k${index}`,
      label: `${String.fromCharCode(65 + index)} Kim`,
      level: 1,
      paid: true,
      children: [],
    })),
  );
  assert.equal(searchAffiliateOrgChart(many, "kim").length, 12);
  assert.equal(searchAffiliateOrgChart(many, "kim", 8).length, 8);
}
{
  const selected = affiliateOrgChartNodeHtml(
    {
      id: "a",
      parentId: "you",
      label: "Ann",
      level: 1,
      paid: true,
      childCount: 0,
    },
    null,
    { selected: true, onPath: true },
  );
  assert.equal(selected.includes('data-tone="selected"'), true);
  assert.equal(/#[0-9A-Fa-f]{3,8}/.test(selected), false);
}
assert.equal(affiliateOrgPlanLabel(null), "Affiliate");
assert.equal(affiliateOrgPlanLabel("Plus"), "Plus");
assert.equal(affiliateOrgLevelBadge(0), "You");
assert.equal(affiliateOrgLevelBadge(2), "L2");
assert.equal(
  affiliateOrgRunRateUsd({ planPriceUsd: 20, paid: true, ratePct: 10 }),
  2,
);
assert.equal(
  affiliateOrgRunRateUsd({ planPriceUsd: 20, paid: false, ratePct: 10 }),
  0,
);
assert.equal(affiliateOrgRunRateLabel(0), "Signup");
assert.equal(affiliateOrgRunRateLabel(0, "root"), "$0.00 / mo");
assert.equal(affiliateOrgRunRateLabel(2), "$2.00 / mo");
assert.equal(affiliateOrgRunRateLabel(1237.5), "$1,237.50 / mo");
{
  const paid = affiliateDownlinePersonMeta(
    {
      planName: "Plus",
      planPriceUsd: 20,
      firstPaidAt: "2026-01-01",
      level: 1,
    },
    {
      earnDepth: 2,
      rows: [
        { level: 1, ratePct: 10 },
        { level: 2, ratePct: 5 },
      ],
    },
  );
  assert.equal(paid.planLabel, "Plus");
  assert.equal(paid.runRateUsd, 2);
  assert.equal(paid.runRateLabel, "$2.00 / mo");
  const signup = affiliateDownlinePersonMeta(
    {
      planName: null,
      planPriceUsd: 0,
      firstPaidAt: null,
      level: 1,
    },
    { earnDepth: 2, rows: [{ level: 1, ratePct: 10 }] },
  );
  assert.equal(signup.planLabel, "Affiliate");
  assert.equal(signup.runRateLabel, "Signup");
}
assert.equal(affiliateNetworkLabel({ alias: "Ava", name: "Tim" }), "Ava");
assert.equal(affiliateNetworkLabel({ alias: "  ", name: "Tim Gale" }), "Tim Gale");
assert.equal(affiliateNetworkLabel({ alias: null, name: null }), "Member");
assert.deepEqual(
  sortDownlineNewestFirst([
    { userId: "old", attributedAt: "2026-01-01T00:00:00.000Z", level: 1 },
    { userId: "new", attributedAt: "2026-09-15T00:00:00.000Z", level: 1 },
    { userId: "mid", attributedAt: "2026-06-01T00:00:00.000Z", level: 2 },
  ]).map((row) => row.userId),
  ["new", "mid", "old"],
);
assert.equal(
  sumAffiliateOrgRunRate([
    { runRateUsd: 2, children: [{ runRateUsd: 1, children: [] }] },
  ]),
  3,
);
assert.equal(
  flattenAffiliateOrgChart(
    [
      {
        userId: "a",
        label: "Ann",
        level: 1,
        paid: true,
        planName: "Plus",
        runRateUsd: 2,
        children: [],
      },
    ],
    { planName: "Pro" },
  )[0]?.runRateUsd,
  2,
);
{
  const card = affiliateOrgChartNodeHtml(
    {
      id: "a",
      parentId: "you",
      label: "Ann",
      level: 1,
      paid: true,
      planName: "Plus",
      runRateUsd: 2,
      childCount: 0,
    },
    null,
  );
  assert.equal(card.includes("Plan"), true);
  assert.equal(card.includes("Plus"), true);
  assert.equal(card.includes("Monthly earnings"), true);
  assert.equal(card.includes("$2.00"), true);
  assert.equal(card.includes("L1"), true);
  assert.equal(card.includes("Plus · L1"), false);
}
assert.equal(
  affiliateOrgChartNodeHtml(
    {
      id: "a",
      parentId: "you",
      label: "Ann",
      level: 1,
      paid: false,
      planName: null,
      runRateUsd: 0,
      childCount: 0,
    },
    null,
  ).includes("Signup"),
  true,
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
assert.equal(canArchiveAffiliateLink("system"), false);
assert.equal(canArchiveAffiliateLink("custom"), true);
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
assert.equal(parsePayoutStatus("pending"), "pending");
assert.equal(parsePayoutFileStatus("pending"), "pending");
assert.equal(parsePayoutFileStatus("paid"), "paid");
assert.equal(payoutEligibleForAirdropFile("requested"), true);
assert.equal(payoutEligibleForAirdropFile("pending"), false);
assert.equal(payoutStatusLabel("pending"), "Pending");
assert.equal(
  shortenPayoutAddress("0x5555555555555555555555555555555555555555"),
  "0x555.....55555",
);
assert.equal(shortenPayoutAddress("0xabc"), "0xabc");
assert.deepEqual(
  mergePayoutsForAirdrop([
    { address: "0xAbc", amountUsd: 10 },
    { address: "0xabc", amountUsd: 2.5 },
    { address: "0xDef", amountUsd: 1 },
  ]),
  [
    { address: "0xAbc", amountUsd: 12.5 },
    { address: "0xDef", amountUsd: 1 },
  ],
);
assert.equal(
  affiliateAirdropCsv([
    { address: "0xAbc", amountUsd: 10 },
    { address: "0xabc", amountUsd: 2.5 },
  ]),
  "address,amount\n0xAbc,12.50\n",
);
assert.deepEqual(
  summarizeAdminPayoutQueue(
    [
      {
        status: "requested",
        amountUsd: 40,
        network: "arbitrum",
        address: "0xabc",
      },
      {
        status: "requested",
        amountUsd: 10,
        network: null,
        address: "0xabc",
      },
      {
        status: "pending",
        amountUsd: 25,
        network: "arbitrum",
        address: "0xdef",
      },
      {
        status: "pending",
        amountUsd: 5,
        network: "base",
        address: "0xghi",
      },
      {
        status: "paid",
        amountUsd: 100,
        network: "arbitrum",
        address: "0xabc",
      },
      {
        status: "rejected",
        amountUsd: 8,
        network: "arbitrum",
        address: "0xabc",
      },
    ],
    1,
  ),
  {
    readyUsd: 40,
    readyCount: 1,
    toSendUsd: 30,
    toSendCount: 2,
    outstandingUsd: 70,
    paidUsd: 100,
    paidCount: 1,
    pendingFileCount: 1,
    readyByNetwork: [{ network: "arbitrum", amountUsd: 40, count: 1 }],
    toSendByNetwork: [
      { network: "arbitrum", amountUsd: 25, count: 1 },
      { network: "base", amountUsd: 5, count: 1 },
    ],
  },
);
assert.equal(parsePayoutFileMaxRows(200).ok, true);
assert.equal(parsePayoutFileMaxRows(0).ok, false);
assert.equal(parsePayoutFileMaxAmount("").ok, true);
assert.equal(parsePayoutFileMaxAmount("50").ok, true);
assert.equal(parsePayoutFileNetwork("").ok, true);
assert.deepEqual(parsePayoutFileNetwork("Arbitrum-Sepolia"), {
  ok: true,
  network: "arbitrum-sepolia",
});
assert.deepEqual(
  chunkPayoutsForAirdropFiles(
    [
      { address: "0xA", amountUsd: 10 },
      { address: "0xB", amountUsd: 10 },
      { address: "0xC", amountUsd: 10 },
    ],
    { maxRows: 2, maxAmountUsd: null },
  ).map((chunk) => chunk.map((row) => row.address)),
  [["0xA", "0xB"], ["0xC"]],
);
assert.equal(
  chunkPayoutsForAirdropFiles(
    [
      { address: "0xA", amountUsd: 10 },
      { address: "0xa", amountUsd: 5 },
      { address: "0xB", amountUsd: 10 },
    ],
    { maxRows: 1, maxAmountUsd: null },
  ).length,
  2,
);
assert.deepEqual(
  chunkPayoutsForAirdropFiles(
    [
      { address: "0xA", amountUsd: 20 },
      { address: "0xB", amountUsd: 20 },
      { address: "0xC", amountUsd: 10 },
    ],
    { maxRows: 10, maxAmountUsd: 30 },
  ).map((chunk) => chunk.map((row) => row.address)),
  [["0xA"], ["0xB", "0xC"]],
);
assert.equal(parseAffiliateLabel("Spring", 40, "Enter a name.").ok, true);
assert.equal(parseAffiliateLabel("", 40, "Enter a name.").ok, false);
assert.equal(parseAffiliateAlias("").ok, false);
assert.equal(parseAffiliateAlias("a").ok, false);
assert.equal(parseAffiliateAlias("1click").ok, false);
assert.equal(parseAffiliateAlias("click!").ok, false);
const affiliateAlias = parseAffiliateAlias(" Ava  Walker ");
assert.equal(affiliateAlias.ok, true);
if (affiliateAlias.ok) {
  assert.equal(affiliateAlias.alias, "Ava Walker");
}
assert.equal(parseAffiliateAlias("x".repeat(33)).ok, false);
assert.equal(generateAffiliateLinkSlug(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7])).length, 8);

console.log("membership affiliate checks passed");
