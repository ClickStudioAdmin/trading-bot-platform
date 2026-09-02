import assert from "node:assert/strict";
import {
  dcaIndicatorStartLatches,
  indicatorClosesForCross,
} from "./indicators";
import {
  dcaAveragingKind,
  dcaCapHit,
  dcaClipsFilledFromGrid,
  dcaClipAction,
  dcaClipKey,
  dcaClipCycleKey,
  dcaClipRestKey,
  dcaConfigMaxOrderError,
  dcaCycleEnded,
  dcaLiveQtyBlocksCycleEnd,
  dcaGridClipCounts,
  dcaExitLimitKey,
  dcaExitLimitRestKey,
  dcaFlattenKey,
  parseDcaClipIndex,
  parseDcaExitLimitKind,
  isDcaClipKey,
  isDcaExitLimitKey,
  planDcaExitLimitKeep,
  planDcaExitLimitSync,
  planDcaSafetySync,
  capDcaSafetySync,
  DCA_LIVE_GRID_OPS_PER_SYNC,
  formatDcaEntryType,
  dcaDipMet,
  dcaEnabledSides,
  dcaStartListens,
  dcaNeedsIndicatorCloses,
  dcaLegIsRunning,
  dcaWebhookSignalApplies,
  dcaExitTpslNeedsVenueSync,
  dcaHintsForCopyOpen,
  dcaHintsForOpen,
  dcaIntervalMet,
  dcaIntervalParts,
  dcaOpenHint,
  dcaPlaybookConflict,
  dcaPlaybookHasOpenCycle,
  dcaPlaybookIsRunning,
  dcaWithLockedCycleConfig,
  resolveDcaSaveConfig,
  dcaCloneIdleDraft,
  dcaCopyName,
  dcaPnlPct,
  decideDcaTick,
  DEFAULT_DCA_NAME,
  formatDcaNextAdd,
  formatDcaOrdersProgress,
  formatDcaRemaining,
  dcaFilledClipCount,
  parseDcaPlaybookForm,
  parseDcaPlaybookId,
  parseDcaSaveIntent,
  parseDcaPlaybookRow,
  parseDcaStatus,
  parseDcaMaxValueKind,
  dcaMaxTypeFromCaps,
  dcaResolvedMaxValueUsdt,
  dcaTickValueCapUsdt,
  dcaCycleClipSize,
  dcaCopyEstimateClipSize,
  type DcaPlaybook,
} from "./playbook";
import { emptyFuturesTpsl } from "@/lib/futures/tpsl";

