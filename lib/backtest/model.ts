import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";
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

export const BACKTEST_MAX_WINDOW_DAYS = 365;
export const BACKTEST_CANDLE_LIMIT = 1500;
export const DEFAULT_STARTING_USDT = 10_000;

export type BacktestFeePreset = keyof typeof BACKTEST_FEE_PRESETS;
export type BacktestStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "cancelled";
export type BacktestWindowDays = 30 | 90;

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
};

export function parseFeePreset(raw: unknown): BacktestFeePreset {
  return raw === "vip0_taker" ? "vip0_taker" : "vip0_taker";
}

export function parseWindowDays(raw: unknown): BacktestWindowDays {
  return Number(raw) === 90 ? 90 : 30;
}

export function parseBacktestStatus(raw: unknown): BacktestStatus | null {
  const value = String(raw ?? "").trim();
  if (
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

export function defaultBacktestDates(): { from: string; to: string } {
  const toMs = Date.now();
  const fromMs = toMs - 30 * 24 * 60 * 60 * 1000;
  return { from: isoDateUtc(fromMs), to: isoDateUtc(toMs) };
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
  if (interval === "15") {
    return 15 * 60 * 1000;
  }
  if (interval === "60") {
    return 60 * 60 * 1000;
  }
  if (interval === "240") {
    return 240 * 60 * 1000;
  }
  return 24 * 60 * 60 * 1000;
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
  const days = (toMs - fromMs) / (24 * 60 * 60 * 1000);
  if (days > BACKTEST_MAX_WINDOW_DAYS) {
    return {
      ok: false,
      error: `The window cannot be longer than ${BACKTEST_MAX_WINDOW_DAYS} days.`,
    };
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
