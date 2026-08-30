import assert from "node:assert/strict";
import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import { snapshotDcaRecipe } from "@/lib/templates/recipe";
import type { PerpsTemplateRecipe } from "@/lib/templates/recipe";
import {
  buildEquityTimeline,
  expandStudyScenarios,
  STUDY_MAX_SCENARIOS,
  studyIntervalsForWindow,
} from "./study";
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

const monthFrom = Date.UTC(2026, 6, 1);
const monthTo = Date.UTC(2026, 6, 31, 23, 59, 59, 999);
const intervals = studyIntervalsForWindow(monthFrom, monthTo);
assert.ok(intervals.includes("60"));
assert.ok(intervals.includes("240"));
assert.ok(intervals.includes("D"));
assert.equal(intervals.includes("15"), false);

const expanded = expandStudyScenarios(seed, monthFrom, monthTo);
assert.ok(expanded.scenarios.length > 0);
assert.ok(expanded.scenarios.length <= STUDY_MAX_SCENARIOS);
assert.ok(
  expanded.scenarios.some((row) => row.recipe.kind === "dca" && row.recipe.startKind === "immediate"),
);
assert.ok(
  expanded.scenarios.some((row) => row.recipe.kind === "dca" && row.recipe.startKind === "indicator"),
);
assert.equal(
  expanded.scenarios.some((row) => row.recipe.kind === "dca" && row.recipe.startKind === "webhook"),
  false,
);
const starts = new Set(
  expanded.scenarios
    .filter((row) => row.recipe.kind === "dca")
    .map((row) =>
      row.recipe.kind === "dca"
        ? `${row.recipe.startKind}:${row.recipe.indicatorKind ?? ""}:${row.recipe.indicatorCompare ?? ""}`
        : "",
    ),
);
assert.ok(starts.has("immediate::"));
assert.ok([...starts].some((row) => row.startsWith("indicator:rsi:")));

const withPrice = snapshotDcaRecipe({
  ...parsed.config,
  startKind: "price",
  armTrigger: { triggerBy: "last", compare: "gte", price: 100_000 },
});
const priced = expandStudyScenarios(withPrice, monthFrom, monthTo);
assert.ok(
  priced.scenarios.some(
    (row) => row.recipe.kind === "dca" && row.recipe.startKind === "price",
  ),
);

const perps: PerpsTemplateRecipe = {
  kind: "perps",
  name: "Perps seed",
  symbol: "ETHUSDT",
  formAction: "buy",
  orderType: "market",
  sizeUnit: "qty",
  size: "1",
  limitPrice: "",
  entrySource: "price",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: "3000",
  skipIfOpen: true,
  tpsl: null,
  trailing: null,
};
const perpsExpanded = expandStudyScenarios(perps, monthFrom, monthTo);
assert.ok(perpsExpanded.scenarios.length > 0);
assert.ok(
  perpsExpanded.scenarios.every(
    (row) => row.recipe.kind === "perps" && row.recipe.entrySource === "price",
  ),
);
assert.ok(
  perpsExpanded.scenarios.some(
    (row) =>
      row.recipe.kind === "perps" &&
      row.recipe.tpsl != null &&
      (row.recipe.tpsl.takeProfit ?? 0) > 3000,
  ),
);

const flatten: PerpsTemplateRecipe = {
  ...perps,
  formAction: "close_long",
};
assert.equal(expandStudyScenarios(flatten, monthFrom, monthTo).scenarios.length, 0);

const run: BacktestRun = {
  id: "run-1",
  userId: "user-1",
  templateId: null,
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
