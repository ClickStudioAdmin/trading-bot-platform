import {
  parseDeskType,
  parseTradingAccountRow,
  type DeskType,
} from "@/lib/accounts/model";
import { createServiceClient } from "@/lib/supabase/admin";
import { deskLogoPublicUrl, traderLogoPublicUrl } from "./logo";
import {
  copyCatalogueIncludes,
  parseCopyDescription,
  parseCopyListingName,
  parseCopyMaxFollowers,
  parseCopyShareStatus,
  parseCopyToggle,
  parseCopyVisibility,
  parseTraderAlias,
  parseTraderLogoPath,
  type CopyCatalogueSort,
  type CopyCatalogueTab,
  type CopyListingVisibility,
  type CopyShareStatus,
} from "./model";
import { loadFavoriteDeskIds } from "./favorites";
import {
  backfillMissingFuturesDeskStats,
  loadFuturesDeskStats,
  type StoredDeskStats,
} from "./desk-stats";
import type { DeskWindowStats } from "@/lib/futures/stats";

export type CopyCatalogueCard = {
  accountId: string;
  deskName: string;
  deskType: DeskType;
  venue: string;
  visibility: CopyListingVisibility;
  description: string;
  maxFollowers: number | null;
  followerCount: number;
  invitedCount: number;
  traderUserId: string;
  traderAlias: string | null;
  traderLogoUrl: string | null;
  deskLogoUrl: string | null;
  favorite: boolean;
  following: boolean;
  stats30d: DeskWindowStats | null;
  createdAt: string;
};

type ListingRow = {
  accountId: string;
  name: string;
  visibility: CopyListingVisibility;
  description: string;
  maxFollowers: number | null;
  sharingEnabled: boolean;
  logoUrl: string | null;
  createdAt: string;
};

function parseListing(row: Record<string, unknown>): ListingRow | null {
  const visibility = parseCopyVisibility(row.visibility);
  const description = parseCopyDescription(row.description);
  const maxFollowers = parseCopyMaxFollowers(row.max_followers);
  const named = parseCopyListingName(row.name);
  if (!visibility.ok || !description.ok || !maxFollowers.ok) {
    return null;
  }
  const logo = parseTraderLogoPath(row.logo_path);
  const updatedAt =
    typeof row.updated_at === "string" ? row.updated_at : null;
  return {
    accountId: String(row.account_id ?? "").trim(),
    name: named.ok ? named.name : "",
    visibility: visibility.visibility,
    description: description.description,
    maxFollowers: maxFollowers.maxFollowers,
    sharingEnabled: parseCopyToggle(row.sharing_enabled),
    logoUrl: deskLogoPublicUrl(logo.ok ? logo.path : null, updatedAt),
    createdAt: String(row.created_at ?? ""),
  };
}

function sortCards(
  cards: CopyCatalogueCard[],
  sort: CopyCatalogueSort,
): CopyCatalogueCard[] {
  return cards.slice().sort((a, b) => {
    if (sort === "drawdown") {
      return (
        (a.stats30d?.maxDrawdownUsdt ?? 0) - (b.stats30d?.maxDrawdownUsdt ?? 0)
      );
    }
    if (sort === "followers") {
      return b.followerCount - a.followerCount;
    }
    if (sort === "newest") {
      return b.createdAt.localeCompare(a.createdAt);
    }
    return (b.stats30d?.realizedPct ?? -Infinity) - (a.stats30d?.realizedPct ?? -Infinity);
  });
}

