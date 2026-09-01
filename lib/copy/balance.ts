import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { loadAccountSnapshot } from "@/lib/exchanges/account-snapshot";
import { loadDeskTicker } from "@/lib/market/desk-tickers";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { loadFuturesPositions } from "@/lib/futures/list";
import { futuresPnlUsdt, markFromTicker } from "@/lib/futures/math";
import type { FuturesPosition } from "@/lib/futures/model";
import {
  copyPaperEquity,
  copyPaperEquityView,
  copyUtcDayStartMs,
  type CopyPaperEquityView,
} from "./decide";

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

export async function loadCopyFollowerEquity(input: {
  userId: string;
  accountId: string;
  mode: "paper" | "live";
  tickers: Map<string, { lastPrice?: string; bid1Price?: string; ask1Price?: string }>;
}): Promise<number | null> {
  const positions = await loadFuturesPositions({
    scope: { accountId: input.accountId, userId: input.userId },
  });
  let unrealized = 0;
  for (const row of positions) {
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
  if (!accountCanHoldConnections(input.mode)) {
    let realized = 0;
    for (const row of positions) {
      realized += row.realizedUsdt;
    }
    const equity = copyPaperEquity({ realizedUsdt: realized, unrealizedUsdt: unrealized });
    return Number.isFinite(equity) ? equity : null;
  }
  const settings = await loadFuturesSettings(input.accountId);
  if (!settings.connectionId) {
    return null;
  }
  const snapshot = await loadAccountSnapshot(input.userId, settings.connectionId);
  if (!snapshot.ok) {
    return null;
  }
  const available = snapshot.snapshot.availableBalance;
  if (available == null || !Number.isFinite(available)) {
    return null;
  }
  const equity = available + unrealized;
  return Number.isFinite(equity) ? equity : null;
}

export async function loadCopyPaperEquityView(input: {
  userId: string;
  accountId: string;
  venue: string;
  venueEnvironment: string | null;
  startingUsdt?: number;
}): Promise<CopyPaperEquityView> {
  const positions = await loadFuturesPositions({
    scope: { accountId: input.accountId, userId: input.userId },
  });
  let realizedUsdt = 0;
  const open: FuturesPosition[] = [];
  for (const row of positions) {
    realizedUsdt += row.realizedUsdt;
    if (row.status === "open") {
      open.push(row);
    }
  }
  const tickers = new Map<
    string,
    { lastPrice?: string; bid1Price?: string; ask1Price?: string }
  >();
  const symbols = [...new Set(open.map((row) => row.symbol))];
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const quote = await loadDeskTicker(
          input.venue,
          input.venueEnvironment,
          symbol,
        );
        if (quote) {
          tickers.set(symbol, quote);
        }
      } catch {
        return;
      }
    }),
  );
  let unrealizedUsdt = 0;
  for (const row of open) {
    const mark = markFromTicker(tickers.get(row.symbol) ?? {});
    if (mark == null) {
      continue;
    }
    unrealizedUsdt += futuresPnlUsdt({
      side: row.side,
      qty: row.qty,
      entryPrice: row.entryPrice,
      exitPrice: mark,
    });
  }
  const settings = await loadFuturesSettings(input.accountId);
  return copyPaperEquityView({
    realizedUsdt,
    unrealizedUsdt,
    startingUsdt: input.startingUsdt,
    leverage: settings.paperLeverage,
  });
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
