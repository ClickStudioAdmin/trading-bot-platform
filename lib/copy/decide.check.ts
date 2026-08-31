import assert from "node:assert/strict";
import {
  COPY_PAPER_STARTING_USDT,
  copyAdverseMoveSkip,
  copyBreachIdempotencyKey,
  copyDailyLossBreached,
  copyDrawdownBreached,
  copyFillIsEntry,
  copyFillPlaceAction,
  copyOpenNotionalState,
  copyPaperEquity,
  copyPaperEquityView,
  copyParentFillNotional,
  copyParentWorkingNotional,
  copiedWorkingMatchesParent,
  copyCycleKey,
  copyCycleMidParent,
  copyCycleReceiptKey,
  copyCycleSkipMessage,
  copyCycleSkipToken,
  copyFollowerAlreadyJoined,
  copyFollowerCloseKey,
  copyShouldFlattenWithParent,
  copyShouldSkipDuplicateEntry,
  copyWorkingSkipReceiptKey,
  copyLiveLadderFitsVenue,
  copyWorkingIdempotencyKey,
  copyWorkingLooksDca,
  decideCopyCycleSkip,
  formatCopyPaperStartingUsdt,
  copyParentFillPrice,
  copyUtcDayStartMs,
  decideCopyFanOut,
  parentCopyBookUsdt,
  type CopyParentFill,
} from "./decide";