export async function loadCopyCatalogue(input: {
  viewerUserId: string;
  tab: CopyCatalogueTab;
  privateOnly: boolean;
  query: string;
  sort: CopyCatalogueSort;
}): Promise<CopyCatalogueCard[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  await backfillMissingFuturesDeskStats();
  const [
    { data: listingRows },
    { data: shareRows },
    { data: copyRows },
    favoriteIds,
  ] = await Promise.all([
    supabase
      .from("desk_copy_listings")
      .select(
        "account_id, name, visibility, description, max_followers, sharing_enabled, logo_path, created_at, updated_at",
      ),
    supabase
      .from("desk_copy_shares")
      .select("parent_account_id, status")
      .eq("to_user_id", input.viewerUserId)
      .in("status", ["invited", "active"]),
    supabase
      .from("trading_accounts")
      .select("copy_of_account_id")
      .eq("user_id", input.viewerUserId)
      .not("copy_of_account_id", "is", null),
    loadFavoriteDeskIds(input.viewerUserId),
  ]);
  const grants = new Map<string, CopyShareStatus>();
  for (const row of shareRows ?? []) {
    const parentId = String(
      (row as { parent_account_id: string }).parent_account_id,
    );
    const status = parseCopyShareStatus((row as { status: string }).status);
    if (status.ok) {
      grants.set(parentId, status.status);
    }
  }
  const followingIds = new Set(
    (copyRows ?? [])
      .map((row) => String((row as { copy_of_account_id?: string }).copy_of_account_id ?? ""))
      .filter(Boolean),
  );
  const listings = (listingRows ?? [])
    .map((row) => parseListing(row as Record<string, unknown>))
    .filter((row): row is ListingRow => row != null && Boolean(row.accountId));
  const listingById = new Map(listings.map((row) => [row.accountId, row]));
  const visibleIds = new Set(
    listings
      .filter((row) =>
        copyCatalogueIncludes({
          sharingEnabled: row.sharingEnabled,
          visibility: row.visibility,
          grantStatus: grants.get(row.accountId) ?? null,
        }),
      )
      .map((row) => row.accountId),
  );
  let candidateIds: string[] = [];
  if (input.tab === "subscribed") {
    candidateIds = [...followingIds];
  } else if (input.tab === "favorites") {
    candidateIds = [...favoriteIds].filter(
      (id) => visibleIds.has(id) || followingIds.has(id),
    );
  } else {
    candidateIds = [...visibleIds];
  }
  if (input.privateOnly) {
    candidateIds = candidateIds.filter(
      (id) => listingById.get(id)?.visibility === "private",
    );
  }
  if (candidateIds.length === 0) {
    return [];
  }
  const [{ data: desks }, stats, { data: childRows }, { data: shareCounts }] =
    await Promise.all([
      supabase
        .from("trading_accounts")
        .select("*")
        .in("id", candidateIds),
      loadFuturesDeskStats(candidateIds),
      supabase
        .from("trading_accounts")
        .select("copy_of_account_id")
        .in("copy_of_account_id", candidateIds),
      supabase
        .from("desk_copy_shares")
        .select("parent_account_id, status")
        .in("parent_account_id", candidateIds)
        .in("status", ["invited", "active"]),
    ]);
  const accounts = (desks ?? [])
    .map((row) => parseTradingAccountRow(row as Record<string, unknown>))
    .filter((row) => candidateIds.includes(row.id));
  const ownerIds = [...new Set(accounts.map((row) => row.userId))];
  const { data: profiles } =
    ownerIds.length === 0
      ? { data: [] }
      : await supabase
          .from("trader_profiles")
          .select("user_id, alias, logo_path, updated_at")
          .in("user_id", ownerIds);
  const profileByUser = new Map(
    (profiles ?? []).map((row) => {
      const userId = String((row as { user_id: string }).user_id);
      const alias = parseTraderAlias((row as { alias?: string }).alias);
      const logo = parseTraderLogoPath((row as { logo_path?: string }).logo_path);
      const updatedAt = String((row as { updated_at?: string }).updated_at ?? "");
      return [
        userId,
        {
          alias: alias.ok ? alias.alias : null,
          logoUrl: traderLogoPublicUrl(logo.ok ? logo.path : null, updatedAt),
        },
      ] as const;
    }),
  );
  const followerCount = new Map<string, number>();
  for (const row of childRows ?? []) {
    const parent = String(
      (row as { copy_of_account_id: string }).copy_of_account_id,
    );
    followerCount.set(parent, (followerCount.get(parent) ?? 0) + 1);
  }
  const invitedCount = new Map<string, number>();
  for (const row of shareCounts ?? []) {
    const parent = String(
      (row as { parent_account_id: string }).parent_account_id,
    );
    invitedCount.set(parent, (invitedCount.get(parent) ?? 0) + 1);
  }
  const needle = input.query.trim().toLowerCase();
  const cards: CopyCatalogueCard[] = [];
  for (const desk of accounts) {
    const listing = listingById.get(desk.id);
    const profile = profileByUser.get(desk.userId);
    const stored: StoredDeskStats | undefined = stats.get(desk.id);
    const card: CopyCatalogueCard = {
      accountId: desk.id,
      deskName: listing?.name || desk.name,
      deskType: parseDeskType(desk.deskType),
      venue: desk.venue,
      visibility: listing?.visibility ?? "private",
      description: listing?.description ?? "",
      maxFollowers: listing?.maxFollowers ?? null,
      followerCount: followerCount.get(desk.id) ?? 0,
      invitedCount: invitedCount.get(desk.id) ?? 0,
      traderUserId: desk.userId,
      traderAlias: profile?.alias ?? null,
      traderLogoUrl: profile?.logoUrl ?? null,
      deskLogoUrl: listing?.logoUrl ?? null,
      favorite: favoriteIds.has(desk.id),
      following: followingIds.has(desk.id),
      stats30d: stored?.last30d ?? null,
      createdAt: listing?.createdAt ?? new Date(desk.createdAtMs).toISOString(),
    };
    if (needle) {
      const hay = `${card.traderAlias ?? ""} ${card.deskName}`.toLowerCase();
      if (!hay.includes(needle)) {
        continue;
      }
    }
    cards.push(card);
  }
  return sortCards(cards, input.sort);
}

export async function loadTraderCatalogueDesks(input: {
  viewerUserId: string;
  traderUserId: string;
}): Promise<CopyCatalogueCard[]> {
  const cards = await loadCopyCatalogue({
    viewerUserId: input.viewerUserId,
    tab: "all",
    privateOnly: false,
    query: "",
    sort: "newest",
  });
  const following = await loadCopyCatalogue({
    viewerUserId: input.viewerUserId,
    tab: "subscribed",
    privateOnly: false,
    query: "",
    sort: "newest",
  });
  const byId = new Map<string, CopyCatalogueCard>();
  for (const card of [...cards, ...following]) {
    if (card.traderUserId === input.traderUserId) {
      byId.set(card.accountId, card);
    }
  }
  return [...byId.values()];
}
