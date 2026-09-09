import assert from "node:assert/strict";
import {
  backtestChartLevels,
  backtestFillMarkerText,
  backtestCycleUnrealizedUsdt,
  backtestOpenMarkPrice,
  backtestReplayMarkPrice,
  groupBacktestOrdersIntoCycles,
  listBacktestCycles,
  plannedExitsForBacktestCycle,
} from "./positions";
import type { BacktestRecipe, SimulatedOrder } from "./model";

const fills: SimulatedOrder[] = [
  {
    atMs: 1_000,
    action: "buy",
    side: "long",
    qty: 1,
    price: 100,
    feeUsdt: 0,
    realizedUsdt: -0.06,
    reason: "entry",
    clipIndex: 1,
  },
  {
    atMs: 2_000,
    action: "buy",
    side: "long",
    qty: 2,
    price: 90,
    feeUsdt: 0,
    realizedUsdt: -0.1,
    reason: "clip",
    clipIndex: 2,
  },
  {
    atMs: 3_000,
    action: "flatten",
    side: "long",
    qty: 3,
    price: 110,
    feeUsdt: 0,
    realizedUsdt: 40,
    reason: "take_profit",
  },
  {
    atMs: 4_000,
    action: "sell",
    side: "short",
    qty: 1,
    price: 50,
    feeUsdt: 0,
    realizedUsdt: -0.03,
    reason: "entry",
    clipIndex: 1,
  },
  {
    atMs: 5_000,
    action: "flatten",
    side: "short",
    qty: 1,
    price: 40,
    feeUsdt: 0,
    realizedUsdt: 10,
    reason: "take_profit",
  },
];

const recipe: BacktestRecipe = {
  kind: "dca",
  name: "Test",
  symbol: "BTCUSDT",
  direction: "long",
  startKind: "immediate",
  dcaMode: "position",
  clipSize: 1,
  sizeUnit: "qty",
  maxClips: 5,
  maxValue: null,
  maxValueKind: "usdt",
  dipPct: null,
  intervalMinutes: null,
  sizeMultiplier: 1,
  deviationMultiplier: 1,
  takeProfitPct: 10,
  stopLossPct: 5,
  takeProfitBasis: "average",
  stopLossBasis: "average",
  takeProfitOrderType: "market",
  breakevenActivationPct: null,
  breakevenOffsetPct: null,
  trailingTriggerPct: null,
  trailingPct: null,
  armTrigger: null,
  shortArmTrigger: null,
  indicatorKind: null,
  indicatorTimeframe: null,
  indicatorCompare: null,
  indicatorLevel: null,
  indicatorPeriod: null,
  indicatorSlowPeriod: null,
  shortIndicatorKind: null,
  shortIndicatorTimeframe: null,
  shortIndicatorCompare: null,
  shortIndicatorLevel: null,
  shortIndicatorPeriod: null,
  shortIndicatorSlowPeriod: null,
};

const grouped = groupBacktestOrdersIntoCycles(fills);
assert.equal(grouped.closed.length, 2);
assert.equal(grouped.open.length, 0);
assert.equal(grouped.closed[0]?.side, "short");
assert.equal(grouped.closed[0]?.closedAtMs, 5_000);
assert.equal(grouped.closed[1]?.clipCount, 2);
assert.equal(grouped.closed[1]?.entryPrice, (100 + 180) / 3);
assert.equal(grouped.closed[1]?.exitReason, "take_profit");
assert.equal(backtestFillMarkerText(fills[0]!, false), "Entry long");
assert.equal(backtestFillMarkerText(fills[1]!, false), "Add 2 long");
assert.equal(backtestFillMarkerText(fills[2]!, false), "TP long");
assert.equal(
  backtestFillMarkerText({ ...fills[2]!, side: "short" }, false),
  "TP short",
);
assert.equal(
  backtestFillMarkerText(
    { ...fills[2]!, reason: "liquidation" },
    false,
  ),
  "Liq long",
);
assert.equal(
  backtestFillMarkerText({ ...fills[2]!, reason: "exit_if" }, false),
  "Exit-if long",
);
assert.equal(
  backtestFillMarkerText(
    { ...fills[2]!, reason: "exit_if", side: "short" },
    false,
  ),
  "Exit-if short",
);
assert.equal(backtestFillMarkerText(fills[1]!, true), "Add 2 long");
assert.equal(backtestFillMarkerText(fills[3]!, true), "Open short");

