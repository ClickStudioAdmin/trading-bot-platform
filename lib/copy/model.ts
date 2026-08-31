import type { DeskType, TradingAccountMode } from "@/lib/accounts/model";

export const DEFAULT_COPY_MIN_ACTIVITY_DAYS = 90;
export const MS_PER_DAY = 86_400_000;
export const TRADER_ALIAS_MIN = 2;
export const TRADER_ALIAS_MAX = 32;
export const TRADER_BIO_MAX = 280;
export const COPY_DESCRIPTION_MAX = 2000;
export const TRADER_ALIAS_TAKEN = "That trader alias is already taken.";
export const TRADER_ALIAS_REQUIRED =
  "Set a trader alias in Account Settings before you share.";
export const COPY_SHARE_OFF_OPEN_TRADES =
  "Close all live trades on this desk before you turn sharing off.";
export const COPY_FOLLOWING_UNAVAILABLE =
  "This desk is no longer available for following.";
export const COPY_UNFOLLOW_OPEN_TRADES =
  "Close all live trades on this desk before you unfollow.";
export const COPY_UNFOLLOW_LAST_DESK =
  "Create another desk before you unfollow. You can pause copying instead.";
export const TRADER_LOGO_BUCKET = "trader-logos";
export const DESK_LOGO_BUCKET = "desk-logos";
export const TRADER_LOGO_MAX_BYTES = 1_048_576;
export const TRADER_LOGO_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

const TRADER_LOGO_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/logo\.(png|jpg|webp)$/i;

export type CopyListingVisibility = "private" | "public";
export type CopyShareStatus = "invited" | "active" | "revoked";
export type CopyInviteBlock =
  | "no_listing"
  | "sharing_off"
  | "new_followers_off"
  | "self"
  | "cap";
export type CopyShareBlockCode =
  | "copy_desk"
  | "cash_and_carry"
  | "paper"
  | "unbound"
  | "no_alias"
  | "activity";

export type TraderProfile = {
  userId: string;
  alias: string;
  bio: string | null;
  logoPath: string | null;
  logoUrl: string | null;
};

export type DeskCopyShare = {
  id: string;
  parentAccountId: string;
  fromUserId: string;
  toUserId: string;
  invitedEmail: string;
  status: CopyShareStatus;
  createdAt: string;
  updatedAt: string;
};

/** Owner-facing follower row. Private lists email; public lists user id. */
export type DeskCopyFollowerView = {
  id: string;
  status: CopyShareStatus;
  invitedEmail: string;
  toUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type CopyOwnerFollowerSituation = {
  statusLabel: string;
  sourceLabel: string;
  detail: string;
};

export function copyOwnerFollowerSituation(input: {
  status: CopyShareStatus;
  visibility: CopyListingVisibility | null | undefined;
  sharingEnabled: boolean;
  invitedOn: string | null;
  updatedOn: string | null;
}): CopyOwnerFollowerSituation {
  const sourceLabel =
    input.visibility === "public" ? "Catalogue" : "Private invite";
  if (input.status === "revoked") {
    return {
      statusLabel: "Revoked",
      sourceLabel,
      detail: input.updatedOn
        ? `Revoked ${input.updatedOn}`
        : "Invite revoked",
    };
  }
  if (input.status === "active") {
    const since = input.invitedOn ? ` · since ${input.invitedOn}` : "";
    return {
      statusLabel: "Following",
      sourceLabel,
      detail: input.sharingEnabled
        ? `Copying this desk${since}`
        : `Copy desk stays · parent unavailable${since}`,
    };
  }
  const invited = input.invitedOn ? ` · invited ${input.invitedOn}` : "";
  return {
    statusLabel: "Invited",
    sourceLabel,
    detail: input.sharingEnabled
      ? `Waiting to create a copy desk${invited}`
      : `Invite paused · desk unavailable${invited}`,
  };
}

export type CopyCatalogueTab = "all" | "favorites" | "subscribed";
export type CopyCatalogueSort =
  | "roi"
  | "drawdown"
  | "followers"
  | "newest";

export function copyCatalogueIncludes(input: {
  sharingEnabled: boolean;
  visibility: CopyListingVisibility;
  grantStatus: CopyShareStatus | null;
}): boolean {
  if (!input.sharingEnabled) {
    return false;
  }
  if (input.visibility === "public") {
    return true;
  }
  return input.grantStatus === "invited" || input.grantStatus === "active";
}

export function copyDeskPageVisible(input: {
  sharingEnabled: boolean;
  visibility: CopyListingVisibility;
  grantStatus: CopyShareStatus | null;
  following: boolean;
}): boolean {
  return input.following || copyCatalogueIncludes(input);
}

export function copyDeskPagePath(accountId: string): string {
  return `/account/copy/desks/${encodeURIComponent(accountId)}`;
}

export function parseCopyCatalogueTab(value: unknown): CopyCatalogueTab {
  const raw = String(value ?? "").trim();
  if (raw === "favorites" || raw === "subscribed") {
    return raw;
  }
  return "all";
}

export function parseCopyCatalogueSort(value: unknown): CopyCatalogueSort {
  const raw = String(value ?? "").trim();
  if (
    raw === "drawdown" ||
    raw === "followers" ||
    raw === "newest"
  ) {
    return raw;
  }
  return "roi";
}

export function copyOwnerFollowerLabel(input: {
  visibility: CopyListingVisibility | null | undefined;
  invitedEmail: string;
  toUserId: string;
}): string {
  if (input.visibility !== "public") {
    const email = input.invitedEmail.trim().toLowerCase();
    if (email) {
      return email;
    }
  }
  return input.toUserId;
}

export type DeskCopyListing = {
  accountId: string;
  name: string;
  visibility: CopyListingVisibility;
  description: string;
  maxFollowers: number | null;
  minBalanceUsdt: number | null;
  sharingEnabled: boolean;
  allowNewFollowers: boolean;
  logoPath: string | null;
  logoUrl: string | null;
};

export type CopyMinBalanceBlock = "below" | "unread";

export type CopyPlatformSettings = {
  minActivityDays: number;
  maxFollowersDefault: number | null;
  maxFollowersCeiling: number | null;
};

export function parseCopyMinActivityDays(
  value: unknown,
): { ok: true; days: number } | { ok: false; error: string } {
  const raw = String(value ?? "").trim().replace(/,/g, "");
  if (!raw) {
    return { ok: false, error: "Enter the minimum activity days." };
  }
  if (!/^\d+$/.test(raw)) {
    return { ok: false, error: "Minimum activity days must be a whole number." };
  }
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 0) {
    return { ok: false, error: "Minimum activity days must be zero or more." };
  }
  return { ok: true, days };
}

