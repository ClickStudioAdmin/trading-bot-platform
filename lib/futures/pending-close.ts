import { createServiceClient } from "@/lib/supabase/admin";
import type { FuturesSide } from "./model";

export const FUTURES_LIVE_POSITION_STATUSES = ["open", "closing"] as const;
export const FUTURES_LIVE_WORKING_STATUSES = ["open", "cancelling"] as const;

export const PENDING_CLOSE_CANCEL_CONCURRENCY = 4;

export function futuresPositionIsLive(status: string): boolean {
  return status === "open" || status === "closing";
}

export function futuresWorkingIsPendingCancel(status: string): boolean {
  return status === "cancelling";
}

export function futuresWorkingIsLive(status: string): boolean {
  return status === "open" || status === "cancelling";
}

export function dcaFlattenVenuePlan(venue: string | null | undefined): {
  waitForGridBeforeFlatten: false;
  useSymbolCancelAll: boolean;
} {
  return {
    waitForGridBeforeFlatten: false,
    useSymbolCancelAll: venue === "bybit",
  };
}

export function selectIds(
  rows: readonly { id: string }[],
): string[] {
  return rows.map((row) => row.id).filter((id) => id.trim() !== "");
}

export function workingOwnedByPositions<
  T extends { id: string; positionId: string | null; symbol: string; side: string },
>(
  working: readonly T[],
  positions: readonly { id: string; symbol: string; side: string }[],
): T[] {
  const ids = new Set(positions.map((row) => row.id));
  const keys = new Set(
    positions.map((row) => `${row.symbol}:${row.side}`),
  );
  return working.filter(
    (row) =>
      (row.positionId != null && ids.has(row.positionId)) ||
      keys.has(`${row.symbol}:${row.side}`),
  );
}

export function workingOwnedByPerpsDisable<
  T extends {
    id: string;
    positionId: string | null;
    ruleName: string | null;
  },
>(
  working: readonly T[],
  positions: readonly { id: string; ruleName: string | null }[],
): T[] {
  const ids = new Set(positions.map((row) => row.id));
  const names = new Set(
    positions
      .map((row) => row.ruleName)
      .filter((name): name is string => Boolean(name)),
  );
  return working.filter(
    (row) =>
      (row.positionId != null && ids.has(row.positionId)) ||
      (row.ruleName != null && names.has(row.ruleName)),
  );
}

export async function mapWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  const cap = Math.max(1, Math.floor(concurrency));
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      await work(items[index] as T);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(cap, items.length) }, () => worker()),
  );
}

export async function markFuturesPendingClose(input: {
  accountId: string;
  userId: string;
  positionIds?: readonly string[];
  workingIds?: readonly string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Auth is not configured." };
  }
  const positionIds = (input.positionIds ?? []).filter((id) => id.trim() !== "");
  const workingIds = (input.workingIds ?? []).filter((id) => id.trim() !== "");
  if (positionIds.length > 0) {
    const { error } = await supabase
      .from("futures_positions")
      .update({ status: "closing" })
      .eq("account_id", input.accountId)
      .eq("user_id", input.userId)
      .in("id", positionIds)
      .eq("status", "open");
    if (error) {
      return { ok: false, error: error.message };
    }
  }
  if (workingIds.length > 0) {
    const { error } = await supabase
      .from("futures_working_orders")
      .update({ status: "cancelling" })
      .eq("account_id", input.accountId)
      .eq("user_id", input.userId)
      .in("id", workingIds)
      .eq("status", "open");
    if (error) {
      return { ok: false, error: error.message };
    }
  }
  return { ok: true };
}

export function sidesForMark(
  side?: FuturesSide | null,
  enabled?: readonly FuturesSide[],
): FuturesSide[] {
  if (side) {
    return [side];
  }
  return enabled && enabled.length > 0 ? [...enabled] : ["long", "short"];
}