assert.equal(parseDcaStatus("armed"), "armed");
assert.equal(parseDcaStatus("stop_adding"), "stop_adding");
assert.equal(parseDcaStatus("nope"), "idle");
assert.equal(dcaClipAction("long"), "buy");
assert.equal(dcaClipAction("short"), "sell");
assert.equal(dcaClipKey("11111111-1111-4111-8111-111111111111", "long", 2), "d11111111l2");
assert.equal(
  dcaClipRestKey("11111111-1111-4111-8111-111111111111", "long", 3, 1_700_000_000_000),
  dcaClipRestKey("11111111-1111-4111-8111-111111111111", "long", 3, 1_700_000_000_000),
);
assert.ok(
  dcaClipRestKey("11111111-1111-4111-8111-111111111111", "long", 20, 1_700_000_000_000)
    .length <= 36,
);
assert.equal(
  isDcaClipKey(
    dcaClipRestKey("11111111-1111-4111-8111-111111111111", "long", 3, 1_700_000_000_000),
    "11111111-1111-4111-8111-111111111111",
    "long",
  ),
  true,
);
assert.equal(parseDcaClipIndex("d11111111l2"), 2);
assert.equal(formatDcaEntryType(0), "Entry # 1");
assert.equal(formatDcaEntryType(1), "Entry # 2");
assert.equal(parseDcaClipIndex("c123"), null);
assert.equal(
  dcaExitLimitKey("11111111-1111-4111-8111-111111111111", "long", "tp"),
  "d11111111ltp",
);
assert.equal(parseDcaExitLimitKind("d11111111ltp"), "tp");
assert.equal(parseDcaExitLimitKind("d11111111lsl"), "sl");
assert.equal(parseDcaExitLimitKind("d11111111ltp847291"), "tp");
assert.equal(parseDcaClipIndex("d11111111ltp847291"), null);
assert.equal(parseDcaClipIndex("d11111111l10x847291"), 10);
assert.equal(
  parseDcaClipIndex(
    dcaClipCycleKey(
      "11111111-1111-4111-8111-111111111111",
      "short",
      1,
      "22222222-2222-4222-8222-222222222222",
    ),
  ),
  1,
);
assert.equal(
  parseDcaClipIndex(
    dcaClipCycleKey(
      "11111111-1111-4111-8111-111111111111",
      "short",
      13,
      "22222222-2222-4222-8222-222222222222",
    ),
  ),
  13,
);
assert.equal(
  isDcaClipKey(
    dcaClipCycleKey(
      "11111111-1111-4111-8111-111111111111",
      "short",
      1,
      "22222222-2222-4222-8222-222222222222",
    ),
    "11111111-1111-4111-8111-111111111111",
    "short",
  ),
  true,
);
assert.notEqual(
  dcaClipCycleKey(
    "11111111-1111-4111-8111-111111111111",
    "short",
    1,
    "22222222-2222-4222-8222-222222222222",
  ),
  dcaClipCycleKey(
    "11111111-1111-4111-8111-111111111111",
    "short",
    1,
    "33333333-3333-4333-8333-333333333333",
  ),
);
const tpRestKey = dcaExitLimitRestKey(
  "11111111-1111-4111-8111-111111111111",
  "short",
  "tp",
  0.03,
  2489.18,
);
assert.equal(parseDcaExitLimitKind(tpRestKey), "tp");
assert.equal(
  isDcaExitLimitKey(
    tpRestKey,
    "11111111-1111-4111-8111-111111111111",
    "short",
    "tp",
  ),
  true,
);
assert.equal(
  dcaExitLimitRestKey(
    "11111111-1111-4111-8111-111111111111",
    "short",
    "tp",
    0.03,
    2489.18,
  ),
  tpRestKey,
);
assert.ok(tpRestKey.length <= 36);
const tpPosKey = dcaExitLimitRestKey(
  "11111111-1111-4111-8111-111111111111",
  "short",
  "tp",
  0.03,
  2489.18,
  "22222222-2222-4222-8222-222222222222",
);
assert.equal(parseDcaExitLimitKind(tpPosKey), "tp");
assert.equal(
  isDcaExitLimitKey(
    tpPosKey,
    "11111111-1111-4111-8111-111111111111",
    "short",
    "tp",
  ),
  true,
);
assert.notEqual(tpPosKey, tpRestKey);
assert.ok(tpPosKey.length <= 36);
assert.equal(
  dcaExitLimitRestKey(
    "11111111-1111-4111-8111-111111111111",
    "short",
    "tp",
    0.03,
    2489.18,
    "33333333-3333-4333-8333-333333333333",
  ) === tpPosKey,
  false,
);
assert.equal(
  dcaFlattenKey(
    "11111111-1111-4111-8111-111111111111",
    "short",
    "22222222-2222-4222-8222-222222222222",
  ),
  "c11111111s22222222",
);
assert.deepEqual(
  planDcaExitLimitSync({
    qty: 1,
    limitPrice: 100,
    existing: null,
  }),
  { kind: "rest" },
);
assert.deepEqual(
  planDcaExitLimitSync({
    qty: 1,
    limitPrice: 100,
    existing: { remainingQty: 1, limitPrice: 100 },
  }),
  { kind: "keep" },
);
assert.deepEqual(
  planDcaExitLimitSync({
    qty: 2,
    limitPrice: 100,
    existing: { remainingQty: 1, limitPrice: 100 },
  }),
  { kind: "replace" },
);
assert.deepEqual(
  planDcaExitLimitSync({
    qty: 0.5,
    limitPrice: 110,
    existing: { remainingQty: 1, limitPrice: 100 },
  }),
  { kind: "amend", qty: 0.5, limitPrice: 110 },
);
assert.deepEqual(
  planDcaExitLimitKeep(
    [
      {
        id: "a",
        idempotencyKey: "d11111111ltp1",
        remainingQty: 1,
        limitPrice: 100,
        reduceOnly: true,
      },
      {
        id: "b",
        idempotencyKey: "d11111111ltp2",
        remainingQty: 1,
        limitPrice: 100,
        reduceOnly: true,
      },
    ],
    1,
    100,
  ),
  { keep: {
    id: "a",
    idempotencyKey: "d11111111ltp1",
    remainingQty: 1,
    limitPrice: 100,
    reduceOnly: true,
  }, cancelIds: ["b"] },
);
assert.equal(
  isDcaClipKey(
    "d11111111l10",
    "11111111-1111-4111-8111-111111111111",
    "long",
  ),
  true,
);
assert.equal(
  isDcaClipKey(
    "d11111111l10x847291",
    "11111111-1111-4111-8111-111111111111",
    "long",
  ),
  true,
);
assert.equal(
  isDcaClipKey(
    "d11111111l1",
    "11111111-1111-4111-8111-111111111111",
    "long",
  ),
  true,
);
assert.equal(
  isDcaClipKey(
    "d11111111l10",
    "11111111-1111-4111-8111-111111111111",
    "short",
  ),
  false,
);
assert.equal(
  isDcaClipKey(
    "d11111111ltp",
    "11111111-1111-4111-8111-111111111111",
    "long",
  ),
  false,
);
const safetyId = "11111111-1111-4111-8111-111111111111";
const safetyWorking = Array.from({ length: 19 }, (_, index) => ({
  id: `w${index + 1}`,
  idempotencyKey: dcaClipKey(safetyId, "long", index + 1),
  remainingQty: 0.01,
  limitPrice: 99 - index,
  reduceOnly: false,
}));
const toMarket = planDcaSafetySync({
  playbookId: safetyId,
  side: "long",
  status: "armed",
  dcaMode: "position",
  maxClips: 20,
  dipPct: 1,
  deviationMultiplier: 1,
  clipSize: 0.01,
  sizeMultiplier: 1,
  sizeUnit: "qty",
  entryPrice: 100,
  working: safetyWorking,
});
assert.equal(toMarket.cancelIds.length, 19);
assert.equal(toMarket.rest.length, 0);
assert.equal(toMarket.amend.length, 0);
const maxTen = planDcaSafetySync({
  playbookId: safetyId,
  side: "long",
  status: "armed",
  dcaMode: "order",
  maxClips: 10,
  dipPct: 1,
  deviationMultiplier: 1,
  clipSize: 0.01,
  sizeMultiplier: 1,
  sizeUnit: "qty",
  entryPrice: 100,
  working: safetyWorking,
});
assert.equal(maxTen.cancelIds.length, 10);
assert.equal(maxTen.rest.length, 0);
assert.ok(maxTen.cancelIds.includes("w10"));
assert.ok(maxTen.cancelIds.includes("w19"));
assert.ok(!maxTen.cancelIds.includes("w1"));
assert.ok(!maxTen.cancelIds.includes("w9"));
const stopped = planDcaSafetySync({
  playbookId: safetyId,
  side: "long",
  status: "stop_adding",
  dcaMode: "order",
  maxClips: 20,
  dipPct: 1,
  deviationMultiplier: 1,
  clipSize: 0.01,
  sizeMultiplier: 1,
  sizeUnit: "qty",
  entryPrice: 100,
  working: safetyWorking,
});
assert.equal(stopped.cancelIds.length, 19);
const filledSkip = planDcaSafetySync({
  playbookId: safetyId,
  side: "long",
  status: "armed",
  dcaMode: "order",
  maxClips: 4,
  dipPct: 1,
  deviationMultiplier: 1,
  clipSize: 0.01,
  sizeMultiplier: 1,
  sizeUnit: "qty",
  entryPrice: 100,
  working: [
    {
      id: "f1",
      idempotencyKey: dcaClipKey(safetyId, "long", 1),
      remainingQty: 0,
      limitPrice: 99,
      reduceOnly: false,
      status: "filled",
    },
    {
      id: "w2",
      idempotencyKey: dcaClipKey(safetyId, "long", 2),
      remainingQty: 0.01,
      limitPrice: 98.01,
      reduceOnly: false,
      status: "open",
    },
  ],
});
assert.deepEqual(filledSkip.rest.map((row) => row.clipIndex), [3]);
assert.equal(filledSkip.cancelIds.length, 0);
assert.equal(filledSkip.amend.length, 0);
const priorCycleFilled = planDcaSafetySync({
  playbookId: safetyId,
  side: "short",
  status: "armed",
  dcaMode: "order",
  maxClips: 4,
  dipPct: 1,
  deviationMultiplier: 1,
  clipSize: 0.01,
  sizeMultiplier: 1,
  sizeUnit: "qty",
  entryPrice: 100,
  positionId: "pos-now",
  working: [
    {
      id: "old1",
      idempotencyKey: dcaClipKey(safetyId, "short", 1),
      remainingQty: 0,
      limitPrice: 101,
      reduceOnly: false,
      status: "filled",
      positionId: "pos-old",
    },
    {
      id: "old13",
      idempotencyKey: dcaClipKey(safetyId, "short", 13),
      remainingQty: 0,
      limitPrice: 110,
      reduceOnly: false,
      status: "filled",
      positionId: "pos-old",
    },
  ],
});
assert.ok(priorCycleFilled.rest.some((row) => row.clipIndex === 1));
assert.ok(
  priorCycleFilled.rest.some((row) => row.clipIndex === 2),
);
const dupes = planDcaSafetySync({
  playbookId: safetyId,
  side: "long",
  status: "armed",
  dcaMode: "order",
  maxClips: 4,
  dipPct: 1,
  deviationMultiplier: 1,
  clipSize: 0.01,
  sizeMultiplier: 1,
  sizeUnit: "qty",
  entryPrice: 100,
  working: [
    {
      id: "w3a",
      idempotencyKey: dcaClipRestKey(safetyId, "long", 3, 100),
      remainingQty: 0.01,
      limitPrice: 97.0299,
      reduceOnly: false,
      status: "open",
    },
    {
      id: "w3b",
      idempotencyKey: dcaClipRestKey(safetyId, "long", 3, 200),
      remainingQty: 0.01,
      limitPrice: 97.0299,
      reduceOnly: false,
      status: "open",
    },
  ],
});
assert.equal(dupes.cancelIds.length, 1);
assert.ok(dupes.cancelIds.includes("w3b"));
assert.deepEqual(
  dupes.rest.map((row) => row.clipIndex).sort((a, b) => a - b),
  [1, 2],
);
const cappedDupes = capDcaSafetySync(
  {
    cancelIds: ["a", "b", "c"],
    amend: [
      { workingId: "w1", qty: 1, limitPrice: 10 },
      { workingId: "w2", qty: 1, limitPrice: 9 },
    ],
    rest: [
      { clipIndex: 5, qty: 1, limitPrice: 8 },
      { clipIndex: 1, qty: 1, limitPrice: 9 },
      { clipIndex: 2, qty: 1, limitPrice: 8.5 },
    ],
  },
  DCA_LIVE_GRID_OPS_PER_SYNC,
);
assert.deepEqual(cappedDupes.cancelIds, ["a", "b", "c"]);
assert.deepEqual(
  cappedDupes.rest.map((row) => row.clipIndex),
  [1, 2, 5],
);
assert.equal(cappedDupes.amend.length, 0);
const firstRests = capDcaSafetySync(
  {
    cancelIds: [],
    amend: [],
    rest: [
      { clipIndex: 3, qty: 1, limitPrice: 8 },
      { clipIndex: 1, qty: 1, limitPrice: 9 },
      { clipIndex: 2, qty: 1, limitPrice: 8.5 },
    ],
  },
  2,
);
assert.deepEqual(
  firstRests.rest.map((row) => row.clipIndex),
  [1, 2],
);
assert.equal(
  isDcaExitLimitKey(
    "d11111111ltp847291",
    "11111111-1111-4111-8111-111111111111",
    "long",
    "tp",
  ),
  true,
);
assert.equal(
  isDcaExitLimitKey(
    "d11111111lsl",
    "11111111-1111-4111-8111-111111111111",
    "long",
    "tp",
  ),
  false,
);
assert.deepEqual(dcaEnabledSides("both"), ["long", "short"]);
assert.equal(
  dcaConfigMaxOrderError({
    config: {
      direction: "long",
      dcaMode: "position",
      clipSize: 10,
      sizeUnit: "qty",
      maxClips: 5,
      maxValue: null,
      maxValueKind: "usdt",
      dipPct: null,
      sizeMultiplier: 2,
      deviationMultiplier: 1,
    },
    lastPrice: 100,
    maxQty: 50,
    maxMktQty: 50,
    baseCoin: "BTC",
  }),
  "Entry # 4 is 80 BTC, above the 50 BTC market maximum.",
);
assert.equal(
  dcaConfigMaxOrderError({
    config: {
      direction: "long",
      dcaMode: "position",
      clipSize: 100,
      sizeUnit: "usdt",
      maxClips: 20,
      maxValue: null,
      maxValueKind: "usdt",
      dipPct: null,
      sizeMultiplier: 2,
      deviationMultiplier: 1,
    },
    lastPrice: null,
    maxQty: 119,
    maxMktQty: 119,
    baseCoin: "BTC",
  }),
  null,
);
assert.equal(dcaStartListens("immediate"), false);
assert.equal(dcaStartListens("price"), true);
assert.equal(dcaStartListens("webhook"), true);
assert.equal(dcaStartListens("indicator"), true);
assert.equal(
  dcaNeedsIndicatorCloses({
    startKind: "indicator",
    indicatorTimeframe: "5",
    direction: "long",
    long: { status: "idle" },
    short: { status: "idle" },
  }),
  false,
);
assert.equal(
  dcaNeedsIndicatorCloses({
    startKind: "indicator",
    indicatorTimeframe: "5",
    direction: "long",
    long: { status: "armed" },
    short: { status: "idle" },
  }),
  true,
);
assert.equal(
  dcaNeedsIndicatorCloses({
    startKind: "price",
    indicatorTimeframe: "5",
    direction: "long",
    long: { status: "armed" },
    short: { status: "idle" },
  }),
  false,
);
assert.equal(dcaLegIsRunning("idle"), false);
assert.equal(dcaLegIsRunning("armed"), true);
assert.equal(dcaLegIsRunning("stop_adding"), true);
assert.equal(
  dcaWebhookSignalApplies({
    startKind: "webhook",
    fromSignal: true,
    status: "idle",
  }),
  false,
);
assert.equal(
  dcaWebhookSignalApplies({
    startKind: "webhook",
    fromSignal: true,
    status: "armed",
  }),
  true,
);
assert.equal(
  dcaWebhookSignalApplies({
    startKind: "webhook",
    fromSignal: false,
    status: "idle",
  }),
  true,
);
assert.equal(
  parseDcaPlaybookId("11111111-1111-1111-1111-111111111111"),
  "11111111-1111-1111-1111-111111111111",
);
assert.equal(parseDcaPlaybookId("nope"), null);
assert.equal(parseDcaSaveIntent("arm"), "arm");
assert.equal(parseDcaSaveIntent("save"), "save");
assert.equal(parseDcaSaveIntent(""), "save");
assert.equal(
  dcaPlaybookConflict(
    [{ id: "a", symbol: "BTCUSDT" }],
    { symbol: "BTCUSDT" },
  ),
  true,
);
assert.equal(
  dcaPlaybookConflict(
    [{ id: "a", symbol: "BTCUSDT" }],
    { id: "a", symbol: "BTCUSDT" },
  ),
  false,
);
assert.equal(
  dcaPlaybookConflict(
    [{ id: "a", symbol: "BTCUSDT" }],
    { symbol: "ETHUSDT" },
  ),
  false,
);
assert.equal(dcaCopyName("DCA Test"), "DCA Test (copy)");
assert.equal(dcaCopyName("DCA Test (copy)"), "DCA Test (copy)");
assert.equal(dcaCopyName("A".repeat(40)).length, 40);
assert.equal(dcaCopyName("A".repeat(40)).endsWith(" (copy)"), true);