export function parseCopyMaxFollowers(
  value: unknown,
): { ok: true; maxFollowers: number | null } | { ok: false; error: string } {
  const raw = String(value ?? "").trim().replace(/,/g, "");
  if (!raw) {
    return { ok: true, maxFollowers: null };
  }
  if (!/^\d+$/.test(raw)) {
    return {
      ok: false,
      error: "Maximum copy traders must be a whole number.",
    };
  }
  const maxFollowers = Number(raw);
  if (!Number.isInteger(maxFollowers) || maxFollowers < 1) {
    return {
      ok: false,
      error: "Maximum copy traders must be 1 or more, or empty for no cap.",
    };
  }
  return { ok: true, maxFollowers };
}

export function parseCopyFollowerLimits(input: {
  defaultValue: unknown;
  ceiling: unknown;
}):
  | {
      ok: true;
      maxFollowersDefault: number | null;
      maxFollowersCeiling: number | null;
    }
  | { ok: false; error: string } {
  const preset = parseCopyMaxFollowers(input.defaultValue);
  if (!preset.ok) {
    return {
      ok: false,
      error: "Default maximum copy traders must be 1 or more, or empty.",
    };
  }
  const ceiling = parseCopyMaxFollowers(input.ceiling);
  if (!ceiling.ok) {
    return {
      ok: false,
      error: "Platform maximum copy traders must be 1 or more, or empty.",
    };
  }
  if (
    preset.maxFollowers != null &&
    ceiling.maxFollowers != null &&
    preset.maxFollowers > ceiling.maxFollowers
  ) {
    return {
      ok: false,
      error: "Default maximum copy traders cannot be above the platform maximum.",
    };
  }
  return {
    ok: true,
    maxFollowersDefault: preset.maxFollowers,
    maxFollowersCeiling: effectiveCopyFollowersCeiling({
      defaultValue: preset.maxFollowers,
      ceiling: ceiling.maxFollowers,
    }),
  };
}

export function effectiveCopyFollowersCeiling(input: {
  defaultValue: number | null | undefined;
  ceiling: number | null | undefined;
}): number | null {
  const cap =
    input.ceiling != null &&
    Number.isInteger(input.ceiling) &&
    input.ceiling >= 1
      ? input.ceiling
      : null;
  if (cap != null) {
    return cap;
  }
  const preset =
    input.defaultValue != null &&
    Number.isInteger(input.defaultValue) &&
    input.defaultValue >= 1
      ? input.defaultValue
      : null;
  return preset;
}

