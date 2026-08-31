import { createServiceClient } from "@/lib/supabase/admin";

export async function loadFavoriteDeskIds(userId: string): Promise<Set<string>> {
  const supabase = createServiceClient();
  if (!supabase) {
    return new Set();
  }
  const { data, error } = await supabase
    .from("desk_copy_favorites")
    .select("account_id")
    .eq("user_id", userId);
  if (error || !data) {
    return new Set();
  }
  return new Set(
    data.map((row) => String((row as { account_id: string }).account_id)),
  );
}

export async function toggleDeskCopyFavorite(input: {
  userId: string;
  accountId: string;
  favorite: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  if (input.favorite) {
    const { error } = await supabase.from("desk_copy_favorites").upsert(
      {
        user_id: input.userId,
        account_id: input.accountId,
      },
      { onConflict: "user_id,account_id" },
    );
    if (error) {
      return { ok: false, error: "Could not save that favorite." };
    }
    return { ok: true };
  }
  const { error } = await supabase
    .from("desk_copy_favorites")
    .delete()
    .eq("user_id", input.userId)
    .eq("account_id", input.accountId);
  if (error) {
    return { ok: false, error: "Could not remove that favorite." };
  }
  return { ok: true };
}
