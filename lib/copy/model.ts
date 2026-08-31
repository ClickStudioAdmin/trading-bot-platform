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
};

export type DeskCopyListing = {
  accountId: string;
  visibility: CopyListingVisibility;
  description: string;
  maxFollowers: number | null;
};

export type CopyPlatformSettings = {
  minActivityDays: number;
  maxFollowersDefault: number | null;
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

export function copyFollowerCapReached(input: {
  maxFollowers: number | null | undefined;
  followerCount: number;
}): boolean {
  if (
    input.maxFollowers == null ||
    !Number.isInteger(input.maxFollowers) ||
    input.maxFollowers < 1
  ) {
    return false;
  }
  if (!Number.isFinite(input.followerCount) || input.followerCount < 0) {
    return false;
  }
  return input.followerCount >= input.maxFollowers;
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
}): {
  visibility: string | null;
  description: string | null;
  maxFollowers: string | null;
} {
  const visibility = parseCopyVisibility(input.visibility);
  const description = parseCopyDescription(input.description);
  const maxFollowers = parseCopyMaxFollowers(input.maxFollowers);
  return {
    visibility: visibility.ok ? null : visibility.error,
    description: description.ok ? null : description.error,
    maxFollowers: maxFollowers.ok ? null : maxFollowers.error,
  };
}

export function parseDeskCopyListingForm(input: {
  visibility: unknown;
  description: unknown;
  maxFollowers?: unknown;
}):
  | {
      ok: true;
      visibility: CopyListingVisibility;
      description: string;
      maxFollowers: number | null;
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
  const visibility = parseCopyVisibility(input.visibility);
  const description = parseCopyDescription(input.description);
  const maxFollowers = parseCopyMaxFollowers(input.maxFollowers);
  if (!visibility.ok || !description.ok || !maxFollowers.ok) {
    return { ok: false, error: "Check the share fields." };
  }
  return {
    ok: true,
    visibility: visibility.visibility,
    description: description.description,
    maxFollowers: maxFollowers.maxFollowers,
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
