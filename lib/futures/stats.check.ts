import assert from "node:assert/strict";
import type { FuturesOrder, FuturesPosition } from "./model";
import {
  annualizeReturnPct,
  closedTradingDays,
  deskStatsSnapshot,
  deskWindowStats,
  effectiveLeverage,
  flattenExitPrice,
  formatTradingDaysNote,
  futuresClosedStats,
  futuresDaysHeld,
  futuresOpenExposure,
  inclusiveUtcDays,
  positionMarginUsdt,
  roePct,
} from "./stats";

function closed(partial: Partial<FuturesPosition> & { realizedUsdt: number; notionalUsdt: number }): FuturesPosition {
  return {
    id: partial.id ?? "1",
    userId: "u",
    accountId: "a",
    symbol: partial.symbol ?? "BTCUSDT",
    side: "long",
    qty: 1,
    entryPrice: 100,
    notionalUsdt: partial.notionalUsdt,
    realizedUsdt: partial.realizedUsdt,
    leverage: partial.leverage ?? null,
    status: "closed",
    source: "manual",
    ruleId: null,
    ruleName: null,
    openedAtMs: 1,
    closedAtMs: partial.closedAtMs ?? 2,
    venue: null,
    environment: null,
    takeProfit: null,
    stopLoss: null,
    tpTrigger: "last",
    slTrigger: "last",
    tpslMode: "full",
    tpQty: null,
    slQty: null,
    tpOrderType: "market",
    slOrderType: "market",
    tpLimitPrice: null,
    slLimitPrice: null,
    trailingStop: null,
    trailingActive: null,
    trailingPeak: null,
  };
}

const empty = futuresClosedStats([]);
assert.equal(empty.closedCount, 0);
assert.equal(empty.greenCount, 0);
assert.equal(empty.realizedUsdt, 0);
assert.equal(empty.realizedPct, null);
assert.equal(empty.onNotionalPct, null);
assert.equal(empty.roePct, null);
assert.equal(empty.roeTradeCount, 0);
assert.equal(empty.tradingDays, null);
assert.equal(empty.aprPct, null);

assert.equal(positionMarginUsdt(1_000, 10), 100);
assert.equal(positionMarginUsdt(1_000, null), null);
assert.equal(roePct(20, 100), 0.2);
assert.equal(roePct(20, null), null);
assert.equal(effectiveLeverage(null, 10), 10);
assert.equal(effectiveLeverage(5, 10), 5);

const mixed = futuresClosedStats([
  closed({ id: "1", realizedUsdt: 20, notionalUsdt: 100 }),
  closed({ id: "2", realizedUsdt: -5, notionalUsdt: 100 }),
]);
assert.equal(mixed.closedCount, 2);
assert.equal(mixed.greenCount, 1);
assert.equal(mixed.realizedUsdt, 15);
assert.equal(mixed.realizedPct, 0.075);
assert.equal(mixed.onNotionalPct, 0.075);
assert.equal(mixed.roePct, null);
assert.equal(mixed.roeTradeCount, 0);
assert.equal(mixed.tradingDays, 1);
assert.equal(mixed.aprPct, null);

const geared = futuresClosedStats([
  closed({ id: "1", realizedUsdt: 20, notionalUsdt: 100, leverage: 10 }),
  closed({ id: "2", realizedUsdt: -5, notionalUsdt: 100, leverage: 10 }),
]);
assert.equal(geared.onNotionalPct, 0.075);
assert.equal(geared.roePct, 0.75);
assert.equal(geared.roeTradeCount, 2);
assert.equal(geared.tradingDays, 1);
assert.equal(geared.aprPct, 1.75 ** 365.25 - 1);

const partialRoe = futuresClosedStats([
  closed({ id: "1", realizedUsdt: 20, notionalUsdt: 100, leverage: 10 }),
  closed({ id: "2", realizedUsdt: -5, notionalUsdt: 100 }),
]);
assert.equal(partialRoe.realizedUsdt, 15);
assert.equal(partialRoe.onNotionalPct, 0.075);
assert.equal(partialRoe.roePct, 2);
assert.equal(partialRoe.roeTradeCount, 1);