export function effectiveCopyMaxFollowers(input: {
  deskMax: number | null | undefined;
  ceiling: number | null | undefined;
}): number | null {
  const desk =
    input.deskMax != null &&
    Number.isInteger(input.deskMax) &&
    input.deskMax >= 1
      ? input.deskMax
      : null;
  const cap =
    input.ceiling != null &&
    Number.isInteger(input.ceiling) &&
    input.ceiling >= 1
      ? input.ceiling
      : null;
  if (desk == null) {
    return cap;
  }
  if (cap == null) {
    return desk;
  }
  return Math.min(desk, cap);
}

export function copyMaxFollowersWithinCeiling(
  maxFollowers: number | null,
  ceiling: number | null | undefined,
): { ok: true; maxFollowers: number | null } | { ok: false; error: string } {
  if (ceiling == null || !Number.isInteger(ceiling) || ceiling < 1) {
    return { ok: true, maxFollowers };
  }
  if (maxFollowers == null) {
    return { ok: true, maxFollowers: ceiling };
  }
  if (maxFollowers > ceiling) {
    return {
      ok: false,
      error: `Maximum copy traders cannot be more than ${ceiling}.`,
    };
  }
  return { ok: true, maxFollowers };
}

export function parseCopyMinBalanceUsdt(
  value: unknown,
): { ok: true; minBalanceUsdt: number | null } | { ok: false; error: string } {
  const raw = String(value ?? "").trim().replace(/,/g, "");
  if (!raw) {
    return { ok: true, minBalanceUsdt: null };
  }
  const minBalanceUsdt = Number(raw);
  if (!Number.isFinite(minBalanceUsdt) || minBalanceUsdt <= 0) {
    return {
      ok: false,
      error: "Minimum account balance must be more than zero, or empty.",
    };
  }
  return { ok: true, minBalanceUsdt };
}

export function copyMinBalanceMet(input: {
  minBalanceUsdt: number | null | undefined;
  mode: TradingAccountMode;
  availableBalance: number | null | undefined;
}): { ok: true } | { ok: false; code: CopyMinBalanceBlock; error: string } {
  if (
    input.minBalanceUsdt == null ||
    !Number.isFinite(input.minBalanceUsdt) ||
    input.minBalanceUsdt <= 0
  ) {
    return { ok: true };
  }
  if (input.mode !== "live") {
    return { ok: true };
  }
  if (
    input.availableBalance == null ||
    !Number.isFinite(input.availableBalance)
  ) {
    return {
      ok: false,
      code: "unread",
      error:
        "Could not read available balance on this Live desk. Bind a key and try again.",
    };
  }
  if (input.availableBalance + 1e-8 < input.minBalanceUsdt) {
    return {
      ok: false,
      code: "below",
      error: `This desk needs at least ${input.minBalanceUsdt} available to copy.`,
    };
  }
  return { ok: true };
}

export function copyFollowerCapReached(input: {
  maxFollowers: number | null | undefined;
  followerCount: number;
  ceiling?: number | null;
}): boolean {
  const maxFollowers = effectiveCopyMaxFollowers({
    deskMax: input.maxFollowers,
    ceiling: input.ceiling,
  });
  if (
    maxFollowers == null ||
    !Number.isInteger(maxFollowers) ||
    maxFollowers < 1
  ) {
    return false;
  }
  if (!Number.isFinite(input.followerCount) || input.followerCount < 0) {
    return false;
  }
  return input.followerCount >= maxFollowers;
}

export function copyActivityFloorMet(input: {
  firstFillMs: number | null | undefined;
  minDays: number;
  nowMs: number;
}): boolean {
  if (
    input.firstFillMs == null ||
    !Number.isFinite(input.firstFillMs) ||
    !Number.isFinite(input.minDays) ||
    input.minDays < 0 ||
    !Number.isFinite(input.nowMs)
  ) {
    return false;
  }
  if (input.nowMs < input.firstFillMs) {
    return false;
  }
  return input.nowMs - input.firstFillMs >= input.minDays * MS_PER_DAY;
}

export function parseTraderAlias(
  value: unknown,
): { ok: true; alias: string } | { ok: false; error: string } {
  const alias = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!alias) {
    return { ok: false, error: "Enter a trader alias." };
  }
  if (
    alias.length < TRADER_ALIAS_MIN ||
    alias.length > TRADER_ALIAS_MAX
  ) {
    return {
      ok: false,
      error: `Trader alias must be ${TRADER_ALIAS_MIN} to ${TRADER_ALIAS_MAX} characters.`,
    };
  }
  if (!/^[A-Za-z][A-Za-z0-9_ -]*$/.test(alias)) {
    return {
      ok: false,
      error:
        "Use letters, numbers, spaces, underscore, or hyphen. Start with a letter.",
    };
  }
  return { ok: true, alias };
}

