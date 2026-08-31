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
  const alias = String(value ?? "").trim();
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
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(alias)) {
    return {
      ok: false,
      error:
        "Use letters, numbers, underscore, or hyphen. Start with a letter.",
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

export function parseTraderProfileForm(input: {
  alias: unknown;
  bio: unknown;
}):
  | { ok: true; alias: string; bio: string | null }
  | { ok: false; error: string } {
  const alias = parseTraderAlias(input.alias);
  if (!alias.ok) {
    return alias;
  }
  const bio = parseTraderBio(input.bio);
  if (!bio.ok) {
    return bio;
  }
  return { ok: true, alias: alias.alias, bio: bio.bio };
}

export function parseDeskCopyListingForm(input: {
  visibility: unknown;
  description: unknown;
}):
  | { ok: true; visibility: CopyListingVisibility; description: string }
  | { ok: false; error: string } {
  const visibility = parseCopyVisibility(input.visibility);
  if (!visibility.ok) {
    return visibility;
  }
  const description = parseCopyDescription(input.description);
  if (!description.ok) {
    return description;
  }
  return {
    ok: true,
    visibility: visibility.visibility,
    description: description.description,
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
