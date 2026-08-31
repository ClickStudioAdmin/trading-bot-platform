import { createServiceClient } from "@/lib/supabase/admin";
import { deskLogoPublicUrl } from "./logo";
import {
  parseCopyDescription,
  parseCopyListingName,
  parseCopyMaxFollowers,
  parseCopyMinBalanceUsdt,
  parseCopyToggle,
  parseCopyVisibility,
  parseTraderLogoPath,
  type CopyListingVisibility,
  type DeskCopyListing,
} from "./model";

function parseListingRow(
  row: Record<string, unknown>,
): DeskCopyListing | null {
  const visibility = parseCopyVisibility(row.visibility);
  const description = parseCopyDescription(row.description);
  const maxFollowers = parseCopyMaxFollowers(row.max_followers);
  const minBalance = parseCopyMinBalanceUsdt(row.min_balance_usdt);
  const named = parseCopyListingName(row.name);
  if (
    !visibility.ok ||
    !description.ok ||
    !maxFollowers.ok ||
    !minBalance.ok
  ) {
    return null;
  }
  const logo = parseTraderLogoPath(row.logo_path);
  const logoPath = logo.ok ? logo.path : null;
  const updatedAt =
    typeof row.updated_at === "string" ? row.updated_at : null;
  return {
    accountId: String(row.account_id),
    name: named.ok ? named.name : "Desk",
    visibility: visibility.visibility,
    description: description.description,
    maxFollowers: maxFollowers.maxFollowers,
    minBalanceUsdt: minBalance.minBalanceUsdt,
    sharingEnabled: parseCopyToggle(row.sharing_enabled),
    allowNewFollowers:
      row.allow_new_followers === undefined
        ? true
        : parseCopyToggle(row.allow_new_followers),
    logoPath,
    logoUrl: deskLogoPublicUrl(logoPath, updatedAt),
  };
}

export async function loadDeskCopyListing(
  accountId: string,
): Promise<DeskCopyListing | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("desk_copy_listings")
    .select(
      "account_id, name, visibility, description, max_followers, min_balance_usdt, sharing_enabled, allow_new_followers, logo_path, updated_at",
    )
    .eq("account_id", accountId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return parseListingRow(data as Record<string, unknown>);
}

export async function loadFirstVenueFillMs(
  accountId: string,
): Promise<number | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("futures_orders")
    .select("filled_at")
    .eq("account_id", accountId)
    .not("venue_order_id", "is", null)
    .neq("venue_order_id", "")
    .order("filled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const filled = new Date(
    String((data as { filled_at?: unknown }).filled_at ?? ""),
  ).getTime();
  return Number.isFinite(filled) ? filled : null;
}

export async function saveDeskCopyListing(input: {
  accountId: string;
  name: string;
  visibility: CopyListingVisibility;
  description: string;
  maxFollowers: number | null;
  minBalanceUsdt: number | null;
  sharingEnabled: boolean;
  allowNewFollowers: boolean;
  logoPath: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const existing = await loadDeskCopyListing(input.accountId);
  const now = new Date().toISOString();
  const row = {
    account_id: input.accountId,
    name: input.name,
    visibility: input.visibility,
    description: input.description,
    max_followers: input.maxFollowers,
    min_balance_usdt: input.minBalanceUsdt,
    sharing_enabled: input.sharingEnabled,
    allow_new_followers: input.allowNewFollowers,
    logo_path: input.logoPath,
    updated_at: now,
  };
  const { error } = existing
    ? await supabase
        .from("desk_copy_listings")
        .update({
          name: input.name,
          visibility: input.visibility,
          description: input.description,
          max_followers: input.maxFollowers,
          min_balance_usdt: input.minBalanceUsdt,
          sharing_enabled: input.sharingEnabled,
          allow_new_followers: input.allowNewFollowers,
          logo_path: input.logoPath,
          updated_at: now,
        })
        .eq("account_id", input.accountId)
    : await supabase.from("desk_copy_listings").insert({
        ...row,
        created_at: now,
      });
  if (error) {
    return { ok: false, error: "Could not save the share listing." };
  }
  return { ok: true };
}

export async function pauseCopyNewEntriesOnUnbind(input: {
  accountId: string;
  openTradeCount: number;
}): Promise<{ paused: boolean; unlisted: boolean }> {
  const listing = await loadDeskCopyListing(input.accountId);
  if (!listing) {
    return { paused: false, unlisted: false };
  }
  const unlisted =
    listing.sharingEnabled &&
    (!Number.isFinite(input.openTradeCount) || input.openTradeCount <= 0);
  const paused = listing.allowNewFollowers;
  if (!paused && !unlisted) {
    return { paused: false, unlisted: false };
  }
  const saved = await saveDeskCopyListing({
    accountId: listing.accountId,
    name: listing.name,
    visibility: listing.visibility,
    description: listing.description,
    maxFollowers: listing.maxFollowers,
    minBalanceUsdt: listing.minBalanceUsdt,
    sharingEnabled: unlisted ? false : listing.sharingEnabled,
    allowNewFollowers: false,
    logoPath: listing.logoPath,
  });
  if (!saved.ok) {
    return { paused: false, unlisted: false };
  }
  return { paused, unlisted };
}
