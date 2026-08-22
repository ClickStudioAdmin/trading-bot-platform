import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import { createServiceClient } from "@/lib/supabase/admin";

export type PersistResult =
  | { status: "saved"; count: number }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string };

export async function persistOpportunities(
  rows: ScannedOpportunity[],
): Promise<PersistResult> {
  const supabase = createServiceClient();
  if (!supabase) {
    return {
      status: "skipped",
      reason:
        "Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY on this Vercel environment. Use the development project on develop.",
    };
  }

  const payload = rows.map((row) => ({
    base_coin: row.baseCoin,
    spot_symbol: row.spotSymbol,
    future_symbol: row.futureSymbol,
    delivery_time: new Date(row.deliveryTimeMs).toISOString(),
    future_bid: row.futureBid,
    spot_ask: row.spotAsk,
    executable_basis: row.executableBasis,
    fee_rate: row.feeRate,
    net_basis: row.netBasis,
    net_apr: row.netApr,
    capacity_usdt: row.capacityUsdt,
    scanned_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("opportunities").upsert(payload, {
    onConflict: "spot_symbol,future_symbol",
  });

  if (error) {
    return { status: "error", reason: error.message };
  }

  return { status: "saved", count: payload.length };
}

export async function loadLatestScannedAt(): Promise<number | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("opportunities")
    .select("scanned_at")
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.scanned_at) {
    return null;
  }

  const ms = new Date(String(data.scanned_at)).getTime();
  return Number.isFinite(ms) ? ms : null;
}