assert.equal(
  dcaDipMet({ side: "long", lastPrice: 98, lastClipPrice: 100, dipPct: 2 }),
  true,
);
assert.equal(
  dcaDipMet({ side: "long", lastPrice: 99, lastClipPrice: 100, dipPct: 2 }),
  false,
);
assert.equal(
  dcaDipMet({ side: "short", lastPrice: 102, lastClipPrice: 100, dipPct: 2 }),
  true,
);

assert.equal(
  dcaIntervalMet({ nowMs: 120_000, lastClipAtMs: 0, intervalMinutes: 1 }),
  true,
);
assert.equal(
  dcaIntervalMet({ nowMs: 30_000, lastClipAtMs: 0, intervalMinutes: 1 }),
  false,
);

assert.equal(
  dcaCapHit({
    clipsFilled: 3,
    maxClips: 3,
    maxValue: null,
    markValue: null,
  }),
  true,
);
assert.equal(
  dcaCapHit({
    clipsFilled: 1,
    maxClips: 3,
    maxValue: 1000,
    markValue: 1000,
  }),
  true,
);

assert.equal(
  dcaClipsFilledFromGrid({
    hasFirstFill: true,
    maxClips: 10,
    openWorking: 0,
    filledAdds: 0,
  }),
  1,
);
assert.equal(
  dcaClipsFilledFromGrid({
    hasFirstFill: true,
    maxClips: 10,
    openWorking: 9,
    filledAdds: 0,
  }),
  1,
);
assert.equal(
  dcaClipsFilledFromGrid({
    hasFirstFill: true,
    maxClips: 10,
    openWorking: 0,
    filledAdds: 9,
  }),
  10,
);
assert.equal(
  dcaClipsFilledFromGrid({
    hasFirstFill: true,
    maxClips: 10,
    openWorking: 19,
    filledAdds: 0,
  }),
  1,
);
assert.equal(
  dcaGridClipCounts(
    [
      { status: "open", idempotencyKey: dcaClipKey(safetyId, "long", 1) },
      { status: "filled", idempotencyKey: dcaClipKey(safetyId, "long", 2) },
    ],
    safetyId,
    "long",
  ).filledAdds,
  1,
);
assert.equal(
  dcaCycleEnded({
    status: "stop_adding",
    clipsFilled: 10,
    positionQty: null,
  }),
  true,
);
assert.equal(
  dcaCycleEnded({
    status: "armed",
    clipsFilled: 2,
    positionQty: 1,
  }),
  false,
);
assert.equal(
  dcaCycleEnded({
    status: "idle",
    clipsFilled: 2,
    positionQty: null,
  }),
  false,
);
assert.equal(
  dcaCycleEnded({
    status: "armed",
    clipsFilled: 1,
    positionQty: 1120,
  }),
  false,
);
assert.equal(dcaLiveQtyBlocksCycleEnd(1120), true);
assert.equal(dcaLiveQtyBlocksCycleEnd(null), false);
assert.equal(dcaLiveQtyBlocksCycleEnd(0), false);
assert.equal(
  dcaPnlPct({ side: "long", qty: 1, entryPrice: 100, mark: 110 }),
  10,
);
assert.equal(
  dcaPnlPct({ side: "short", qty: 1, entryPrice: 100, mark: 90 }),
  10,
);

const prices = { last: 100, mark: 100, index: 100 };
const base = {
  side: "long" as const,
  reduceOnly: false,
  lastPrice: 100,
  mark: 100,
  lastClipPrice: 100,
  lastClipAtMs: 0,
  nowMs: 1_000,
  dipPct: 2,
  intervalMinutes: null as number | null,
  clipsFilled: 1,
  maxClips: 5 as number | null,
  maxValue: null as number | null,
  positionQty: 1 as number | null,
  entryPrice: 100 as number | null,
  takeProfitPct: 10 as number | null,
  stopLossPct: 5 as number | null,
  armTrigger: null,
  armConditionTrue: false,
  disarmTrigger: null,
  disarmConditionTrue: false,
  triggerPrices: prices,
};

