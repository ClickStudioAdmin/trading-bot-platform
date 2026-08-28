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
  accountId: string | null;
  strategy: string | null;
  data: Record<string, unknown>;
};

export async function listEventLogs(
  filters: EventLogFilters,
  options: {
    limit?: number;
    userId?: string;
    accountId?: string;
    scopes?: Array<"system" | "strategy" | "trade">;
    since?: string;
  } = {},
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

  if (options.accountId) {
    query = query.eq("account_id", options.accountId);
  } else if (options.userId) {
    query = query.eq("user_id", options.userId);
  }

  const scopes =
    options.scopes && options.scopes.length > 0
      ? options.scopes
      : filters.scope === "system" ||
          filters.scope === "strategy" ||
          filters.scope === "trade"
        ? [filters.scope]
        : [];
  if (scopes.length === 1) {
    query = query.eq("scope", scopes[0]);
  } else if (scopes.length > 1) {
    query = query.in("scope", scopes);
  }
  if (options.since) {
    query = query.gte("created_at", options.since);
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
    accountId: row.account_id ? String(row.account_id) : null,
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
      (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
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

export function positionIdFromLogData(
  data: Record<string, unknown>,
): string | null {
  const raw = data.positionId;
  if (typeof raw === "string" && raw.trim()) {
    return raw;
  }
  return null;
}

export type PositionLogAnchor = {
  id: string;
  symbol?: string;
  side?: string;
  ruleId?: string | null;
  ruleName?: string | null;
  openedAtMs?: number;
  closedAtMs?: number | null;
};

const POSITION_LOG_WINDOW_MS = 5_000;

export function logBelongsToPosition(
  log: EventLogRow,
  position: PositionLogAnchor,
): boolean {
  const byId = positionIdFromLogData(log.data);
  if (byId) {
    return byId === position.id;
  }
  const symbol = stringLogField(log.data.symbol);
  if (!symbol || !position.symbol || symbol !== position.symbol) {
    return false;
  }
  const side = stringLogField(log.data.side);
  if (side && position.side && side !== position.side) {
    return false;
  }
  const playbookId = stringLogField(log.data.playbookId);
  const ruleId = stringLogField(log.data.ruleId) ?? position.ruleId ?? null;
  if (playbookId && position.ruleId && playbookId !== position.ruleId) {
    return false;
  }
  const ruleName = stringLogField(log.data.ruleName);
  if (ruleName && position.ruleName && ruleName !== position.ruleName) {
    return false;
  }
  const linked =
    Boolean(playbookId && position.ruleId && playbookId === position.ruleId) ||
    Boolean(ruleId && position.ruleId && ruleId === position.ruleId) ||
    Boolean(ruleName && position.ruleName && ruleName === position.ruleName);
  if (!linked) {
    return false;
  }
  return logInPositionWindow(log, position);
}

export function logsForPosition(
  logs: EventLogRow[],
  position: PositionLogAnchor | string,
): EventLogRow[] {
  const anchor =
    typeof position === "string" ? { id: position } : position;
  return logs
    .filter((log) => logBelongsToPosition(log, anchor))
    .sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
    );
}

export function attachPositionLogs<T extends PositionLogAnchor>(
  rows: T[],
  logs: EventLogRow[],
): (T & { logs: EventLogRow[] })[] {
  return rows.map((row) => ({
    ...row,
    logs: logsForPosition(logs, row),
  }));
}

function stringLogField(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function logInPositionWindow(
  log: EventLogRow,
  position: PositionLogAnchor,
): boolean {
  const at = new Date(log.createdAt).getTime();
  if (!Number.isFinite(at)) {
    return false;
  }
  const opened = position.openedAtMs ?? 0;
  const start = opened > 0 ? opened - POSITION_LOG_WINDOW_MS : 0;
  const closed = position.closedAtMs ?? 0;
  const end =
    closed > 0 ? closed + POSITION_LOG_WINDOW_MS : Date.now() + POSITION_LOG_WINDOW_MS;
  return at >= start && at <= end;
}