export function parseTraderBio(
  value: unknown,
): { ok: true; bio: string | null } | { ok: false; error: string } {
  const bio = String(value ?? "").trim();
  if (!bio) {
    return { ok: true, bio: null };
  }
  if (bio.length > TRADER_BIO_MAX) {
    return {
      ok: false,
      error: `Bio must be ${TRADER_BIO_MAX} characters or fewer.`,
    };
  }
  return { ok: true, bio };
}

export function parseCopyToggle(value: unknown): boolean {
  if (value === true || value === 1) {
    return true;
  }
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "on" || raw === "true" || raw === "1";
}

export function copyListingAcceptsFollowers(input: {
  sharingEnabled?: boolean | null;
  allowNewFollowers?: boolean | null;
}): boolean {
  return Boolean(input.sharingEnabled) && input.allowNewFollowers !== false;
}

export function copyShareCountsTowardCap(status: CopyShareStatus): boolean {
  return status === "invited" || status === "active";
}

/** A copy desk follows until the grant is revoked. Missing share still copies. */
export function copyShareAllowsFanOut(
  status: CopyShareStatus | null | undefined,
): boolean {
  return status !== "revoked";
}

/** Unfollow keeps a private invite. Catalogue follows drop the share row. */
export function copyUnfollowKeepsInvite(
  visibility: CopyListingVisibility | null | undefined,
): boolean {
  return visibility !== "public";
}

export function parseCopyShareStatus(
  value: unknown,
): { ok: true; status: CopyShareStatus } | { ok: false; error: string } {
  const status = String(value ?? "").trim();
  if (status === "invited" || status === "active" || status === "revoked") {
    return { ok: true, status };
  }
  return { ok: false, error: "Copy share status is invalid." };
}

export function parseCopyInviteEmail(
  value: unknown,
): { ok: true; email: string } | { ok: false; error: string } {
  const email = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    return { ok: false, error: "Enter a valid email." };
  }
  return { ok: true, email };
}

export function copyInviteBlockCode(input: {
  listing: {
    sharingEnabled: boolean;
    allowNewFollowers: boolean;
    maxFollowers: number | null;
  } | null;
  ceiling?: number | null;
  followerCount: number;
  fromUserId: string;
  toUserId: string;
}): CopyInviteBlock | null {
  if (!input.listing) {
    return "no_listing";
  }
  if (!input.listing.sharingEnabled) {
    return "sharing_off";
  }
  if (!input.listing.allowNewFollowers) {
    return "new_followers_off";
  }
  if (input.fromUserId === input.toUserId) {
    return "self";
  }
  if (
    copyFollowerCapReached({
      maxFollowers: input.listing.maxFollowers,
      ceiling: input.ceiling,
      followerCount: input.followerCount,
    })
  ) {
    return "cap";
  }
  return null;
}

export function formatCopyInviteBlock(code: CopyInviteBlock): string {
  if (code === "no_listing") {
    return "Save the share settings before you invite.";
  }
  if (code === "sharing_off") {
    return "Turn sharing on before you invite.";
  }
  if (code === "new_followers_off") {
    return "New followers are not allowed on this desk.";
  }
  if (code === "self") {
    return "You cannot invite yourself.";
  }
  return "This desk is at its maximum copy traders.";
}

export function copySharingOffBlocked(input: {
  currentlyEnabled: boolean;
  nextEnabled: boolean;
  openTradeCount: number;
}): boolean {
  return (
    input.currentlyEnabled &&
    !input.nextEnabled &&
    Number.isFinite(input.openTradeCount) &&
    input.openTradeCount > 0
  );
}

export function copyLiveTradeCount(input: {
  openPositions?: number | null;
  workingOrders?: number | null;
}): number {
  const opens =
    input.openPositions != null && Number.isFinite(input.openPositions)
      ? Math.max(0, input.openPositions)
      : 0;
  const working =
    input.workingOrders != null && Number.isFinite(input.workingOrders)
      ? Math.max(0, input.workingOrders)
      : 0;
  return opens + working;
}

export function parseTraderLogoPath(
  value: unknown,
): { ok: true; path: string | null } | { ok: false; error: string } {
  if (value == null) {
    return { ok: true, path: null };
  }
  const path = String(value).trim();
  if (!path) {
    return { ok: true, path: null };
  }
  if (!TRADER_LOGO_PATH.test(path)) {
    return { ok: false, error: "Trader logo path is invalid." };
  }
  return { ok: true, path };
}

