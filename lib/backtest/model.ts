import {
  annualizeReturnPct,
  inclusiveUtcDays,
} from "@/lib/futures/stats";
import {
  formatPct,
  formatSignedUsd,
  signedTone,
} from "@/lib/opportunities/format";
import {
  DCA_INDICATOR_TIMEFRAMES,
  finerDcaIndicatorTimeframe,
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

export const BACKTEST_CANDLE_LIMIT = 2_500_000;
export const BACKTEST_LONG_TAPE_BARS = 20_000;
export const BACKTEST_INLINE_BAR_LIMIT = 3000;
export const BACKTEST_VERCEL_BAR_LIMIT = 3000;
export const BACKTEST_COMPARABLE_CAP = 8;
export const DEFAULT_STARTING_USDT = 10_000;
export const DEFAULT_LEVERAGE = 10;
export const DEFAULT_BACKTEST_WINDOW_DAYS = 365;
export const BACKTEST_WINDOW_PRESETS = [
  { days: 30, label: "1 month" },
  { days: 365, label: "1 year" },
  { days: 1825, label: "5 years" },
  { days: 3650, label: "10 years" },
] as const;
export const MAX_BACKTEST_LEVERAGE = 125;

export type BacktestFeePreset = keyof typeof BACKTEST_FEE_PRESETS;
export type BacktestStatus =
  | "draft"
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "cancelled";
export const BACKTEST_FILL_REASONS = [
  "entry",
  "clip",
  "take_profit",
  "stop",
  "trailing",
  "close",
  "liquidation",
] as const;
export type BacktestFillReason = (typeof BACKTEST_FILL_REASONS)[number];

export type SimulatedOrder = {
  atMs: number;
  action: "buy" | "sell" | "flatten";
  side: "long" | "short";
  qty: number;
  price: number;
  feeUsdt: number;
  realizedUsdt: number | null;
  reason?: BacktestFillReason;
  clipIndex?: number;
};

export function parseBacktestFillReason(
  value: unknown,
): BacktestFillReason | undefined {
  return (BACKTEST_FILL_REASONS as readonly string[]).includes(String(value))
    ? (value as BacktestFillReason)
    : undefined;
}

export function parseBacktestClipIndex(value: unknown): number | undefined {
  const clipIndex = Number(value);
  return Number.isInteger(clipIndex) && clipIndex > 0 ? clipIndex : undefined;
}

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
  leverage: number;
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

export function comparableBacktestName(name: string, symbol: string): string {
  const base = name.trim() || "Backtest";
  const pair = symbol.trim();
  if (!pair) {
    return base.slice(0, 80);
  }
  if (base.toLowerCase().includes(pair.toLowerCase())) {
    return base.slice(0, 80);
  }
  return `${base} · ${pair}`.slice(0, 80);
}

export function backtestRunTitle(run: {
  recipe: { name: string };
  symbol: string;
  parentRunId: string | null;
}): string {
  if (!run.parentRunId) {
    return run.recipe.name.trim() || "Backtest";
  }
  return comparableBacktestName(run.recipe.name, run.symbol);
}

export function backtestRerunHref(runId: string): string {
  return `/account/backtests?rerun=${encodeURIComponent(runId)}#replay`;
}

export function backtestSavedListHref(): string {
  return "/account/backtests?tab=saved";
}

export function backtestQueueSeedFromRun(run: BacktestRun): {
  recipe: BacktestRecipe;
  sourceTemplateId: string;
  fromDate: string;
  toDate: string;
  startingUsdt: number;
  leverage: number;
  interval: DcaIndicatorTimeframe;
  symbol: string;
  venue: string;
  venueEnvironment: string | null;
  comparables: string[];
} {
  return {
    recipe: run.recipe,
    sourceTemplateId: run.sourceTemplateId ?? "",
    fromDate: isoDateUtc(run.fromMs),
    toDate: isoDateUtc(run.toMs),
    startingUsdt: run.startingUsdt,
    leverage: normalizeBacktestLeverage(run.leverage),
    interval: run.interval,
    symbol: run.symbol,
    venue: run.venue,
    venueEnvironment: run.venueEnvironment,
    comparables: [...(run.comparableSymbols ?? [])],
  };
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
  return backtestWindowEndingToday(DEFAULT_BACKTEST_WINDOW_DAYS);
}

export function matchingBacktestWindowDays(
  from: string,
  to: string,
): number | null {
  for (const row of BACKTEST_WINDOW_PRESETS) {
    const window = backtestWindowEndingToday(row.days);
    if (window.from === from && window.to === to) {
      return row.days;
    }
  }
  return null;
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

export function normalizeBacktestLeverage(raw: unknown): number {
  const value = Number(raw);
  if (value > 0 && Number.isFinite(value)) {
    return value;
  }
  return 1;
}

export function parseBacktestLeverage(
  raw: unknown,
): { ok: true; leverage: number } | { ok: false; error: string } {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (!text) {
    return { ok: true, leverage: 1 };
  }
  const value = Number(text);
  if (!(value > 0) || !Number.isFinite(value)) {
    return { ok: false, error: "Enter leverage greater than 0." };
  }
  if (value > MAX_BACKTEST_LEVERAGE) {
    return {
      ok: false,
      error: `Leverage must be ${MAX_BACKTEST_LEVERAGE} or less.`,
    };
  }
  return { ok: true, leverage: value };
}

export function backtestMarginUsdt(
  notionalUsdt: number,
  leverage: number,
): number {
  return notionalUsdt / normalizeBacktestLeverage(leverage);
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

export function backtestTapeInterval(
  recipe: BacktestRecipe | null,
  fromMs: number,
  toMs: number,
): DcaIndicatorTimeframe {
  if (recipe?.kind === "dca" && recipe.startKind === "indicator") {
    const primary = recipe.indicatorTimeframe;
    const short = recipe.shortIndicatorTimeframe;
    if (primary && short) {
      return finerDcaIndicatorTimeframe(primary, short);
    }
    if (primary) {
      return primary;
    }
    if (short) {
      return short;
    }
  }
  for (const interval of DCA_INDICATOR_TIMEFRAMES) {
    if (estimateBacktestBars(fromMs, toMs, interval) <= BACKTEST_CANDLE_LIMIT) {
      return interval;
    }
  }
  return "D";
}

export const BACKTEST_CHART_TRAIL_BARS = 8;

export function backtestChartTrailMs(interval: DcaIndicatorTimeframe): number {
  return intervalMs(interval) * BACKTEST_CHART_TRAIL_BARS;
}

export function backtestActivityBounds(input: {
  fromMs: number;
  toMs: number;
  orders: ReadonlyArray<{ atMs: number }>;
  padMs?: number;
}): { fromMs: number; toMs: number } {
  const padMs = Math.max(0, input.padMs ?? 0);
  if (input.orders.length === 0) {
    return { fromMs: input.fromMs, toMs: input.toMs + padMs };
  }
  let first = input.orders[0].atMs;
  let last = first;
  for (const order of input.orders) {
    if (order.atMs < first) {
      first = order.atMs;
    }
    if (order.atMs > last) {
      last = order.atMs;
    }
  }
  const fromMs = Math.max(input.fromMs, first - padMs);
  const toMs = Math.min(input.toMs, last) + padMs;
  return toMs > fromMs
    ? { fromMs, toMs }
    : { fromMs: input.fromMs, toMs: input.toMs + padMs };
}

export const BACKTEST_CHART_INTERVALS: readonly DcaIndicatorTimeframe[] = [
  "15",
  "60",
  "240",
  "D",
];
export const BACKTEST_CHART_BAR_LIMIT = 1500;

export function chartIntervalForWindow(
  fromMs: number,
  toMs: number,
  preferred: DcaIndicatorTimeframe,
): DcaIndicatorTimeframe {
  const start = Math.max(0, DCA_INDICATOR_TIMEFRAMES.indexOf(preferred));
  for (let i = start; i < DCA_INDICATOR_TIMEFRAMES.length; i += 1) {
    const interval = DCA_INDICATOR_TIMEFRAMES[i];
    if (estimateBacktestBars(fromMs, toMs, interval) <= BACKTEST_CHART_BAR_LIMIT) {
      return interval;
    }
  }
  return "D";
}

export function backtestChartIntervalChoices(
  preferred: DcaIndicatorTimeframe,
): DcaIndicatorTimeframe[] {
  const extra = new Set<DcaIndicatorTimeframe>([
    ...BACKTEST_CHART_INTERVALS,
    preferred,
  ]);
  return DCA_INDICATOR_TIMEFRAMES.filter((row) => extra.has(row));
}

export function backtestChartIntervalFits(
  fromMs: number,
  toMs: number,
  interval: DcaIndicatorTimeframe,
): boolean {
  return estimateBacktestBars(fromMs, toMs, interval) <= BACKTEST_CHART_BAR_LIMIT;
}

export function backtestChartFetchBounds(
  run: Pick<BacktestRun, "fromMs" | "toMs" | "orders">,
  interval: DcaIndicatorTimeframe,
): { fromMs: number; toMs: number } {
  return backtestActivityBounds({
    fromMs: run.fromMs,
    toMs: run.toMs,
    orders: run.orders,
    padMs: backtestChartTrailMs(interval),
  });
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

export function parseBacktestDates(
  fromRaw: unknown,
  toRaw: unknown,
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
  return { ok: true, fromMs, toMs };
}

export function parseBacktestDateRange(
  fromRaw: unknown,
  toRaw: unknown,
  interval: DcaIndicatorTimeframe,
): { ok: true; fromMs: number; toMs: number } | { ok: false; error: string } {
  const range = parseBacktestDates(fromRaw, toRaw);
  if (!range.ok) {
    return range;
  }
  const bars = estimateBacktestBars(range.fromMs, range.toMs, interval);
  if (bars > BACKTEST_CANDLE_LIMIT) {
    return {
      ok: false,
      error:
        "That window is too long for this timeframe. Use a shorter range or a higher timeframe.",
    };
  }
  return range;
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

export type BacktestOutcome = "profit" | "loss" | "liquidated";

export function backtestRunWasLiquidated(
  orders: Array<Pick<SimulatedOrder, "reason">>,
): boolean {
  return orders.some((row) => row.reason === "liquidation");
}

export function backtestRunOutcome(input: {
  orders: Array<Pick<SimulatedOrder, "reason">>;
  realizedUsdt: number;
}): BacktestOutcome {
  if (backtestRunWasLiquidated(input.orders)) {
    return "liquidated";
  }
  return input.realizedUsdt > 0 ? "profit" : "loss";
}

export function backtestOutcomeLabel(outcome: BacktestOutcome): string {
  if (outcome === "liquidated") {
    return "Account Liquidated";
  }
  return outcome === "profit" ? "Profit" : "Loss";
}

export function backtestLiquidationPrice(input: {
  side: "long" | "short";
  entry: number;
  qty: number;
  cashUsdt: number;
  feeRate?: number;
}): number | null {
  if (!(input.qty > 0) || !(input.entry > 0)) {
    return null;
  }
  const rate =
    input.feeRate != null && input.feeRate > 0 && Number.isFinite(input.feeRate)
      ? input.feeRate
      : 0;
  if (input.side === "long") {
    const denom = input.qty * (1 - rate);
    if (!(denom > 0)) {
      return null;
    }
    const price = (input.entry * input.qty - input.cashUsdt) / denom;
    return price > 0 && Number.isFinite(price) ? price : null;
  }
  const denom = input.qty * (1 + rate);
  if (!(denom > 0)) {
    return null;
  }
  const price = (input.cashUsdt + input.entry * input.qty) / denom;
  return price > 0 && Number.isFinite(price) ? price : null;
}

export function firstAdverseFill(
  side: "long" | "short",
  adverse: number,
  candidates: Array<{ price: number; reason: BacktestFillReason } | null>,
): { price: number; reason: BacktestFillReason } | null {
  const hit = candidates.filter(
    (row): row is { price: number; reason: BacktestFillReason } =>
      row != null &&
      row.price > 0 &&
      (side === "long" ? adverse <= row.price : adverse >= row.price),
  );
  if (hit.length === 0) {
    return null;
  }
  return hit.reduce((best, row) => {
    if (side === "long") {
      return row.price > best.price ? row : best;
    }
    return row.price < best.price ? row : best;
  });
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
  return formatPct(returnPct == null ? null : returnPct);
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
  realizedUsdt: number,
  peakNotionalUsdt: number,
  fromMs: number,
  toMs: number,
): number | null {
  const period = returnOnCapitalUsedPct(realizedUsdt, peakNotionalUsdt);
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

export function completedBacktestNotionalUsdt(
  orders: SimulatedOrder[],
): number {
  const legs: Record<"long" | "short", { qty: number; entry: number }> = {
    long: { qty: 0, entry: 0 },
    short: { qty: 0, entry: 0 },
  };
  let sum = 0;
  for (const order of orders) {
    const leg = legs[order.side];
    if (order.action === "flatten") {
      sum += leg.qty * leg.entry;
      legs[order.side] = { qty: 0, entry: 0 };
    } else {
      const nextQty = leg.qty + order.qty;
      const entry =
        nextQty > 0
          ? (leg.entry * leg.qty + order.price * order.qty) / nextQty
          : order.price;
      legs[order.side] = { qty: nextQty, entry };
    }
  }
  return sum;
}

export function backtestOnNotionalPct(
  realizedUsdt: number,
  orders: SimulatedOrder[],
): number | null {
  return returnOnCapitalUsedPct(
    realizedUsdt,
    completedBacktestNotionalUsdt(orders),
  );
}

export function backtestRoePct(
  realizedUsdt: number,
  orders: SimulatedOrder[],
  leverage: number,
): number | null {
  return returnOnCapitalUsedPct(
    realizedUsdt,
    backtestMarginUsdt(completedBacktestNotionalUsdt(orders), leverage),
  );
}

export function backtestWindowDays(fromMs: number, toMs: number): number | null {
  return inclusiveUtcDays(fromMs, toMs);
}

export function backtestAprPct(
  realizedUsdt: number,
  startingUsdt: number,
  fromMs: number,
  toMs: number,
): number | null {
  return annualizeReturnPct(
    realizedReturnPct({ startingUsdt, realizedUsdt }),
    backtestWindowDays(fromMs, toMs),
  );
}

export function backtestDrawdownPct(stats: Pick<
  BacktestStats,
  "startingUsdt" | "maxDrawdownUsdt"
>): number | null {
  if (!(stats.startingUsdt > 0) || !Number.isFinite(stats.maxDrawdownUsdt)) {
    return null;
  }
  return stats.maxDrawdownUsdt / stats.startingUsdt;
}

/** Header Max Drawdown: stored marked-equity dip, not a fill-only rebuild. */
export function backtestDrawdownCard(
  stats: Pick<BacktestStats, "trades" | "startingUsdt" | "maxDrawdownUsdt">,
  extra?: { liquidated?: boolean },
): { value: string; toneClass: string; note?: string } {
  if (!(stats.trades > 0)) {
    return { value: "—", toneClass: "text-ink" };
  }
  const dip = Number.isFinite(stats.maxDrawdownUsdt)
    ? stats.maxDrawdownUsdt
    : 0;
  const visible = Math.round(dip) > 0;
  if (extra?.liquidated && visible) {
    return {
      value: formatPct(1),
      toneClass: signedTone(-dip),
      note: formatSignedUsd(-dip),
    };
  }
  const pct = backtestDrawdownPct({
    startingUsdt: stats.startingUsdt,
    maxDrawdownUsdt: visible ? dip : 0,
  });
  return {
    value: pct == null ? "—" : formatPct(pct),
    toneClass: signedTone(visible ? -dip : 0),
    note: visible ? formatSignedUsd(-dip) : undefined,
  };
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

export type BacktestLinkHighlight = {
  runId: string;
  symbol: string;
  interval: DcaIndicatorTimeframe;
  fromMs: number;
  toMs: number;
  trades: number;
  winRate: number;
  realizedUsdt: number;
  returnPct: number | null;
  roePct: number | null;
  aprPct: number | null;
};

export function backtestLinkHighlight(
  run: Pick<
    BacktestRun,
    | "id"
    | "symbol"
    | "interval"
    | "fromMs"
    | "toMs"
    | "stats"
    | "orders"
    | "leverage"
  >,
): BacktestLinkHighlight {
  const realized = run.stats?.realizedUsdt ?? 0;
  const startingUsdt = run.stats?.startingUsdt ?? 0;
  const leverage = normalizeBacktestLeverage(run.leverage);
  return {
    runId: run.id,
    symbol: run.symbol,
    interval: run.interval,
    fromMs: run.fromMs,
    toMs: run.toMs,
    trades: run.stats?.trades ?? 0,
    winRate: run.stats?.winRate ?? 0,
    realizedUsdt: realized,
    returnPct: realizedReturnPct({ startingUsdt, realizedUsdt: realized }),
    roePct: backtestRoePct(realized, run.orders, leverage),
    aprPct: backtestAprPct(
      realized,
      startingUsdt,
      run.fromMs,
      run.toMs,
    ),
  };
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
