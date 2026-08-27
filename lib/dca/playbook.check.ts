import assert from "node:assert/strict";
import {
  dcaAveragingKind,
  dcaCapHit,
  dcaClipsFilledFromGrid,
  dcaClipAction,
  dcaClipKey,
  dcaClipRestKey,
  dcaCycleEnded,
  dcaGridClipCounts,
  dcaExitLimitKey,
  parseDcaClipIndex,
  parseDcaExitLimitKind,
  isDcaClipKey,
  isDcaExitLimitKey,
  planDcaSafetySync,
  formatDcaEntryType,
  dcaDipMet,
  dcaEnabledSides,
  dcaStartListens,
  dcaLegIsRunning,
  dcaWebhookSignalApplies,
  dcaHintsForOpen,
  dcaIntervalMet,
  dcaIntervalParts,
  dcaOpenHint,
  dcaPlaybookConflict,
  dcaPlaybookIsRunning,
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
  dcaMaxTypeFromCaps,
  type DcaPlaybook,
} from "./playbook";

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
assert.equal(dcaStartListens("immediate"), false);
assert.equal(dcaStartListens("price"), true);
assert.equal(dcaStartListens("webhook"), true);
assert.equal(dcaStartListens("indicator"), true);
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
assert.ok(row);
assert.equal(dcaPlaybookIsRunning(row), true);
assert.equal(
  dcaPlaybookIsRunning({
    long: {
      status: "idle",
      clipsFilled: 0,
      lastClipPrice: null,
      lastClipAtMs: null,
      firstFillPrice: null,
      breakevenDone: false,
    },
    short: {
      status: "idle",
      clipsFilled: 0,
      lastClipPrice: null,
      lastClipAtMs: null,
      firstFillPrice: null,
      breakevenDone: false,
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
  dcaHintsForOpen(
    [row as DcaPlaybook],
    [{ symbol: "BTCUSDT", side: "long" }],
  )["BTCUSDT:long"]?.orders,
  "2",
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

console.log("dca playbook checks passed");