export function parseTraderLogoUpload(value: {
  name?: unknown;
  type?: unknown;
  size?: unknown;
} | null): { ok: true; ext: string | null } | { ok: false; error: string } {
  if (value == null) {
    return { ok: true, ext: null };
  }
  const name = String(value.name ?? "").trim();
  const type = String(value.type ?? "").trim().toLowerCase();
  const size = Number(value.size ?? 0);
  if (!name && (!Number.isFinite(size) || size <= 0)) {
    return { ok: true, ext: null };
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: true, ext: null };
  }
  if (size > TRADER_LOGO_MAX_BYTES) {
    return { ok: false, error: "Trader logo must be 1 MB or smaller." };
  }
  const ext = TRADER_LOGO_TYPES[type as keyof typeof TRADER_LOGO_TYPES];
  if (!ext) {
    return { ok: false, error: "Use a PNG, JPG, or WebP image." };
  }
  return { ok: true, ext };
}

export function parseCopyVisibility(
  value: unknown,
):
  | { ok: true; visibility: CopyListingVisibility }
  | { ok: false; error: string } {
  const visibility = String(value ?? "").trim();
  if (visibility === "private" || visibility === "public") {
    return { ok: true, visibility };
  }
  return { ok: false, error: "Choose private or public." };
}

export function parseCopyListingName(
  value: unknown,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(value ?? "").trim();
  if (name.length < 1 || name.length > 40) {
    return { ok: false, error: "Desk name must be 1 to 40 characters." };
  }
  return { ok: true, name };
}

export function parseCopyScalePercent(
  value: unknown,
): { ok: true; scale: number } | { ok: false; error: string } {
  const raw = String(value ?? "").trim().replace(/,/g, "");
  if (!raw) {
    return { ok: true, scale: 1 };
  }
  const pct = Number(raw);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
    return { ok: false, error: "Scale must be between 0 and 100 percent." };
  }
  return { ok: true, scale: pct / 100 };
}

/** Parent fill × (follower book / parent balance). Null means skip. */
export function copyBalanceScaledNotional(input: {
  parentFillUsdt: number;
  parentBalanceUsdt: number;
  followerBalanceUsdt: number;
}): number | null {
  if (
    !(input.parentFillUsdt > 0) ||
    !(input.parentBalanceUsdt > 0) ||
    !(input.followerBalanceUsdt > 0)
  ) {
    return null;
  }
  return (
    input.parentFillUsdt * (input.followerBalanceUsdt / input.parentBalanceUsdt)
  );
}

export type CopySizeMode = "balance" | "percent" | "fixed";
export type CopySizeSkip = "skip" | "pause";

export function parseCopySizeMode(value: unknown): CopySizeMode {
  const raw = String(value ?? "").trim();
  if (raw === "percent" || raw === "fixed") {
    return raw;
  }
  return "balance";
}

export function parseCopySizeForm(input: {
  sizeMode: unknown;
  sizePercent: unknown;
  sizeBookUsdt: unknown;
}):
  | {
      ok: true;
      sizeMode: CopySizeMode;
      sizePercent: number | null;
      sizeBookUsdt: number | null;
    }
  | { ok: false; error: string } {
  const sizeMode = parseCopySizeMode(input.sizeMode);
  if (sizeMode === "balance") {
    return { ok: true, sizeMode, sizePercent: null, sizeBookUsdt: null };
  }
  if (sizeMode === "percent") {
    const raw = String(input.sizePercent ?? "").trim().replace(/,/g, "");
    const sizePercent = Number(raw);
    if (!raw || !Number.isFinite(sizePercent) || sizePercent <= 0 || sizePercent > 100) {
      return {
        ok: false,
        error: "Percent of account must be more than 0 and at most 100.",
      };
    }
    return { ok: true, sizeMode, sizePercent, sizeBookUsdt: null };
  }
  const book = parseCopyOptionalUsdt(input.sizeBookUsdt, "Fixed book");
  if (!book.ok) {
    return book;
  }
  if (book.value == null) {
    return { ok: false, error: "Fixed book must be more than zero." };
  }
  return { ok: true, sizeMode, sizePercent: null, sizeBookUsdt: book.value };
}

/** Resolve the follower book used in the balance-ratio formula. */
export function resolveCopyFollowerBook(input: {
  sizeMode: CopySizeMode;
  availableUsdt: number;
  sizePercent: number | null;
  sizeBookUsdt: number | null;
}): { ok: true; bookUsdt: number } | { ok: false; code: CopySizeSkip } {
  if (!(input.availableUsdt > 0)) {
    return { ok: false, code: "skip" };
  }
  if (input.sizeMode === "percent") {
    const pct =
      input.sizePercent != null && input.sizePercent > 0 && input.sizePercent <= 100
        ? input.sizePercent
        : 0;
    const bookUsdt = input.availableUsdt * (pct / 100);
    if (!(bookUsdt > 0)) {
      return { ok: false, code: "skip" };
    }
    return { ok: true, bookUsdt };
  }
  if (input.sizeMode === "fixed") {
    const bookUsdt = input.sizeBookUsdt;
    if (!(bookUsdt != null && bookUsdt > 0)) {
      return { ok: false, code: "skip" };
    }
    if (input.availableUsdt < bookUsdt) {
      return { ok: false, code: "pause" };
    }
    return { ok: true, bookUsdt };
  }
  return { ok: true, bookUsdt: input.availableUsdt };
}

