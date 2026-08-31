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
  filledAtMs: number;
};

export type CopyFanOutDecision =
  | { action: "place"; place: "buy" | "sell" | "close"; notionalUsdt: number }
  | { action: "skip"; reason: CopyFanOutSkip }
  | { action: "pause"; reason: "fixed_book" }
  | { action: "flatten-pause"; reason: "daily_loss" | "open_notional" };

export type CopyFanOutSkip =
  | "paused"
  | "revoked"
  | "reduce_only"
  | "unbound"
  | "no_size"
  | "min_balance"
  | "no_position"
  | "over_notional"
  | "before_follow";

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
  openNotionalUsdt: number;
  maxOpenNotionalUsdt: number | null;
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
  const alreadyOpen = copyOpenNotionalState({
    openNotionalUsdt: input.openNotionalUsdt,
    incomingUsdt: 0,
    maxOpenNotionalUsdt: input.maxOpenNotionalUsdt,
  });
  if (alreadyOpen === "flatten") {
    return { action: "flatten-pause", reason: "open_notional" };
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
  if (isEntry) {
    const room = copyOpenNotionalState({
      openNotionalUsdt: input.openNotionalUsdt,
      incomingUsdt: sized.notionalUsdt,
      maxOpenNotionalUsdt: input.maxOpenNotionalUsdt,
    });
    if (room === "flatten") {
      return { action: "flatten-pause", reason: "open_notional" };
    }
    if (room === "skip") {
      return { action: "skip", reason: "over_notional" };
    }
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
