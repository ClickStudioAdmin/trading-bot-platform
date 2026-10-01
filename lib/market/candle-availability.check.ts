import assert from "node:assert/strict";
import { isoDateUtc } from "@/lib/backtest/model";
import {
  CANDLE_HISTORY_FLOOR_MS,
  candleAvailabilityNotice,
  candleRangeError,
  candleRangesDoNotOverlap,
  findEarliestCandleMs,
  formatYearMonthSpan,
  limitingCandleSpan,
  maxCandleRangeDates,
  utcDayFloor,
} from "./candle-availability";

const FIRST = Date.UTC(2021, 2, 25, 18, 0, 0);
const NOW = Date.UTC(2026, 9, 1, 12, 0, 0);
const STEP = 6 * 60 * 60 * 1000;

function covers(startMs: number, endMs: number): boolean {
  return FIRST <= endMs && FIRST >= startMs;
}

async function main(): Promise<void> {
let existsCalls = 0;
const earliest = await findEarliestCandleMs({
  nowMs: NOW,
  stepMs: STEP,
  exists: async (startMs, endMs) => {
    existsCalls += 1;
    return covers(startMs, endMs);
  },
  oldestIn: async (startMs, endMs) => (covers(startMs, endMs) ? FIRST : null),
});
assert.equal(earliest, FIRST);
assert.ok(existsCalls < 40);
assert.ok(existsCalls > 0);

const none = await findEarliestCandleMs({
  nowMs: NOW,
  stepMs: STEP,
  exists: async () => false,
  oldestIn: async () => null,
});
assert.equal(none, null);

const sameDay = utcDayFloor(FIRST);
assert.equal(
  candleRangeError({
    fromMs: sameDay,
    toMs: NOW,
    earliestMs: FIRST,
    latestMs: NOW,
    symbol: "ETHUSDT",
    intervalLabel: "6h",
    venueLabel: "Bybit",
  }),
  null,
);
const dayBefore = sameDay - 86_400_000;
const tooEarly = candleRangeError({
  fromMs: dayBefore,
  toMs: NOW,
  earliestMs: FIRST,
  latestMs: NOW,
  symbol: "ETHUSDT",
  intervalLabel: "6h",
  venueLabel: "Bybit",
});
assert.match(tooEarly ?? "", /starts before ETHUSDT 6h on Bybit/);
assert.match(tooEarly ?? "", /25 Mar 2021/);

const tooLate = candleRangeError({
  fromMs: NOW,
  toMs: NOW + 10 * 86_400_000,
  earliestMs: FIRST,
  latestMs: NOW,
  symbol: "ETHUSDT",
  intervalLabel: "6h",
  venueLabel: "Bybit",
});
assert.match(tooLate ?? "", /ends after the last ETHUSDT 6h candle on Bybit/);

const spans = limitingCandleSpan([
  { symbol: "ETHUSDT", earliestMs: FIRST, latestMs: NOW },
  { symbol: "SOLUSDT", earliestMs: Date.UTC(2024, 0, 1), latestMs: NOW },
]);
assert.equal(spans?.symbol, "SOLUSDT");
assert.equal(spans?.earliestMs, Date.UTC(2024, 0, 1));

assert.equal(
  limitingCandleSpan([
    { symbol: "ETHUSDT", earliestMs: Date.UTC(2024, 0, 1), latestMs: Date.UTC(2024, 5, 1) },
    { symbol: "SOLUSDT", earliestMs: Date.UTC(2025, 0, 1), latestMs: NOW },
  ]),
  null,
);
assert.match(candleRangesDoNotOverlap("6h", "Bybit"), /no shared 6h history/);

const notice = candleAvailabilityNotice({
  span: { symbol: "ETHUSDT", earliestMs: FIRST, latestMs: NOW },
  intervalLabel: "6h",
  venueLabel: "Bybit",
  primarySymbol: "ETHUSDT",
});
assert.match(notice, /Maximum available range for ETHUSDT 6h on Bybit/);
assert.match(notice, /25 Mar 2021/);

const dates = maxCandleRangeDates(
  { symbol: "ETHUSDT", earliestMs: FIRST, latestMs: NOW },
  isoDateUtc(NOW),
);
assert.equal(dates.from, isoDateUtc(FIRST));
assert.equal(dates.to, isoDateUtc(NOW));
const capped = maxCandleRangeDates(
  { symbol: "ETHUSDT", earliestMs: FIRST, latestMs: NOW },
  "2026-09-01",
);
assert.equal(capped.to, "2026-09-01");
assert.match(formatYearMonthSpan(FIRST, NOW), /5 years/);
assert.equal(CANDLE_HISTORY_FLOOR_MS, Date.UTC(2016, 0, 1));

console.log("candle availability checks passed");
}

void main();
