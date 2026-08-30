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
assert.equal(closed.orders[1]?.price, 111);
assert.equal(closed.stats.trades, 1);
assert.equal(closed.stats.openQty, 0);
assert.ok((closed.stats.realizedUsdt ?? 0) > 0);

console.log("dca backtest replay checks passed");
