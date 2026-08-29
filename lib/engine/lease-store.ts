import { createServiceClient } from "@/lib/supabase/admin";
import {
  ENGINE_CLAIM_BATCH,
  ENGINE_LEASE_TTL_SECONDS,
  ENGINE_MUTATION_TTL_SECONDS,
  ENGINE_VENUE_GAP_MS,
} from "./lease";

const EPOCH = "1970-01-01T00:00:00.000Z";

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
  const prefer = new Set(input?.preferAccountIds ?? []);
  const exclude = new Set(input?.excludeAccountIds ?? []);
  await ensureLeaseRows(supabase);
  const nowIso = new Date().toISOString();
  const { data: free, error } = await supabase
    .from("engine_desk_leases")
    .select("account_id, leased_until")
    .lt("leased_until", nowIso)
    .order("leased_until", { ascending: true })
    .order("account_id", { ascending: true })
    .limit(Math.min(200, Math.max(limit * 8, 40)));
  if (error) {
    console.error("engine_desk_leases list", error.message);
    return [];
  }
  const ranked = (free ?? [])
    .map((row) => ({
      accountId: String(row.account_id ?? ""),
      leasedUntil: String(row.leased_until ?? ""),
    }))
    .filter((row) => row.accountId && !exclude.has(row.accountId))
    .sort((a, b) => {
      const aHot = prefer.has(a.accountId) ? 0 : 1;
      const bHot = prefer.has(b.accountId) ? 0 : 1;
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
