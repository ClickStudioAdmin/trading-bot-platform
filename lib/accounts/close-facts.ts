import { createServiceClient } from "@/lib/supabase/admin";

export type DeskCloseFacts = {
  hasCopyDesks: boolean;
  hasOpenShares: boolean;
  followerBooksOpen: boolean;
  sourceClosed: boolean;
};

const EMPTY_FACTS: DeskCloseFacts = {
  hasCopyDesks: false,
  hasOpenShares: false,
  followerBooksOpen: false,
  sourceClosed: false,
};

export async function loadDeskCloseFacts(
  accountIds: readonly string[],
  copyParentIds: ReadonlyMap<string, string> = new Map(),
): Promise<Map<string, DeskCloseFacts>> {
  const facts = new Map<string, DeskCloseFacts>();
  for (const id of accountIds) {
    facts.set(id, { ...EMPTY_FACTS });
  }
  if (accountIds.length === 0) {
    return facts;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return facts;
  }
  const ids = [...accountIds];
  const [{ data: copies, error: copyError }, { data: shares, error: shareError }] =
    await Promise.all([
      supabase
        .from("trading_accounts")
        .select("id, copy_of_account_id")
        .in("copy_of_account_id", ids),
      supabase
        .from("desk_copy_shares")
        .select("parent_account_id")
        .in("parent_account_id", ids)
        .in("status", ["invited", "active"]),
    ]);
  if (!copyError) {
    const parentByCopy = new Map<string, string>();
    for (const row of copies ?? []) {
      const copyId = String((row as { id?: string }).id ?? "").trim();
      const parentId = String(
        (row as { copy_of_account_id?: string }).copy_of_account_id ?? "",
      ).trim();
      if (!copyId || !parentId || !facts.has(parentId)) {
        continue;
      }
      parentByCopy.set(copyId, parentId);
      const current = facts.get(parentId) ?? { ...EMPTY_FACTS };
      facts.set(parentId, { ...current, hasCopyDesks: true });
    }
    const copyIds = [...parentByCopy.keys()];
    if (copyIds.length > 0) {
      const [positions, working, carries] = await Promise.all([
        supabase
          .from("futures_positions")
          .select("account_id")
          .in("account_id", copyIds)
          .in("status", ["open", "closing"]),
        supabase
          .from("futures_working_orders")
          .select("account_id")
          .in("account_id", copyIds)
          .in("status", ["open", "cancelling"]),
        supabase
          .from("paper_carries")
          .select("account_id")
          .in("account_id", copyIds)
          .in("status", ["open", "closing"]),
      ]);
      const openCopyIds = new Set<string>();
      for (const bundle of [positions.data, working.data, carries.data]) {
        for (const row of bundle ?? []) {
          const id = String(
            (row as { account_id?: string }).account_id ?? "",
          ).trim();
          if (id) {
            openCopyIds.add(id);
          }
        }
      }
      for (const copyId of openCopyIds) {
        const parentId = parentByCopy.get(copyId);
        if (!parentId) {
          continue;
        }
        const current = facts.get(parentId) ?? { ...EMPTY_FACTS };
        facts.set(parentId, { ...current, followerBooksOpen: true });
      }
    }
  }
  if (!shareError) {
    for (const row of shares ?? []) {
      const parentId = String(
        (row as { parent_account_id?: string }).parent_account_id ?? "",
      ).trim();
      if (!facts.has(parentId)) {
        continue;
      }
      const current = facts.get(parentId) ?? { ...EMPTY_FACTS };
      facts.set(parentId, { ...current, hasOpenShares: true });
    }
  }
  const parentIds = [...new Set([...copyParentIds.values()].filter(Boolean))];
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from("trading_accounts")
      .select("id, closed_at")
      .in("id", parentIds);
    const closedParents = new Set<string>();
    for (const row of parents ?? []) {
      const id = String((row as { id?: string }).id ?? "").trim();
      if (id && (row as { closed_at?: string | null }).closed_at) {
        closedParents.add(id);
      }
    }
    for (const [accountId, parentId] of copyParentIds) {
      if (!closedParents.has(parentId)) {
        continue;
      }
      const current = facts.get(accountId) ?? { ...EMPTY_FACTS };
      facts.set(accountId, { ...current, sourceClosed: true });
    }
  }
  return facts;
}
