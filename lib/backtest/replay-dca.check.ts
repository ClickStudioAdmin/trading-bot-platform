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
priceBoth.set("shortArmTriggerBy", "last");
priceBoth.set("shortArmCompare", "lte");
priceBoth.set("shortArmPrice", "90");
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

const rsiBothForm = new FormData();
rsiBothForm.set("startKind", "indicator");
rsiBothForm.set("indicatorKind", "rsi");
rsiBothForm.set("indicatorTimeframe", "15");
rsiBothForm.set("indicatorCompare", "cross_lte");
rsiBothForm.set("indicatorLevel", "30");
rsiBothForm.set("shortIndicatorKind", "rsi");
rsiBothForm.set("shortIndicatorTimeframe", "15");
rsiBothForm.set("shortIndicatorCompare", "cross_gte");
rsiBothForm.set("shortIndicatorLevel", "70");
const rsiDumpCloses = [...Array(19).fill(100), 1];
const rsiBoth = replayDcaPlaybook({
  bars: rsiDumpCloses.map((close, index) => ({
    timeMs: (index + 1) * 60_000,
    open: close,
    high: close,
    low: close,
    close,
  })),
  recipe: parseRecipe("both", rsiBothForm),
  feeRate: 0,
  startingUsdt: 10_000,
});
const rsiBothStarts = rsiBoth.orders.filter(
  (row) => row.action === "buy" || row.action === "sell",
);
assert.equal(rsiBothStarts.length, 1);
assert.equal(rsiBothStarts[0]?.side, "long");
assert.ok(!rsiBoth.orders.some((row) => row.side === "short"));

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

const marginForm = new FormData();
marginForm.set("name", "Margin cap");
marginForm.set("symbol", "BTCUSDT");
marginForm.set("direction", "long");
marginForm.set("startKind", "immediate");
marginForm.set("maxClips", "1");
marginForm.set("maxValue", "100");
marginForm.set("maxValueKind", "margin");
marginForm.set("accountBookUsdt", "10000");
marginForm.set("accountLeverage", "10");
marginForm.set("sizeUnit", "usdt");
marginForm.set("sizeMultiplier", "1");
const marginParsed = parseDcaPlaybookForm(marginForm);
assert.equal(marginParsed.ok, true);
if (!marginParsed.ok) {
  throw new Error("expected margin DCA parse");
}
const marginReplay = replayDcaPlaybook({
  bars: [{ timeMs: 1_000, open: 100, high: 100, low: 100, close: 100 }],
  recipe: snapshotDcaRecipe(marginParsed.config),
  feeRate: 0,
  startingUsdt: 10_000,
  leverage: 10,
});
const marginBuys = marginReplay.orders.filter((row) => row.action === "buy");
assert.equal(marginBuys.length, 1);
assert.equal(marginBuys[0]?.qty, 1_000);

const liqForm = new FormData();
liqForm.set("name", "Liq");
liqForm.set("symbol", "BTCUSDT");
liqForm.set("direction", "long");
liqForm.set("startKind", "immediate");
liqForm.set("clipSize", "10");
liqForm.set("sizeUnit", "qty");
liqForm.set("sizeMultiplier", "1");
const liqParsed = parseDcaPlaybookForm(liqForm);
assert.equal(liqParsed.ok, true);
if (!liqParsed.ok) {
  throw new Error("expected liq DCA parse");
}
const liqReplay = replayDcaPlaybook({
  bars: [
    { timeMs: 1_000, open: 100, high: 100, low: 100, close: 100 },
    { timeMs: 2_000, open: 100, high: 100, low: 89, close: 92 },
    { timeMs: 3_000, open: 110, high: 121, low: 110, close: 120 },
  ],
  recipe: snapshotDcaRecipe(liqParsed.config),
  feeRate: 0,
  startingUsdt: 100,
  leverage: 10,
});
const liqFlat = liqReplay.orders.find((row) => row.action === "flatten");
assert.equal(liqFlat?.reason, "liquidation");
assert.equal(liqFlat?.price, 90);
assert.ok(Math.abs(liqReplay.stats.endingUsdt) < 1e-8);
assert.equal(liqReplay.stats.openSide, null);
assert.equal(
  liqReplay.orders.some((row) => row.reason === "take_profit"),
  false,
);

const slSaves = replayDcaPlaybook({
  bars: [
    { timeMs: 1_000, open: 100, high: 100, low: 100, close: 100 },
    { timeMs: 2_000, open: 100, high: 100, low: 89, close: 92 },
  ],
  recipe: snapshotDcaRecipe({
    ...liqParsed.config,
    stopLossPct: 5,
  }),
  feeRate: 0,
  startingUsdt: 100,
  leverage: 10,
});
const slFlat = slSaves.orders.find((row) => row.action === "flatten");
assert.equal(slFlat?.reason, "stop");
assert.equal(slFlat?.price, 95);

const stopForm = new FormData();
stopForm.set("name", "Stop wick");
stopForm.set("symbol", "BTCUSDT");
stopForm.set("direction", "long");
stopForm.set("startKind", "immediate");
stopForm.set("clipSize", "1");
stopForm.set("sizeUnit", "qty");
stopForm.set("takeProfitPct", "10");
stopForm.set("stopLossPct", "5");
const stopParsed = parseDcaPlaybookForm(stopForm);
assert.equal(stopParsed.ok, true);
if (!stopParsed.ok) {
  throw new Error("expected stop DCA parse");
}
const stopped = replayDcaPlaybook({
  bars: [
    { timeMs: 1_000, open: 100, high: 100, low: 100, close: 100 },
    { timeMs: 2_000, open: 100, high: 111, low: 94, close: 111 },
  ],
  recipe: snapshotDcaRecipe(stopParsed.config),
  feeRate: 0,
  startingUsdt: 10_000,
});
assert.equal(stopped.orders[1]?.action, "flatten");
assert.equal(stopped.orders[1]?.reason, "stop");
assert.equal(stopped.orders[1]?.price, 95);

