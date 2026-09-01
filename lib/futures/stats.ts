import type { FuturesOrder, FuturesPosition } from "./model";

export function effectiveLeverage(
  stamped: number | null | undefined,
  fallback: number | null | undefined,
): number | null {
  if (stamped != null && stamped > 0 && Number.isFinite(stamped)) {
    return stamped;
  }
  if (fallback != null && fallback > 0 && Number.isFinite(fallback)) {
    return fallback;
  }
  return null;
}

export function positionMarginUsdt(
  notionalUsdt: number,
  leverage: number | null,
): number | null {
  if (!(notionalUsdt > 0) || leverage == null || !(leverage > 0)) {
    return null;
  }
  return notionalUsdt / leverage;
}

export function roePct(
  realizedUsdt: number,
  marginUsdt: number | null,
): number | null {
  if (marginUsdt == null || !(marginUsdt > 0) || !Number.isFinite(realizedUsdt)) {
    return null;
  }
  return realizedUsdt / marginUsdt;
}

export function futuresDaysHeld(
  openedAtMs: number,
  closedAtMs: number | null,
): number | null {
  if (!closedAtMs || !(openedAtMs > 0)) {
    return null;
  }
  return (closedAtMs - openedAtMs) / 86_400_000;
}

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365.25;

function utcDayStartMs(atMs: number): number {
  const date = new Date(atMs);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function inclusiveUtcDays(
  fromMs: number,
  toMs: number,
): number | null {
  if (!(fromMs > 0) || !(toMs > 0) || toMs < fromMs) {
    return null;
  }
  return (utcDayStartMs(toMs) - utcDayStartMs(fromMs)) / MS_PER_DAY + 1;
}

export function closedTradingDays(
  closed: readonly { closedAtMs: number | null }[],
): number | null {
  let first: number | null = null;
  let last: number | null = null;
  for (const row of closed) {
    const at = row.closedAtMs;
    if (at == null || !(at > 0)) {
      continue;
    }
    if (first == null || at < first) {
      first = at;
    }
    if (last == null || at > last) {
      last = at;
    }
  }
  if (first == null || last == null) {
    return null;
  }
  return inclusiveUtcDays(first, last);
}

export function annualizeReturnPct(
  periodReturn: number | null,
  days: number | null,
): number | null {
  if (
    periodReturn == null ||
    days == null ||
    !(days > 0) ||
    !Number.isFinite(periodReturn) ||
    periodReturn <= -1
  ) {
    return null;
  }
  return (1 + periodReturn) ** (DAYS_PER_YEAR / days) - 1;
}

export function formatTradingDaysNote(days: number | null): string | undefined {
  if (days == null || !(days > 0)) {
    return undefined;
  }
  return days === 1 ? "1 day trading" : `${days} days trading`;
}

export const DESK_STATS_WINDOW_MS = 30 * 86_400_000;

export type DeskCloseForStats = {
  closedAtMs: number | null;
  realizedUsdt: number;
  notionalUsdt: number;
};

export type DeskWindowStats = {
  realizedUsdt: number;
  realizedPct: number | null;
  closedCount: number;
  winCount: number;
  maxDrawdownUsdt: number;
  maxDrawdownPct: number | null;
};

export type DeskStatsSnapshot = {
  allTime: DeskWindowStats;
  last30d: DeskWindowStats;
};

export function maxRealizedLossUsdt(
  closed: readonly { realizedUsdt: number }[],
): number | null {
  let worst: number | null = null;
  for (const row of closed) {
    if (
      Number.isFinite(row.realizedUsdt) &&
      row.realizedUsdt < 0 &&
      (worst == null || row.realizedUsdt < worst)
    ) {
      worst = row.realizedUsdt;
    }
  }
  return worst;
}

export function bookEquityDrawdown(input: {
  startingUsdt: number;
  closed: readonly { closedAtMs: number | null; realizedUsdt: number }[];
  openUnrealizedUsdt?: number | null;
}): { maxDrawdownUsdt: number; maxDrawdownPct: number | null } {
  const starting = input.startingUsdt;
  if (!(starting > 0) || !Number.isFinite(starting)) {
    return { maxDrawdownUsdt: 0, maxDrawdownPct: null };
  }
  const rows = input.closed
    .filter((row) => row.closedAtMs != null && row.closedAtMs > 0)
    .slice()
    .sort((a, b) => (a.closedAtMs ?? 0) - (b.closedAtMs ?? 0));
  let equity = starting;
  let peak = starting;
  let maxDrawdownUsdt = 0;
  function consider(next: number) {
    if (next > peak) {
      peak = next;
    }
    const drawdown = peak - next;
    if (drawdown > maxDrawdownUsdt) {
      maxDrawdownUsdt = drawdown;
    }
  }
  consider(starting);
  for (const row of rows) {
    equity += row.realizedUsdt;
    consider(equity);
  }
  if (
    input.openUnrealizedUsdt != null &&
    Number.isFinite(input.openUnrealizedUsdt)
  ) {
    consider(equity + input.openUnrealizedUsdt);
  }
  return {
    maxDrawdownUsdt,
    maxDrawdownPct: peak > 0 ? maxDrawdownUsdt / peak : null,
  };
}

export function deskWindowStats(
  closed: readonly DeskCloseForStats[],
): DeskWindowStats {
  const rows = closed
    .filter((row) => row.closedAtMs != null && row.closedAtMs > 0)
    .slice()
    .sort((a, b) => (a.closedAtMs ?? 0) - (b.closedAtMs ?? 0));
  let equity = 0;
  let peak = 0;
  let maxDrawdownUsdt = 0;
  let realizedUsdt = 0;
  let notionalUsdt = 0;
  let winCount = 0;
  for (const row of rows) {
    realizedUsdt += row.realizedUsdt;
    notionalUsdt += row.notionalUsdt;
    if (row.realizedUsdt > 0) {
      winCount += 1;
    }
    equity += row.realizedUsdt;
    if (equity > peak) {
      peak = equity;
    }
    const drawdown = peak - equity;
    if (drawdown > maxDrawdownUsdt) {
      maxDrawdownUsdt = drawdown;
    }
  }
  return {
    realizedUsdt,
    realizedPct: notionalUsdt > 0 ? realizedUsdt / notionalUsdt : null,
    closedCount: rows.length,
    winCount,
    maxDrawdownUsdt,
    maxDrawdownPct: peak > 0 ? maxDrawdownUsdt / peak : null,
  };
}

export function deskStatsSnapshot(
  closed: readonly DeskCloseForStats[],
  nowMs: number,
): DeskStatsSnapshot {
  const floor = nowMs - DESK_STATS_WINDOW_MS;
  return {
    allTime: deskWindowStats(closed),
    last30d: deskWindowStats(
      closed.filter((row) => (row.closedAtMs ?? 0) >= floor),
    ),
  };
}

export function futuresClosedStats(
  closed: FuturesPosition[],
  fallbackLeverage: number | null = null,
) {
  const realizedUsdt = closed.reduce((sum, row) => sum + row.realizedUsdt, 0);
  const notionalUsdt = closed.reduce((sum, row) => sum + row.notionalUsdt, 0);
  let roeRealizedUsdt = 0;
  let marginUsdt = 0;
  let roeTradeCount = 0;
  for (const row of closed) {
    const leverage = effectiveLeverage(row.leverage, fallbackLeverage);
    const margin = positionMarginUsdt(row.notionalUsdt, leverage);
    if (margin == null) {
      continue;
    }
    roeRealizedUsdt += row.realizedUsdt;
    marginUsdt += margin;
    roeTradeCount += 1;
  }
  const onNotionalPct = notionalUsdt > 0 ? realizedUsdt / notionalUsdt : null;
  const roe = roePct(roeRealizedUsdt, marginUsdt > 0 ? marginUsdt : null);
  const tradingDays = closedTradingDays(closed);
  return {
    realizedUsdt,
    realizedPct: onNotionalPct,
    onNotionalPct,
    roePct: roe,
    roeTradeCount,
    tradingDays,
    aprPct: annualizeReturnPct(roe, tradingDays),
    closedCount: closed.length,
    greenCount: closed.filter((row) => row.realizedUsdt > 0).length,
  };
}

export function futuresOpenExposure(
  open: { baseCoin: string; notionalUsdt: number }[],
): { baseCoin: string; notionalUsdt: number; share: number }[] {
  const totals = new Map<string, number>();
  for (const row of open) {
    totals.set(row.baseCoin, (totals.get(row.baseCoin) ?? 0) + row.notionalUsdt);
  }
  const sum = open.reduce((total, row) => total + row.notionalUsdt, 0);
  return [...totals.entries()]
    .map(([baseCoin, notionalUsdt]) => ({
      baseCoin,
      notionalUsdt,
      share: sum > 0 ? notionalUsdt / sum : 0,
    }))
    .sort((a, b) => b.notionalUsdt - a.notionalUsdt);
}

export function flattenExitPrice(orders: FuturesOrder[]): number | null {
  for (let index = orders.length - 1; index >= 0; index -= 1) {
    const order = orders[index];
    if (order?.action === "flatten" && order.price && order.price > 0) {
      return order.price;
    }
  }
  return null;
}