export function copySizedNotional(input: {
  parentFillUsdt: number;
  parentBalanceUsdt: number;
  followerAvailableUsdt: number;
  sizeMode: CopySizeMode;
  sizePercent: number | null;
  sizeBookUsdt: number | null;
}): { ok: true; notionalUsdt: number } | { ok: false; code: CopySizeSkip } {
  const book = resolveCopyFollowerBook({
    sizeMode: input.sizeMode,
    availableUsdt: input.followerAvailableUsdt,
    sizePercent: input.sizePercent,
    sizeBookUsdt: input.sizeBookUsdt,
  });
  if (!book.ok) {
    return book;
  }
  const notionalUsdt = copyBalanceScaledNotional({
    parentFillUsdt: input.parentFillUsdt,
    parentBalanceUsdt: input.parentBalanceUsdt,
    followerBalanceUsdt: book.bookUsdt,
  });
  if (notionalUsdt == null) {
    return { ok: false, code: "skip" };
  }
  return { ok: true, notionalUsdt };
}

export type DeskCopySettings = {
  accountId: string;
  scale: number;
  sizeMode: CopySizeMode;
  sizePercent: number | null;
  sizeBookUsdt: number | null;
  paused: boolean;
  maxDailyLossUsdt: number | null;
  maxOpenNotionalUsdt: number | null;
  maxDrawdownPct: number | null;
  maxAdverseMovePct: number | null;
  equityPeakUsdt: number | null;
};

export function parseCopyOptionalPct(
  value: unknown,
  label: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const raw = String(value ?? "").trim().replace(/,/g, "");
  if (!raw) {
    return { ok: true, value: null };
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
    return {
      ok: false,
      error: `${label} must be more than 0 and at most 100, or empty.`,
    };
  }
  return { ok: true, value: parsed };
}

export function parseCopyOptionalUsdt(
  value: unknown,
  label: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const raw = String(value ?? "").trim().replace(/,/g, "");
  if (!raw) {
    return { ok: true, value: null };
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false, error: `${label} must be more than zero, or empty.` };
  }
  return { ok: true, value: parsed };
}

export function parseCopyFollowerGuardsForm(input: {
  maxDailyLossUsdt: unknown;
  maxDrawdownPct?: unknown;
  maxAdverseMovePct?: unknown;
  paused: unknown;
}):
  | {
      ok: true;
      paused: boolean;
      maxDailyLossUsdt: number | null;
      maxDrawdownPct: number | null;
      maxAdverseMovePct: number | null;
    }
  | { ok: false; error: string } {
  const daily = parseCopyOptionalUsdt(input.maxDailyLossUsdt, "Max daily loss");
  if (!daily.ok) {
    return daily;
  }
  const drawdown = parseCopyOptionalPct(
    input.maxDrawdownPct,
    "Max drawdown",
  );
  if (!drawdown.ok) {
    return drawdown;
  }
  const adverse = parseCopyOptionalPct(
    input.maxAdverseMovePct,
    "Max adverse move",
  );
  if (!adverse.ok) {
    return adverse;
  }
  return {
    ok: true,
    paused: parseCopyToggle(input.paused),
    maxDailyLossUsdt: daily.value,
    maxDrawdownPct: drawdown.value,
    maxAdverseMovePct: adverse.value,
  };
}

export type CopyUnfollowBlock = "open" | "last";

export function copyUnfollowBlockCode(input: {
  liveTradeCount: number;
  deskCount: number;
}): CopyUnfollowBlock | null {
  if (input.liveTradeCount > 0) {
    return "open";
  }
  if (input.deskCount <= 1) {
    return "last";
  }
  return null;
}

export function formatCopyUnfollowBlock(code: CopyUnfollowBlock): string {
  if (code === "open") {
    return COPY_UNFOLLOW_OPEN_TRADES;
  }
  return COPY_UNFOLLOW_LAST_DESK;
}

export type CopyCreateBlock =
  | "self"
  | "already"
  | "no_listing"
  | "sharing_off"
  | "private"
  | "new_followers_off"
  | "cap";