const paperFallback = futuresClosedStats(
  [closed({ id: "1", realizedUsdt: 20, notionalUsdt: 200 })],
  10,
);
assert.equal(paperFallback.roePct, 1);
assert.equal(paperFallback.roeTradeCount, 1);

assert.equal(futuresDaysHeld(0, 86_400_000), null);
assert.equal(futuresDaysHeld(0, null), null);
assert.equal(futuresDaysHeld(1_000, 1_000 + 86_400_000), 1);

const jan1 = Date.UTC(2026, 0, 1, 15);
const feb16 = Date.UTC(2026, 1, 16, 3);
assert.equal(inclusiveUtcDays(jan1, jan1), 1);
assert.equal(inclusiveUtcDays(jan1, feb16), 47);
assert.equal(inclusiveUtcDays(feb16, jan1), null);
assert.equal(closedTradingDays([]), null);
assert.equal(
  closedTradingDays([
    { closedAtMs: feb16 },
    { closedAtMs: jan1 },
    { closedAtMs: null },
  ]),
  47,
);
assert.ok(
  Math.abs((annualizeReturnPct(0.1, 365.25) ?? NaN) - 0.1) < 1e-12,
);
assert.equal(annualizeReturnPct(null, 10), null);
assert.equal(annualizeReturnPct(-1, 10), null);
assert.equal(formatTradingDaysNote(null), undefined);
assert.equal(formatTradingDaysNote(1), "1 day trading");
assert.equal(formatTradingDaysNote(47), "47 days trading");

const spanned = futuresClosedStats([
  closed({
    id: "1",
    realizedUsdt: 20,
    notionalUsdt: 100,
    leverage: 10,
    closedAtMs: jan1,
  }),
  closed({
    id: "2",
    realizedUsdt: -5,
    notionalUsdt: 100,
    leverage: 10,
    closedAtMs: feb16,
  }),
]);
assert.equal(spanned.tradingDays, 47);
assert.equal(spanned.roePct, 0.75);
assert.equal(spanned.aprPct, 1.75 ** (365.25 / 47) - 1);

const exposure = futuresOpenExposure([
  { baseCoin: "BTC", notionalUsdt: 70 },
  { baseCoin: "ETH", notionalUsdt: 30 },
]);
assert.deepEqual(exposure, [
  { baseCoin: "BTC", notionalUsdt: 70, share: 0.7 },
  { baseCoin: "ETH", notionalUsdt: 30, share: 0.3 },
]);

const drawdown = deskWindowStats([
  { closedAtMs: 1, realizedUsdt: 50, notionalUsdt: 100 },
  { closedAtMs: 2, realizedUsdt: -30, notionalUsdt: 100 },
  { closedAtMs: 3, realizedUsdt: 10, notionalUsdt: 100 },
]);
assert.equal(drawdown.closedCount, 3);
assert.equal(drawdown.winCount, 2);
assert.equal(drawdown.realizedUsdt, 30);
assert.equal(drawdown.maxDrawdownUsdt, 30);
assert.equal(drawdown.maxDrawdownPct, 30 / 50);

const windowed = deskStatsSnapshot(
  [
    { closedAtMs: 1, realizedUsdt: 20, notionalUsdt: 100 },
    { closedAtMs: 86_400_000 * 40, realizedUsdt: 5, notionalUsdt: 50 },
  ],
  86_400_000 * 45,
);
assert.equal(windowed.allTime.closedCount, 2);
assert.equal(windowed.last30d.closedCount, 1);
assert.equal(windowed.last30d.realizedUsdt, 5);

assert.equal(flattenExitPrice([]), null);
assert.equal(
  flattenExitPrice([
    order({ action: "buy", price: 100 }),
    order({ action: "flatten", price: 110 }),
  ]),
  110,
);

console.log("futures stats checks passed");

function order(
  partial: Pick<FuturesOrder, "action" | "price">,
): FuturesOrder {
  return {
    id: "o",
    positionId: "p",
    action: partial.action,
    qty: 1,
    price: partial.price,
    notionalUsdt: 100,
    venueOrderId: null,
    filledAtMs: 1,
    source: "manual",
    ruleName: null,
  };
}
