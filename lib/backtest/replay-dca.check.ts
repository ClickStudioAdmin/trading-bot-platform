import assert from "node:assert/strict";
import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import { snapshotDcaRecipe } from "@/lib/templates/recipe";
import { canBacktestDcaRecipe, replayDcaPlaybook } from "./replay-dca";

const form = new FormData();
form.set("name", "Immediate long");
form.set("symbol", "BTCUSDT");
form.set("direction", "long");
form.set("startKind", "immediate");
form.set("clipSize", "1");
form.set("sizeUnit", "qty");
form.set("takeProfitPct", "10");
const parsed = parseDcaPlaybookForm(form);
assert.equal(parsed.ok, true);
if (!parsed.ok) {
  throw new Error("expected DCA parse");
}
const recipe = snapshotDcaRecipe(parsed.config);
assert.equal(canBacktestDcaRecipe(recipe).ok, true);
assert.equal(
  canBacktestDcaRecipe({
    ...recipe,
    clipSize: 0,
    maxClips: 3,
    maxValue: 20,
    maxValueKind: "percent",
  }).ok,
  true,
);
assert.equal(
  canBacktestDcaRecipe({ ...recipe, startKind: "webhook" }).ok,
  false,
);

const opened = replayDcaPlaybook({
  bars: [
    { timeMs: 1_000, open: 100, high: 100, low: 100, close: 100 },
    { timeMs: 2_000, open: 100, high: 101, low: 99, close: 100 },
  ],
  recipe,
  feeRate: 0,
  startingUsdt: 10_000,
});
assert.equal(opened.orders.length, 1);
assert.equal(opened.orders[0]?.action, "buy");
assert.equal(opened.orders[0]?.reason, "entry");
assert.equal(opened.orders[0]?.clipIndex, 1);
assert.equal(opened.orders[0]?.price, 100);
assert.equal(opened.stats.openSide, "long");
assert.equal(opened.stats.openQty, 1);
assert.equal(opened.stats.trades, 0);

const closed = replayDcaPlaybook({
  bars: [
    { timeMs: 1_000, open: 100, high: 100, low: 100, close: 100 },
    { timeMs: 2_000, open: 111, high: 111, low: 111, close: 111 },
  ],
  recipe,
  feeRate: 0,
  startingUsdt: 10_000,
});
assert.equal(closed.orders.length, 2);
assert.equal(closed.orders[0]?.action, "buy");
assert.equal(closed.orders[1]?.action, "flatten");
assert.equal(closed.orders[1]?.reason, "take_profit");
assert.equal(closed.orders[1]?.price, 111);
assert.equal(closed.stats.trades, 1);
assert.equal(closed.stats.openQty, 0);
assert.ok((closed.stats.realizedUsdt ?? 0) > 0);

function parseRecipe(direction: "long" | "short" | "both", extra?: FormData) {
  const row = extra ?? new FormData();
  row.set("name", `DCA ${direction}`);
  row.set("symbol", "BTCUSDT");
  row.set("direction", direction);
  if (!row.has("startKind")) {
    row.set("startKind", "immediate");
  }
  row.set("clipSize", "1");
  row.set("sizeUnit", "qty");
  const parsedRow = parseDcaPlaybookForm(row);
  assert.equal(parsedRow.ok, true);
  if (!parsedRow.ok) {
    throw new Error("expected DCA parse");
  }
  return snapshotDcaRecipe(parsedRow.config);
}

const bothImmediate = replayDcaPlaybook({
  bars: [
    { timeMs: 1_000, open: 100, high: 100, low: 100, close: 100 },
    { timeMs: 2_000, open: 100, high: 100, low: 100, close: 100 },
    { timeMs: 3_000, open: 100, high: 100, low: 100, close: 100 },
  ],
  recipe: parseRecipe("both"),
  feeRate: 0,
  startingUsdt: 10_000,
});
const bothEntries = bothImmediate.orders.filter(
  (row) => row.action === "buy" || row.action === "sell",
);
assert.equal(bothEntries.length, 1);
assert.equal(bothEntries[0]?.side, "long");
assert.equal(bothImmediate.stats.openSide, "long");
assert.ok(!bothImmediate.orders.some((row) => row.side === "short"));

const priceBoth = new FormData();
priceBoth.set("startKind", "price");
priceBoth.set("armTriggerBy", "last");
priceBoth.set("armCompare", "gte");
priceBoth.set("armPrice", "100");
const bothPrice = replayDcaPlaybook({
  bars: [
    { timeMs: 1_000, open: 100, high: 100, low: 100, close: 100 },
    { timeMs: 2_000, open: 101, high: 101, low: 101, close: 101 },
  ],
  recipe: parseRecipe("both", priceBoth),
  feeRate: 0,
  startingUsdt: 10_000,
});
assert.equal(
  bothPrice.orders.filter((row) => row.action === "buy" || row.action === "sell")
    .length,
  1,
);
assert.equal(bothPrice.orders[0]?.side, "long");
assert.ok(!bothPrice.orders.some((row) => row.side === "short"));

const percentForm = new FormData();
percentForm.set("name", "Compound");
percentForm.set("symbol", "BTCUSDT");
percentForm.set("direction", "long");
percentForm.set("startKind", "immediate");
percentForm.set("maxClips", "1");
percentForm.set("maxValue", "20");
percentForm.set("maxValueKind", "percent");
percentForm.set("accountBookUsdt", "10000");
percentForm.set("sizeUnit", "usdt");
percentForm.set("takeProfitPct", "10");
percentForm.set("sizeMultiplier", "1");
const percentParsed = parseDcaPlaybookForm(percentForm);
assert.equal(percentParsed.ok, true);
if (!percentParsed.ok) {
  throw new Error("expected percent DCA parse");
}
const compounded = replayDcaPlaybook({
  bars: [
    { timeMs: 1_000, open: 100, high: 100, low: 100, close: 100 },
    { timeMs: 2_000, open: 110, high: 110, low: 110, close: 110 },
    { timeMs: 3_000, open: 110, high: 110, low: 110, close: 110 },
  ],
  recipe: snapshotDcaRecipe(percentParsed.config),
  feeRate: 0,
  startingUsdt: 10_000,
});
const buys = compounded.orders.filter((row) => row.action === "buy");
assert.equal(buys.length, 2);
assert.equal(buys[0]?.qty, 20);
assert.ok(Math.abs((buys[1]?.qty ?? 0) - 2040 / 110) < 1e-8);

console.log("dca backtest replay checks passed");
