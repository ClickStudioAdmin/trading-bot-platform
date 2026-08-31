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
  parseCopyDescription,
  parseCopyMinActivityDays,
  parseCopyVisibility,
  parseDeskCopyListingForm,
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
assert.equal(parseTraderAlias("click studio").ok, false);
assert.equal(parseTraderAlias("click!").ok, false);
const alias = parseTraderAlias(" Click_desk-1 ");
assert.equal(alias.ok, true);
if (alias.ok) {
  assert.equal(alias.alias, "Click_desk-1");
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

const listing = parseDeskCopyListingForm({
  visibility: "public",
  description: "One-way BTC. Caps on.",
});
assert.equal(listing.ok, true);
if (listing.ok) {
  assert.equal(listing.visibility, "public");
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
