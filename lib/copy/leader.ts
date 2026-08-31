import { loadTradingAccountById } from "@/lib/accounts/store";
import type { DeskType } from "@/lib/accounts/model";
import { getVenue } from "@/lib/exchanges/venues";
import { formatAuDateUtc, parseDisplayTime } from "@/lib/time/display";
import { loadFuturesDeskStats } from "./desk-stats";
import { loadDeskCopyListing } from "./listings";
import { loadTraderProfile } from "./profile";
import { createServiceClient } from "@/lib/supabase/admin";
import type { DeskWindowStats } from "@/lib/futures/stats";

export type CopyLeaderStripData = {
  parentAccountId: string;
  deskName: string;
  deskType: DeskType;
  venueLabel: string;
  brief: string;
  followingAvailable: boolean;
  traderAlias: string | null;
  traderLogoUrl: string | null;
  uniqueFollowers: number;
  visibleDeskCount: number;
  firstSharedLabel: string | null;
  followerCount: number;
  stats30d: DeskWindowStats | null;
};

export async function loadCopyLeaderStrip(
  parentAccountId: string,
): Promise<CopyLeaderStripData | null> {
  const parent = await loadTradingAccountById(parentAccountId);
  if (!parent) {
    return null;
  }
  const [profile, listing, stats, childCount, traderMeta] = await Promise.all([
    loadTraderProfile(parent.userId),
    loadDeskCopyListing(parent.id),
    loadFuturesDeskStats([parent.id]),
    countCopyChildren(parent.id),
    loadTraderStripMeta(parent.userId),
  ]);
  const stored = stats.get(parent.id);
  return {
    parentAccountId: parent.id,
    deskName: listing?.name || parent.name,
    deskType: parent.deskType,
    venueLabel: getVenue(parent.venue)?.label ?? parent.venue,
    brief: listing?.description ?? "",
    followingAvailable: listing?.sharingEnabled === true,
    traderAlias: profile?.alias ?? null,
    traderLogoUrl: profile?.logoUrl ?? listing?.logoUrl ?? null,
    uniqueFollowers: traderMeta.uniqueFollowers,
    visibleDeskCount: traderMeta.visibleDeskCount,
    firstSharedLabel: traderMeta.firstSharedLabel,
    followerCount: childCount,
    stats30d: stored?.last30d ?? null,
  };
}

async function countCopyChildren(parentAccountId: string): Promise<number> {
  const supabase = createServiceClient();
  if (!supabase) {
    return 0;
  }
  const { count, error } = await supabase
    .from("trading_accounts")
    .select("id", { count: "exact", head: true })
    .eq("copy_of_account_id", parentAccountId);
  if (error || count == null) {
    return 0;
  }
  return count;
}

async function loadTraderStripMeta(traderUserId: string): Promise<{
  uniqueFollowers: number;
  visibleDeskCount: number;
  firstSharedLabel: string | null;
}> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { uniqueFollowers: 0, visibleDeskCount: 0, firstSharedLabel: null };
  }
  const { data: desks } = await supabase
    .from("trading_accounts")
    .select("id")
    .eq("user_id", traderUserId);
  const deskIds = (desks ?? []).map((row) => String((row as { id: string }).id));
  if (deskIds.length === 0) {
    return { uniqueFollowers: 0, visibleDeskCount: 0, firstSharedLabel: null };
  }
  const [{ data: listings }, { data: shares }] = await Promise.all([
    supabase
      .from("desk_copy_listings")
      .select("account_id, sharing_enabled, created_at")
      .in("account_id", deskIds),
    supabase
      .from("desk_copy_shares")
      .select("to_user_id, status")
      .in("parent_account_id", deskIds)
      .in("status", ["invited", "active"]),
  ]);
  const visible = (listings ?? []).filter(
    (row) => (row as { sharing_enabled?: unknown }).sharing_enabled === true,
  );
  const firstSharedMs = visible
    .map((row) =>
      parseDisplayTime((row as { created_at?: string }).created_at),
    )
    .filter((ms): ms is number => ms != null)
    .sort((a, b) => a - b)[0];
  const unique = new Set(
    (shares ?? []).map((row) =>
      String((row as { to_user_id?: string }).to_user_id ?? ""),
    ),
  );
  unique.delete("");
  return {
    uniqueFollowers: unique.size,
    visibleDeskCount: visible.length,
    firstSharedLabel: firstSharedMs ? formatAuDateUtc(firstSharedMs) : null,
  };
}
