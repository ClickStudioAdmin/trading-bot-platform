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
export const TRADER_LOGO_BUCKET = "trader-logos";
export const TRADER_LOGO_MAX_BYTES = 1_048_576;
export const TRADER_LOGO_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

const TRADER_LOGO_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/logo\.(png|jpg|webp)$/i;

export type CopyListingVisibility = "private" | "public";
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

export type DeskCopyListing = {
  accountId: string;
  visibility: CopyListingVisibility;
  description: string;
  maxFollowers: number | null;
  minBalanceUsdt: number | null;
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
    maxFollowersCeiling: ceiling.maxFollowers,
  };
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
  visibility: unknown;
  description: unknown;
  maxFollowers?: unknown;
  minBalanceUsdt?: unknown;
  ceiling?: number | null;
}): {
  visibility: string | null;
  description: string | null;
  maxFollowers: string | null;
  minBalanceUsdt: string | null;
} {
  const visibility = parseCopyVisibility(input.visibility);
  const description = parseCopyDescription(input.description);
  const maxFollowers = parseCopyMaxFollowers(input.maxFollowers);
  const capped = maxFollowers.ok
    ? copyMaxFollowersWithinCeiling(maxFollowers.maxFollowers, input.ceiling)
    : maxFollowers;
  const minBalance = parseCopyMinBalanceUsdt(input.minBalanceUsdt);
  return {
    visibility: visibility.ok ? null : visibility.error,
    description: description.ok ? null : description.error,
    maxFollowers: capped.ok ? null : capped.error,
    minBalanceUsdt: minBalance.ok ? null : minBalance.error,
  };
}

export function parseDeskCopyListingForm(input: {
  visibility: unknown;
  description: unknown;
  maxFollowers?: unknown;
  minBalanceUsdt?: unknown;
  ceiling?: number | null;
}):
  | {
      ok: true;
      visibility: CopyListingVisibility;
      description: string;
      maxFollowers: number | null;
      minBalanceUsdt: number | null;
    }
  | { ok: false; error: string } {
  const fields = deskCopyListingFieldErrors(input);
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
  const visibility = parseCopyVisibility(input.visibility);
  const description = parseCopyDescription(input.description);
  const maxFollowers = parseCopyMaxFollowers(input.maxFollowers);
  const minBalance = parseCopyMinBalanceUsdt(input.minBalanceUsdt);
  if (
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
    visibility: visibility.visibility,
    description: description.description,
    maxFollowers: capped.maxFollowers,
    minBalanceUsdt: minBalance.minBalanceUsdt,
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