export function formatCopyCreateBlock(code: CopyCreateBlock): string {
  if (code === "self") {
    return "You cannot copy your own desk.";
  }
  if (code === "already") {
    return "You already have a copy of this desk.";
  }
  if (code === "no_listing") {
    return "This desk is not shared.";
  }
  if (code === "sharing_off") {
    return COPY_FOLLOWING_UNAVAILABLE;
  }
  if (code === "private") {
    return "This desk is invite only.";
  }
  if (code === "new_followers_off") {
    return "This desk is not taking new followers.";
  }
  return "This desk has no follower slots left.";
}

export function copyCreateBlockCode(input: {
  parentUserId: string;
  viewerUserId: string;
  listing: {
    sharingEnabled: boolean;
    allowNewFollowers: boolean;
    visibility: CopyListingVisibility;
    maxFollowers: number | null;
  } | null;
  grantStatus: CopyShareStatus | null;
  alreadyCopying: boolean;
  followerCount: number;
  ceiling?: number | null;
}): CopyCreateBlock | null {
  if (input.parentUserId === input.viewerUserId) {
    return "self";
  }
  if (input.alreadyCopying) {
    return "already";
  }
  if (!input.listing) {
    return "no_listing";
  }
  if (!input.listing.sharingEnabled) {
    return "sharing_off";
  }
  const granted =
    input.grantStatus === "invited" || input.grantStatus === "active";
  if (input.listing.visibility === "private" && !granted) {
    return "private";
  }
  if (!input.listing.allowNewFollowers && !granted) {
    return "new_followers_off";
  }
  if (
    !granted &&
    copyFollowerCapReached({
      maxFollowers: input.listing.maxFollowers,
      followerCount: input.followerCount,
      ceiling: input.ceiling ?? null,
    })
  ) {
    return "cap";
  }
  return null;
}

export function parseCopyDescription(
  value: unknown,
): { ok: true; description: string } | { ok: false; error: string } {
  const description = String(value ?? "").trim();
  if (!description) {
    return { ok: false, error: "Write a short setup description." };
  }
  if (description.length > COPY_DESCRIPTION_MAX) {
    return {
      ok: false,
      error: `Setup description must be ${COPY_DESCRIPTION_MAX} characters or fewer.`,
    };
  }
  return { ok: true, description };
}

export function traderProfileFieldErrors(input: {
  alias: unknown;
  bio: unknown;
}): { alias: string | null; bio: string | null } {
  const alias = parseTraderAlias(input.alias);
  const bio = parseTraderBio(input.bio);
  return {
    alias: alias.ok ? null : alias.error,
    bio: bio.ok ? null : bio.error,
  };
}

export function parseTraderProfileForm(input: {
  alias: unknown;
  bio: unknown;
}):
  | { ok: true; alias: string; bio: string | null }
  | { ok: false; error: string } {
  const fields = traderProfileFieldErrors(input);
  if (fields.alias) {
    return { ok: false, error: fields.alias };
  }
  if (fields.bio) {
    return { ok: false, error: fields.bio };
  }
  const alias = parseTraderAlias(input.alias);
  const bio = parseTraderBio(input.bio);
  if (!alias.ok || !bio.ok) {
    return { ok: false, error: "Check the trader profile fields." };
  }
  return { ok: true, alias: alias.alias, bio: bio.bio };
}

export function deskCopyListingFieldErrors(input: {
  name?: unknown;
  visibility: unknown;
  description: unknown;
  maxFollowers?: unknown;
  minBalanceUsdt?: unknown;
  ceiling?: number | null;
  sharingEnabled?: unknown;
  allowNewFollowers?: unknown;
}): {
  name: string | null;
  visibility: string | null;
  description: string | null;
  maxFollowers: string | null;
  minBalanceUsdt: string | null;
} {
  const name = parseCopyListingName(input.name);
  const visibility = parseCopyVisibility(input.visibility);
  const description = parseCopyDescription(input.description);
  const maxFollowers = parseCopyMaxFollowers(input.maxFollowers);
  const capped = maxFollowers.ok
    ? copyMaxFollowersWithinCeiling(maxFollowers.maxFollowers, input.ceiling)
    : maxFollowers;
  const minBalance = parseCopyMinBalanceUsdt(input.minBalanceUsdt);
  return {
    name: name.ok ? null : name.error,
    visibility: visibility.ok ? null : visibility.error,
    description: description.ok ? null : description.error,
    maxFollowers: capped.ok ? null : capped.error,
    minBalanceUsdt: minBalance.ok ? null : minBalance.error,
  };
}