assert.deepEqual(decideDcaTick({ ...base, status: "idle" }).action, {
  kind: "none",
});
assert.equal(
  decideDcaTick({
    ...base,
    status: "idle",
    armTrigger: { triggerBy: "last", compare: "gte", price: 100 },
    armConditionTrue: false,
  }).action.kind,
  "none",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    clipsFilled: 0,
    startKind: "price",
    armTrigger: { triggerBy: "last", compare: "gte", price: 100 },
  }).action.kind,
  "arm",
);
assert.equal(
  decideDcaTick({
    ...base,
    side: "short",
    status: "armed",
    clipsFilled: 0,
    startKind: "price",
    splitIndicatorSides: true,
    armTrigger: { triggerBy: "last", compare: "gte", price: 100 },
  }).action.kind,
  "none",
);
assert.equal(
  decideDcaTick({
    ...base,
    side: "long",
    status: "armed",
    clipsFilled: 0,
    startKind: "price",
    splitIndicatorSides: true,
    armTrigger: { triggerBy: "last", compare: "gte", price: 100 },
  }).action.kind,
  "arm",
);
assert.equal(
  decideDcaTick({
    ...base,
    side: "long",
    status: "armed",
    clipsFilled: 0,
    startKind: "price",
    splitIndicatorSides: true,
    armTrigger: { triggerBy: "last", compare: "lte", price: 100 },
  }).action.kind,
  "none",
);
assert.equal(
  decideDcaTick({
    ...base,
    side: "short",
    status: "armed",
    clipsFilled: 0,
    startKind: "price",
    splitIndicatorSides: true,
    armTrigger: { triggerBy: "last", compare: "lte", price: 100 },
  }).action.kind,
  "arm",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    clipsFilled: 0,
    startKind: "webhook",
  }).action.kind,
  "none",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    clipsFilled: 0,
    startKind: "indicator",
    indicatorKind: "rsi",
    indicatorCompare: "cross_gte",
    indicatorLevel: 30,
    indicatorConditionTrue: true,
    closes: [],
  }).action.kind,
  "arm",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    clipsFilled: 0,
    startKind: "indicator",
    indicatorKind: "rsi",
    indicatorCompare: "cross_gte",
    indicatorLevel: 30,
    indicatorConditionTrue: false,
    closes: [],
  }).action.kind,
  "none",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    clipsFilled: 0,
    startKind: "indicator",
    indicatorKind: "rsi",
    indicatorCompare: "cross_gte",
    indicatorLevel: 30,
    indicatorConditionTrue: true,
    closes: [],
  }).nextIndicatorTrue,
  true,
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    lastPrice: 97,
  }).action.kind,
  "clip",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    lastPrice: 97,
    dcaMode: "order",
  }).action.kind,
  "none",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    mark: 89,
  }).action.kind,
  "close",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    mark: 111,
  }).action.kind,
  "close",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    mark: 111,
    takeProfitOrderType: "limit",
    tpLimitResting: true,
  }).action.kind,
  "none",
);
assert.deepEqual(
  decideDcaTick({
    ...base,
    status: "armed",
    mark: 111,
    takeProfitOrderType: "limit",
    tpLimitResting: false,
  }).action,
  { kind: "close", reason: "take_profit" },
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    firstFillPrice: 100,
    entryPrice: 90,
    mark: 95,
    takeProfitPct: 6,
    takeProfitBasis: "first_entry",
  }).action.kind,
  "none",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    firstFillPrice: 100,
    entryPrice: 90,
    mark: 107,
    takeProfitPct: 6,
    takeProfitBasis: "first_entry",
  }).action.kind,
  "close",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    mark: 103,
    breakevenActivationPct: 2,
    breakevenDone: false,
  }).action.kind,
  "breakeven",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    clipsFilled: 5,
  }).action.kind,
  "stop_adding",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    lastPrice: 97,
    reduceOnly: true,
  }).action.kind,
  "none",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "stop_adding",
    lastPrice: 97,
  }).action.kind,
  "none",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "stop_adding",
    clipsFilled: 10,
    positionQty: null,
  }).action.kind,
  "end_cycle",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    clipsFilled: 3,
    positionQty: null,
  }).action.kind,
  "end_cycle",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    takeProfitPct: 1.4,
    takeProfitOrderType: "limit",
    tpLimitResting: true,
    mark: 100.01,
  }).action.kind,
  "none",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    clipsFilled: 1,
    positionQty: null,
  }).action.kind,
  "end_cycle",
);
assert.equal(
  decideDcaTick({
    ...base,
    status: "armed",
    disarmTrigger: { triggerBy: "last", compare: "lte", price: 100 },
    disarmConditionTrue: false,
  }).action.kind,
  "disarm",
);

const form = new FormData();
form.set("symbol", "BTCUSDT");
form.set("side", "long");
form.set("clipSize", "0.01");
form.set("sizeUnit", "qty");
const parsed = parseDcaPlaybookForm(form);
assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.equal(parsed.config.name, DEFAULT_DCA_NAME);
  assert.equal(parsed.config.symbol, "BTCUSDT");
  assert.equal(parsed.config.direction, "long");
  assert.equal(parsed.config.startKind, "immediate");
  assert.equal(parsed.config.dcaMode, "position");
  assert.equal(parsed.config.sizeMultiplier, 1);
  assert.equal(parsed.config.takeProfitOrderType, "market");
  assert.equal(parsed.config.stopLossOrderType, "market");
}

const tpLimitForm = new FormData();
tpLimitForm.set("symbol", "BTCUSDT");
tpLimitForm.set("side", "long");
tpLimitForm.set("clipSize", "0.01");
tpLimitForm.set("sizeUnit", "qty");
tpLimitForm.set("takeProfitPct", "10");
tpLimitForm.set("takeProfitOrderType", "limit");
const tpLimitParsed = parseDcaPlaybookForm(tpLimitForm);
assert.equal(tpLimitParsed.ok, true);
if (tpLimitParsed.ok) {
  assert.equal(tpLimitParsed.config.takeProfitOrderType, "limit");
}

const bothForm = new FormData();
bothForm.set("symbol", "ETHUSDT");
bothForm.set("direction", "both");
bothForm.set("clipSize", "100");
bothForm.set("sizeUnit", "usdt");
bothForm.set("startKind", "webhook");
bothForm.set("webhookId", "11111111-1111-1111-1111-111111111111");
bothForm.set("dcaMode", "order");
bothForm.set("dipPct", "1");
bothForm.set("maxClips", "5");
bothForm.set("sizeMultiplier", "2");
const bothParsed = parseDcaPlaybookForm(bothForm);
assert.equal(bothParsed.ok, true);
if (bothParsed.ok) {
  assert.equal(bothParsed.config.direction, "both");
  assert.equal(bothParsed.config.startKind, "webhook");
  assert.equal(bothParsed.config.dcaMode, "order");
  assert.equal(bothParsed.config.sizeMultiplier, 2);
}

const bothManual = new FormData();
bothManual.set("symbol", "BTCUSDT");
bothManual.set("direction", "both");
bothManual.set("clipSize", "100");
bothManual.set("sizeUnit", "usdt");
bothManual.set("startKind", "immediate");
const bothManualParsed = parseDcaPlaybookForm(bothManual);
assert.equal(bothManualParsed.ok, true);
if (bothManualParsed.ok) {
  assert.equal(bothManualParsed.config.direction, "both");
  assert.equal(bothManualParsed.config.startKind, "immediate");
}

assert.equal(
  dcaAveragingKind({
    dcaMode: "order",
    dipPct: 1,
    intervalMinutes: 15,
  }),
  "dip",
);
assert.equal(
  dcaAveragingKind({
    dcaMode: "position",
    dipPct: 2,
    intervalMinutes: 15,
  }),
  "dip",
);
assert.equal(
  dcaAveragingKind({
    dcaMode: "position",
    dipPct: null,
    intervalMinutes: 15,
  }),
  "interval",
);

