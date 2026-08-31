import assert from "node:assert/strict";
import {
  COPY_DESCRIPTION_MAX,
  copyActivityFloorMet,
  copyShareBlockCode,
  DEFAULT_COPY_MIN_ACTIVITY_DAYS,
  deskCopyShareBlock,
  evaluateCopyShare,
  formatCopyShareBlock,
  MS_PER_DAY,
  copyFollowerCapReached,
  copyMinBalanceMet,
  parseCopyDescription,
  copyMaxFollowersWithinCeiling,
  effectiveCopyMaxFollowers,
  parseCopyFollowerLimits,
  parseCopyMaxFollowers,
  parseCopyMinBalanceUsdt,
  parseCopyMinActivityDays,
  parseCopyVisibility,
  parseDeskCopyListingForm,
  parseTraderLogoPath,
  parseTraderLogoUpload,
  parseTraderAlias,
  parseTraderBio,
  parseTraderProfileForm,
  TRADER_ALIAS_REQUIRED,
  TRADER_BIO_MAX,
} from "./model";

assert.equal(DEFAULT_COPY_MIN_ACTIVITY_DAYS, 90);

assert.equal(parseCopyMinActivityDays("").ok, false);
assert.equal(parseCopyMinActivityDays("abc").ok, false);
assert.equal(parseCopyMinActivityDays("-1").ok, false);
assert.equal(parseCopyMinActivityDays("1.5").ok, false);
assert.equal(parseCopyMinActivityDays("90").ok, true);
const zero = parseCopyMinActivityDays("0");
assert.equal(zero.ok, true);
if (zero.ok) {
  assert.equal(zero.days, 0);
}
const ninety = parseCopyMinActivityDays("90");
assert.equal(ninety.ok, true);
if (ninety.ok) {
  assert.equal(ninety.days, 90);
}

assert.equal(parseCopyMaxFollowers("").ok, true);
const unlimited = parseCopyMaxFollowers("   ");
assert.equal(unlimited.ok, true);
if (unlimited.ok) {
  assert.equal(unlimited.maxFollowers, null);
}
assert.equal(parseCopyMaxFollowers("0").ok, false);
assert.equal(parseCopyMaxFollowers("1.5").ok, false);
const ten = parseCopyMaxFollowers("10");
assert.equal(ten.ok, true);
if (ten.ok) {
  assert.equal(ten.maxFollowers, 10);
}
assert.equal(
  copyFollowerCapReached({ maxFollowers: null, followerCount: 99 }),
  false,
);
assert.equal(
  copyFollowerCapReached({ maxFollowers: 10, followerCount: 9 }),
  false,
);
assert.equal(
  copyFollowerCapReached({ maxFollowers: 10, followerCount: 10 }),
  true,
);
assert.equal(
  copyFollowerCapReached({
    maxFollowers: 40,
    ceiling: 20,
    followerCount: 20,
  }),
  true,
);
assert.equal(
  copyFollowerCapReached({
    maxFollowers: null,
    ceiling: 20,
    followerCount: 19,
  }),
  false,
);
assert.equal(
  effectiveCopyMaxFollowers({ deskMax: 40, ceiling: 20 }),
  20,
);
assert.equal(
  effectiveCopyMaxFollowers({ deskMax: null, ceiling: 20 }),
  20,
);
assert.equal(
  effectiveCopyMaxFollowers({ deskMax: 10, ceiling: 20 }),
  10,
);
assert.equal(copyMaxFollowersWithinCeiling(40, 20).ok, false);
const stamped = copyMaxFollowersWithinCeiling(null, 20);
assert.equal(stamped.ok, true);
if (stamped.ok) {
  assert.equal(stamped.maxFollowers, 20);
}
assert.equal(parseCopyFollowerLimits({ defaultValue: "20", ceiling: "20" }).ok, true);
assert.equal(
  parseCopyFollowerLimits({ defaultValue: "40", ceiling: "20" }).ok,
  false,
);

