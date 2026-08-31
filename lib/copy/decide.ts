import type { CopySizeMode, CopySizeSkip } from "./model";
import { copySizedNotional } from "./model";

export const COPY_RULE_NAME = "Copy";
export const COPY_FANOUT_MAX_FILLS = 8;
export const COPY_PAPER_STARTING_USDT = 10_000;

export type CopyParentFill = {
  id: string;
  action: "buy" | "sell" | "flatten";
  symbol: string;
  side: "long" | "short";
  notionalUsdt: number;
  price: number | null;
  filledAtMs: number;
};

export type CopyFanOutDecision =
  | { action: "place"; place: "buy" | "sell" | "close"; notionalUsdt: number }
  | { action: "skip"; reason: CopyFanOutSkip }
  | { action: "pause"; reason: "fixed_book" }
  | { action: "flatten-pause"; reason: "daily_loss" | "drawdown" };

export type CopyFanOutSkip =
  | "paused"
  | "revoked"
  | "reduce_only"
  | "unbound"
  | "no_size"
  | "min_balance"
  | "no_position"
  | "before_follow"
  | "adverse_move";

export function copyFillPlaceAction(
  action: CopyParentFill["action"],
): "buy" | "sell" | "close" {
  if (action === "flatten") {
    return "close";
  }
  return action;
}

export function copyFillIsEntry(action: CopyParentFill["action"]): boolean {
  return action === "buy" || action === "sell";
}

/** Prefer leftover available; a desk already in trades often reports 0. */
export function parentCopyBookUsdt(input: {
  availableBalance: number | null;
  marginBalance: number | null;
}): number | null {
  if (input.availableBalance != null && input.availableBalance > 0) {
    return input.availableBalance;
  }
  if (input.marginBalance != null && input.marginBalance > 0) {
    return input.marginBalance;
  }
  return null;
}

export function copyMinOrderRetryUsdt(input: {
  error: string;
  sizedUsdt: number;
  followerAvailableUsdt: number;
}): number | null {
  const match = input.error.match(/Minimum order(?: value)? is \$([0-9,.]+)/i);
  if (!match) {
    return null;
  }
  const minUsdt = Number(match[1].replace(/,/g, ""));
  if (!(minUsdt > 0) || !Number.isFinite(minUsdt)) {
    return null;
  }
  if (minUsdt <= input.sizedUsdt + 1e-8) {
    return null;
  }
  if (minUsdt > input.followerAvailableUsdt + 1e-8) {
    return null;
  }
  return minUsdt;
}

export function copyParentFillNotional(input: {
  notionalUsdt: number | null;
  qty: number;
  price: number | null;
}): number {
  if (input.notionalUsdt != null && input.notionalUsdt > 0) {
    return input.notionalUsdt;
  }
  if (input.qty > 0 && input.price != null && input.price > 0) {
    return input.qty * input.price;
  }
  return 0;
}

export function copyDailyLossBreached(
  todayRealizedUsdt: number,
  maxDailyLossUsdt: number | null,
): boolean {
  if (maxDailyLossUsdt == null || !(maxDailyLossUsdt > 0)) {
    return false;
  }
  return todayRealizedUsdt < 0 && -todayRealizedUsdt + 1e-8 >= maxDailyLossUsdt;
}

export function copyDrawdownBreached(input: {
  equityUsdt: number | null;
  peakUsdt: number | null;
  maxDrawdownPct: number | null;
}): boolean {
  if (input.maxDrawdownPct == null || !(input.maxDrawdownPct > 0)) {
    return false;
  }
  if (
    input.equityUsdt == null ||
    input.peakUsdt == null ||
    !Number.isFinite(input.equityUsdt) ||
    !(input.peakUsdt > 0)
  ) {
    return false;
  }
  return (
    (input.peakUsdt - input.equityUsdt) / input.peakUsdt + 1e-8 >=
    input.maxDrawdownPct / 100
  );
}

export function copyParentFillPrice(input: {
  price: number | null;
  qty: number;
  notionalUsdt: number | null;
}): number | null {
  if (input.price != null && input.price > 0) {
    return input.price;
  }
  if (input.qty > 0 && input.notionalUsdt != null && input.notionalUsdt > 0) {
    return input.notionalUsdt / input.qty;
  }
  return null;
}

/** Skip an entry when mark has moved against the copy by more than X% of parent price. */
export function copyAdverseMoveSkip(input: {
  action: CopyParentFill["action"];
  parentPrice: number | null;
  markPrice: number | null;
  maxAdverseMovePct: number | null;
}): boolean {
  if (!copyFillIsEntry(input.action)) {
    return false;
  }
  if (input.maxAdverseMovePct == null || !(input.maxAdverseMovePct > 0)) {
    return false;
  }
  if (
    input.parentPrice == null ||
    input.markPrice == null ||
    !(input.parentPrice > 0) ||
    !(input.markPrice > 0)
  ) {
    return false;
  }
  const limit = input.maxAdverseMovePct / 100;
  if (input.action === "buy") {
    return input.markPrice > input.parentPrice * (1 + limit) + 1e-8;
  }
  return input.markPrice < input.parentPrice * (1 - limit) - 1e-8;
}

