import assert from "node:assert/strict";
import {
  BACKTEST_INTERRUPTED_ERROR,
  BACKTEST_MAX_CLAIM_ATTEMPTS,
  backtestClaimBudgetExceeded,
  backtestClaimCanRequeue,
  backtestErrorIsTransient,
  backtestQueuedNotice,
  backtestTapeCoverageError,
  formatBacktestUtcDate,
} from "./guard";

assert.equal(BACKTEST_MAX_CLAIM_ATTEMPTS, 3);
assert.equal(backtestClaimBudgetExceeded(1), false);
assert.equal(backtestClaimBudgetExceeded(3), false);
assert.equal(backtestClaimBudgetExceeded(4), true);
assert.equal(backtestClaimCanRequeue(1), true);
assert.equal(backtestClaimCanRequeue(2), true);
assert.equal(backtestClaimCanRequeue(3), false);
assert.equal(
  BACKTEST_INTERRUPTED_ERROR,
  "Stopped after 3 interrupted attempts.",
);

assert.equal(backtestQueuedNotice(null), "Queued. Starting this run now.");
assert.equal(backtestQueuedNotice("  "), "Queued. Starting this run now.");
assert.equal(
  backtestQueuedNotice("Bybit /v5/market/kline: Too many visits"),
  "Waiting to retry. Bybit /v5/market/kline: Too many visits",
);

assert.equal(
  backtestErrorIsTransient(
    Object.assign(new Error("Bybit HTTP 429"), { retryable: true }),
  ),
  true,
);
assert.equal(
  backtestErrorIsTransient(
    Object.assign(new Error("Bybit HTTP 403"), { retryable: false }),
  ),
  false,
);
assert.equal(
  backtestErrorIsTransient(new Error("Could not reach Hyperliquid.")),
  true,
);
assert.equal(
  backtestErrorIsTransient(new Error("Unknown Hyperliquid network.")),
  false,
);
assert.equal(
  backtestErrorIsTransient(new Error("Bybit blocked this address")),
  false,
);
assert.equal(
  backtestErrorIsTransient(
    Object.assign(new Error("The operation was aborted due to timeout"), {
      name: "TimeoutError",
    }),
  ),
  true,
);
assert.equal(
  backtestErrorIsTransient(new Error("fetch failed")),
  true,
);
assert.equal(
  backtestErrorIsTransient(new Error("Not enough candles in that window.")),
  false,
);
assert.equal(
  backtestErrorIsTransient(new Error(BACKTEST_INTERRUPTED_ERROR)),
  false,
);

const hour = 60 * 60 * 1000;
const fromMs = Date.UTC(2025, 9, 16);
const toMs = Date.UTC(2025, 9, 16, 5);
function hourly(start: number, count: number, skip = new Set<number>()) {
  const bars = [];
  for (let index = 0; index < count; index += 1) {
    if (skip.has(index)) {
      continue;
    }
    bars.push({ timeMs: start + index * hour });
  }
  return bars;
}

assert.equal(formatBacktestUtcDate(fromMs), "16 Oct 2025");
assert.equal(
  backtestTapeCoverageError({
    bars: hourly(fromMs, 6),
    fromMs,
    toMs,
    intervalMs: hour,
    nowMs: toMs,
  }),
  null,
);
assert.equal(
  backtestTapeCoverageError({
    bars: hourly(fromMs + hour, 5),
    fromMs,
    toMs,
    intervalMs: hour,
    nowMs: toMs,
  }),
  null,
);
assert.match(
  backtestTapeCoverageError({
    bars: [
      { timeMs: fromMs - hour },
      ...hourly(Date.UTC(2025, 10, 2), 6),
    ],
    fromMs,
    toMs: Date.UTC(2025, 10, 2, 5),
    intervalMs: hour,
    nowMs: Date.UTC(2025, 10, 2, 5),
  }) ?? "",
  /oldest candle is 2 Nov 2025/,
);