const intervalForm = new FormData();
intervalForm.set("symbol", "BTCUSDT");
intervalForm.set("side", "long");
intervalForm.set("clipSize", "0.01");
intervalForm.set("sizeUnit", "qty");
intervalForm.set("averaging", "interval");
intervalForm.set("intervalMinutes", "15");
intervalForm.set("dipPct", "2");
const intervalParsed = parseDcaPlaybookForm(intervalForm);
assert.equal(intervalParsed.ok, true);
if (intervalParsed.ok) {
  assert.equal(intervalParsed.config.dcaMode, "position");
  assert.equal(intervalParsed.config.intervalMinutes, 15);
  assert.equal(intervalParsed.config.dipPct, null);
  assert.equal(dcaAveragingKind(intervalParsed.config), "interval");
}

const intervalHours = new FormData();
intervalHours.set("symbol", "BTCUSDT");
intervalHours.set("side", "long");
intervalHours.set("clipSize", "0.01");
intervalHours.set("sizeUnit", "qty");
intervalHours.set("averaging", "interval");
intervalHours.set("intervalUnit", "hours");
intervalHours.set("intervalValue", "2");
const intervalHoursParsed = parseDcaPlaybookForm(intervalHours);
assert.equal(intervalHoursParsed.ok, true);
if (intervalHoursParsed.ok) {
  assert.equal(intervalHoursParsed.config.intervalMinutes, 120);
}

const intervalDays = new FormData();
intervalDays.set("symbol", "BTCUSDT");
intervalDays.set("side", "long");
intervalDays.set("clipSize", "0.01");
intervalDays.set("sizeUnit", "qty");
intervalDays.set("averaging", "interval");
intervalDays.set("intervalUnit", "days");
intervalDays.set("intervalValue", "1");
const intervalDaysParsed = parseDcaPlaybookForm(intervalDays);
assert.equal(intervalDaysParsed.ok, true);
if (intervalDaysParsed.ok) {
  assert.equal(intervalDaysParsed.config.intervalMinutes, 1440);
}

assert.deepEqual(dcaIntervalParts(15), { unit: "minutes", value: "15" });
assert.deepEqual(dcaIntervalParts(120), { unit: "hours", value: "2" });
assert.deepEqual(dcaIntervalParts(1440), { unit: "days", value: "1" });

const dipForm = new FormData();
dipForm.set("symbol", "BTCUSDT");
dipForm.set("side", "long");
dipForm.set("clipSize", "0.01");
dipForm.set("sizeUnit", "qty");
dipForm.set("averaging", "dip");
dipForm.set("dipPct", "2");
dipForm.set("intervalMinutes", "15");
const dipParsed = parseDcaPlaybookForm(dipForm);
assert.equal(dipParsed.ok, true);
if (dipParsed.ok) {
  assert.equal(dipParsed.config.dcaMode, "position");
  assert.equal(dipParsed.config.dipPct, 2);
  assert.equal(dipParsed.config.intervalMinutes, null);
  assert.equal(dcaAveragingKind(dipParsed.config), "dip");
}

const gridForm = new FormData();
gridForm.set("symbol", "BTCUSDT");
gridForm.set("side", "long");
gridForm.set("clipSize", "0.01");
gridForm.set("sizeUnit", "qty");
gridForm.set("averaging", "dip");
gridForm.set("restGrid", "1");
gridForm.set("dipPct", "2");
gridForm.set("maxClips", "5");
const gridParsed = parseDcaPlaybookForm(gridForm);
assert.equal(gridParsed.ok, true);
if (gridParsed.ok) {
  assert.equal(gridParsed.config.dcaMode, "order");
  assert.equal(gridParsed.config.dipPct, 2);
  assert.equal(gridParsed.config.intervalMinutes, null);
  assert.equal(dcaAveragingKind(gridParsed.config), "dip");
}

const gridMissingMax = new FormData();
gridMissingMax.set("symbol", "BTCUSDT");
gridMissingMax.set("side", "long");
gridMissingMax.set("clipSize", "0.01");
gridMissingMax.set("sizeUnit", "qty");
gridMissingMax.set("averaging", "dip");
gridMissingMax.set("restGrid", "1");
gridMissingMax.set("dipPct", "2");
const gridMissingMaxParsed = parseDcaPlaybookForm(gridMissingMax);
assert.equal(gridMissingMaxParsed.ok, false);

const missingInterval = new FormData();
missingInterval.set("symbol", "BTCUSDT");
missingInterval.set("side", "long");
missingInterval.set("clipSize", "0.01");
missingInterval.set("sizeUnit", "qty");
missingInterval.set("averaging", "interval");
const missingIntervalParsed = parseDcaPlaybookForm(missingInterval);
assert.equal(missingIntervalParsed.ok, false);

assert.equal(dcaMaxTypeFromCaps(20, 50_000), "orders");
assert.equal(dcaMaxTypeFromCaps(null, 50_000), "value");
assert.equal(dcaMaxTypeFromCaps(null, null), "orders");

const ordersOnly = new FormData();
ordersOnly.set("symbol", "BTCUSDT");
ordersOnly.set("side", "long");
ordersOnly.set("clipSize", "50");
ordersOnly.set("sizeUnit", "usdt");
ordersOnly.set("maxType", "orders");
ordersOnly.set("maxClips", "20");
ordersOnly.set("maxValue", "50000");
const ordersOnlyParsed = parseDcaPlaybookForm(ordersOnly);
assert.equal(ordersOnlyParsed.ok, true);
if (ordersOnlyParsed.ok) {
  assert.equal(ordersOnlyParsed.config.maxClips, 20);
  assert.equal(ordersOnlyParsed.config.maxValue, null);
}

const valueOnly = new FormData();
valueOnly.set("symbol", "BTCUSDT");
valueOnly.set("side", "long");
valueOnly.set("clipSize", "50");
valueOnly.set("sizeUnit", "usdt");
valueOnly.set("maxType", "value");
valueOnly.set("maxClips", "20");
valueOnly.set("maxValue", "50000");
const valueOnlyParsed = parseDcaPlaybookForm(valueOnly);
assert.equal(valueOnlyParsed.ok, true);
if (valueOnlyParsed.ok) {
  assert.equal(valueOnlyParsed.config.maxClips, null);
  assert.equal(valueOnlyParsed.config.maxValue, 50000);
}

const bothCaps = new FormData();
bothCaps.set("symbol", "BTCUSDT");
bothCaps.set("side", "long");
bothCaps.set("sizeUnit", "usdt");
bothCaps.set("maxClips", "3");
bothCaps.set("maxValue", "700");
bothCaps.set("sizeMultiplier", "2");
const bothCapsParsed = parseDcaPlaybookForm(bothCaps);
assert.equal(bothCapsParsed.ok, true);
if (bothCapsParsed.ok) {
  assert.equal(bothCapsParsed.config.maxClips, 3);
  assert.equal(bothCapsParsed.config.maxValue, 700);
  assert.equal(bothCapsParsed.config.maxValueKind, "usdt");
  assert.equal(bothCapsParsed.config.clipSize, 100);
}

