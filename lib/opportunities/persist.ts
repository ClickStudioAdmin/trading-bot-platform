import { daysToExpiry, netApr } from "@/lib/opportunities/math";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import { createServiceClient } from "@/lib/supabase/admin";

export type PersistResult =
  | { status: "saved"; count: number }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string };

type StoredOpportunityRow = {
  base_coin: unknown;
  spot_symbol: unknown;
  future_symbol: unknown;
  delivery_time: unknown;
  future_bid: unknown;
  spot_ask: unknown;
  executable_basis: unknown;
  fee_rate: unknown;
  net_basis: unknown;
  net_apr: unknown;
  capacity_usdt: unknown;
  scanned_at: unknown;
};

function asFinite(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function storedRowToOpportunity(
  row: StoredOpportunityRow,
  nowMs = Date.now(),
): ScannedOpportunity | null {
  const deliveryTimeMs = new Date(String(row.delivery_time ?? "")).getTime();
  const futureBid = asFinite(row.future_bid);
  const spotAsk = asFinite(row.spot_ask);
  const executableBasis = asFinite(row.executable_basis);
  const feeRate = asFinite(row.fee_rate);
  const netBasis = asFinite(row.net_basis);
  const capacityUsdt = asFinite(row.capacity_usdt);
  if (
    !Number.isFinite(deliveryTimeMs) ||
    futureBid === null ||
    spotAsk === null ||
    executableBasis === null ||
    feeRate === null ||
    netBasis === null ||
    capacityUsdt === null
  ) {
    return null;
  }
  const dte = daysToExpiry(deliveryTimeMs, nowMs);
  return {
    baseCoin: String(row.base_coin ?? ""),
    spotSymbol: String(row.spot_symbol ?? ""),
    futureSymbol: String(row.future_symbol ?? ""),
    deliveryTimeMs,
    deliveryDate: new Date(deliveryTimeMs).toISOString().slice(0, 10),
    daysToExpiry: dte,
    futureBid,
    spotAsk,
    executableBasis,
    feeRate,
    netBasis,
    netApr: netApr(netBasis, dte),
    capacityUsdt,
  };
}

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

  if (rows.length === 0) {
    return { status: "saved", count: 0 };
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

export async function loadStoredPairMeta(
  spotSymbol: string,
  futureSymbol: string,
): Promise<{ baseCoin: string; deliveryTimeMs: number } | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("opportunities")
    .select("base_coin, delivery_time")
    .eq("spot_symbol", spotSymbol)
    .eq("future_symbol", futureSymbol)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const deliveryTimeMs = new Date(String(data.delivery_time ?? "")).getTime();
  const baseCoin = String(data.base_coin ?? "");
  if (!baseCoin || !Number.isFinite(deliveryTimeMs)) {
    return null;
  }
  return { baseCoin, deliveryTimeMs };
}

export async function loadStoredOpportunities(
  nowMs = Date.now(),
): Promise<{ rows: ScannedOpportunity[]; scannedAtMs: number | null }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { rows: [], scannedAtMs: null };
  }

  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "base_coin, spot_symbol, future_symbol, delivery_time, future_bid, spot_ask, executable_basis, fee_rate, net_basis, net_apr, capacity_usdt, scanned_at",
    )
    .order("net_apr", { ascending: false });

  if (error || !data) {
    return { rows: [], scannedAtMs: null };
  }

  const rows: ScannedOpportunity[] = [];
  let scannedAtMs: number | null = null;
  for (const raw of data) {
    const row = storedRowToOpportunity(raw as StoredOpportunityRow, nowMs);
    if (row) {
      rows.push(row);
    }
    const at = new Date(String(raw.scanned_at ?? "")).getTime();
    if (Number.isFinite(at) && (scannedAtMs === null || at > scannedAtMs)) {
      scannedAtMs = at;
    }
  }
  return { rows, scannedAtMs };
}
