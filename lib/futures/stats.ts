import type { FuturesPosition } from "./model";

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
