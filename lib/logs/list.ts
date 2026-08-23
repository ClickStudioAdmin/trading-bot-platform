import type { EventLogFilters } from "@/lib/logs/filters";
import { createServiceClient } from "@/lib/supabase/admin";

export type { EventLogFilters } from "@/lib/logs/filters";
export { parseEventLogFilters } from "@/lib/logs/filters";

export type EventLogRow = {
  id: number;
  createdAt: string;
  level: "info" | "warning" | "error";
  scope: "system" | "strategy" | "trade";
  event: string;
  message: string;
  userId: string | null;
  strategy: string | null;
  data: Record<string, unknown>;
};

export async function listEventLogs(
  filters: EventLogFilters,
  options: { limit?: number; userId?: string } = {},
): Promise<EventLogRow[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }

  const limit = options.limit ?? 100;
  let query = supabase
    .from("event_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.userId) {
    query = query.eq("user_id", options.userId);
  }

  if (filters.scope === "system" || filters.scope === "strategy" || filters.scope === "trade") {
    query = query.eq("scope", filters.scope);
  }
  if (filters.level === "info" || filters.level === "warning" || filters.level === "error") {
    query = query.eq("level", filters.level);
  }
  if (filters.event.trim()) {
    query = query.eq("event", filters.event.trim());
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: Number(row.id),
    createdAt: String(row.created_at),
    level: row.level,
    scope: row.scope,
    event: String(row.event),
    message: String(row.message),
    userId: row.user_id ? String(row.user_id) : null,
    strategy: row.strategy ? String(row.strategy) : null,
    data:
      row.data && typeof row.data === "object" && !Array.isArray(row.data)
        ? (row.data as Record<string, unknown>)
        : {},
  }));
}

export function carryIdFromLogData(
  data: Record<string, unknown>,
): number | null {
  const raw = data.carryId;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function logsForCarry(
  logs: EventLogRow[],
  carryId: number,
): EventLogRow[] {
  return logs
    .filter((log) => carryIdFromLogData(log.data) === carryId)
    .sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
    );
}

export function attachLogs<T extends { id: number }>(
  rows: T[],
  logs: EventLogRow[],
): (T & { logs: EventLogRow[] })[] {
  return rows.map((row) => ({
    ...row,
    logs: logsForCarry(logs, row.id),
  }));
}
