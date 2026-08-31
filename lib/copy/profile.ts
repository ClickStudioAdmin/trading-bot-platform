import { createServiceClient } from "@/lib/supabase/admin";
import {
  parseTraderAlias,
  parseTraderBio,
  TRADER_ALIAS_TAKEN,
  type TraderProfile,
} from "./model";

function parseProfileRow(
  row: Record<string, unknown>,
): TraderProfile | null {
  const alias = parseTraderAlias(row.alias);
  if (!alias.ok) {
    return null;
  }
  const bio = parseTraderBio(row.bio);
  if (!bio.ok) {
    return null;
  }
  return {
    userId: String(row.user_id),
    alias: alias.alias,
    bio: bio.bio,
  };
}

export async function loadTraderProfile(
  userId: string,
): Promise<TraderProfile | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("trader_profiles")
    .select("user_id, alias, bio")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return parseProfileRow(data as Record<string, unknown>);
}

export async function saveTraderProfile(input: {
  userId: string;
  alias: string;
  bio: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const existing = await loadTraderProfile(input.userId);
  const now = new Date().toISOString();
  const row = {
    user_id: input.userId,
    alias: input.alias,
    bio: input.bio,
    updated_at: now,
  };
  const { error } = existing
    ? await supabase
        .from("trader_profiles")
        .update(row)
        .eq("user_id", input.userId)
    : await supabase.from("trader_profiles").insert({
        ...row,
        created_at: now,
      });
  if (error?.code === "23505") {
    return { ok: false, error: TRADER_ALIAS_TAKEN };
  }
  if (error) {
    return { ok: false, error: "Could not save trader profile." };
  }
  return { ok: true };
}
