import type { FuturesOrder, FuturesPosition } from "./model";

export function futuresDaysHeld(
  openedAtMs: number,
  closedAtMs: number | null,
): number | null {
  if (!closedAtMs || !(openedAtMs > 0)) {
    return null;
  }
  return (closedAtMs - openedAtMs) / 86_400_000;
}

export function futuresClosedStats(closed: FuturesPosition[]) {
  const realizedUsdt = closed.reduce((sum, row) => sum + row.realizedUsdt, 0);
  const notionalUsdt = closed.reduce((sum, row) => sum + row.notionalUsdt, 0);
  return {
    realizedUsdt,
    realizedPct: notionalUsdt > 0 ? realizedUsdt / notionalUsdt : null,
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
