import { createServiceClient } from "@/lib/supabase/admin";
import { loadDeskCopyListing } from "./listings";
import {
  copyShareCountsTowardCap,
  copyUnfollowKeepsInvite,
  parseCopyShareStatus,
  type CopyShareStatus,
  type DeskCopyFollowerView,
  type DeskCopyShare,
} from "./model";

function parseShareRow(row: Record<string, unknown>): DeskCopyShare | null {
  const status = parseCopyShareStatus(row.status);
  if (!status.ok) {
    return null;
  }
  const id = String(row.id ?? "").trim();
  const parentAccountId = String(row.parent_account_id ?? "").trim();
  const fromUserId = String(row.from_user_id ?? "").trim();
  const toUserId = String(row.to_user_id ?? "").trim();
  const invitedEmail = String(row.invited_email ?? "").trim().toLowerCase();
  if (!id || !parentAccountId || !fromUserId || !toUserId) {
    return null;
  }
  return {
    id,
    parentAccountId,
    fromUserId,
    toUserId,
    invitedEmail,
    status: status.status,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function loadDeskCopyShares(
  parentAccountId: string,
): Promise<DeskCopyShare[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("desk_copy_shares")
    .select(
      "id, parent_account_id, from_user_id, to_user_id, invited_email, status, created_at, updated_at",
    )
    .eq("parent_account_id", parentAccountId)
    .order("created_at", { ascending: true });
  if (error || !data) {
    return [];
  }
  return (data as Record<string, unknown>[])
    .map(parseShareRow)
    .filter((row): row is DeskCopyShare => row != null);
}

export function countOpenCopyShares(shares: readonly DeskCopyShare[]): number {
  return shares.filter((row) => copyShareCountsTowardCap(row.status)).length;
}

export async function loadDeskCopyFollowerViews(
  parentAccountId: string,
): Promise<DeskCopyFollowerView[]> {
  const shares = await loadDeskCopyShares(parentAccountId);
  return shares.map((share) => ({
    id: share.id,
    status: share.status,
    invitedEmail: share.invitedEmail,
    toUserId: share.toUserId,
    createdAt: share.createdAt,
    updatedAt: share.updatedAt,
  }));
}

export async function loadInboundCopyInvites(userId: string): Promise<
  {
    share: DeskCopyShare;
    parentName: string;
    traderAlias: string | null;
    sharingEnabled: boolean;
  }[]
> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("desk_copy_shares")
    .select(
      "id, parent_account_id, from_user_id, to_user_id, invited_email, status, created_at, updated_at",
    )
    .eq("to_user_id", userId)
    .in("status", ["invited", "active"])
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  const shares = (data as Record<string, unknown>[])
    .map(parseShareRow)
    .filter((row): row is DeskCopyShare => row != null);
  if (shares.length === 0) {
    return [];
  }
  const parentIds = [...new Set(shares.map((row) => row.parentAccountId))];
  const fromIds = [...new Set(shares.map((row) => row.fromUserId))];
  const [{ data: desks }, { data: listings }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("trading_accounts")
        .select("id, name")
        .in("id", parentIds),
      supabase
        .from("desk_copy_listings")
        .select("account_id, sharing_enabled")
        .in("account_id", parentIds),
      supabase.from("trader_profiles").select("user_id, alias").in("user_id", fromIds),
    ]);
  const nameById = new Map(
    (desks ?? []).map((row) => [
      String((row as { id: string }).id),
      String((row as { name?: string }).name ?? "Desk"),
    ]),
  );
  const sharingById = new Map(
    (listings ?? []).map((row) => [
      String((row as { account_id: string }).account_id),
      (row as { sharing_enabled?: unknown }).sharing_enabled === true,
    ]),
  );
  const aliasByUser = new Map(
    (profiles ?? []).map((row) => [
      String((row as { user_id: string }).user_id),
      String((row as { alias?: string }).alias ?? "").trim() || null,
    ]),
  );
  return shares.map((share) => ({
    share,
    parentName: nameById.get(share.parentAccountId) ?? "Desk",
    traderAlias: aliasByUser.get(share.fromUserId) ?? null,
    sharingEnabled: sharingById.get(share.parentAccountId) ?? false,
  }));
}

