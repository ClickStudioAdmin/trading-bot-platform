import { createServiceClient } from "@/lib/supabase/admin";
import {
  ENGINE_CLAIM_BATCH,
  ENGINE_LEASE_TTL_SECONDS,
  ENGINE_MUTATION_TTL_SECONDS,
  ENGINE_VENUE_GAP_MS,
} from "./lease";

export function engineWorkerId(): string {
  const fromEnv = String(process.env.ENGINE_WORKER_ID ?? "").trim();
  if (fromEnv) {
    return fromEnv.slice(0, 80);
  }
  const host = String(process.env.FLY_MACHINE_ID ?? process.env.HOSTNAME ?? "local");
  return `eng:${host}:${process.pid}`.slice(0, 80);
}

function asAccountIds(data: unknown): string[] {
  if (data == null) {
    return [];
  }
  const rows = Array.isArray(data) ? data : [data];
  const ids: string[] = [];
  for (const row of rows) {
    if (typeof row === "string" && row.length > 0) {
      ids.push(row);
      continue;
    }
    if (!row || typeof row !== "object") {
      continue;
    }
    const rec = row as Record<string, unknown>;
    const id = rec.account_id ?? rec.accountId ?? rec.id;
    if (typeof id === "string" && id.length > 0) {
      ids.push(id);
    }
  }
  return ids;
}

export async function claimEngineDesks(input?: {
  workerId?: string;
  limit?: number;
  ttlSeconds?: number;
}): Promise<string[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase.rpc("claim_engine_desks", {
    p_worker_id: input?.workerId ?? engineWorkerId(),
    p_limit: input?.limit ?? ENGINE_CLAIM_BATCH,
    p_ttl_seconds: input?.ttlSeconds ?? ENGINE_LEASE_TTL_SECONDS,
  });
  if (error) {
    console.error("claim_engine_desks", error.message);
    return [];
  }
  return asAccountIds(data);
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
  const { data, error } = await supabase.rpc("try_claim_engine_desk", {
    p_account_id: input.accountId,
    p_worker_id: input.workerId ?? engineWorkerId(),
    p_ttl_seconds: input.ttlSeconds ?? ENGINE_MUTATION_TTL_SECONDS,
  });
  if (error) {
    return "busy";
  }
  if (data === "acquired" || data === "held") {
    return data;
  }
  return "busy";
}

export async function releaseEngineDesk(input: {
  accountId: string;
  workerId?: string;
}): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  await supabase.rpc("release_engine_desk", {
    p_account_id: input.accountId,
    p_worker_id: input.workerId ?? engineWorkerId(),
  });
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
  const { data } = await supabase.rpc("take_engine_venue_slot", {
    p_connection_id: connectionId,
    p_gap_ms: ENGINE_VENUE_GAP_MS,
  });
  const slot = data ? new Date(String(data)).getTime() : 0;
  const wait = slot - Date.now();
  if (wait > 0 && wait < 5_000) {
    await sleep(wait);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
