import {
  accountDeleteBlockers,
  type AccountDeleteBlock,
} from "@/lib/accounts/model";

/** How long a closed source desk and its copy desks stay before the purge. */
export const DESK_CLOSE_RETENTION_MONTHS = 6;

export const FOLLOWER_BOOK_OPEN =
  "A follower still has an open position or a working order. Disable this desk and let the next tick flatten those copies";

export type DeskCloseKind = "archive" | "revoke";

export type DeskWindDown =
  | { action: "delete" }
  | { action: "close"; kind: DeskCloseKind }
  | { action: "blocked"; blocks: AccountDeleteBlock[] };

export function deskWindDown(input: {
  accountCount: number;
  openCount: number;
  automationsRunning: boolean;
  hasCopyDesks: boolean;
  hasOpenShares: boolean;
  followerBooksOpen: boolean;
}): DeskWindDown {
  const blocks = accountDeleteBlockers({
    accountCount: input.accountCount,
    openCount: input.openCount,
    automationsRunning: input.automationsRunning,
    mode: "live",
    followerBooksOpen: input.followerBooksOpen,
  });
  if (blocks.length > 0) {
    return { action: "blocked", blocks };
  }
  if (input.hasCopyDesks) {
    return { action: "close", kind: "archive" };
  }
  if (input.hasOpenShares) {
    return { action: "close", kind: "revoke" };
  }
  return { action: "delete" };
}

export function engineSkipsClosedDesk(input: {
  closedAtMs: number | null;
  parentClosedAtMs: number | null;
}): boolean {
  return input.closedAtMs != null || input.parentClosedAtMs != null;
}

/** Calendar months in UTC. Day 31 lands on the last day of a shorter month. */
export function addUtcMonths(ms: number, months: number): number {
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) {
    return Number.NaN;
  }
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  const msPart = date.getUTCMilliseconds();
  const wholeMonths = Math.trunc(months);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + wholeMonths);
  const dim = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, dim));
  date.setUTCHours(hours, minutes, seconds, msPart);
  return date.getTime();
}

export function deskCloseRetentionDue(
  closedAtMs: number,
  nowMs: number,
  months = DESK_CLOSE_RETENTION_MONTHS,
): boolean {
  if (!Number.isFinite(closedAtMs) || closedAtMs <= 0 || !Number.isFinite(nowMs)) {
    return false;
  }
  const dueAt = addUtcMonths(closedAtMs, months);
  return Number.isFinite(dueAt) && nowMs >= dueAt;
}

export function oldestDueClosedDesk(
  rows: readonly { id: string; closedAtMs: number }[],
  nowMs: number,
): string | null {
  let best: { id: string; closedAtMs: number } | null = null;
  for (const row of rows) {
    if (!row.id || !deskCloseRetentionDue(row.closedAtMs, nowMs)) {
      continue;
    }
    if (!best || row.closedAtMs < best.closedAtMs) {
      best = row;
    }
  }
  return best?.id ?? null;
}
