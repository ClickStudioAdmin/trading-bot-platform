import {
  parseCloseReason,
  parseTradeSource,
  type CloseReason,
  type PaperCarryAutomation,
  type TradeSource,
} from "@/lib/paper/automation";
import { carryPnlUsdt } from "@/lib/paper/math";
import { pairKey } from "@/lib/paper/open";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";

export type PaperCarryRow = {
  id: number;
  baseCoin: string;
  spotSymbol: string;
  futureSymbol: string;
  deliveryTimeMs: number;
  notionalUsdt: number;
  entryBasis: number;
  openedAtMs: number;
  status: "open" | "closed";
  exitBasis: number | null;
  closedAtMs: number | null;
  realizedUsdt: number | null;
  daysHeld: number | null;
  realizedApr: number | null;
  source: TradeSource;
  closeSource: TradeSource | null;
  closeReason: CloseReason | null;
  ruleId: number | null;
  automation: PaperCarryAutomation;
};

export type MarkedPaperCarry = PaperCarryRow & {
  markBasis: number | null;
  unrealizedUsdt: number | null;
  daysToExpiry: number | null;
};

export type PaperDeskStats = {
  openNotionalUsdt: number;
  unrealizedUsdt: number | null;
  realizedUsdt: number;
  closedCount: number;
  greenCount: number;
};

export function asNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Expected a finite number");
  }
  return parsed;
}

export function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return asNumber(value);
}

export function parsePaperCarryRow(row: Record<string, unknown>): PaperCarryRow {
  const openedAt = new Date(String(row.opened_at));
  const closedAt = row.closed_at ? new Date(String(row.closed_at)) : null;
  const delivery = new Date(String(row.delivery_time));
  const status = row.status === "closed" ? "closed" : "open";

  return {
    id: asNumber(row.id),
    baseCoin: String(row.base_coin),
    spotSymbol: String(row.spot_symbol),
    futureSymbol: String(row.future_symbol),
    deliveryTimeMs: delivery.getTime(),
    notionalUsdt: asNumber(row.notional_usdt),
    entryBasis: asNumber(row.entry_basis),
    openedAtMs: openedAt.getTime(),
    status,
    exitBasis: asNullableNumber(row.exit_basis),
    closedAtMs: closedAt ? closedAt.getTime() : null,
    realizedUsdt: asNullableNumber(row.realized_usdt),
    daysHeld: asNullableNumber(row.days_held),
    realizedApr: asNullableNumber(row.realized_apr),
    source: parseTradeSource(row.source),
    closeSource:
      status === "closed" ? parseTradeSource(row.close_source) : null,
    closeReason: parseCloseReason(row.close_reason),
    ruleId: asNullableNumber(row.rule_id),
    automation: {
      entryMinNetApr: asNullableNumber(row.entry_min_net_apr),
      entryMinDte: asNullableNumber(row.entry_min_dte),
      entryMaxDte: asNullableNumber(row.entry_max_dte),
      entryMinCapacityUsdt: asNullableNumber(row.entry_min_capacity_usdt),
      closeMaxDte: asNullableNumber(row.close_max_dte),
      closeMinNetApr: asNullableNumber(row.close_min_net_apr),
      takeProfitPct: asNullableNumber(row.take_profit_pct),
      stopLossPct: asNullableNumber(row.stop_loss_pct),
    },
  };
}

export function markOpenCarries(
  rows: PaperCarryRow[],
  scan: ScannedOpportunity[],
): MarkedPaperCarry[] {
  const byPair = new Map(
    scan.map((item) => [pairKey(item.spotSymbol, item.futureSymbol), item]),
  );

  return rows.map((row) => {
    const live = byPair.get(pairKey(row.spotSymbol, row.futureSymbol));
    if (!live) {
      return {
        ...row,
        markBasis: null,
        unrealizedUsdt: null,
        daysToExpiry: null,
      };
    }
    return {
      ...row,
      markBasis: live.netBasis,
      unrealizedUsdt: carryPnlUsdt(
        row.entryBasis,
        live.netBasis,
        row.notionalUsdt,
        live.feeRate,
      ),
      daysToExpiry: live.daysToExpiry,
    };
  });
}

export function formatDeskDate(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) {
    return "—";
  }
  return new Date(ms).toISOString().slice(0, 10);
}

export function paperDeskStats(
  open: MarkedPaperCarry[],
  closed: PaperCarryRow[],
): PaperDeskStats {
  const missingMark = open.some((row) => row.unrealizedUsdt === null);

  return {
    openNotionalUsdt: open.reduce((sum, row) => sum + row.notionalUsdt, 0),
    unrealizedUsdt:
      open.length === 0
        ? 0
        : missingMark
          ? null
          : open.reduce((sum, row) => sum + (row.unrealizedUsdt ?? 0), 0),
    realizedUsdt: closed.reduce((sum, row) => sum + (row.realizedUsdt ?? 0), 0),
    closedCount: closed.length,
    greenCount: closed.filter((row) => (row.realizedUsdt ?? 0) > 0).length,
  };
}

export function openExposure(
  open: MarkedPaperCarry[],
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
