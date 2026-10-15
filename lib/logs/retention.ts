import { createServiceClient } from "@/lib/supabase/admin";

export const EVENT_LOG_RETENTION_DAYS = 60;
export const EVENT_LOG_RETENTION_BATCH = 1_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function eventLogRetentionCutoffMs(
  nowMs: number,
  days = EVENT_LOG_RETENTION_DAYS,
): number {
  const safeDays = Math.max(1, Math.floor(days));
  return Math.floor(nowMs) - safeDays * DAY_MS;
}

export function eventLogRetentionCutoffIso(
  nowMs: number,
  days = EVENT_LOG_RETENTION_DAYS,
): string {
  return new Date(eventLogRetentionCutoffMs(nowMs, days)).toISOString();
}

export function eventLogExpired(createdAtMs: number, cutoffMs: number): boolean {
  return Number.isFinite(createdAtMs) && createdAtMs < cutoffMs;
}

export function eventLogRetentionBatch(requested?: number): number {
  const value = Math.floor(requested ?? EVENT_LOG_RETENTION_BATCH);
  if (!Number.isFinite(value)) {
    return EVENT_LOG_RETENTION_BATCH;
  }
  return Math.max(1, Math.min(EVENT_LOG_RETENTION_BATCH, value));
}

export function eventLogIdsToDelete(
  ids: readonly number[],
  batch = EVENT_LOG_RETENTION_BATCH,
): number[] {
  const limit = eventLogRetentionBatch(batch);
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of ids) {
    if (out.length >= limit) {
      break;
    }
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

export async function purgeExpiredEventLogs(input?: {
  nowMs?: number;
  batch?: number;
}): Promise<{ deleted: number; cutoff: string }> {
  const nowMs = input?.nowMs ?? Date.now();
  const batch = eventLogRetentionBatch(input?.batch);
  const cutoff = eventLogRetentionCutoffIso(nowMs);
  const supabase = createServiceClient();
  if (!supabase) {
    return { deleted: 0, cutoff };
  }
  const { data, error } = await supabase
    .from("event_logs")
    .select("id")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(batch);
  if (error) {
    throw new Error(error.message);
  }
  const ids = eventLogIdsToDelete(
    (data ?? []).map((row) => Number(row.id)),
    batch,
  );
  if (!ids.length) {
    return { deleted: 0, cutoff };
  }
  const { error: deleteError } = await supabase
    .from("event_logs")
    .delete()
    .in("id", ids);
  if (deleteError) {
    throw new Error(deleteError.message);
  }
  return { deleted: ids.length, cutoff };
}