export async function inviteDeskCopyShare(input: {
  parentAccountId: string;
  fromUserId: string;
  toUserId: string;
  invitedEmail: string;
}): Promise<{ ok: true; share: DeskCopyShare } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const existing = (await loadDeskCopyShares(input.parentAccountId)).find(
    (row) => row.toUserId === input.toUserId,
  );
  const now = new Date().toISOString();
  if (existing) {
    if (copyShareCountsTowardCap(existing.status)) {
      return { ok: false, error: "That member already has an invite." };
    }
    const { data, error } = await supabase
      .from("desk_copy_shares")
      .update({
        invited_email: input.invitedEmail,
        status: "invited" satisfies CopyShareStatus,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select(
        "id, parent_account_id, from_user_id, to_user_id, invited_email, status, created_at, updated_at",
      )
      .maybeSingle();
    const parsed = data ? parseShareRow(data as Record<string, unknown>) : null;
    if (error || !parsed) {
      return { ok: false, error: "Could not send the invite." };
    }
    return { ok: true, share: parsed };
  }
  const { data, error } = await supabase
    .from("desk_copy_shares")
    .insert({
      parent_account_id: input.parentAccountId,
      from_user_id: input.fromUserId,
      to_user_id: input.toUserId,
      invited_email: input.invitedEmail,
      status: "invited" satisfies CopyShareStatus,
      created_at: now,
      updated_at: now,
    })
    .select(
      "id, parent_account_id, from_user_id, to_user_id, invited_email, status, created_at, updated_at",
    )
    .maybeSingle();
  const parsed = data ? parseShareRow(data as Record<string, unknown>) : null;
  if (error || !parsed) {
    return { ok: false, error: "Could not send the invite." };
  }
  return { ok: true, share: parsed };
}

export async function activateDeskCopyShare(input: {
  parentAccountId: string;
  parentUserId: string;
  toUserId: string;
  invitedEmail: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const existing = (await loadDeskCopyShares(input.parentAccountId)).find(
    (row) => row.toUserId === input.toUserId,
  );
  const now = new Date().toISOString();
  if (existing) {
    if (existing.status === "active") {
      return { ok: true };
    }
    const { error } = await supabase
      .from("desk_copy_shares")
      .update({
        invited_email: input.invitedEmail,
        status: "active" satisfies CopyShareStatus,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) {
      return { ok: false, error: "Could not activate that copy grant." };
    }
    return { ok: true };
  }
  const { error } = await supabase.from("desk_copy_shares").insert({
    parent_account_id: input.parentAccountId,
    from_user_id: input.parentUserId,
    to_user_id: input.toUserId,
    invited_email: input.invitedEmail,
    status: "active" satisfies CopyShareStatus,
    created_at: now,
    updated_at: now,
  });
  if (error) {
    return { ok: false, error: "Could not record that you are following." };
  }
  return { ok: true };
}

export async function revokeDeskCopyShare(input: {
  shareId: string;
  parentAccountId: string;
  fromUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("desk_copy_shares")
    .update({
      status: "revoked" satisfies CopyShareStatus,
      updated_at: now,
    })
    .eq("id", input.shareId)
    .eq("parent_account_id", input.parentAccountId)
    .eq("from_user_id", input.fromUserId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "Could not revoke that invite." };
  }
  return { ok: true };
}

export async function releaseDeskCopyShareByFollower(input: {
  parentAccountId: string;
  toUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const listing = await loadDeskCopyListing(input.parentAccountId);
  if (copyUnfollowKeepsInvite(listing?.visibility)) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("desk_copy_shares")
      .update({
        status: "invited" satisfies CopyShareStatus,
        updated_at: now,
      })
      .eq("parent_account_id", input.parentAccountId)
      .eq("to_user_id", input.toUserId)
      .in("status", ["invited", "active"]);
    if (error) {
      return { ok: false, error: "Could not unfollow that desk." };
    }
    return { ok: true };
  }
  const { error } = await supabase
    .from("desk_copy_shares")
    .delete()
    .eq("parent_account_id", input.parentAccountId)
    .eq("to_user_id", input.toUserId);
  if (error) {
    return { ok: false, error: "Could not unfollow that desk." };
  }
  return { ok: true };
}