const exits = plannedExitsForBacktestCycle(recipe, grouped.closed[1]!);
assert.ok(exits.takeProfit != null && exits.takeProfit > grouped.closed[1]!.entryPrice);
assert.ok(exits.stopLoss != null && exits.stopLoss < grouped.closed[1]!.entryPrice);

assert.equal(backtestChartLevels(recipe, fills), null);
const inspect = listBacktestCycles(fills);
assert.equal(inspect[0]?.side, "long");
assert.equal(inspect[1]?.side, "short");
const shortId = inspect.find((row) => row.side === "short")?.id;
const levels = backtestChartLevels(recipe, fills, shortId);
assert.equal(levels?.side, "short");
assert.equal(levels?.entry, 50);
assert.equal(levels?.liquidation, null);
const newest = backtestChartLevels(recipe, fills, shortId);
assert.equal(newest?.side, "short");
assert.equal(newest?.entry, 50);
const liqFills = [
  fills[0]!,
  fills[1]!,
  { ...fills[2]!, reason: "liquidation" as const, price: 80, realizedUsdt: -60 },
];
const liqId = listBacktestCycles(liqFills)[0]?.id;
const liqLevels = backtestChartLevels(recipe, liqFills, liqId);
assert.equal(liqLevels?.liquidation, 80);
assert.equal(liqLevels?.takeProfit, null);
assert.equal(backtestOpenMarkPrice({
  side: "long",
  entryPrice: 100,
  qty: 2,
  unrealizedUsdt: 10,
}), 105);
assert.equal(
  backtestReplayMarkPrice({
    lastPrice: 90_000,
    markUsdt: 0,
    opens: [
      { side: "long", qty: 0.02, entryPrice: 80_000 },
      { side: "short", qty: 0.1, entryPrice: 30_000 },
    ],
  }),
  90_000,
);
assert.equal(
  backtestReplayMarkPrice({
    markUsdt: 10,
    opens: [
      { side: "long", qty: 2, entryPrice: 100 },
      { side: "short", qty: 1, entryPrice: 100 },
    ],
  }),
  110,
);
assert.equal(
  backtestCycleUnrealizedUsdt(
    { side: "long", qty: 2, entryPrice: 100 },
    110,
  ),
  20,
);
assert.equal(
  backtestCycleUnrealizedUsdt(
    { side: "short", qty: 1, entryPrice: 100 },
    110,
  ),
  -10,
);

const bothOpens = [
  { side: "long" as const, qty: 0.018, entryPrice: 85_082.36 },
  { side: "short" as const, qty: 0.112, entryPrice: 33_045.77 },
];
const bothMarkUsdt =
  (backtestCycleUnrealizedUsdt(bothOpens[0]!, 85_000) ?? 0) +
  (backtestCycleUnrealizedUsdt(bothOpens[1]!, 85_000) ?? 0);
const recovered = backtestReplayMarkPrice({
  markUsdt: bothMarkUsdt,
  opens: bothOpens,
});
assert.ok(recovered != null && Math.abs(recovered - 85_000) < 1e-6);
assert.equal(
  backtestReplayMarkPrice({
    markUsdt: 0,
    opens: [
      { side: "long", qty: 1, entryPrice: 100 },
      { side: "short", qty: 1, entryPrice: 100 },
    ],
  }),
  null,
);

console.log("backtest positions checks passed");
