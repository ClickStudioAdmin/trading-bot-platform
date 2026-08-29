import { createServiceClient } from "@/lib/supabase/admin";
import {
  ENGINE_CLAIM_BATCH,
  ENGINE_LEASE_ENSURE_MS,
  ENGINE_LEASE_TTL_SECONDS,
  ENGINE_MUTATION_TTL_SECONDS,
  ENGINE_SCAN_KEY,
  ENGINE_SCAN_TTL_SECONDS,
  ENGINE_VENUE_GAP_MS,
} from "./lease";

const EPOCH = "1970-01-01T00:00:00.000Z";
let lastLeaseEnsureMs = 0;

export function engineWorkerId(): string {
  const fromEnv = String(process.env.ENGINE_WORKER_ID ?? "").trim();
  if (fromEnv) {
    return fromEnv.slice(0, 80);
  }
  const host = String(process.env.FLY_MACHINE_ID ?? process.env.HOSTNAME ?? "local");
  return `eng:${host}:${process.pid}`.slice(0, 80);
}

function leaseUntilIso(ttlSeconds: number): string {
  return new Date(Date.now() + Math.max(5, ttlSeconds) * 1000).toISOString();
}

async function ensureLeaseRows(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  accountIds?: string[],
): Promise<void> {
  let ids = accountIds;
  if (!ids) {
    const { data, error } = await supabase.from("trading_accounts").select("id");
    if (error) {
      console.error("engine_desk_leases accounts", error.message);
      return;
    }
    ids = (data ?? []).map((row) => String(row.id));
  }
  if (!ids.length) {
    return;
  }
  const { error } = await supabase.from("engine_desk_leases").upsert(
    ids.map((account_id) => ({ account_id })),
    { onConflict: "account_id", ignoreDuplicates: true },
  );
  if (error) {
    console.error("engine_desk_leases upsert", error.message);
  }
}

async function ensureLeaseRowsIfStale(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
): Promise<void> {
  const now = Date.now();
  if (lastLeaseEnsureMs > 0 && now - lastLeaseEnsureMs < ENGINE_LEASE_ENSURE_MS) {
    return;
  }
  lastLeaseEnsureMs = now;
  await ensureLeaseRows(supabase);
}

function asAccountIds(data: unknown): string[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((row) => {
      if (typeof row === "string") {
        return row;
      }
      if (row && typeof row === "object" && "account_id" in row) {
        return String((row as { account_id?: unknown }).account_id ?? "");
      }
      return "";
    })
    .filter(Boolean);
}

export async function tryClaimEngineScan(input?: {
  workerId?: string;
  scanKey?: string;
  ttlSeconds?: number;
}): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) {
    return true;
  }
  const workerId = input?.workerId ?? engineWorkerId();
  const scanKey = (input?.scanKey ?? ENGINE_SCAN_KEY).trim() || ENGINE_SCAN_KEY;
  const ttlSeconds = input?.ttlSeconds ?? ENGINE_SCAN_TTL_SECONDS;
  const { data, error } = await supabase.rpc("engine_try_claim_scan", {
    p: {
      worker_id: workerId,
      scan_key: scanKey,
      ttl_seconds: ttlSeconds,
    },
  });
  if (!error) {
    return Boolean(data);
  }
  console.error("engine_try_claim_scan rpc", error.message);
  await supabase.from("engine_scan_leases").upsert(
    { scan_key: scanKey },
    { onConflict: "scan_key", ignoreDuplicates: true },
  );
  const nowIso = new Date().toISOString();
  const { data: row, error: tableError } = await supabase
    .from("engine_scan_leases")
    .update({
      worker_id: workerId,
      leased_until: leaseUntilIso(ttlSeconds),
      updated_at: nowIso,
    })
    .eq("scan_key", scanKey)
    .lt("leased_until", nowIso)
    .select("scan_key");
  if (tableError) {
    console.error("engine_scan_leases claim", tableError.message);
    return true;
  }
  return Boolean(row?.length);
}

