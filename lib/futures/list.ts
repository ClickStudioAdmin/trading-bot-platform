import { parseFuturesPositionRow, type FuturesPosition } from "./model";
import { getSessionContext } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";

export async function loadFuturesPositions(input?: {
  status?: "open" | "closed";
}): Promise<FuturesPosition[]> {
  const session = await getSessionContext();
  const supabase = createServiceClient();
  if (!session || !supabase) {
    return [];
  }
  let query = supabase
    .from("futures_positions")
    .select("*")
    .eq("account_id", session.account.id)
    .eq("user_id", session.member.id)
    .order("opened_at", { ascending: false });
  if (input?.status) {
    query = query.eq("status", input.status);
  }
  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  return data.map((row) =>
    parseFuturesPositionRow(row as Record<string, unknown>),
  );
}

export async function loadOpenFuturesForSymbol(
  symbol: string,
): Promise<FuturesPosition | null> {
  const session = await getSessionContext();
  const supabase = createServiceClient();
  if (!session || !supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("futures_positions")
    .select("*")
    .eq("account_id", session.account.id)
    .eq("user_id", session.member.id)
    .eq("symbol", symbol)
    .eq("status", "open")
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return parseFuturesPositionRow(data as Record<string, unknown>);
}
