import { intervalMs } from "./model";
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";

/** Work starts that still run. The next start fails without loading candles. */
export const BACKTEST_MAX_CLAIM_ATTEMPTS = 3;

/** Pause before a queued row can be claimed again after a venue blip. */
export const BACKTEST_RETRY_DELAY_MS = 60_000;

export const BACKTEST_INTERRUPTED_ERROR =
  "Stopped after 3 interrupted attempts.";

const TAPE_COVERAGE_MIN_PERCENT = 98;

const UTC_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function backtestClaimBudgetExceeded(claimCount: number): boolean {
  return claimCount > BACKTEST_MAX_CLAIM_ATTEMPTS;
}

/** A timeout, rate limit, or 5xx can go back on the queue before the last attempt. */
export function backtestClaimCanRequeue(claimCount: number): boolean {
  return claimCount < BACKTEST_MAX_CLAIM_ATTEMPTS;
}

export function backtestQueuedNotice(error: string | null): string {
  const reason = error?.trim() ?? "";
  if (!reason) {
    return "Queued. Starting soon....";
  }
  return `Waiting to retry. ${reason}`;
}

/**
 * Venue blips are worth another queued pass. A refused request, a bad recipe,
 * and a short tape are not.
 */
export function backtestErrorIsTransient(cause: unknown): boolean {
  if (cause && typeof cause === "object" && "retryable" in cause) {
    return (cause as { retryable?: unknown }).retryable === true;
  }
  const name = cause instanceof Error ? cause.name : "";
  if (name === "AbortError" || name === "TimeoutError") {
    return true;
  }
  const message =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : "";
  const line = message.toLowerCase();
  if (
    line.includes("403") ||
    line.includes("forbidden") ||
    line.includes("blocked")
  ) {
    return false;
  }
  if (line.includes("unknown hyperliquid network")) {
    return false;
  }
  if (line.includes("could not reach hyperliquid")) {
    return true;
  }
  return (
    line.includes("fetch failed") ||
    line.includes("network error") ||
    line.includes("econnreset") ||
    line.includes("etimedout") ||
    line.includes("socket hang up") ||
    line.includes("timed out") ||
    line.includes("timeout") ||
    line.includes("aborted") ||
    line.includes("rate limit") ||
    line.includes("too many")
  );
}

export function formatBacktestUtcDate(ms: number): string {
  const date = new Date(ms);
  const month = UTC_MONTHS[date.getUTCMonth()] ?? "Jan";
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
}

/** Null when the tape reaches both ends of the window and has no large hole. */
export function backtestTapeCoverageError(input: {
  bars: ReadonlyArray<{ timeMs: number }>;
  fromMs: number;
  toMs: number;
  intervalMs: number;
  nowMs: number;
}): string | null {
  const step = Math.floor(input.intervalMs);
  if (!(step > 0) || !(input.toMs > input.fromMs)) {
    return "Incomplete candle history. This window has no bars.";
  }
  const times: number[] = [];
  const seen = new Set<number>();
  for (const bar of input.bars) {
    const timeMs = bar.timeMs;
    if (
      !Number.isFinite(timeMs) ||
      timeMs < input.fromMs ||
      timeMs > input.toMs ||
      seen.has(timeMs)
    ) {
      continue;
    }
    seen.add(timeMs);
    times.push(timeMs);
  }
  times.sort((left, right) => left - right);
  const oldest = times[0];
  const newest = times[times.length - 1];
  if (oldest == null || newest == null) {
    return "Incomplete candle history. No candles were loaded for this window.";
  }
  if (oldest > input.fromMs + step) {
    return `Incomplete candle history. The oldest candle is ${formatBacktestUtcDate(oldest)}, and this window starts ${formatBacktestUtcDate(input.fromMs)}.`;
  }
  const endTarget = Math.min(input.toMs, input.nowMs);
  // Candle time is the bar open. The bar that contains the end may still be
  // forming, so the previous open still reaches the window.
  const currentOpen = Math.floor(endTarget / step) * step;
  if (newest < currentOpen - step) {
    const endLabel =
      input.toMs > input.nowMs
        ? "today"
        : formatBacktestUtcDate(input.toMs);
    return `Incomplete candle history. The newest candle is ${formatBacktestUtcDate(newest)}, and this window ends ${endLabel}.`;
  }
  const slots = Math.floor((newest - oldest) / step) + 1;
  if (times.length * 100 < slots * TAPE_COVERAGE_MIN_PERCENT) {
    return `Incomplete candle history. ${times.length} candles were loaded for a span that needs about ${slots}.`;
  }
  return null;
}

export function backtestRunTapeCoverageError(input: {
  bars: ReadonlyArray<{ timeMs: number }>;
  fromMs: number;
  toMs: number;
  interval: DcaIndicatorTimeframe;
  nowMs: number;
}): string | null {
  return backtestTapeCoverageError({
    bars: input.bars,
    fromMs: input.fromMs,
    toMs: input.toMs,
    intervalMs: intervalMs(input.interval),
    nowMs: input.nowMs,
  });
}