export function parseDeskCopyListingForm(input: {
  name?: unknown;
  visibility: unknown;
  description: unknown;
  maxFollowers?: unknown;
  minBalanceUsdt?: unknown;
  ceiling?: number | null;
  sharingEnabled?: unknown;
  allowNewFollowers?: unknown;
}):
  | {
      ok: true;
      name: string;
      visibility: CopyListingVisibility;
      description: string;
      maxFollowers: number | null;
      minBalanceUsdt: number | null;
      sharingEnabled: boolean;
      allowNewFollowers: boolean;
    }
  | { ok: false; error: string } {
  const fields = deskCopyListingFieldErrors(input);
  if (fields.name) {
    return { ok: false, error: fields.name };
  }
  if (fields.visibility) {
    return { ok: false, error: fields.visibility };
  }
  if (fields.description) {
    return { ok: false, error: fields.description };
  }
  if (fields.maxFollowers) {
    return { ok: false, error: fields.maxFollowers };
  }
  if (fields.minBalanceUsdt) {
    return { ok: false, error: fields.minBalanceUsdt };
  }
  const name = parseCopyListingName(input.name);
  const visibility = parseCopyVisibility(input.visibility);
  const description = parseCopyDescription(input.description);
  const maxFollowers = parseCopyMaxFollowers(input.maxFollowers);
  const minBalance = parseCopyMinBalanceUsdt(input.minBalanceUsdt);
  if (
    !name.ok ||
    !visibility.ok ||
    !description.ok ||
    !maxFollowers.ok ||
    !minBalance.ok
  ) {
    return { ok: false, error: "Check the share fields." };
  }
  const capped = copyMaxFollowersWithinCeiling(
    maxFollowers.maxFollowers,
    input.ceiling,
  );
  if (!capped.ok) {
    return capped;
  }
  return {
    ok: true,
    name: name.name,
    visibility: visibility.visibility,
    description: description.description,
    maxFollowers: capped.maxFollowers,
    minBalanceUsdt: minBalance.minBalanceUsdt,
    sharingEnabled: parseCopyToggle(input.sharingEnabled),
    allowNewFollowers:
      input.allowNewFollowers === undefined
        ? true
        : parseCopyToggle(input.allowNewFollowers),
  };
}

export function copyShareBlockCode(input: {
  mode: TradingAccountMode;
  deskType: DeskType;
  copyOfAccountId?: string | null;
  bound: boolean;
  alias: string | null | undefined;
  firstFillMs: number | null | undefined;
  minDays: number;
  nowMs: number;
}): CopyShareBlockCode | null {
  if (input.copyOfAccountId) {
    return "copy_desk";
  }
  if (input.deskType === "cash_and_carry") {
    return "cash_and_carry";
  }
  if (input.mode !== "live") {
    return "paper";
  }
  if (!input.bound) {
    return "unbound";
  }
  if (!String(input.alias ?? "").trim()) {
    return "no_alias";
  }
  if (
    !copyActivityFloorMet({
      firstFillMs: input.firstFillMs,
      minDays: input.minDays,
      nowMs: input.nowMs,
    })
  ) {
    return "activity";
  }
  return null;
}

export function formatCopyShareBlock(
  code: CopyShareBlockCode,
  minDays = DEFAULT_COPY_MIN_ACTIVITY_DAYS,
): string {
  if (code === "copy_desk") {
    return "A copy desk cannot be shared.";
  }
  if (code === "cash_and_carry") {
    return "Cash and Carry desks cannot be shared.";
  }
  if (code === "paper") {
    return "Paper desks cannot be shared. Share a connected Live desk.";
  }
  if (code === "unbound") {
    return "Bind an exchange before you share this desk.";
  }
  if (code === "no_alias") {
    return TRADER_ALIAS_REQUIRED;
  }
  if (minDays <= 0) {
    return "This desk needs a venue fill before it can be shared.";
  }
  return `This desk needs a first venue fill at least ${minDays} days ago before it can be shared.`;
}

export function deskCopyShareBlock(input: {
  mode: TradingAccountMode;
  deskType: DeskType;
  copyOfAccountId?: string | null;
  bound: boolean;
  alias: string | null | undefined;
  firstFillMs: number | null | undefined;
  minDays: number;
  nowMs: number;
}): string | null {
  const code = copyShareBlockCode(input);
  return code ? formatCopyShareBlock(code, input.minDays) : null;
}

export function evaluateCopyShare(input: {
  mode: TradingAccountMode;
  deskType: DeskType;
  copyOfAccountId?: string | null;
  bound: boolean;
  alias: string | null | undefined;
  firstFillMs: number | null | undefined;
  minDays: number;
}): { code: CopyShareBlockCode | null; block: string | null } {
  const nowMs = Date.now();
  const code = copyShareBlockCode({ ...input, nowMs });
  return {
    code,
    block: code ? formatCopyShareBlock(code, input.minDays) : null,
  };
}