export function copyOpenNotionalState(input: {
  openNotionalUsdt: number;
  incomingUsdt: number;
  maxOpenNotionalUsdt: number | null;
}): "ok" | "skip" | "flatten" {
  if (input.maxOpenNotionalUsdt == null || !(input.maxOpenNotionalUsdt > 0)) {
    return "ok";
  }
  if (input.openNotionalUsdt + 1e-8 >= input.maxOpenNotionalUsdt) {
    return "flatten";
  }
  if (input.openNotionalUsdt + input.incomingUsdt > input.maxOpenNotionalUsdt + 1e-8) {
    return "skip";
  }
  return "ok";
}

export function decideCopyFanOut(input: {
  paused: boolean;
  shareActive: boolean;
  reduceOnly: boolean;
  liveUnbound: boolean;
  fill: CopyParentFill;
  followerCreatedAtMs: number;
  hasFollowerPosition: boolean;
  todayRealizedUsdt: number;
  maxDailyLossUsdt: number | null;
  followerEquityUsdt: number | null;
  equityPeakUsdt: number | null;
  maxDrawdownPct: number | null;
  markPrice: number | null;
  maxAdverseMovePct: number | null;
  parentBalanceUsdt: number;
  followerAvailableUsdt: number;
  sizeMode: CopySizeMode;
  sizePercent: number | null;
  sizeBookUsdt: number | null;
  minBalanceOk: boolean;
}): CopyFanOutDecision {
  if (!input.shareActive) {
    return { action: "skip", reason: "revoked" };
  }
  if (input.fill.filledAtMs < input.followerCreatedAtMs) {
    return { action: "skip", reason: "before_follow" };
  }
  if (copyDailyLossBreached(input.todayRealizedUsdt, input.maxDailyLossUsdt)) {
    return { action: "flatten-pause", reason: "daily_loss" };
  }
  if (
    copyDrawdownBreached({
      equityUsdt: input.followerEquityUsdt,
      peakUsdt: input.equityPeakUsdt,
      maxDrawdownPct: input.maxDrawdownPct,
    })
  ) {
    return { action: "flatten-pause", reason: "drawdown" };
  }
  if (input.paused) {
    return { action: "skip", reason: "paused" };
  }
  if (input.liveUnbound) {
    return { action: "skip", reason: "unbound" };
  }
  const isEntry = copyFillIsEntry(input.fill.action);
  if (isEntry && input.reduceOnly) {
    return { action: "skip", reason: "reduce_only" };
  }
  if (isEntry && !input.minBalanceOk) {
    return { action: "skip", reason: "min_balance" };
  }
  if (
    copyAdverseMoveSkip({
      action: input.fill.action,
      parentPrice: input.fill.price,
      markPrice: input.markPrice,
      maxAdverseMovePct: input.maxAdverseMovePct,
    })
  ) {
    return { action: "skip", reason: "adverse_move" };
  }
  if (!isEntry && !input.hasFollowerPosition) {
    return { action: "skip", reason: "no_position" };
  }
  const sized = copySizedNotional({
    parentFillUsdt: input.fill.notionalUsdt,
    parentBalanceUsdt: input.parentBalanceUsdt,
    followerAvailableUsdt: input.followerAvailableUsdt,
    sizeMode: input.sizeMode,
    sizePercent: input.sizePercent,
    sizeBookUsdt: input.sizeBookUsdt,
  });
  if (!sized.ok) {
    const code: CopySizeSkip = sized.code;
    if (code === "pause") {
      return { action: "pause", reason: "fixed_book" };
    }
    return { action: "skip", reason: "no_size" };
  }
  return {
    action: "place",
    place: copyFillPlaceAction(input.fill.action),
    notionalUsdt: sized.notionalUsdt,
  };
}

export function copyPaperEquity(input: {
  startingUsdt?: number;
  realizedUsdt: number;
  unrealizedUsdt: number;
}): number {
  return (
    (input.startingUsdt ?? COPY_PAPER_STARTING_USDT) +
    input.realizedUsdt +
    input.unrealizedUsdt
  );
}

export type CopyPaperEquityView = {
  startingUsdt: number;
  realizedUsdt: number;
  unrealizedUsdt: number;
  equityUsdt: number;
};

export function copyPaperEquityView(input: {
  startingUsdt?: number;
  realizedUsdt: number;
  unrealizedUsdt: number;
}): CopyPaperEquityView {
  const startingUsdt = input.startingUsdt ?? COPY_PAPER_STARTING_USDT;
  return {
    startingUsdt,
    realizedUsdt: input.realizedUsdt,
    unrealizedUsdt: input.unrealizedUsdt,
    equityUsdt: copyPaperEquity({ ...input, startingUsdt }),
  };
}

export function formatCopyPaperStartingUsdt(
  value = COPY_PAPER_STARTING_USDT,
): string {
  return `$${value.toLocaleString("en-US")}`;
}

export function copyUtcDayStartMs(nowMs: number): number {
  const date = new Date(nowMs);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function copyBreachIdempotencyKey(
  accountId: string,
  dayStartMs: number,
): string {
  const day = new Date(dayStartMs).toISOString().slice(0, 10).replace(/-/g, "");
  const short = accountId.replace(/-/g, "").slice(0, 12);
  return `cbr-${short}-${day}`;
}