const fill: CopyParentFill = {
  id: "11111111-1111-4111-8111-111111111111",
  action: "buy",
  symbol: "BTCUSDT",
  side: "long",
  notionalUsdt: 10_000,
  price: 100,
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
  followerEquityUsdt: 10_000 as number | null,
  equityPeakUsdt: 10_000 as number | null,
  maxDrawdownPct: null as number | null,
  markPrice: 100 as number | null,
  maxAdverseMovePct: null as number | null,
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
  copyParentWorkingNotional({
    remainingQty: 0.01,
    qty: 0.01,
    filledQty: 0,
    limitPrice: 100_000,
  }),
  1_000,
);
assert.equal(
  copyParentWorkingNotional({
    remainingQty: 0,
    qty: 0.02,
    filledQty: 0.01,
    limitPrice: 100,
  }),
  1,
);
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
assert.deepEqual(copyPaperEquityView({ realizedUsdt: -200, unrealizedUsdt: 50 }), {
  startingUsdt: 10_000,
  realizedUsdt: -200,
  unrealizedUsdt: 50,
  equityUsdt: 9_850,
});
assert.equal(formatCopyPaperStartingUsdt(), "$10,000");

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
    paused: true,
    fill: { ...fill, action: "flatten" },
    hasFollowerPosition: true,
  }),
  { action: "place", place: "close", notionalUsdt: 1_000 },
);
assert.equal(
  copyShouldFlattenWithParent({
    parentHasPosition: false,
    parentHasEntryWorking: false,
    followerHasPosition: true,
  }),
  true,
);
assert.equal(
  copyShouldFlattenWithParent({
    parentHasPosition: true,
    parentHasEntryWorking: false,
    followerHasPosition: true,
  }),
  false,
);
assert.equal(
  copyShouldFlattenWithParent({
    parentHasPosition: false,
    parentHasEntryWorking: true,
    followerHasPosition: true,
  }),
  false,
);
assert.match(copyFollowerCloseKey("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"), /^cfl-/);
assert.equal(
  copyShouldSkipDuplicateEntry({
    parentEntryCount: 2,
    followerEntryCount: 2,
  }),
  true,
);
assert.equal(
  copyShouldSkipDuplicateEntry({
    parentEntryCount: 2,
    followerEntryCount: 1,
  }),
  false,
);
assert.equal(
  copyWorkingSkipReceiptKey("27513ab0-4d7b-4837-bc1e-40e44fccb950").startsWith(
    "wsk-",
  ),
  true,
);
assert.deepEqual(
  decideCopyFanOut({
    ...base,
    todayRealizedUsdt: -250,
    maxDailyLossUsdt: 200,
  }),
  { action: "flatten-pause", reason: "daily_loss" },
);
assert.equal(copyDrawdownBreached({
  equityUsdt: 8_000,
  peakUsdt: 10_000,
  maxDrawdownPct: 20,
}), true);
assert.equal(copyDrawdownBreached({
  equityUsdt: 8_100,
  peakUsdt: 10_000,
  maxDrawdownPct: 20,
}), false);
assert.equal(copyDrawdownBreached({
  equityUsdt: 8_000,
  peakUsdt: 10_000,
  maxDrawdownPct: null,
}), false);
assert.equal(copyDrawdownBreached({
  equityUsdt: 0,
  peakUsdt: 10_000,
  maxDrawdownPct: 20,
}), true);
assert.equal(
  parentCopyBookUsdt({ availableBalance: 80, marginBalance: 100 }),
  80,
);
assert.equal(
  parentCopyBookUsdt({ availableBalance: 0, marginBalance: 100 }),
  100,
);
assert.equal(
  parentCopyBookUsdt({ availableBalance: null, marginBalance: 100 }),
  100,
);
assert.equal(
  parentCopyBookUsdt({ availableBalance: 0, marginBalance: 0 }),
  null,
);
assert.equal(copyParentFillPrice({ price: 50, qty: 2, notionalUsdt: 80 }), 50);
assert.equal(copyParentFillPrice({ price: null, qty: 2, notionalUsdt: 80 }), 40);
assert.equal(
  copyAdverseMoveSkip({
    action: "buy",
    parentPrice: 100,
    markPrice: 103,
    maxAdverseMovePct: 2,
  }),
  true,
);
assert.equal(
  copyAdverseMoveSkip({
    action: "buy",
    parentPrice: 100,
    markPrice: 101,
    maxAdverseMovePct: 2,
  }),
  false,
);
assert.equal(
  copyAdverseMoveSkip({
    action: "buy",
    parentPrice: 100,
    markPrice: 90,
    maxAdverseMovePct: 2,
  }),
  false,
);
assert.equal(
  copyAdverseMoveSkip({
    action: "sell",
    parentPrice: 100,
    markPrice: 97,
    maxAdverseMovePct: 2,
  }),
  true,
);
assert.equal(
  copyAdverseMoveSkip({
    action: "flatten",
    parentPrice: 100,
    markPrice: 130,
    maxAdverseMovePct: 2,
  }),
  false,
);
assert.deepEqual(
  decideCopyFanOut({
    ...base,
    followerEquityUsdt: 7_500,
    equityPeakUsdt: 10_000,
    maxDrawdownPct: 20,
  }),
  { action: "flatten-pause", reason: "drawdown" },
);
assert.deepEqual(
  decideCopyFanOut({
    ...base,
    markPrice: 104,
    maxAdverseMovePct: 3,
  }),
  { action: "skip", reason: "adverse_move" },
);
assert.deepEqual(
  decideCopyFanOut({
    ...base,
    fill: { ...fill, action: "flatten" },
    hasFollowerPosition: true,
    markPrice: 130,
    maxAdverseMovePct: 1,
  }),
  { action: "place", place: "close", notionalUsdt: 1_000 },
);
assert.deepEqual(
  decideCopyFanOut({
    ...base,
    markPrice: null,
    maxAdverseMovePct: 1,
  }),
  { action: "place", place: "buy", notionalUsdt: 1_000 },
);
assert.deepEqual(
  decideCopyFanOut({
    ...base,
    followerEquityUsdt: 5_000,
    equityPeakUsdt: null,
    maxDrawdownPct: 10,
  }),
  { action: "place", place: "buy", notionalUsdt: 1_000 },
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

assert.equal(copyCycleKey("BTCUSDT", "long"), "BTCUSDT:long");
assert.equal(copyWorkingLooksDca("d11111111l2"), true);
assert.equal(copyWorkingLooksDca("d11111111ltp"), true);
assert.equal(copyWorkingLooksDca("11111111-1111-4111-8111-111111111111"), false);
assert.equal(
  copyWorkingIdempotencyKey({
    id: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: "d11111111l2",
  }),
  "d11111111l2",
);
assert.equal(
  copyCycleMidParent({
    parentHasPosition: true,
    entryClipIndexes: [0, 1],
    hasNewEntryFillAfterFollow: true,
  }),
  false,
);
assert.equal(
  copyCycleMidParent({
    parentHasPosition: true,
    entryClipIndexes: [4, 5],
    hasNewEntryFillAfterFollow: false,
  }),
  true,
);
assert.equal(
  copyCycleMidParent({
    parentHasPosition: false,
    entryClipIndexes: [0, 1, 2],
    hasNewEntryFillAfterFollow: false,
  }),
  false,
);
assert.equal(
  copyCycleMidParent({
    parentHasPosition: true,
    entryClipIndexes: [4, 5],
    hasNewEntryFillAfterFollow: true,
  }),
  true,
);
assert.equal(
  copyCycleMidParent({
    parentHasPosition: true,
    entryClipIndexes: [0, 1],
    hasNewEntryFillAfterFollow: true,
    parentHadEntryBeforeFollow: true,
  }),
  true,
);
assert.equal(
  copyCycleMidParent({
    parentHasPosition: true,
    entryClipIndexes: [],
    hasNewEntryFillAfterFollow: true,
    parentPositionOpenedBeforeFollow: true,
  }),
  true,
);
assert.equal(
  copyCycleMidParent({
    parentHasPosition: true,
    entryClipIndexes: [],
    hasNewEntryFillAfterFollow: true,
    parentPositionOpenedBeforeFollow: false,
  }),
  false,
);
assert.equal(
  copyFollowerAlreadyJoined({
    hasFollowerPosition: false,
    hasCopiedWorking: true,
  }),
  true,
);
assert.equal(
  decideCopyCycleSkip({
    alreadyJoined: false,
    midParent: true,
    live: false,
    ladderClips: [],
    minQty: 0.001,
    minNotionalUsdt: 5,
  }),
  "mid_cycle",
);
assert.equal(
  decideCopyCycleSkip({
    alreadyJoined: true,
    midParent: true,
    live: true,
    ladderClips: [{ sizedUsdt: 1, price: 78_000 }],
    minQty: 0.001,
    minNotionalUsdt: 5,
  }),
  null,
);
assert.equal(
  decideCopyCycleSkip({
    alreadyJoined: false,
    midParent: false,
    live: true,
    ladderClips: [
      { sizedUsdt: 7.8, price: 78_000 },
      { sizedUsdt: 80, price: 77_000 },
    ],
    minQty: 0.001,
    minNotionalUsdt: 5,
  }),
  "ladder_too_small",
);
assert.equal(
  decideCopyCycleSkip({
    alreadyJoined: false,
    midParent: true,
    live: true,
    ladderClips: [{ sizedUsdt: 1, price: 78_000 }],
    minQty: 0.001,
    minNotionalUsdt: 5,
  }),
  "mid_cycle",
);
assert.equal(
  copiedWorkingMatchesParent("d11111111l2", {
    id: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: "d11111111l2",
  }),
  true,
);
assert.equal(copyCycleSkipToken({ parentPositionId: null, minClipIndex: 4 }), "c4");
assert.equal(
  copyLiveLadderFitsVenue({
    sizedUsdt: 7.8,
    price: 78_000,
    minQty: 0.001,
    minNotionalUsdt: 5,
  }),
  false,
);
assert.equal(
  copyLiveLadderFitsVenue({
    sizedUsdt: 80,
    price: 78_000,
    minQty: 0.001,
    minNotionalUsdt: 5,
  }),
  true,
);
assert.equal(
  copyCycleSkipMessage("mid_cycle", "BTCUSDT", "long").includes("already"),
  true,
);
assert.equal(
  copyCycleReceiptKey("ladder_too_small", "BTCUSDT", "long", "abc").startsWith(
    "sml-",
  ),
  true,
);

console.log("copy decide checks passed");
