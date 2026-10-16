import {
  deskCloseRetentionDue,
  oldestDueClosedDesk,
  type DeskCloseKind,
} from "@/lib/accounts/close";
import { formatDeleteBlockers } from "@/lib/accounts/model";
import {
  listTradingAccounts,
  loadAccountUsage,
  teardownTradingAccountById,
} from "@/lib/accounts/store";
import { revokeOpenDeskCopyShares } from "@/lib/copy/shares";
import { notifyCopySourceClosed } from "@/lib/notifications/commercial";
import { createServiceClient } from "@/lib/supabase/admin";

export async function closeTradingAccountRow(
  userId: string,
  accountId: string,
): Promise<{ error: string | null; kind: DeskCloseKind | null }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { error: "Auth is not configured.", kind: null };
  }
  const accounts = await listTradingAccounts(userId);
  const target = accounts.find((account) => account.id === accountId);
  if (!target || target.closedAtMs != null) {
    return { error: "That account was not found.", kind: null };
  }
  const usage = await loadAccountUsage(accounts);
  const own = usage.get(accountId);
  if (!own?.closeKind) {
    return {
      error: own?.blocks.length
        ? `${formatDeleteBlockers(own.blocks)}.`
        : "This desk can be deleted.",
      kind: null,
    };
  }
  const kind = own.closeKind;
  const revoked = await revokeOpenDeskCopyShares(accountId);
  if (!revoked.ok) {
    return { error: revoked.error, kind: null };
  }
  const now = new Date().toISOString();
  const { error: listingError } = await supabase
    .from("desk_copy_listings")
    .update({
      sharing_enabled: false,
      allow_new_followers: false,
      visibility: "private",
      updated_at: now,
    })
    .eq("account_id", accountId);
  if (listingError) {
    return { error: "Could not take this desk off the catalogue.", kind: null };
  }
  const { data: copyRows, error: copyError } = await supabase
    .from("trading_accounts")
    .select("user_id")
    .eq("copy_of_account_id", accountId);
  if (copyError) {
    return { error: "Could not list the copy desks.", kind: null };
  }
  const copyUsers = new Set(
    (copyRows ?? [])
      .map((row) => String((row as { user_id?: string }).user_id ?? "").trim())
      .filter(Boolean),
  );
  const told = new Set<string>();
  for (const followerId of copyUsers) {
    told.add(followerId);
    await notifyCopySourceClosed({
      parentAccountId: accountId,
      toUserId: followerId,
      deskName: target.name,
      keepsCopy: true,
    });
  }
  for (const share of revoked.shares) {
    if (told.has(share.toUserId)) {
      continue;
    }
    told.add(share.toUserId);
    await notifyCopySourceClosed({
      parentAccountId: accountId,
      toUserId: share.toUserId,
      deskName: target.name,
      keepsCopy: false,
    });
  }
  if (kind === "archive") {
    const { error } = await supabase
      .from("trading_accounts")
      .update({ closed_at: now })
      .eq("id", accountId)
      .eq("user_id", userId)
      .is("closed_at", null);
    if (error) {
      return { error: "Could not close this desk.", kind: null };
    }
    return { error: null, kind: "archive" };
  }
  const removed = await teardownTradingAccountById(userId, accountId);
  if (removed.error) {
    return { error: removed.error, kind: null };
  }
  return { error: null, kind: "revoke" };
}

export async function purgeExpiredClosedDesks(input?: {
  nowMs?: number;
}): Promise<{ parents: number; copies: number }> {
  const nowMs = input?.nowMs ?? Date.now();
  const supabase = createServiceClient();
  if (!supabase) {
    return { parents: 0, copies: 0 };
  }
  const { data, error } = await supabase
    .from("trading_accounts")
    .select("id, user_id, closed_at")
    .not("closed_at", "is", null)
    .is("copy_of_account_id", null);
  if (error || !data) {
    if (error) {
      throw new Error(error.message);
    }
    return { parents: 0, copies: 0 };
  }
  const dueId = oldestDueClosedDesk(
    data.map((row) => ({
      id: String((row as { id?: string }).id ?? ""),
      closedAtMs: Date.parse(String((row as { closed_at?: string }).closed_at ?? "")),
    })),
    nowMs,
  );
  if (!dueId) {
    return { parents: 0, copies: 0 };
  }
  const parent = data.find((row) => String((row as { id?: string }).id) === dueId);
  const parentUserId = String((parent as { user_id?: string } | undefined)?.user_id ?? "");
  const closedAtMs = Date.parse(
    String((parent as { closed_at?: string } | undefined)?.closed_at ?? ""),
  );
  if (!parentUserId || !deskCloseRetentionDue(closedAtMs, nowMs)) {
    return { parents: 0, copies: 0 };
  }
  const { data: copies, error: copyError } = await supabase
    .from("trading_accounts")
    .select("id, user_id")
    .eq("copy_of_account_id", dueId);
  if (copyError) {
    throw new Error(copyError.message);
  }
  let removedCopies = 0;
  for (const row of copies ?? []) {
    const copyId = String((row as { id?: string }).id ?? "").trim();
    const copyUserId = String((row as { user_id?: string }).user_id ?? "").trim();
    if (!copyId || !copyUserId) {
      continue;
    }
    const removed = await teardownTradingAccountById(copyUserId, copyId);
    if (removed.error) {
      throw new Error(removed.error);
    }
    removedCopies += 1;
  }
  const removedParent = await teardownTradingAccountById(parentUserId, dueId);
  if (removedParent.error) {
    throw new Error(removedParent.error);
  }
  return { parents: 1, copies: removedCopies };
}
