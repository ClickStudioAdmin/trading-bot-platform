import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { loadAccountSnapshot } from "@/lib/exchanges/account-snapshot";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { loadFuturesPositions } from "@/lib/futures/list";
import { futuresPnlUsdt, markFromTicker } from "@/lib/futures/math";
import { copyPaperEquity, copyUtcDayStartMs } from "./decide";

export async function loadCopyAvailableUsdt(input: {
  userId: string;
  accountId: string;
  mode: "paper" | "live";
  tickers: Map<string, { lastPrice?: string; bid1Price?: string; ask1Price?: string }>;
}): Promise<number | null> {
  if (accountCanHoldConnections(input.mode)) {
    const settings = await loadFuturesSettings(input.accountId);
    if (!settings.connectionId) {
      return null;
    }
    const snapshot = await loadAccountSnapshot(input.userId, settings.connectionId);
    if (!snapshot.ok) {
      return null;
    }
    const available = snapshot.snapshot.availableBalance;
    return available != null && Number.isFinite(available) ? available : null;
  }
  const positions = await loadFuturesPositions({
    scope: { accountId: input.accountId, userId: input.userId },
  });
  let realized = 0;
  let unrealized = 0;
  for (const row of positions) {
    realized += row.realizedUsdt;
    if (row.status !== "open") {
      continue;
    }
    const mark = markFromTicker(input.tickers.get(row.symbol) ?? {});
    if (mark == null) {
      continue;
    }
    unrealized += futuresPnlUsdt({
      side: row.side,
      qty: row.qty,
      entryPrice: row.entryPrice,
      exitPrice: mark,
    });
  }
  const equity = copyPaperEquity({ realizedUsdt: realized, unrealizedUsdt: unrealized });
  return Number.isFinite(equity) ? equity : null;
}

export async function loadCopyGuardSnapshot(input: {
  userId: string;
  accountId: string;
  nowMs?: number;
}): Promise<{
  openNotionalUsdt: number;
  todayRealizedUsdt: number;
}> {
  const positions = await loadFuturesPositions({
    scope: { accountId: input.accountId, userId: input.userId },
  });
  const dayStart = copyUtcDayStartMs(input.nowMs ?? Date.now());
  let openNotionalUsdt = 0;
  let todayRealizedUsdt = 0;
  for (const row of positions) {
    if (row.status === "open") {
      openNotionalUsdt += row.notionalUsdt;
    }
    if (row.closedAtMs != null && row.closedAtMs >= dayStart) {
      todayRealizedUsdt += row.realizedUsdt;
    }
  }
  return { openNotionalUsdt, todayRealizedUsdt };
}
