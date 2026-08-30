import {
  DCA_INDICATOR_TIMEFRAMES,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import type {
  DcaTemplateRecipe,
  PerpsTemplateRecipe,
} from "@/lib/templates/recipe";

export type BacktestRecipe = PerpsTemplateRecipe | DcaTemplateRecipe;
export type BacktestDeskType = "perps" | "dca";

export const BACKTEST_FEE_PRESETS = {
  vip0_taker: {
    id: "vip0_taker",
    label: "VIP0 taker (6 bps all-in)",
    rate: 0.0006,
  },
} as const;

export const BACKTEST_CANDLE_LIMIT = 200_000;
export const BACKTEST_INLINE_BAR_LIMIT = 1500;
export const BACKTEST_VERCEL_BAR_LIMIT = 3000;
export const BACKTEST_COMPARABLE_CAP = 8;
export const DEFAULT_STARTING_USDT = 10_000;

export type BacktestFeePreset = keyof typeof BACKTEST_FEE_PRESETS;
export type BacktestStatus =
  | "draft"
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "cancelled";
export type SimulatedOrder = {
  atMs: number;
  action: "buy" | "sell" | "flatten";
  side: "long" | "short";
  qty: number;
  price: number;
  feeUsdt: number;
  realizedUsdt: number | null;
};

export type BacktestStats = {
  trades: number;
  wins: number;
  winRate: number;
  realizedUsdt: number;
  maxDrawdownUsdt: number;
  profitFactor: number | null;
  timeInMarket: number;
  openQty: number;
  openSide: "long" | "short" | null;
  markUsdt: number;
  startingUsdt: number;
  endingUsdt: number;
  returnPct: number | null;
};

export type BacktestRun = {
  id: string;
  userId: string | null;
  templateId: string | null;
  sourceTemplateId: string | null;
  studyId: string | null;
  deskType: BacktestDeskType;
  venue: string;
  venueEnvironment: string | null;
  symbol: string;
  interval: DcaIndicatorTimeframe;
  fromMs: number;
  toMs: number;
  startingUsdt: number;
  feePreset: BacktestFeePreset;
  feeRate: number;
  status: BacktestStatus;
  recipe: BacktestRecipe;
  stats: BacktestStats | null;
  orders: SimulatedOrder[];
  error: string | null;
  createdAtMs: number;
  finishedAtMs: number | null;
  parentRunId: string | null;
  comparableSymbols: string[];
};

export type EquityPoint = {
  atMs: number;
  equityUsdt: number;
  realizedUsdt: number;
  label: string;
};

export function parseFeePreset(raw: unknown): BacktestFeePreset {
  return raw === "vip0_taker" ? "vip0_taker" : "vip0_taker";
}

export function parseBacktestStatus(raw: unknown): BacktestStatus | null {
  const value = String(raw ?? "").trim();
  if (
    value === "draft" ||
    value === "queued" ||
    value === "running" ||
    value === "done" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value;
  }
  return null;
}

export function isoDateUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function backtestWindowEndingToday(days: number): {
  from: string;
  to: string;
} {
  const toMs = Date.now();
  const fromMs = toMs - days * 24 * 60 * 60 * 1000;
  return { from: isoDateUtc(fromMs), to: isoDateUtc(toMs) };
}

export function defaultBacktestDates(): { from: string; to: string } {
  return backtestWindowEndingToday(30);
}

export function parseStartingBalance(
  raw: unknown,
): { ok: true; startingUsdt: number } | { ok: false; error: string } {
  const value = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!(value > 0) || !Number.isFinite(value)) {
    return { ok: false, error: "Enter an initial account balance greater than 0." };
  }
  if (value > 10_000_000) {
    return { ok: false, error: "Initial balance must be 10,000,000 or less." };
  }
  return { ok: true, startingUsdt: value };
}