assert.equal(parseCopyMinBalanceUsdt("").ok, true);
assert.equal(parseCopyMinBalanceUsdt("0").ok, false);
assert.equal(parseCopyMinBalanceUsdt("-1").ok, false);
const floor = parseCopyMinBalanceUsdt("1,000.5");
assert.equal(floor.ok, true);
if (floor.ok) {
  assert.equal(floor.minBalanceUsdt, 1000.5);
}
assert.equal(
  copyMinBalanceMet({
    minBalanceUsdt: 1000,
    mode: "paper",
    availableBalance: 10,
  }).ok,
  true,
);
assert.equal(
  copyMinBalanceMet({
    minBalanceUsdt: null,
    mode: "live",
    availableBalance: 10,
  }).ok,
  true,
);
assert.equal(
  copyMinBalanceMet({
    minBalanceUsdt: 1000,
    mode: "live",
    availableBalance: 1000,
  }).ok,
  true,
);
const unread = copyMinBalanceMet({
  minBalanceUsdt: 1000,
  mode: "live",
  availableBalance: null,
});
assert.equal(unread.ok, false);
if (!unread.ok) {
  assert.equal(unread.code, "unread");
}
const short = copyMinBalanceMet({
  minBalanceUsdt: 1000,
  mode: "live",
  availableBalance: 999,
});
assert.equal(short.ok, false);
if (!short.ok) {
  assert.equal(short.code, "below");
}

const now = Date.UTC(2026, 7, 31);
const firstFill = now - 90 * MS_PER_DAY;
assert.equal(
  copyActivityFloorMet({ firstFillMs: firstFill, minDays: 90, nowMs: now }),
  true,
);
assert.equal(
  copyActivityFloorMet({
    firstFillMs: firstFill + MS_PER_DAY,
    minDays: 90,
    nowMs: now,
  }),
  false,
);
assert.equal(
  copyActivityFloorMet({ firstFillMs: now, minDays: 0, nowMs: now }),
  true,
);
assert.equal(
  copyActivityFloorMet({ firstFillMs: null, minDays: 0, nowMs: now }),
  false,
);
assert.equal(
  copyActivityFloorMet({ firstFillMs: firstFill, minDays: -1, nowMs: now }),
  false,
);

assert.equal(parseTraderAlias("").ok, false);
assert.equal(parseTraderAlias("a").ok, false);
assert.equal(parseTraderAlias("1click").ok, false);
assert.equal(parseTraderAlias("click!").ok, false);
const alias = parseTraderAlias(" Click_desk-1 ");
assert.equal(alias.ok, true);
if (alias.ok) {
  assert.equal(alias.alias, "Click_desk-1");
}
const spaced = parseTraderAlias("  Click   Studio  ");
assert.equal(spaced.ok, true);
if (spaced.ok) {
  assert.equal(spaced.alias, "Click Studio");
}
assert.equal(parseTraderAlias("x".repeat(33)).ok, false);

assert.equal(parseTraderBio("").ok, true);
const emptyBio = parseTraderBio("   ");
assert.equal(emptyBio.ok, true);
if (emptyBio.ok) {
  assert.equal(emptyBio.bio, null);
}
const bio = parseTraderBio("  Hedge mode.  ");
assert.equal(bio.ok, true);
if (bio.ok) {
  assert.equal(bio.bio, "Hedge mode.");
}
assert.equal(parseTraderBio("x".repeat(TRADER_BIO_MAX + 1)).ok, false);

assert.equal(parseCopyVisibility("private").ok, true);
assert.equal(parseCopyVisibility("public").ok, true);
assert.equal(parseCopyVisibility("catalogue").ok, false);
assert.equal(parseCopyDescription("").ok, false);
assert.equal(parseCopyDescription(" Hedge vs one-way. ").ok, true);
assert.equal(parseCopyDescription("x".repeat(COPY_DESCRIPTION_MAX + 1)).ok, false);

const profile = parseTraderProfileForm({
  alias: "alpha",
  bio: "",
});
assert.equal(profile.ok, true);
if (profile.ok) {
  assert.equal(profile.alias, "alpha");
  assert.equal(profile.bio, null);
}
assert.equal(parseTraderProfileForm({ alias: "1bad", bio: "" }).ok, false);

