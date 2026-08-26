import assert from "node:assert/strict";
import {
  dcaCapHit,
  dcaClipAction,
  dcaDipMet,
  dcaIntervalMet,
  dcaPlaybookIsRunning,
  dcaOpenHint,
  dcaHintsForOpen,
  dcaPnlPct,
  decideDcaTick,
  DEFAULT_DCA_NAME,
  formatDcaNextAdd,
  formatDcaRemaining,
  parseDcaPlaybookForm,
  parseDcaPlaybookRow,
  parseDcaStatus,
} from "./playbook";

assert.equal(parseDcaStatus("armed"), "armed");
assert.equal(parseDcaStatus("stop_adding"), "stop_adding");
assert.equal(parseDcaStatus("nope"), "idle");
assert.equal(dcaClipAction("long"), "buy");
assert.equal(dcaClipAction("short"), "sell");
assert.equal(dcaPlaybookIsRunning("armed"), true);
assert.equal(dcaPlaybookIsRunning("stop_adding"), true);
assert.equal(dcaPlaybookIsRunning("idle"), false);

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
  "arm",
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
  assert.equal(parsed.config.side, "long");
}

const row = parseDcaPlaybookRow({
  id: "pb-1",
  user_id: "user-1",
  account_id: "acc-1",
  name: "Desk DCA",
  symbol: "BTCUSDT",
  side: "long",
  clip_size: "0.01",
  size_unit: "qty",
  status: "armed",
  clips_filled: 2,
  last_clip_price: "100",
  last_clip_at: "2026-08-27T00:00:00.000Z",
});
assert.equal(row?.name, "Desk DCA");
assert.equal(row?.clipsFilled, 2);
assert.equal(row?.status, "armed");
assert.ok(row);

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
    dipPct: null,
    intervalMinutes: null,
    lastClipAtMs: null,
    nowMs: 0,
  }),
  "First clip",
);
assert.equal(
  dcaOpenHint({
    playbook: row,
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
    playbook: row,
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
    row,
    [{ symbol: "BTCUSDT", side: "long", qty: 0.02, mark: 100 }],
    Date.parse("2026-08-27T00:10:00.000Z"),
  )["BTCUSDT:long"]?.clips,
  2,
);

console.log("dca playbook checks passed");
