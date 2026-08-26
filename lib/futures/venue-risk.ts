import { hedgePositionIdx } from "./decide";
import type { MarkedFutures } from "./mark";
import type { FuturesSide } from "./model";

export type FuturesVenueRisk = {
  leverage: number | null;
  liqPrice: number | null;
};

export function futuresVenueRiskKey(
  symbol: string,
  side: FuturesSide,
): string {
  return `${symbol}:${hedgePositionIdx(side)}`;
}

export function mapLinearPositionRisk(
  rows: {
    symbol: string;
    positionIdx: number;
    leverage: number | null;
    liqPrice: number | null;
  }[],
): Map<string, FuturesVenueRisk> {
  const risk = new Map<string, FuturesVenueRisk>();
  for (const row of rows) {
    risk.set(`${row.symbol}:${row.positionIdx}`, {
      leverage: row.leverage,
      liqPrice: row.liqPrice,
    });
  }
  return risk;
}

export function attachFuturesVenueRisk(
  rows: MarkedFutures[],
  risk: Map<string, FuturesVenueRisk>,
): MarkedFutures[] {
  return rows.map((row) => {
    const found = risk.get(futuresVenueRiskKey(row.symbol, row.side));
    return {
      ...row,
      leverage: found?.leverage ?? null,
      liqPrice: found?.liqPrice ?? null,
    };
  });
}

export function formatLeverage(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return "—";
  }
  return `${value}×`;
}
