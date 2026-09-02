import assert from "node:assert/strict";
import {
  backtestChartLevels,
  backtestFillMarkerText,
  backtestOpenMarkPrice,
  groupBacktestOrdersIntoCycles,
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
  shortIndicatorKind: null,
  shortIndicatorTimeframe: null,
  shortIndicatorCompare: null,
  shortIndicatorLevel: null,
};

const grouped = groupBacktestOrdersIntoCycles(fills);
assert.equal(grouped.closed.length, 2);
assert.equal(grouped.open.length, 0);
assert.equal(grouped.closed[0]?.side, "short");
assert.equal(grouped.closed[0]?.closedAtMs, 5_000);
assert.equal(grouped.closed[1]?.clipCount, 2);
assert.equal(grouped.closed[1]?.entryPrice, (100 + 180) / 3);
assert.equal(grouped.closed[1]?.exitReason, "take_profit");
assert.equal(backtestFillMarkerText(fills[0]!, false), "Entry");
assert.equal(backtestFillMarkerText(fills[1]!, false), "Add 2");
assert.equal(backtestFillMarkerText(fills[2]!, false), "TP");
assert.equal(
  backtestFillMarkerText(
    { ...fills[2]!, reason: "liquidation" },
    false,
  ),
  "Liq",
);
assert.equal(backtestFillMarkerText(fills[3]!, true), "Open short");

const exits = plannedExitsForBacktestCycle(recipe, grouped.closed[1]!);
assert.ok(exits.takeProfit != null && exits.takeProfit > grouped.closed[1]!.entryPrice);
assert.ok(exits.stopLoss != null && exits.stopLoss < grouped.closed[1]!.entryPrice);

const levels = backtestChartLevels(recipe, fills.slice(0, 4));
assert.equal(levels?.side, "short");
assert.equal(levels?.entry, 50);
assert.equal(levels?.liquidation, null);
const newest = backtestChartLevels(recipe, fills);
assert.equal(newest?.side, "short");
assert.equal(newest?.entry, 50);
const liqLevels = backtestChartLevels(recipe, [
  fills[0]!,
  fills[1]!,
  { ...fills[2]!, reason: "liquidation", price: 80, realizedUsdt: -60 },
]);
assert.equal(liqLevels?.liquidation, 80);
assert.equal(liqLevels?.takeProfit, null);
assert.equal(backtestOpenMarkPrice({
  side: "long",
  entryPrice: 100,
  qty: 2,
  unrealizedUsdt: 10,
}), 105);

console.log("backtest positions checks passed");
