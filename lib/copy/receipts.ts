import { createServiceClient } from "@/lib/supabase/admin";

export async function loadCopyReceiptFillIds(input: {
  followerAccountId: string;
  parentFillIds: readonly string[];
}): Promise<Set<string>> {
  const out = new Set<string>();
  if (input.parentFillIds.length === 0) {
    return out;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return out;
  }
  const { data, error } = await supabase
    .from("desk_copy_receipts")
    .select("parent_fill_id")
    .eq("follower_account_id", input.followerAccountId)
    .in("parent_fill_id", [...input.parentFillIds]);
  if (error || !data) {
    return out;
  }
  for (const row of data) {
    const id = String((row as { parent_fill_id?: string }).parent_fill_id ?? "");
    if (id) {
      out.add(id);
    }
  }
  return out;
}

export async function insertCopyReceipt(input: {
  followerAccountId: string;
  parentFillId: string;
}): Promise<{ ok: true } | { ok: false }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false };
  }
  const { error } = await supabase.from("desk_copy_receipts").insert({
    follower_account_id: input.followerAccountId,
    parent_fill_id: input.parentFillId,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: true };
    }
    return { ok: false };
  }
  return { ok: true };
}