const gridForm = new FormData();
gridForm.set("name", "Rest grid");
gridForm.set("symbol", "BTCUSDT");
gridForm.set("direction", "long");
gridForm.set("startKind", "immediate");
gridForm.set("clipSize", "1");
gridForm.set("sizeUnit", "qty");
gridForm.set("maxClips", "3");
gridForm.set("dipPct", "10");
gridForm.set("restGrid", "1");
gridForm.set("sizeMultiplier", "1");
gridForm.set("deviationMultiplier", "1");
const gridParsed = parseDcaPlaybookForm(gridForm);
assert.equal(gridParsed.ok, true);
if (!gridParsed.ok) {
  throw new Error("expected grid DCA parse");
}
assert.equal(gridParsed.config.dcaMode, "order");
const gridRecipe = snapshotDcaRecipe(gridParsed.config);
const sameBarLow = replayDcaPlaybook({
  bars: [{ timeMs: 1_000, open: 100, high: 100, low: 90, close: 100 }],
  recipe: gridRecipe,
  feeRate: 0,
  startingUsdt: 10_000,
});
assert.equal(sameBarLow.orders.length, 1);
assert.equal(sameBarLow.orders[0]?.reason, "entry");
const gridFilled = replayDcaPlaybook({
  bars: [
    { timeMs: 1_000, open: 100, high: 100, low: 100, close: 100 },
    { timeMs: 2_000, open: 100, high: 100, low: 89, close: 100 },
  ],
  recipe: gridRecipe,
  feeRate: 0,
  startingUsdt: 10_000,
});
assert.equal(gridFilled.orders.length, 2);
assert.equal(gridFilled.orders[1]?.reason, "clip");
assert.equal(gridFilled.orders[1]?.price, 90);
assert.equal(gridFilled.orders[1]?.clipIndex, 2);
assert.equal(gridFilled.stats.openQty, 2);

const limitTpForm = new FormData();
limitTpForm.set("name", "Limit TP");
limitTpForm.set("symbol", "BTCUSDT");
limitTpForm.set("direction", "long");
limitTpForm.set("startKind", "immediate");
limitTpForm.set("clipSize", "1");
limitTpForm.set("sizeUnit", "qty");
limitTpForm.set("takeProfitPct", "10");
limitTpForm.set("takeProfitOrderType", "limit");
const limitTpParsed = parseDcaPlaybookForm(limitTpForm);
assert.equal(limitTpParsed.ok, true);
if (!limitTpParsed.ok) {
  throw new Error("expected limit TP parse");
}
const limitTpRecipe = snapshotDcaRecipe(limitTpParsed.config);
const entryBarWick = replayDcaPlaybook({
  bars: [{ timeMs: 1_000, open: 100, high: 111, low: 100, close: 100 }],
  recipe: limitTpRecipe,
  feeRate: 0,
  startingUsdt: 10_000,
});
assert.equal(entryBarWick.orders.length, 1);
assert.equal(entryBarWick.stats.openSide, "long");
const limitTpHit = replayDcaPlaybook({
  bars: [
    { timeMs: 1_000, open: 100, high: 100, low: 100, close: 100 },
    { timeMs: 2_000, open: 100, high: 111, low: 100, close: 105 },
  ],
  recipe: limitTpRecipe,
  feeRate: 0,
  startingUsdt: 10_000,
});
assert.equal(limitTpHit.orders[1]?.action, "flatten");
assert.equal(limitTpHit.orders[1]?.reason, "take_profit");
assert.ok(Math.abs((limitTpHit.orders[1]?.price ?? 0) - 110) < 1e-8);

const gridTpForm = new FormData();
gridTpForm.set("name", "Grid limit TP");
gridTpForm.set("symbol", "XRPUSDT");
gridTpForm.set("direction", "long");
gridTpForm.set("startKind", "immediate");
gridTpForm.set("clipSize", "1");
gridTpForm.set("sizeUnit", "qty");
gridTpForm.set("maxClips", "3");
gridTpForm.set("dipPct", "1");
gridTpForm.set("restGrid", "1");
gridTpForm.set("sizeMultiplier", "1");
gridTpForm.set("deviationMultiplier", "1");
gridTpForm.set("takeProfitPct", "1.4");
gridTpForm.set("takeProfitOrderType", "limit");
const gridTpParsed = parseDcaPlaybookForm(gridTpForm);
assert.equal(gridTpParsed.ok, true);
if (!gridTpParsed.ok) {
  throw new Error("expected grid TP parse");
}
const gridTp = replayDcaPlaybook({
  bars: [
    { timeMs: 1_000, open: 100, high: 100, low: 100, close: 100 },
    { timeMs: 2_000, open: 100, high: 101.5, low: 98.9, close: 100 },
  ],
  recipe: snapshotDcaRecipe(gridTpParsed.config),
  feeRate: 0,
  startingUsdt: 10_000,
});
assert.equal(gridTp.orders.length, 3);
assert.equal(gridTp.orders[1]?.reason, "clip");
assert.equal(gridTp.orders[1]?.price, 99);
assert.equal(gridTp.orders[2]?.reason, "take_profit");
assert.ok(Math.abs((gridTp.orders[2]?.price ?? 0) - 99.5 * 1.014) < 1e-8);

console.log("dca backtest replay checks passed");
