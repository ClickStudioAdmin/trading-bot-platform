import { createServiceClient } from "@/lib/supabase/admin";
import {
  parseCopyDescription,
  parseCopyVisibility,
  type CopyListingVisibility,
  type DeskCopyListing,
} from "./model";

function parseListingRow(
  row: Record<string, unknown>,
): DeskCopyListing | null {
  const visibility = parseCopyVisibility(row.visibility);
  const description = parseCopyDescription(row.description);
  if (!visibility.ok || !description.ok) {
    return null;
  }
  return {
    accountId: String(row.account_id),
    visibility: visibility.visibility,
    description: description.description,
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
    .select("account_id, visibility, description")
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
  visibility: CopyListingVisibility;
  description: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const existing = await loadDeskCopyListing(input.accountId);
  const now = new Date().toISOString();
  const row = {
    account_id: input.accountId,
    visibility: input.visibility,
    description: input.description,
    updated_at: now,
  };
  const { error } = existing
    ? await supabase
        .from("desk_copy_listings")
        .update({
          visibility: input.visibility,
          description: input.description,
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