function utcDayStart(raw: unknown): number | null {
  const text = String(raw ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  if (!Number.isFinite(ms)) {
    return null;
  }
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

export function intervalMs(interval: DcaIndicatorTimeframe): number {
  if (interval === "5") {
    return 5 * 60 * 1000;
  }
  if (interval === "15") {
    return 15 * 60 * 1000;
  }
  if (interval === "30") {
    return 30 * 60 * 1000;
  }
  if (interval === "60") {
    return 60 * 60 * 1000;
  }
  if (interval === "120") {
    return 120 * 60 * 1000;
  }
  if (interval === "240") {
    return 240 * 60 * 1000;
  }
  if (interval === "360") {
    return 360 * 60 * 1000;
  }
  if (interval === "720") {
    return 720 * 60 * 1000;
  }
  return 24 * 60 * 60 * 1000;
}

export function estimateBacktestBars(
  fromMs: number,
  toMs: number,
  interval: DcaIndicatorTimeframe,
): number {
  if (!(toMs > fromMs)) {
    return 0;
  }
  return Math.ceil((toMs - fromMs) / intervalMs(interval));
}

export function chartIntervalForWindow(
  fromMs: number,
  toMs: number,
  preferred: DcaIndicatorTimeframe,
): DcaIndicatorTimeframe {
  const start = Math.max(0, DCA_INDICATOR_TIMEFRAMES.indexOf(preferred));
  for (let i = start; i < DCA_INDICATOR_TIMEFRAMES.length; i += 1) {
    const interval = DCA_INDICATOR_TIMEFRAMES[i];
    if (estimateBacktestBars(fromMs, toMs, interval) <= 1500) {
      return interval;
    }
  }
  return "D";
}

export function backtestShouldRunInline(
  bars: number,
  pairCount: number,
): boolean {
  return bars <= BACKTEST_INLINE_BAR_LIMIT && pairCount <= 4;
}

export function parseComparableSymbols(
  raw: unknown,
  primary: string,
): string[] {
  const parts = Array.isArray(raw)
    ? raw.map((row) => String(row ?? ""))
    : String(raw ?? "").split(/[\s,]+/);
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const part of parts) {
    const symbol = part.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (symbol.length < 2 || symbol.length > 32) {
      continue;
    }
    if (symbol === primary || seen.has(symbol)) {
      continue;
    }
    seen.add(symbol);
    rows.push(symbol);
    if (rows.length >= BACKTEST_COMPARABLE_CAP) {
      break;
    }
  }
  return rows;
}

export function parseBacktestDateRange(
  fromRaw: unknown,
  toRaw: unknown,
  interval: DcaIndicatorTimeframe,
): { ok: true; fromMs: number; toMs: number } | { ok: false; error: string } {
  const fromMs = utcDayStart(fromRaw);
  const toStart = utcDayStart(toRaw);
  if (fromMs == null || toStart == null) {
    return { ok: false, error: "Enter a start date and an end date." };
  }
  const toMs = toStart + 24 * 60 * 60 * 1000 - 1;
  if (!(toMs > fromMs)) {
    return { ok: false, error: "End date must be after the start date." };
  }
  const bars = Math.ceil((toMs - fromMs) / intervalMs(interval));
  if (bars > BACKTEST_CANDLE_LIMIT) {
    return {
      ok: false,
      error:
        "That window is too long for this timeframe. Use a shorter range or a higher timeframe.",
    };
  }
  return { ok: true, fromMs, toMs };
}

export function emptyBacktestStats(startingUsdt = 0): BacktestStats {
  return {
    trades: 0,
    wins: 0,
    winRate: 0,
    realizedUsdt: 0,
    maxDrawdownUsdt: 0,
    profitFactor: null,
    timeInMarket: 0,
    openQty: 0,
    openSide: null,
    markUsdt: 0,
    startingUsdt,
    endingUsdt: startingUsdt,
    returnPct: null,
  };
}

export function finishBacktestStats(input: {
  trades: number;
  wins: number;
  realizedUsdt: number;
  maxDrawdownUsdt: number;
  profitFactor: number | null;
  timeInMarket: number;
  openQty: number;
  openSide: "long" | "short" | null;
  markUsdt: number;
  startingUsdt: number;
}): BacktestStats {
  const endingUsdt = input.startingUsdt + input.realizedUsdt + input.markUsdt;
  return {
    trades: input.trades,
    wins: input.wins,
    winRate: input.trades > 0 ? input.wins / input.trades : 0,
    realizedUsdt: input.realizedUsdt,
    maxDrawdownUsdt: input.maxDrawdownUsdt,
    profitFactor: input.profitFactor,
    timeInMarket: input.timeInMarket,
    openQty: input.openQty,
    openSide: input.openSide,
    markUsdt: input.markUsdt,
    startingUsdt: input.startingUsdt,
    endingUsdt,
    returnPct:
      input.startingUsdt > 0
        ? (endingUsdt - input.startingUsdt) / input.startingUsdt
        : null,
  };
}

export function formatBacktestReturnPct(
  returnPct: number | null | undefined,
): string {
  if (returnPct == null || !Number.isFinite(returnPct)) {
    return "—";
  }
  return `${(returnPct * 100).toFixed(2)}%`;
}

export function accountPnlUsdt(stats: Pick<
  BacktestStats,
  "startingUsdt" | "endingUsdt"
>): number {
  return stats.endingUsdt - stats.startingUsdt;
}

export function realizedEndingUsdt(
  stats: Pick<BacktestStats, "startingUsdt" | "realizedUsdt">,
): number {
  return stats.startingUsdt + stats.realizedUsdt;
}

export function realizedReturnPct(
  stats: Pick<BacktestStats, "startingUsdt" | "realizedUsdt">,
): number | null {
  if (!(stats.startingUsdt > 0) || !Number.isFinite(stats.realizedUsdt)) {
    return null;
  }
  return stats.realizedUsdt / stats.startingUsdt;
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export function realizedAprPct(
  stats: Pick<BacktestStats, "startingUsdt" | "realizedUsdt">,
  fromMs: number,
  toMs: number,
): number | null {
  const period = realizedReturnPct(stats);
  const years = (toMs - fromMs) / MS_PER_YEAR;
  if (period == null || !(years > 0) || period <= -1) {
    return null;
  }
  return (1 + period) ** (1 / years) - 1;
}

export function peakLockedNotionalUsdt(orders: SimulatedOrder[]): number {
  const legs: Record<"long" | "short", { qty: number; entry: number }> = {
    long: { qty: 0, entry: 0 },
    short: { qty: 0, entry: 0 },
  };
  let peak = 0;
  for (const order of orders) {
    const leg = legs[order.side];
    if (order.action === "flatten") {
      legs[order.side] = { qty: 0, entry: 0 };
    } else {
      const nextQty = leg.qty + order.qty;
      const entry =
        nextQty > 0
          ? (leg.entry * leg.qty + order.price * order.qty) / nextQty
          : order.price;
      legs[order.side] = { qty: nextQty, entry };
    }
    const locked =
      legs.long.qty * legs.long.entry + legs.short.qty * legs.short.entry;
    if (locked > peak) {
      peak = locked;
    }
  }
  return peak;
}

export function splitCompletedBacktestOrders(orders: SimulatedOrder[]): {
  completed: SimulatedOrder[];
  open: SimulatedOrder[];
} {
  const completed: SimulatedOrder[] = [];
  const pending: Record<"long" | "short", SimulatedOrder[]> = {
    long: [],
    short: [],
  };
  for (const order of orders) {
    if (order.action === "flatten") {
      completed.push(...pending[order.side], order);
      pending[order.side] = [];
    } else {
      pending[order.side].push(order);
    }
  }
  return {
    completed,
    open: [...pending.long, ...pending.short],
  };
}

export function openBacktestPositionLabel(orders: SimulatedOrder[]): string | null {
  if (orders.length === 0) {
    return null;
  }
  const sides = ["long", "short"] as const;
  const parts = sides.flatMap((side) => {
    const rows = orders.filter((row) => row.side === side);
    if (rows.length === 0) {
      return [];
    }
    const qty = rows.reduce((sum, row) => sum + row.qty, 0);
    return [`${side} ${qty.toFixed(4)}`];
  });
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function returnOnCapitalUsedPct(
  pnlUsdt: number,
  peakNotionalUsdt: number,
): number | null {
  if (!(peakNotionalUsdt > 0) || !Number.isFinite(pnlUsdt)) {
    return null;
  }
  return pnlUsdt / peakNotionalUsdt;
}