export async function claimEngineDesks(input?: {
  workerId?: string;
  limit?: number;
  ttlSeconds?: number;
  preferAccountIds?: readonly string[];
  excludeAccountIds?: readonly string[];
}): Promise<string[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const workerId = input?.workerId ?? engineWorkerId();
  const limit = Math.max(1, Math.min(50, input?.limit ?? ENGINE_CLAIM_BATCH));
  const ttlSeconds = input?.ttlSeconds ?? ENGINE_LEASE_TTL_SECONDS;
  const prefer = [...new Set(input?.preferAccountIds ?? [])].filter(Boolean);
  const exclude = [...new Set(input?.excludeAccountIds ?? [])].filter(Boolean);
  await ensureLeaseRowsIfStale(supabase);
  if (prefer.length) {
    await ensureLeaseRows(supabase, prefer);
  }
  const { data, error } = await supabase.rpc("engine_claim_ranked_desks", {
    p: {
      worker_id: workerId,
      limit,
      ttl_seconds: ttlSeconds,
      prefer_account_ids: prefer,
      exclude_account_ids: exclude,
    },
  });
  if (!error) {
    return asAccountIds(data);
  }
  console.error("engine_claim_ranked_desks rpc", error.message);
  const preferSet = new Set(prefer);
  const excludeSet = new Set(exclude);
  const nowIso = new Date().toISOString();
  const { data: free, error: listError } = await supabase
    .from("engine_desk_leases")
    .select("account_id, leased_until")
    .lt("leased_until", nowIso)
    .order("leased_until", { ascending: true })
    .order("account_id", { ascending: true })
    .limit(Math.min(200, Math.max(limit * 8, 40)));
  if (listError) {
    console.error("engine_desk_leases list", listError.message);
    return [];
  }
  const ranked = (free ?? [])
    .map((row) => ({
      accountId: String(row.account_id ?? ""),
      leasedUntil: String(row.leased_until ?? ""),
    }))
    .filter((row) => row.accountId && !excludeSet.has(row.accountId))
    .sort((a, b) => {
      const aHot = preferSet.has(a.accountId) ? 0 : 1;
      const bHot = preferSet.has(b.accountId) ? 0 : 1;
      if (aHot !== bHot) {
        return aHot - bHot;
      }
      if (a.leasedUntil !== b.leasedUntil) {
        return a.leasedUntil.localeCompare(b.leasedUntil);
      }
      return a.accountId.localeCompare(b.accountId);
    });
  const claimed: string[] = [];
  const until = leaseUntilIso(ttlSeconds);
  const updatedAt = new Date().toISOString();
  for (const row of ranked) {
    if (claimed.length >= limit) {
      break;
    }
    const { data } = await supabase
      .from("engine_desk_leases")
      .update({
        worker_id: workerId,
        leased_until: until,
        updated_at: updatedAt,
      })
      .eq("account_id", row.accountId)
      .lt("leased_until", nowIso)
      .select("account_id");
    if (data?.length) {
      claimed.push(row.accountId);
    }
  }
  return claimed;
}

export async function tryClaimEngineDesk(input: {
  accountId: string;
  workerId?: string;
  ttlSeconds?: number;
}): Promise<"acquired" | "held" | "busy"> {
  const supabase = createServiceClient();
  if (!supabase) {
    return "busy";
  }
  const workerId = input.workerId ?? engineWorkerId();
  const ttlSeconds = input.ttlSeconds ?? ENGINE_MUTATION_TTL_SECONDS;
  await ensureLeaseRows(supabase, [input.accountId]);
  const nowIso = new Date().toISOString();
  const { data: current } = await supabase
    .from("engine_desk_leases")
    .select("worker_id, leased_until")
    .eq("account_id", input.accountId)
    .maybeSingle();
  if (!current) {
    return "busy";
  }
  const occupied = new Date(String(current.leased_until)).getTime() >= Date.now();
  const holder = String(current.worker_id ?? "");
  if (occupied && holder !== workerId) {
    return "busy";
  }
  const until = leaseUntilIso(ttlSeconds);
  let query = supabase
    .from("engine_desk_leases")
    .update({
      worker_id: workerId,
      leased_until: until,
      updated_at: nowIso,
    })
    .eq("account_id", input.accountId);
  query = occupied
    ? query.eq("worker_id", workerId)
    : query.lt("leased_until", nowIso);
  const { data } = await query.select("account_id");
  if (!data?.length) {
    return "busy";
  }
  return occupied ? "held" : "acquired";
}

export async function releaseEngineDesk(input: {
  accountId: string;
  workerId?: string;
}): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  const workerId = input.workerId ?? engineWorkerId();
  await supabase
    .from("engine_desk_leases")
    .update({
      worker_id: null,
      leased_until: EPOCH,
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", input.accountId)
    .eq("worker_id", workerId);
}

export async function withDeskLease<T>(input: {
  accountId: string;
  holder: string;
  ttlSeconds?: number;
  retries?: number;
  run: () => Promise<T>;
}): Promise<T> {
  const workerId = input.holder.trim().slice(0, 80);
  const retries = Math.max(0, input.retries ?? 8);
  let acquired = false;
  for (let i = 0; i <= retries; i += 1) {
    const result = await tryClaimEngineDesk({
      accountId: input.accountId,
      workerId,
      ttlSeconds: input.ttlSeconds ?? ENGINE_MUTATION_TTL_SECONDS,
    });
    if (result === "acquired") {
      acquired = true;
      break;
    }
    if (result === "held") {
      break;
    }
    await sleep(250);
  }
  try {
    return await input.run();
  } finally {
    if (acquired) {
      await releaseEngineDesk({
        accountId: input.accountId,
        workerId,
      });
    }
  }
}

export async function takeVenueSlot(connectionId: string | null): Promise<void> {
  if (!connectionId) {
    return;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  const now = Date.now();
  const { data: existing } = await supabase
    .from("engine_venue_gates")
    .select("next_allowed_at")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (!existing) {
    await supabase.from("engine_venue_gates").insert({
      connection_id: connectionId,
      next_allowed_at: new Date(now).toISOString(),
    });
  }
  const { data: row } = await supabase
    .from("engine_venue_gates")
    .select("next_allowed_at")
    .eq("connection_id", connectionId)
    .maybeSingle();
  const current = row?.next_allowed_at
    ? new Date(String(row.next_allowed_at)).getTime()
    : now;
  const start = Math.max(now, Number.isFinite(current) ? current : now);
  const next = start + ENGINE_VENUE_GAP_MS;
  await supabase
    .from("engine_venue_gates")
    .update({ next_allowed_at: new Date(next).toISOString() })
    .eq("connection_id", connectionId);
  const wait = start - now;
  if (wait > 0 && wait < 5_000) {
    await sleep(wait);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
