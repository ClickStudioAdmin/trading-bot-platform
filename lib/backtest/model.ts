import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";
import type { PerpsTemplateRecipe } from "@/lib/templates/recipe";

export const BACKTEST_FEE_PRESETS = {
  vip0_taker: {
    id: "vip0_taker",
    label: "VIP0 taker (6 bps all-in)",
    rate: 0.0006,
  },
} as const;

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
};

export type BacktestRun = {
  id: string;
  userId: string | null;
  templateId: string | null;
  deskType: "perps";
  venue: string;
  venueEnvironment: string | null;
  symbol: string;
  interval: DcaIndicatorTimeframe;
  fromMs: number;
  toMs: number;
  feePreset: BacktestFeePreset;
  feeRate: number;
  status: BacktestStatus;
  recipe: PerpsTemplateRecipe;
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

export function emptyBacktestStats(): BacktestStats {
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
  };
}
