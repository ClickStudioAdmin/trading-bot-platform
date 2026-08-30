import assert from "node:assert/strict";
import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import { snapshotDcaRecipe } from "@/lib/templates/recipe";
import { buildEquityTimeline, recipeParamRows } from "./study";
import type { BacktestRun } from "./model";

const form = new FormData();
form.set("name", "Study seed");
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
const seed = snapshotDcaRecipe(parsed.config);
const preview = recipeParamRows(seed);
assert.equal(
  preview.find((row) => row.label === "Start")?.value,
  "Manual",
);
assert.equal(
  preview.find((row) => row.label === "Direction")?.value,
  "Long",
);

const run: BacktestRun = {
  id: "run-1",
  userId: "user-1",
  templateId: null,
  sourceTemplateId: null,
  studyId: null,
  deskType: "dca",
  venue: "bybit",
  venueEnvironment: null,
  symbol: "BTCUSDT",
  interval: "60",
  fromMs: 1_000,
  toMs: 4_000,
  startingUsdt: 10_000,
  feePreset: "vip0_taker",
  feeRate: 0,
  status: "done",
  recipe: seed,
  stats: {
    trades: 1,
    wins: 1,
    winRate: 1,
    realizedUsdt: 90,
    maxDrawdownUsdt: 0,
    profitFactor: null,
    timeInMarket: 0.5,
    openQty: 0,
    openSide: null,
    markUsdt: 0,
    startingUsdt: 10_000,
    endingUsdt: 10_090,
    returnPct: 0.009,
  },
  orders: [
    {
      atMs: 2_000,
      action: "buy",
      side: "long",
      qty: 1,
      price: 100,
      feeUsdt: 0,
      realizedUsdt: 0,
    },
    {
      atMs: 3_000,
      action: "flatten",
      side: "long",
      qty: 1,
      price: 190,
      feeUsdt: 0,
      realizedUsdt: 90,
    },
  ],
  error: null,
  createdAtMs: 1_000,
  finishedAtMs: 4_000,
  parentRunId: null,
  comparableSymbols: [],
};
const timeline = buildEquityTimeline(run);
assert.equal(timeline[0]?.equityUsdt, 10_000);
assert.equal(timeline[1]?.equityUsdt, 10_000);
assert.equal(timeline[2]?.equityUsdt, 10_090);
assert.ok((timeline.at(-1)?.equityUsdt ?? 0) >= 10_090);

console.log("backtest study checks passed");
