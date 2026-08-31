import assert from "node:assert/strict";
import {
  COPY_PAPER_STARTING_USDT,
  copyBreachIdempotencyKey,
  copyDailyLossBreached,
  copyFillIsEntry,
  copyFillPlaceAction,
  copyOpenNotionalState,
  copyPaperEquity,
  copyParentFillNotional,
  copyUtcDayStartMs,
  decideCopyFanOut,
  type CopyParentFill,
} from "./decide";

const fill: CopyParentFill = {
  id: "11111111-1111-4111-8111-111111111111",
  action: "buy",
  symbol: "BTCUSDT",
  side: "long",
  notionalUsdt: 10_000,
  filledAtMs: 1_700_000_000_000,
};

const base = {
  paused: false,
  shareActive: true,
  reduceOnly: false,
  liveUnbound: false,
  fill,
  followerCreatedAtMs: 1_600_000_000_000,
  hasFollowerPosition: false,
  todayRealizedUsdt: 0,
  maxDailyLossUsdt: null as number | null,
  openNotionalUsdt: 0,
  maxOpenNotionalUsdt: null as number | null,
  parentBalanceUsdt: 100_000,
  followerAvailableUsdt: 10_000,
  sizeMode: "balance" as const,
  sizePercent: null as number | null,
  sizeBookUsdt: null as number | null,
  minBalanceOk: true,
};

assert.equal(copyFillPlaceAction("buy"), "buy");
assert.equal(copyFillPlaceAction("sell"), "sell");
assert.equal(copyFillPlaceAction("flatten"), "close");
assert.equal(copyFillIsEntry("buy"), true);
assert.equal(copyFillIsEntry("flatten"), false);
assert.equal(
  copyParentFillNotional({ notionalUsdt: 250, qty: 1, price: 100 }),
  250,
);
assert.equal(
  copyParentFillNotional({ notionalUsdt: null, qty: 2, price: 50 }),
  100,
);
assert.equal(copyDailyLossBreached(-80, 100), false);
assert.equal(copyDailyLossBreached(-100, 100), true);
assert.equal(copyDailyLossBreached(20, 100), false);
assert.equal(copyDailyLossBreached(-50, null), false);
assert.equal(
  copyOpenNotionalState({
    openNotionalUsdt: 9_000,
    incomingUsdt: 500,
    maxOpenNotionalUsdt: 10_000,
  }),
  "ok",
);
assert.equal(
  copyOpenNotionalState({
    openNotionalUsdt: 9_500,
    incomingUsdt: 600,
    maxOpenNotionalUsdt: 10_000,
  }),
  "skip",
);
assert.equal(
  copyOpenNotionalState({
    openNotionalUsdt: 10_000,
    incomingUsdt: 1,
    maxOpenNotionalUsdt: 10_000,
  }),
  "flatten",
);
assert.equal(copyPaperEquity({ realizedUsdt: -200, unrealizedUsdt: 50 }), 9_850);
assert.equal(COPY_PAPER_STARTING_USDT, 10_000);

assert.deepEqual(decideCopyFanOut(base), {
  action: "place",
  place: "buy",
  notionalUsdt: 1_000,
});
assert.deepEqual(
  decideCopyFanOut({
    ...base,
    sizeMode: "percent",
    sizePercent: 20,
  }),
  { action: "place", place: "buy", notionalUsdt: 200 },
);
assert.deepEqual(
  decideCopyFanOut({
    ...base,
    sizeMode: "fixed",
    sizeBookUsdt: 5_000,
  }),
  { action: "place", place: "buy", notionalUsdt: 500 },
);
assert.deepEqual(
  decideCopyFanOut({
    ...base,
    sizeMode: "fixed",
    sizeBookUsdt: 12_000,
  }),
  { action: "pause", reason: "fixed_book" },
);
assert.equal(decideCopyFanOut({ ...base, shareActive: false }).action, "skip");
assert.equal(decideCopyFanOut({ ...base, paused: true }).action, "skip");
assert.equal(decideCopyFanOut({ ...base, reduceOnly: true }).action, "skip");
assert.equal(decideCopyFanOut({ ...base, liveUnbound: true }).action, "skip");
assert.equal(decideCopyFanOut({ ...base, minBalanceOk: false }).action, "skip");
assert.deepEqual(
  decideCopyFanOut({
    ...base,
    fill: { ...fill, action: "flatten" },
    hasFollowerPosition: false,
  }),
  { action: "skip", reason: "no_position" },
);
assert.deepEqual(
  decideCopyFanOut({
    ...base,
    fill: { ...fill, action: "flatten" },
    hasFollowerPosition: true,
  }),
  { action: "place", place: "close", notionalUsdt: 1_000 },
);
assert.deepEqual(
  decideCopyFanOut({
    ...base,
    todayRealizedUsdt: -250,
    maxDailyLossUsdt: 200,
  }),
  { action: "flatten-pause", reason: "daily_loss" },
);
assert.deepEqual(
  decideCopyFanOut({
    ...base,
    openNotionalUsdt: 5_000,
    maxOpenNotionalUsdt: 5_000,
  }),
  { action: "flatten-pause", reason: "open_notional" },
);
assert.deepEqual(
  decideCopyFanOut({
    ...base,
    openNotionalUsdt: 900,
    maxOpenNotionalUsdt: 1_500,
  }),
  { action: "skip", reason: "over_notional" },
);
assert.deepEqual(
  decideCopyFanOut({
    ...base,
    fill: { ...fill, filledAtMs: 1_000 },
  }),
  { action: "skip", reason: "before_follow" },
);

const key = copyBreachIdempotencyKey(
  "11111111-1111-4111-8111-111111111111",
  copyUtcDayStartMs(Date.UTC(2026, 7, 31, 15)),
);
assert.equal(key.length <= 36, true);
assert.match(key, /^cbr-/);

console.log("copy decide checks passed");