assert.equal(parseDcaMaxValueKind("percent"), "percent");
assert.equal(parseDcaMaxValueKind("usdt"), "usdt");
assert.equal(parseDcaMaxValueKind(""), "usdt");
assert.equal(
  dcaResolvedMaxValueUsdt({
    kind: "usdt",
    maxValue: 700,
    bookUsdt: 10_000,
  }),
  700,
);
assert.equal(
  dcaResolvedMaxValueUsdt({
    kind: "percent",
    maxValue: 20,
    bookUsdt: 10_000,
  }),
  2_000,
);
assert.equal(
  dcaResolvedMaxValueUsdt({
    kind: "percent",
    maxValue: 20,
    bookUsdt: null,
  }),
  null,
);
assert.equal(
  dcaTickValueCapUsdt({
    kind: "percent",
    maxValue: 20,
    cycleMaxValue: 2_400,
    bookUsdt: 20_000,
  }),
  2_400,
);
assert.equal(
  dcaCycleClipSize({
    kind: "percent",
    maxValue: 20,
    maxClips: 3,
    clipSize: 50,
    sizeMultiplier: 2,
    sizeUnit: "usdt",
    bookUsdt: 10_000,
  }).clipSize,
  2000 / 7,
);
assert.equal(
  dcaCopyEstimateClipSize({
    maxValueKind: "percent",
    maxValue: 20,
    maxClips: 3,
    clipSize: 50,
    sizeMultiplier: 2,
    sizeUnit: "usdt",
    long: { clipsFilled: 0, cycleMaxValue: null },
    short: { clipsFilled: 0, cycleMaxValue: null },
    bookUsdt: 10_000,
  }),
  2000 / 7,
);
assert.equal(
  dcaCopyEstimateClipSize({
    maxValueKind: "percent",
    maxValue: 20,
    maxClips: 3,
    clipSize: 50,
    sizeMultiplier: 2,
    sizeUnit: "usdt",
    long: { clipsFilled: 2, cycleMaxValue: 2_000 },
    short: { clipsFilled: 0, cycleMaxValue: null },
    bookUsdt: 20_000,
  }),
  50,
);

const percentCaps = new FormData();
percentCaps.set("symbol", "BTCUSDT");
percentCaps.set("side", "long");
percentCaps.set("sizeUnit", "usdt");
percentCaps.set("maxClips", "3");
percentCaps.set("maxValue", "20");
percentCaps.set("maxValueKind", "percent");
percentCaps.set("accountBookUsdt", "10000");
percentCaps.set("sizeMultiplier", "2");
const percentCapsParsed = parseDcaPlaybookForm(percentCaps);
assert.equal(percentCapsParsed.ok, true);
if (percentCapsParsed.ok) {
  assert.equal(percentCapsParsed.config.maxValue, 20);
  assert.equal(percentCapsParsed.config.maxValueKind, "percent");
  assert.equal(percentCapsParsed.config.clipSize, 2000 / 7);
}

const percentOverBook = new FormData();
percentOverBook.set("symbol", "BTCUSDT");
percentOverBook.set("side", "long");
percentOverBook.set("sizeUnit", "usdt");
percentOverBook.set("clipSize", "50");
percentOverBook.set("maxValue", "200");
percentOverBook.set("maxValueKind", "percent");
const percentOverBookParsed = parseDcaPlaybookForm(percentOverBook);
assert.equal(percentOverBookParsed.ok, true);
if (percentOverBookParsed.ok) {
  assert.equal(percentOverBookParsed.config.maxValue, 200);
  assert.equal(percentOverBookParsed.config.maxValueKind, "percent");
}

const percentTooHigh = new FormData();
percentTooHigh.set("symbol", "BTCUSDT");
percentTooHigh.set("side", "long");
percentTooHigh.set("sizeUnit", "usdt");
percentTooHigh.set("clipSize", "50");
percentTooHigh.set("maxValue", "10001");
percentTooHigh.set("maxValueKind", "percent");
const percentTooHighParsed = parseDcaPlaybookForm(percentTooHigh);
assert.equal(percentTooHighParsed.ok, false);
if (!percentTooHighParsed.ok) {
  assert.equal(
    percentTooHighParsed.error,
    "Percent of account must be 10,000 or less.",
  );
}

const noneCap = new FormData();
noneCap.set("symbol", "BTCUSDT");
noneCap.set("side", "long");
noneCap.set("clipSize", "50");
noneCap.set("sizeUnit", "usdt");
noneCap.set("maxValueKind", "none");
noneCap.set("maxValue", "700");
const noneCapParsed = parseDcaPlaybookForm(noneCap);
assert.equal(noneCapParsed.ok, true);
if (noneCapParsed.ok) {
  assert.equal(noneCapParsed.config.maxValue, null);
  assert.equal(noneCapParsed.config.maxValueKind, "usdt");
}

const missingFixed = new FormData();
missingFixed.set("symbol", "BTCUSDT");
missingFixed.set("side", "long");
missingFixed.set("clipSize", "50");
missingFixed.set("sizeUnit", "usdt");
missingFixed.set("maxValueKind", "usdt");
const missingFixedParsed = parseDcaPlaybookForm(missingFixed);
assert.equal(missingFixedParsed.ok, false);
if (!missingFixedParsed.ok) {
  assert.equal(missingFixedParsed.error, "Enter a max value.");
}

const missingPercent = new FormData();
missingPercent.set("symbol", "BTCUSDT");
missingPercent.set("side", "long");
missingPercent.set("clipSize", "50");
missingPercent.set("sizeUnit", "usdt");
missingPercent.set("maxValueKind", "percent");
const missingPercentParsed = parseDcaPlaybookForm(missingPercent);
assert.equal(missingPercentParsed.ok, false);
if (!missingPercentParsed.ok) {
  assert.equal(missingPercentParsed.error, "Enter a max value.");
}

const row = parseDcaPlaybookRow({
  id: "pb-1",
  user_id: "user-1",
  account_id: "acc-1",
  name: "Desk DCA",
  symbol: "BTCUSDT",
  direction: "long",
  clip_size: "0.01",
  size_unit: "qty",
  long_status: "armed",
  long_clips_filled: 2,
  long_last_clip_price: "100",
  long_last_clip_at: "2026-08-27T00:00:00.000Z",
  long_first_fill_price: "101",
});
assert.equal(row?.name, "Desk DCA");
assert.equal(row?.direction, "long");
assert.equal(row?.long.clipsFilled, 2);
assert.equal(row?.long.status, "armed");
assert.equal(row?.long.firstFillPrice, 101);
assert.equal(row?.maxValueKind, "usdt");
assert.equal(row?.long.cycleMaxValue, null);
assert.ok(row);
assert.equal(dcaPlaybookIsRunning(row), true);
const cloned = dcaCloneIdleDraft(row);
assert.equal(cloned.name, "Desk DCA (copy)");
assert.equal(cloned.id, "");
assert.equal(cloned.symbol, row.symbol);
assert.equal(cloned.clipSize, row.clipSize);
assert.equal(cloned.long.status, "idle");
assert.equal(cloned.short.status, "idle");
assert.equal(cloned.long.clipsFilled, 0);
assert.equal(cloned.maxValueKind, "usdt");
assert.equal(cloned.long.cycleMaxValue, null);
assert.equal(cloned.armConditionTrue, false);
assert.equal(dcaPlaybookIsRunning(cloned), false);
assert.equal(dcaPlaybookHasOpenCycle(row), false);
assert.equal(dcaPlaybookHasOpenCycle(cloned), false);
assert.equal(dcaPlaybookHasOpenCycle(row, []), false);
assert.equal(
  dcaPlaybookHasOpenCycle({ ...row, symbol: "" }, [
    { symbol: "", side: "long", qty: 1 },
  ]),
  false,
);
assert.equal(
  dcaPlaybookHasOpenCycle(row, [
    { symbol: row.symbol, side: "long", qty: 1 },
  ]),
  true,
);
assert.equal(
  dcaPlaybookHasOpenCycle(row, [
    { symbol: "ETHUSDT", side: "long", qty: 1 },
  ]),
  false,
);
assert.equal(
  dcaPlaybookHasOpenCycle({
    direction: "long",
    long: {
      status: "armed",
      clipsFilled: 0,
      lastClipPrice: null,
      lastClipAtMs: null,
      firstFillPrice: null,
      breakevenDone: false,
      cycleMaxValue: null,
    },
    short: {
      status: "idle",
      clipsFilled: 0,
      lastClipPrice: null,
      lastClipAtMs: null,
      firstFillPrice: null,
      breakevenDone: false,
      cycleMaxValue: null,
    },
  }),
  false,
);
if (row) {
  const locked = dcaWithLockedCycleConfig(
    {
      ...row,
      symbol: "ETHUSDT",
      clipSize: 99,
      takeProfitPct: 4,
      stopLossPct: 2,
      trailingPct: 1,
    },
    row,
  );
  assert.equal(locked.symbol, row.symbol);
  assert.equal(locked.clipSize, row.clipSize);
  assert.equal(locked.takeProfitPct, 4);
  assert.equal(locked.stopLossPct, 2);
  assert.equal(locked.trailingPct, 1);
  assert.equal(locked.name, row.name);
  const exitOnly = new FormData();
  exitOnly.set("name", row.name);
  exitOnly.set("takeProfitPct", "4");
  exitOnly.set("stopLossPct", "2");
  exitOnly.set("takeProfitBasis", "first_entry");
  const fromMissingCycle = parseDcaPlaybookForm(exitOnly);
  assert.equal(fromMissingCycle.ok, false);
  const restored = resolveDcaSaveConfig(exitOnly, "bybit", row, [
    { symbol: row.symbol, side: "long", qty: 1 },
  ]);
  assert.equal(restored.ok, true);
  if (restored.ok) {
    assert.equal(restored.cycleLocked, true);
    assert.equal(restored.config.symbol, row.symbol);
    assert.equal(restored.config.clipSize, row.clipSize);
    assert.equal(restored.config.takeProfitPct, 4);
    assert.equal(restored.config.stopLossPct, 2);
    assert.equal(restored.config.takeProfitBasis, "first_entry");
  }
}
assert.equal(
  dcaPlaybookIsRunning({
    long: {
      status: "idle",
      clipsFilled: 0,
      lastClipPrice: null,
      lastClipAtMs: null,
      firstFillPrice: null,
      breakevenDone: false,
      cycleMaxValue: null,
    },
    short: {
      status: "idle",
      clipsFilled: 0,
      lastClipPrice: null,
      lastClipAtMs: null,
      firstFillPrice: null,
      breakevenDone: false,
      cycleMaxValue: null,
    },
  }),
  false,
);

