import assert from "node:assert/strict";
import {
  dcaAveragingKind,
  dcaCapHit,
  dcaClipAction,
  dcaClipKey,
  dcaDipMet,
  dcaEnabledSides,
  dcaHintsForOpen,
  dcaIntervalMet,
  dcaOpenHint,
  dcaPlaybookConflict,
  dcaPlaybookIsRunning,
  dcaPnlPct,
  decideDcaTick,
  DEFAULT_DCA_NAME,
  formatDcaNextAdd,
  formatDcaRemaining,
  parseDcaPlaybookForm,
  parseDcaPlaybookId,
  parseDcaPlaybookRow,
  parseDcaStatus,
  type DcaPlaybook,
} from "./playbook";

assert.equal(parseDcaStatus("armed"), "armed");
assert.equal(parseDcaStatus("stop_adding"), "stop_adding");
assert.equal(parseDcaStatus("nope"), "idle");
assert.equal(dcaClipAction("long"), "buy");
assert.equal(dcaClipAction("short"), "sell");
assert.equal(dcaClipKey("11111111-1111-4111-8111-111111111111", "long", 2), "d11111111l2");
assert.deepEqual(dcaEnabledSides("both"), ["long", "short"]);
assert.equal(
  parseDcaPlaybookId("11111111-1111-1111-1111-111111111111"),
  "11111111-1111-1111-1111-111111111111",
);
assert.equal(parseDcaPlaybookId("nope"), null);
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
}

const bothForm = new FormData();
bothForm.set("symbol", "ETHUSDT");
bothForm.set("direction", "both");
bothForm.set("clipSize", "100");
bothForm.set("sizeUnit", "usdt");
bothForm.set("startKind", "webhook");
bothForm.set("webhookId", "11111111-1111-1111-1111-111111111111");
bothForm.set("dcaMode", "order");
bothForm.set("sizeMultiplier", "2");
const bothParsed = parseDcaPlaybookForm(bothForm);
assert.equal(bothParsed.ok, true);
if (bothParsed.ok) {
  assert.equal(bothParsed.config.direction, "both");
  assert.equal(bothParsed.config.startKind, "webhook");
  assert.equal(bothParsed.config.dcaMode, "order");
  assert.equal(bothParsed.config.sizeMultiplier, 2);
}

assert.equal(
  dcaAveragingKind({
    dcaMode: "order",
    dipPct: 1,
    intervalMinutes: 15,
  }),
  "order",
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

const missingInterval = new FormData();
missingInterval.set("symbol", "BTCUSDT");
missingInterval.set("side", "long");
missingInterval.set("clipSize", "0.01");
missingInterval.set("sizeUnit", "qty");
missingInterval.set("averaging", "interval");
const missingIntervalParsed = parseDcaPlaybookForm(missingInterval);
assert.equal(missingIntervalParsed.ok, false);

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
  formatDcaRemaining({
    clipsFilled: 2,
    maxClips: 5,
    maxValue: 1000,
    markValue: 400,
  }),
  "3 clips · $600",
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
    qty: 1,
    mark: 100,
    nowMs: 0,
  }),
  null,
);
assert.equal(
  dcaOpenHint({
    playbook: row as DcaPlaybook,
    symbol: "BTCUSDT",
    side: "long",
    qty: 0.02,
    mark: 100,
    nowMs: Date.parse("2026-08-27T00:10:00.000Z"),
  })?.clips,
  2,
);
assert.deepEqual(
  dcaHintsForOpen(
    [row as DcaPlaybook],
    [{ symbol: "BTCUSDT", side: "long", qty: 0.02, mark: 100 }],
    Date.parse("2026-08-27T00:10:00.000Z"),
  )["BTCUSDT:long"]?.clips,
  2,
);

console.log("dca playbook checks passed");