assert.equal(parseTraderLogoPath("").ok, true);
assert.equal(parseTraderLogoPath("not-a-path").ok, false);
const logoPath = parseTraderLogoPath(
  "11111111-1111-1111-1111-111111111111/logo.png",
);
assert.equal(logoPath.ok, true);
if (logoPath.ok) {
  assert.equal(
    logoPath.path,
    "11111111-1111-1111-1111-111111111111/logo.png",
  );
}
assert.equal(parseTraderLogoUpload(null).ok, true);
assert.equal(parseTraderLogoUpload({ name: "", type: "", size: 0 }).ok, true);
assert.equal(
  parseTraderLogoUpload({
    name: "mark.png",
    type: "image/png",
    size: 1200,
  }).ok,
  true,
);
assert.equal(
  parseTraderLogoUpload({
    name: "mark.gif",
    type: "image/gif",
    size: 1200,
  }).ok,
  false,
);
assert.equal(
  parseTraderLogoUpload({
    name: "mark.png",
    type: "image/png",
    size: 2_000_000,
  }).ok,
  false,
);

const listing = parseDeskCopyListingForm({
  visibility: "public",
  description: "One-way BTC. Caps on.",
});
assert.equal(listing.ok, true);
if (listing.ok) {
  assert.equal(listing.visibility, "public");
  assert.equal(listing.maxFollowers, null);
  assert.equal(listing.minBalanceUsdt, null);
}
const capped = parseDeskCopyListingForm({
  visibility: "private",
  description: "One-way BTC. Caps on.",
  maxFollowers: "25",
});
assert.equal(capped.ok, true);
if (capped.ok) {
  assert.equal(capped.maxFollowers, 25);
}
assert.equal(
  parseDeskCopyListingForm({
    visibility: "public",
    description: "Brief",
    maxFollowers: "0",
  }).ok,
  false,
);
assert.equal(
  parseDeskCopyListingForm({
    visibility: "public",
    description: "Brief",
    maxFollowers: "40",
    ceiling: 20,
  }).ok,
  false,
);
const ceilingEmpty = parseDeskCopyListingForm({
  visibility: "public",
  description: "Brief",
  maxFollowers: "",
  ceiling: 20,
});
assert.equal(ceilingEmpty.ok, true);
if (ceilingEmpty.ok) {
  assert.equal(ceilingEmpty.maxFollowers, 20);
}
const gated = parseDeskCopyListingForm({
  visibility: "public",
  description: "Brief",
  minBalanceUsdt: "2500",
});
assert.equal(gated.ok, true);
if (gated.ok) {
  assert.equal(gated.minBalanceUsdt, 2500);
}

const shareBase = {
  mode: "live" as const,
  deskType: "perps" as const,
  copyOfAccountId: null,
  bound: true,
  alias: "alpha",
  firstFillMs: firstFill,
  minDays: 90,
  nowMs: now,
};
assert.equal(copyShareBlockCode(shareBase), null);
assert.equal(deskCopyShareBlock(shareBase), null);
assert.equal(
  copyShareBlockCode({ ...shareBase, copyOfAccountId: "parent" }),
  "copy_desk",
);
assert.equal(
  copyShareBlockCode({ ...shareBase, deskType: "cash_and_carry" }),
  "cash_and_carry",
);
assert.equal(
  copyShareBlockCode({ ...shareBase, mode: "paper" }),
  "paper",
);
assert.equal(copyShareBlockCode({ ...shareBase, bound: false }), "unbound");
assert.equal(copyShareBlockCode({ ...shareBase, alias: "" }), "no_alias");
assert.equal(
  copyShareBlockCode({ ...shareBase, firstFillMs: null }),
  "activity",
);
assert.equal(
  copyShareBlockCode({
    ...shareBase,
    firstFillMs: now,
    minDays: 0,
  }),
  null,
);
assert.equal(
  copyShareBlockCode({
    ...shareBase,
    firstFillMs: null,
    minDays: 0,
  }),
  "activity",
);
assert.equal(
  formatCopyShareBlock("no_alias"),
  TRADER_ALIAS_REQUIRED,
);
assert.equal(
  formatCopyShareBlock("activity", 0),
  "This desk needs a venue fill before it can be shared.",
);
assert.equal(
  formatCopyShareBlock("activity", 90),
  "This desk needs a first venue fill at least 90 days ago before it can be shared.",
);
assert.equal(evaluateCopyShare({ ...shareBase, alias: "" }).code, "no_alias");
assert.equal(
  evaluateCopyShare({ ...shareBase, firstFillMs: null }).code,
  "activity",
);

console.log("copy model checks passed");