assert.equal(
  formatDcaNextAdd({
    status: "stop_adding",
    dipPct: 2,
    intervalMinutes: 15,
    lastClipAtMs: 0,
    nowMs: 0,
  }),
  "Stopped",
);
assert.equal(
  formatDcaOrdersProgress({ filled: 1, maxClips: 20 }),
  "1/20",
);
assert.equal(
  formatDcaOrdersProgress({ filled: 2, maxClips: null }),
  "2",
);
assert.equal(dcaFilledClipCount(undefined), null);
assert.equal(dcaFilledClipCount([{ action: "buy" }, { action: "flatten" }]), 1);
assert.equal(
  formatDcaRemaining({
    clipsFilled: 2,
    maxClips: 5,
    maxValue: 1000,
    markValue: 400,
  }),
  "3 orders · $600",
);
assert.equal(
  formatDcaNextAdd({
    status: "armed",
    clipsFilled: 1,
    dipPct: null,
    intervalMinutes: null,
    lastClipAtMs: 1,
    nowMs: 2,
  }),
  "Wait for TP/SL",
);
assert.equal(
  formatDcaNextAdd({
    status: "armed",
    clipsFilled: 0,
    startKind: "webhook",
    dipPct: null,
    intervalMinutes: null,
    lastClipAtMs: null,
    nowMs: 0,
  }),
  "Waiting for signal",
);
assert.equal(
  dcaOpenHint({
    playbook: row as DcaPlaybook,
    symbol: "ETHUSDT",
    side: "long",
  }),
  null,
);
assert.equal(
  dcaOpenHint({
    playbook: row as DcaPlaybook,
    symbol: "BTCUSDT",
    side: "long",
  })?.orders,
  "2",
);
assert.equal(
  dcaOpenHint({
    playbook: row as DcaPlaybook,
    symbol: "BTCUSDT",
    side: "long",
  })?.playbookId,
  (row as DcaPlaybook).id,
);
assert.equal(
  dcaHintsForOpen(
    [row as DcaPlaybook],
    [{ symbol: "BTCUSDT", side: "long" }],
  )["BTCUSDT:long"]?.orders,
  "2",
);
const copyHintPlaybook = parseDcaPlaybookRow({
  id: "pb-copy",
  user_id: "user-1",
  account_id: "acc-parent",
  name: "Parent DCA",
  symbol: "BTCUSDT",
  direction: "long",
  clip_size: "0.01",
  size_unit: "qty",
  max_clips: 8,
  long_status: "idle",
});
assert.ok(copyHintPlaybook);
assert.equal(
  dcaHintsForCopyOpen(
    [copyHintPlaybook],
    [
      {
        symbol: "BTCUSDT",
        side: "long",
        orders: [{ action: "buy" }, { action: "buy" }],
      },
    ],
  )["BTCUSDT:long"]?.orders,
  "2/8",
);
const capped = parseDcaPlaybookRow({
  id: "pb-1",
  user_id: "user-1",
  account_id: "acc-1",
  name: "Desk DCA",
  symbol: "BTCUSDT",
  direction: "long",
  clip_size: "0.01",
  size_unit: "qty",
  max_clips: 20,
  long_status: "armed",
  long_clips_filled: 19,
  long_last_clip_price: "100",
  long_last_clip_at: "2026-08-27T00:00:00.000Z",
  long_first_fill_price: "101",
});
assert.ok(capped);
assert.equal(
  dcaOpenHint({
    playbook: capped,
    symbol: "BTCUSDT",
    side: "long",
    orders: [{ action: "buy" }],
  })?.orders,
  "1/20",
);
const withExit = parseDcaPlaybookRow({
  id: "pb-1",
  user_id: "user-1",
  account_id: "acc-1",
  name: "Desk DCA",
  symbol: "BTCUSDT",
  direction: "long",
  clip_size: "0.01",
  size_unit: "qty",
  take_profit_pct: 10,
  stop_loss_pct: 5,
  take_profit_order_type: "limit",
  long_status: "armed",
  long_clips_filled: 1,
  long_last_clip_price: "100",
  long_last_clip_at: "2026-08-27T00:00:00.000Z",
  long_first_fill_price: "100",
});
assert.ok(withExit);
assert.equal(withExit.takeProfitOrderType, "limit");
assert.equal(
  dcaOpenHint({
    playbook: withExit,
    symbol: "BTCUSDT",
    side: "long",
    entryPrice: 100,
    mark: 100,
  })?.plannedTakeProfit,
  100 * (1 + 10 / 100),
);
assert.equal(
  dcaOpenHint({
    playbook: withExit,
    symbol: "BTCUSDT",
    side: "long",
  })?.tpLimitResting,
  false,
);

const uuidExit = parseDcaPlaybookRow({
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "user-1",
  account_id: "acc-1",
  name: "Desk DCA",
  symbol: "BTCUSDT",
  direction: "long",
  clip_size: "0.01",
  size_unit: "qty",
  take_profit_pct: "10",
  take_profit_order_type: "limit",
  long_status: "armed",
  long_clips_filled: 1,
  long_first_fill_price: "100",
});
assert.ok(uuidExit);
assert.equal(
  dcaOpenHint({
    playbook: uuidExit,
    symbol: "BTCUSDT",
    side: "long",
    working: [
      {
        idempotencyKey: dcaExitLimitRestKey(
          uuidExit.id,
          "long",
          "tp",
          0.01,
          110,
        ),
        status: "open",
      },
    ],
  })?.tpLimitResting,
  true,
);

const emptyTpsl = emptyFuturesTpsl();
assert.equal(
  dcaExitTpslNeedsVenueSync(emptyTpsl, {
    ...emptyTpsl,
    takeProfit: 2.5,
    tpOrderType: "limit",
    tpLimitPrice: 2.5,
  }),
  false,
);
assert.equal(
  dcaExitTpslNeedsVenueSync(emptyTpsl, {
    ...emptyTpsl,
    stopLoss: 1.5,
  }),
  true,
);
assert.equal(
  dcaExitTpslNeedsVenueSync(
    { ...emptyTpsl, takeProfit: 2.4, tpOrderType: "market" },
    { ...emptyTpsl, takeProfit: 2.5, tpOrderType: "market" },
  ),
  true,
);
assert.equal(
  dcaExitTpslNeedsVenueSync(
    {
      ...emptyTpsl,
      takeProfit: 2.4,
      stopLoss: 1.5,
      tpOrderType: "limit",
      tpLimitPrice: 2.4,
    },
    {
      ...emptyTpsl,
      takeProfit: 2.6,
      stopLoss: 1.5,
      tpOrderType: "limit",
      tpLimitPrice: 2.6,
    },
  ),
  false,
);

