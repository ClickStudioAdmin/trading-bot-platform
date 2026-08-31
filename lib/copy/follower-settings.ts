import { createServiceClient } from "@/lib/supabase/admin";

export async function saveDeskCopySettings(input: {
  accountId: string;
  scale: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const now = new Date().toISOString();
  const { error } = await supabase.from("desk_copy_settings").upsert(
    {
      account_id: input.accountId,
      scale: input.scale,
      paused: false,
      updated_at: now,
    },
    { onConflict: "account_id" },
  );
  if (error) {
    return { ok: false, error: "Could not save copy scale." };
  }
  return { ok: true };
}