const listedLater = backtestTapeCoverageError({
  bars: hourly(Date.UTC(2020, 2, 25, 8), 6),
  fromMs: Date.UTC(2020, 2, 25),
  toMs: Date.UTC(2020, 2, 25, 13),
  intervalMs: hour,
  nowMs: Date.UTC(2026, 9, 16),
});
assert.equal(listedLater, null);
assert.match(
  backtestTapeCoverageError({
    bars: hourly(Date.UTC(2020, 2, 26, 8), 6),
    fromMs: Date.UTC(2020, 2, 25),
    toMs: Date.UTC(2020, 2, 26, 13),
    intervalMs: hour,
    nowMs: Date.UTC(2026, 9, 16),
  }) ?? "",
  /oldest candle is 26 Mar 2020/,
);

const late = backtestTapeCoverageError({
  bars: hourly(Date.UTC(2025, 10, 2), 6),
  fromMs,
  toMs: Date.UTC(2025, 10, 2, 5),
  intervalMs: hour,
  nowMs: Date.UTC(2025, 10, 2, 5),
});
assert.equal(
  late,
  "Incomplete candle history. The oldest candle is 2 Nov 2025, and this window starts 16 Oct 2025.",
);

const staleEnd = backtestTapeCoverageError({
  bars: hourly(fromMs, 2),
  fromMs,
  toMs,
  intervalMs: hour,
  nowMs: toMs,
});
assert.equal(
  staleEnd,
  "Incomplete candle history. The newest candle is 16 Oct 2025, and this window ends 16 Oct 2025.",
);

const openToday = Date.UTC(2026, 9, 16, 4);
const todayStart = openToday - 4 * hour;
assert.equal(
  backtestTapeCoverageError({
    bars: hourly(todayStart, 5),
    fromMs: todayStart,
    toMs: Date.UTC(2026, 9, 20),
    intervalMs: hour,
    nowMs: openToday,
  }),
  null,
);
assert.match(
  backtestTapeCoverageError({
    bars: hourly(fromMs, 2),
    fromMs,
    toMs: Date.UTC(2026, 9, 20),
    intervalMs: hour,
    nowMs: openToday,
  }) ?? "",
  /ends today/,
);

const quarter = 15 * 60 * 1000;
const maxFrom = Date.UTC(2026, 9, 16);
const maxNow = Date.UTC(2026, 9, 16, 8, 47);
const formingOpen = Math.floor(maxNow / quarter) * quarter;
const lastClosed = formingOpen - quarter;
const maxBars = [];
for (let timeMs = maxFrom; timeMs <= lastClosed; timeMs += quarter) {
  maxBars.push({ timeMs });
}
assert.equal(
  backtestTapeCoverageError({
    bars: maxBars,
    fromMs: maxFrom,
    toMs: Date.UTC(2026, 9, 17) - 1,
    intervalMs: quarter,
    nowMs: maxNow,
  }),
  null,
);
assert.match(
  backtestTapeCoverageError({
    bars: maxBars.filter((row) => row.timeMs <= lastClosed - quarter),
    fromMs: maxFrom,
    toMs: Date.UTC(2026, 9, 17) - 1,
    intervalMs: quarter,
    nowMs: maxNow,
  }) ?? "",
  /newest candle is 16 Oct 2026/,
);

const hole = backtestTapeCoverageError({
  bars: hourly(fromMs, 100, new Set([10, 11, 12])),
  fromMs,
  toMs: fromMs + 99 * hour,
  intervalMs: hour,
  nowMs: fromMs + 99 * hour,
});
assert.equal(
  hole,
  "Incomplete candle history. 97 candles were loaded for a span that needs about 100.",
);
assert.equal(
  backtestTapeCoverageError({
    bars: hourly(fromMs, 100, new Set([10, 11])),
    fromMs,
    toMs: fromMs + 99 * hour,
    intervalMs: hour,
    nowMs: fromMs + 99 * hour,
  }),
  null,
);
assert.match(
  backtestTapeCoverageError({
    bars: [],
    fromMs,
    toMs,
    intervalMs: hour,
    nowMs: toMs,
  }) ?? "",
  /No candles were loaded/,
);

console.log("backtest guard checks passed");