const indicatorDaily = new FormData();
indicatorDaily.set("symbol", "BTCUSDT");
indicatorDaily.set("side", "long");
indicatorDaily.set("clipSize", "0.01");
indicatorDaily.set("sizeUnit", "qty");
indicatorDaily.set("startKind", "indicator");
indicatorDaily.set("indicatorKind", "rsi");
indicatorDaily.set("indicatorTimeframe", "D");
indicatorDaily.set("indicatorCompare", "lte");
indicatorDaily.set("indicatorLevel", "30");
const indicatorDailyParsed = parseDcaPlaybookForm(indicatorDaily);
assert.equal(indicatorDailyParsed.ok, true);
if (indicatorDailyParsed.ok) {
  assert.equal(indicatorDailyParsed.config.indicatorKind, "rsi");
  assert.equal(indicatorDailyParsed.config.indicatorTimeframe, "D");
}

const rsiCrossForm = new FormData();
rsiCrossForm.set("symbol", "BTCUSDT");
rsiCrossForm.set("side", "long");
rsiCrossForm.set("clipSize", "0.01");
rsiCrossForm.set("sizeUnit", "qty");
rsiCrossForm.set("startKind", "indicator");
rsiCrossForm.set("indicatorKind", "rsi");
rsiCrossForm.set("indicatorTimeframe", "15");
rsiCrossForm.set("indicatorCompare", "cross_lte");
rsiCrossForm.set("indicatorLevel", "30");
const rsiCrossParsed = parseDcaPlaybookForm(rsiCrossForm);
assert.equal(rsiCrossParsed.ok, true);
if (rsiCrossParsed.ok) {
  assert.equal(rsiCrossParsed.config.indicatorCompare, "cross_lte");
}

const bothRsiForm = new FormData();
bothRsiForm.set("symbol", "BTCUSDT");
bothRsiForm.set("direction", "both");
bothRsiForm.set("clipSize", "0.01");
bothRsiForm.set("sizeUnit", "qty");
bothRsiForm.set("startKind", "indicator");
bothRsiForm.set("indicatorKind", "rsi");
bothRsiForm.set("indicatorTimeframe", "15");
bothRsiForm.set("indicatorCompare", "cross_lte");
bothRsiForm.set("indicatorLevel", "30");
bothRsiForm.set("shortIndicatorKind", "rsi");
bothRsiForm.set("shortIndicatorTimeframe", "15");
bothRsiForm.set("shortIndicatorCompare", "cross_gte");
bothRsiForm.set("shortIndicatorLevel", "70");
const bothRsiParsed = parseDcaPlaybookForm(bothRsiForm);
assert.equal(bothRsiParsed.ok, true);
if (bothRsiParsed.ok) {
  assert.equal(bothRsiParsed.config.indicatorLevel, 30);
  assert.equal(bothRsiParsed.config.shortIndicatorLevel, 70);
  assert.equal(bothRsiParsed.config.indicatorCompare, "cross_lte");
  assert.equal(bothRsiParsed.config.shortIndicatorCompare, "cross_gte");
}

const bothRsiMissing = new FormData();
bothRsiMissing.set("symbol", "BTCUSDT");
bothRsiMissing.set("direction", "both");
bothRsiMissing.set("clipSize", "0.01");
bothRsiMissing.set("sizeUnit", "qty");
bothRsiMissing.set("startKind", "indicator");
bothRsiMissing.set("indicatorKind", "rsi");
bothRsiMissing.set("indicatorTimeframe", "15");
bothRsiMissing.set("indicatorCompare", "cross_lte");
bothRsiMissing.set("indicatorLevel", "30");
const bothRsiMissingParsed = parseDcaPlaybookForm(bothRsiMissing);
assert.equal(bothRsiMissingParsed.ok, false);

const macdCrossForm = new FormData();
macdCrossForm.set("symbol", "BTCUSDT");
macdCrossForm.set("side", "long");
macdCrossForm.set("clipSize", "0.01");
macdCrossForm.set("sizeUnit", "qty");
macdCrossForm.set("startKind", "indicator");
macdCrossForm.set("indicatorKind", "macd");
macdCrossForm.set("indicatorTimeframe", "60");
macdCrossForm.set("indicatorCompare", "cross_gte");
const macdCrossParsed = parseDcaPlaybookForm(macdCrossForm);
assert.equal(macdCrossParsed.ok, true);
if (macdCrossParsed.ok) {
  assert.equal(macdCrossParsed.config.indicatorCompare, "cross_gte");
  assert.equal(macdCrossParsed.config.indicatorLevel, null);
}

const emaLevelForm = new FormData();
emaLevelForm.set("symbol", "BTCUSDT");
emaLevelForm.set("side", "long");
emaLevelForm.set("clipSize", "0.01");
emaLevelForm.set("sizeUnit", "qty");
emaLevelForm.set("startKind", "indicator");
emaLevelForm.set("indicatorKind", "ema_cross");
emaLevelForm.set("indicatorTimeframe", "240");
emaLevelForm.set("indicatorCompare", "cross_gte");
emaLevelForm.set("indicatorLevel", "80000");
const emaLevelParsed = parseDcaPlaybookForm(emaLevelForm);
assert.equal(emaLevelParsed.ok, true);
if (emaLevelParsed.ok) {
  assert.equal(emaLevelParsed.config.indicatorCompare, "cross_gte");
  assert.equal(emaLevelParsed.config.indicatorLevel, 80000);
}

const indicatorBadTf = new FormData();
indicatorBadTf.set("symbol", "BTCUSDT");
indicatorBadTf.set("side", "long");
indicatorBadTf.set("clipSize", "0.01");
indicatorBadTf.set("sizeUnit", "qty");
indicatorBadTf.set("startKind", "indicator");
indicatorBadTf.set("indicatorKind", "rsi");
indicatorBadTf.set("indicatorTimeframe", "W");
indicatorBadTf.set("indicatorCompare", "lte");
indicatorBadTf.set("indicatorLevel", "30");
const indicatorBadTfParsed = parseDcaPlaybookForm(indicatorBadTf);
assert.equal(indicatorBadTfParsed.ok, false);

const hlForm = new FormData();
hlForm.set("deskVenue", "hyperliquid");
hlForm.set("symbol", "BTC");
hlForm.set("side", "long");
hlForm.set("clipSize", "0.01");
hlForm.set("sizeUnit", "qty");
const hlParsed = parseDcaPlaybookForm(hlForm, "hyperliquid");
assert.equal(hlParsed.ok, true);
if (hlParsed.ok) {
  assert.equal(hlParsed.config.symbol, "BTC");
  assert.equal(hlParsed.config.direction, "long");
}

const hlBoth = new FormData();
hlBoth.set("deskVenue", "hyperliquid");
hlBoth.set("symbol", "ETH");
hlBoth.set("direction", "both");
hlBoth.set("clipSize", "100");
hlBoth.set("sizeUnit", "usdt");
const hlBothParsed = parseDcaPlaybookForm(hlBoth, "hyperliquid");
assert.equal(hlBothParsed.ok, false);
if (!hlBothParsed.ok) {
  assert.match(hlBothParsed.error, /one-way/i);
}

assert.equal(dcaIndicatorStartLatches("rsi", "cross_gte"), true);
assert.equal(dcaIndicatorStartLatches("rsi", "lte"), false);
assert.equal(dcaIndicatorStartLatches("ema_cross", null), true);
assert.deepEqual(indicatorClosesForCross([1, 2, 3, 4]), [1, 2, 3]);

console.log("dca playbook checks passed");
