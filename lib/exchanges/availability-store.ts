import { loginIsAdmin } from "@/lib/admin/emails";
import {
  mergeExchangeAvailability,
  parseAvailabilityRow,
  type ExchangeAccess,
  type ExchangeAvailabilityCell,
} from "@/lib/exchanges/availability";
import { createServiceClient } from "@/lib/supabase/admin";

export async function loadExchangeAvailability(): Promise<
  ExchangeAvailabilityCell[]
> {
  const supabase = createServiceClient();
  if (!supabase) {
    return mergeExchangeAvailability([]);
  }
  const { data, error } = await supabase
    .from("exchange_availability")
    .select("venue, desk_type, mode, live, testing, beta");
  if (error || !data) {
    return mergeExchangeAvailability([]);
  }
  const stored = (data as Record<string, unknown>[]).flatMap((row) => {
    const cell = parseAvailabilityRow(row);
    return cell ? [cell] : [];
  });
  return mergeExchangeAvailability(stored);
}

export async function saveVenueAvailability(
  venueId: string,
  cells: readonly ExchangeAvailabilityCell[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = cells.filter((cell) => cell.venueId === venueId);
  if (rows.length === 0) {
    return { ok: false, error: "That exchange has no desk settings." };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const now = new Date().toISOString();
  const { error } = await supabase.from("exchange_availability").upsert(
    rows.map((cell) => ({
      venue: cell.venueId,
      desk_type: cell.deskType,
      mode: cell.mode,
      live: cell.live,
      testing: cell.testing,
      beta: cell.beta,
      updated_at: now,
    })),
    { onConflict: "venue,desk_type,mode" },
  );
  if (error) {
    return { ok: false, error: "Could not save exchange settings." };
  }
  return { ok: true };
}

export async function loadExchangeAccessForUser(
  userId: string,
): Promise<ExchangeAccess> {
  const [cells, admin] = await Promise.all([
    loadExchangeAvailability(),
    userIsAdmin(userId),
  ]);
  return { admin, cells };
}

async function userIsAdmin(userId: string): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) {
    return false;
  }
  const { data, error } = await supabase
    .from("members")
    .select("role, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    return false;
  }
  const row = data as { role?: unknown; email?: unknown };
  return loginIsAdmin({
    role: row.role == null ? null : String(row.role),
    email: row.email == null ? null : String(row.email),
  });
}
