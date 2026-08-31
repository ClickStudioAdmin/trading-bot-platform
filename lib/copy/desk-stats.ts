import { createServiceClient } from "@/lib/supabase/admin";
import {
  deskStatsSnapshot,
  type DeskCloseForStats,
  type DeskStatsSnapshot,
  type DeskWindowStats,
} from "@/lib/futures/stats";

const FUTURES_DESK_TYPES = [
  "perps",
  "perps_bots",
  "signal_follower",
  "dca",
] as const;

export type StoredDeskStats = {
  accountId: string;
  allTime: DeskWindowStats;
  last30d: DeskWindowStats;
  updatedAt: string;
};

function parseWindow(
  realized: unknown,
  pct: unknown,
  closed: unknown,
  wins: unknown,
  drawdown: unknown,
  drawdownPct: unknown,
): DeskWindowStats {
  const realizedUsdt = Number(realized);
  const realizedPct = pct == null ? null : Number(pct);
  const closedCount = Number(closed);
  const winCount = Number(wins);
  const maxDrawdownUsdt = Number(drawdown);
  const maxDrawdownPct = drawdownPct == null ? null : Number(drawdownPct);
  return {
    realizedUsdt: Number.isFinite(realizedUsdt) ? realizedUsdt : 0,
    realizedPct:
      realizedPct != null && Number.isFinite(realizedPct) ? realizedPct : null,
    closedCount: Number.isFinite(closedCount) ? closedCount : 0,
    winCount: Number.isFinite(winCount) ? winCount : 0,
    maxDrawdownUsdt: Number.isFinite(maxDrawdownUsdt) ? maxDrawdownUsdt : 0,
    maxDrawdownPct:
      maxDrawdownPct != null && Number.isFinite(maxDrawdownPct)
        ? maxDrawdownPct
        : null,
  };
}

function parseStatsRow(row: Record<string, unknown>): StoredDeskStats | null {
  const accountId = String(row.account_id ?? "").trim();
  if (!accountId) {
    return null;
  }
  return {
    accountId,
    allTime: parseWindow(
      row.realized_usdt,
      row.realized_pct,
      row.closed_count,
      row.win_count,
      row.max_drawdown_usdt,
      row.max_drawdown_pct,
    ),
    last30d: parseWindow(
      row.realized_usdt_30d,
      row.realized_pct_30d,
      row.closed_count_30d,
      row.win_count_30d,
      row.max_drawdown_usdt_30d,
      row.max_drawdown_pct_30d,
    ),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function snapshotColumns(accountId: string, snapshot: DeskStatsSnapshot) {
  return {
    account_id: accountId,
    realized_usdt: snapshot.allTime.realizedUsdt,
    realized_pct: snapshot.allTime.realizedPct,
    closed_count: snapshot.allTime.closedCount,
    win_count: snapshot.allTime.winCount,
    max_drawdown_usdt: snapshot.allTime.maxDrawdownUsdt,
    max_drawdown_pct: snapshot.allTime.maxDrawdownPct,
    realized_usdt_30d: snapshot.last30d.realizedUsdt,
    realized_pct_30d: snapshot.last30d.realizedPct,
    closed_count_30d: snapshot.last30d.closedCount,
    win_count_30d: snapshot.last30d.winCount,
    max_drawdown_usdt_30d: snapshot.last30d.maxDrawdownUsdt,
    max_drawdown_pct_30d: snapshot.last30d.maxDrawdownPct,
    updated_at: new Date().toISOString(),
  };
}

async function loadClosedForStats(
  accountId: string,
): Promise<DeskCloseForStats[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("futures_positions")
    .select("realized_usdt, notional_usdt, closed_at")
    .eq("account_id", accountId)
    .eq("status", "closed");
  if (error || !data) {
    return [];
  }
  return (data as Record<string, unknown>[]).map((row) => {
    const closedAt = Date.parse(String(row.closed_at ?? ""));
    return {
      closedAtMs: Number.isFinite(closedAt) ? closedAt : null,
      realizedUsdt: Number(row.realized_usdt) || 0,
      notionalUsdt: Number(row.notional_usdt) || 0,
    };
  });
}

export async function refreshFuturesDeskStats(
  accountId: string,
): Promise<StoredDeskStats | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const snapshot = deskStatsSnapshot(await loadClosedForStats(accountId), Date.now());
  const { data, error } = await supabase
    .from("futures_desk_stats")
    .upsert(snapshotColumns(accountId, snapshot), { onConflict: "account_id" })
    .select(
      "account_id, realized_usdt, realized_pct, closed_count, win_count, max_drawdown_usdt, max_drawdown_pct, realized_usdt_30d, realized_pct_30d, closed_count_30d, win_count_30d, max_drawdown_usdt_30d, max_drawdown_pct_30d, updated_at",
    )
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return parseStatsRow(data as Record<string, unknown>);
}

export async function loadFuturesDeskStats(
  accountIds: readonly string[],
): Promise<Map<string, StoredDeskStats>> {
  const out = new Map<string, StoredDeskStats>();
  if (accountIds.length === 0) {
    return out;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return out;
  }
  const { data, error } = await supabase
    .from("futures_desk_stats")
    .select(
      "account_id, realized_usdt, realized_pct, closed_count, win_count, max_drawdown_usdt, max_drawdown_pct, realized_usdt_30d, realized_pct_30d, closed_count_30d, win_count_30d, max_drawdown_usdt_30d, max_drawdown_pct_30d, updated_at",
    )
    .in("account_id", [...accountIds]);
  if (error || !data) {
    return out;
  }
  for (const row of data as Record<string, unknown>[]) {
    const parsed = parseStatsRow(row);
    if (parsed) {
      out.set(parsed.accountId, parsed);
    }
  }
  return out;
}

export async function backfillMissingFuturesDeskStats(): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  const [{ data: desks }, { data: existing }] = await Promise.all([
    supabase
      .from("trading_accounts")
      .select("id")
      .in("desk_type", [...FUTURES_DESK_TYPES]),
    supabase.from("futures_desk_stats").select("account_id"),
  ]);
  const have = new Set(
    (existing ?? []).map((row) => String((row as { account_id: string }).account_id)),
  );
  const missing = (desks ?? [])
    .map((row) => String((row as { id: string }).id))
    .filter((id) => id && !have.has(id));
  for (const accountId of missing) {
    await refreshFuturesDeskStats(accountId);
  }
}
