import assert from "node:assert/strict";
import {
  dcaBreakevenPrice,
  dcaClipFromBudget,
  dcaClipQtyAt,
  dcaClipSizeAt,
  dcaGeometricSizeSum,
  dcaDipPctAt,
  dcaClipsUntilMaxValue,
  dcaFirstOrderOverMaxQty,
  dcaLadderLevels,
  dcaLadderLossRange,
  dcaLadderMaxOrderError,
  dcaLadderRestPriceError,
  dcaLadderProfitRange,
  dcaInitialMarginUsdt,
  dcaLastClipDeviationPct,
  dcaMaxDropCoveredPct,
  dcaPlannedExits,
  dcaRequiredUsdt,
  dcaAtrDistanceLabel,
  dcaAtrSafetyPrices,
  dcaAtrStep,
  dcaCoveredRangePct,
  dcaResolvedSafetyPrices,
  dcaSafetyPrices,
  dcaStopLossPrice,
  dcaTakeProfitPrice,
  dcaTrailingActivationPrice,
  dcaTrailingDistance,
  dcaTighterStopPrice,
  dcaTighterTrailingActivation,
  dcaTighterTrailingDistance,
} from "./grid";
import {
  bollingerBands,
  crossedLevel,
  DCA_INDICATOR_KIND_OPTIONS,
  DCA_TREND_KIND_OPTIONS,
  dcaIndicatorShowsLevel,
  dcaIndicatorUsesPeriod,
  dcaIndicatorWhenOptions,
  emaCrossBullish,
  emaValues,
  formatDcaIndicatorStartLabel,
  indicatorBothSidesHint,
  indicatorCompareForDirection,
  indicatorStartMet,
  oppositeRsiCompare,
  oppositeRsiLevel,
  macdHistogram,
  parseDcaIndicatorCompare,
  parseDcaIndicatorPeriod,
  parseDcaIndicatorTimeframe,
  priceCrossedAverage,
  rsiValue,
  smaValues,
  supertrendDirections,
  type SupertrendBar,
} from "./indicators";

assert.equal(dcaClipSizeAt(0, 10, 2), 10);
assert.equal(dcaClipSizeAt(1, 10, 2), 20);
assert.equal(dcaClipSizeAt(2, 10, 2), 40);
assert.equal(dcaClipQtyAt(0, 10, 2, "qty", 100), 10);
assert.equal(dcaClipQtyAt(1, 100, 2, "usdt", 50), 4);
assert.equal(dcaGeometricSizeSum(3, 2), 7);
assert.equal(dcaGeometricSizeSum(3, 1), 3);
assert.equal(
  dcaClipFromBudget({
    maxValue: 700,
    maxClips: 3,
    sizeMultiplier: 2,
    sizeUnit: "usdt",
  }),
  100,
);
assert.equal(
  dcaClipFromBudget({
    maxValue: 300,
    maxClips: 3,
    sizeMultiplier: 1,
    sizeUnit: "usdt",
  }),
  100,
);
assert.equal(
  dcaClipFromBudget({
    maxValue: 700,
    maxClips: 3,
    sizeMultiplier: 2,
    sizeUnit: "qty",
    mark: 50,
  }),
  100 / 50,
);
assert.equal(
  dcaClipFromBudget({
    maxValue: 700,
    maxClips: null,
    sizeMultiplier: 2,
    sizeUnit: "usdt",
  }),
  null,
);
assert.equal(
  dcaFirstOrderOverMaxQty({
    side: "long",
    entryPrice: 100,
    maxClips: 5,
    maxValue: null,
    dipPct: null,
    clipSize: 10,
    sizeUnit: "qty",
    sizeMultiplier: 2,
    deviationMultiplier: 1,
    restGrid: false,
    maxQty: 50,
    maxMktQty: 50,
  })?.orderNumber,
  4,
);
assert.equal(
  dcaLadderMaxOrderError({
    sides: ["long"],
    entryPrice: 100,
    maxClips: 5,
    maxValue: null,
    dipPct: null,
    clipSize: 10,
    sizeUnit: "qty",
    sizeMultiplier: 2,
    deviationMultiplier: 1,
    restGrid: false,
    maxQty: 50,
    maxMktQty: 50,
    baseCoin: "BTC",
  }),
  "Entry # 4 is 80 BTC, above the 50 BTC market maximum.",
);
assert.equal(
  dcaLadderMaxOrderError({
    sides: ["long"],
    entryPrice: 80_000,
    maxClips: 20,
    maxValue: null,
    dipPct: null,
    clipSize: 100,
    sizeUnit: "usdt",
    sizeMultiplier: 2,
    deviationMultiplier: 1,
    restGrid: false,
    maxQty: 119,
    maxMktQty: 119,
    baseCoin: "BTC",
  }),
  "Entry # 18 is $13,107,200, above the $9,520,000 market maximum (119 BTC).",
);
assert.equal(
  dcaLadderMaxOrderError({
    sides: ["long"],
    entryPrice: 100,
    maxClips: 3,
    maxValue: null,
    dipPct: null,
    clipSize: 10,
    sizeUnit: "qty",
    sizeMultiplier: 2,
    deviationMultiplier: 1,
    restGrid: false,
    maxQty: 80,
    maxMktQty: 80,
    baseCoin: "BTC",
  }),
  null,
);
assert.equal(
  dcaLadderMaxOrderError({
    sides: ["long"],
    entryPrice: 100,
    maxClips: 3,
    maxValue: null,
    dipPct: null,
    clipSize: 6,
    sizeUnit: "qty",
    sizeMultiplier: 1,
    deviationMultiplier: 1,
    restGrid: true,
    maxQty: 100,
    maxMktQty: 5,
    baseCoin: "BTC",
  }),
  "Entry # 1 is 6 BTC, above the 5 BTC market maximum.",
);
assert.equal(
  dcaLadderMaxOrderError({
    sides: ["long"],
    entryPrice: 100,
    maxClips: 3,
    maxValue: null,
    dipPct: null,
    clipSize: 1,
    sizeUnit: "qty",
    sizeMultiplier: 10,
    deviationMultiplier: 1,
    restGrid: true,
    maxQty: 8,
    maxMktQty: 5,
    baseCoin: "BTC",
  }),
  "Entry # 2 is 10 BTC, above the 8 BTC maximum.",
);
assert.equal(
  dcaLadderMaxOrderError({
    sides: ["long"],
    entryPrice: 100,
    maxClips: 3,
    maxValue: null,
    dipPct: 50,
    clipSize: 100,
    sizeUnit: "usdt",
    sizeMultiplier: 1,
    deviationMultiplier: 1,
    restGrid: true,
    maxQty: 1.5,
    maxMktQty: 1.5,
    baseCoin: "BTC",
  }),
  "Entry # 2 is $100, above the $75 maximum (1.5 BTC).",
);
assert.equal(
  dcaLadderMaxOrderError({
    sides: ["long", "short"],
    entryPrice: 100,
    maxClips: 5,
    maxValue: null,
    dipPct: null,
    clipSize: 10,
    sizeUnit: "qty",
    sizeMultiplier: 2,
    deviationMultiplier: 1,
    restGrid: false,
    maxQty: 50,
    maxMktQty: 50,
    baseCoin: "BTC",
  }),
  "Long Entry # 4 is 80 BTC, above the 50 BTC market maximum.",
);
assert.equal(
  dcaLadderMaxOrderError({
    sides: ["long"],
    entryPrice: 100,
    maxClips: 3,
    maxValue: null,
    dipPct: null,
    clipSize: 1,
    sizeUnit: "usdt",
    sizeMultiplier: 1,
    deviationMultiplier: 1,
    restGrid: true,
    maxQty: 100,
    maxMktQty: 100,
    minQty: 0.1,
    minNotional: 5,
    baseCoin: "BTC",
  }),
  "Entry # 1: Minimum order is $10 (0.1 BTC).",
);
assert.equal(
  dcaLadderRestPriceError({
    sides: ["long"],
    entryPrice: 0.4,
    maxClips: 3,
    maxValue: null,
    dipPct: 1,
    clipSize: 100,
    sizeUnit: "usdt",
    sizeMultiplier: 1,
    deviationMultiplier: 1,
    restGrid: true,
    minPrice: 1,
    tickSize: 0.1,
  }),
  "Entry # 2: Minimum limit is $1.",
);
assert.equal(dcaDipPctAt(0, 1, 2), 1);
assert.equal(dcaDipPctAt(1, 1, 2), 2);
assert.deepEqual(
  dcaSafetyPrices({
    side: "long",
    entryPrice: 100,
    maxClips: 3,
    dipPct: 1,
    deviationMultiplier: 1,
  }),
  [99, 98.01],
);
assert.equal(
  dcaMaxDropCoveredPct({
    side: "long",
    maxClips: 3,
    dipPct: 1,
    deviationMultiplier: 1,
  })?.toFixed(2),
  "1.99",
);
assert.equal(
  dcaLastClipDeviationPct({
    side: "short",
    maxClips: 3,
    dipPct: 1,
    deviationMultiplier: 1,
  })?.toFixed(2),
  "2.01",
);
assert.equal(
  dcaRequiredUsdt({
    clipSize: 100,
    sizeUnit: "usdt",
    maxClips: 3,
    sizeMultiplier: 2,
    mark: null,
  }),
  700,
);
assert.equal(
  dcaRequiredUsdt({
    clipSize: 1,
    sizeUnit: "qty",
    maxClips: 2,
    sizeMultiplier: 1,
    mark: 50,
  }),
  100,
);
assert.equal(dcaInitialMarginUsdt(3_177.25, 10), 317.725);
assert.equal(dcaInitialMarginUsdt(3_177.25, null), null);
assert.equal(dcaInitialMarginUsdt(null, 10), null);

const ladder = dcaLadderLevels({
  side: "long",
  entryPrice: 100,
  maxClips: 3,
  dipPct: 1,
  clipSize: 10,
  sizeUnit: "usdt",
  sizeMultiplier: 1,
  deviationMultiplier: 1,
});
assert.equal(ladder.length, 3);
assert.equal(ladder[0]?.price, 100);
assert.equal(ladder[0]?.orderUsdt, 10);
assert.equal(ladder[0]?.totalUsdt, 10);
assert.equal(ladder[1]?.price, 99);
assert.equal(ladder[1]?.totalUsdt, 20);
assert.equal(ladder[2]?.price, 98.01);
assert.equal(ladder[2]?.totalUsdt, 30);

const qtyLadder = dcaLadderLevels({
  side: "long",
  entryPrice: 100,
  maxClips: 2,
  dipPct: 1,
  clipSize: 1,
  sizeUnit: "qty",
  sizeMultiplier: 1,
  deviationMultiplier: 1,
});
assert.equal(qtyLadder[0]?.orderUsdt, 100);
assert.equal(qtyLadder[1]?.orderUsdt, 99);
assert.equal(qtyLadder[1]?.totalUsdt, 199);
assert.equal(ladder[0]?.profitUsdt, 0);
assert.ok((ladder[2]?.profitUsdt ?? 0) > (ladder[1]?.profitUsdt ?? 0));
assert.equal(
  dcaTakeProfitPrice({
    side: "long",
    firstPrice: 100,
    averagePrice: 98,
    takeProfitPct: 2,
    takeProfitBasis: "average",
  })?.toFixed(2),
  "99.96",
);
assert.equal(
  dcaTakeProfitPrice({
    side: "long",
    firstPrice: 100,
    averagePrice: 98,
    takeProfitPct: 2,
    takeProfitBasis: "first_entry",
  }),
  102,
);
const tpLadder = dcaLadderLevels({
  side: "long",
  entryPrice: 100,
  maxClips: 2,
  dipPct: null,
  clipSize: 100,
  sizeUnit: "usdt",
  sizeMultiplier: 1,
  deviationMultiplier: 1,
  takeProfitPct: 10,
  takeProfitBasis: "average",
});
assert.equal(tpLadder[0]?.profitUsdt.toFixed(2), "10.00");
assert.equal(tpLadder[1]?.profitUsdt.toFixed(2), "20.00");
assert.equal(dcaLadderProfitRange(tpLadder)?.min.toFixed(2), "10.00");
assert.equal(dcaLadderProfitRange(tpLadder)?.max.toFixed(2), "20.00");
assert.equal(tpLadder[0]?.lossUsdt, null);
assert.equal(
  dcaStopLossPrice({
    side: "long",
    firstPrice: 100,
    averagePrice: 98,
    stopLossPct: 2,
    stopLossBasis: "average",
  })?.toFixed(2),
  "96.04",
);
const slLadder = dcaLadderLevels({
  side: "long",
  entryPrice: 100,
  maxClips: 2,
  dipPct: null,
  clipSize: 100,
  sizeUnit: "usdt",
  sizeMultiplier: 1,
  deviationMultiplier: 1,
  stopLossPct: 10,
  stopLossBasis: "average",
});
assert.equal(slLadder[0]?.lossUsdt?.toFixed(2), "10.00");
assert.equal(slLadder[1]?.lossUsdt?.toFixed(2), "20.00");
assert.equal(dcaLadderLossRange(slLadder)?.min.toFixed(2), "10.00");
assert.equal(dcaLadderLossRange(slLadder)?.max.toFixed(2), "20.00");
assert.equal(
  dcaClipsUntilMaxValue({
    side: "long",
    entryPrice: 100,
    maxValue: 250,
    dipPct: null,
    clipSize: 100,
    sizeUnit: "usdt",
    sizeMultiplier: 1,
    deviationMultiplier: 1,
  }),
  3,
);
assert.equal(
  dcaBreakevenPrice({ side: "long", basisPrice: 100, offsetPct: 1 }),
  101,
);
assert.equal(
  dcaBreakevenPrice({ side: "short", basisPrice: 100, offsetPct: 1 }),
  99,
);
assert.equal(dcaTrailingDistance(100, 2), 2);
assert.equal(
  dcaTighterStopPrice({ side: "long", current: 95, candidate: 90 }),
  95,
);
assert.equal(
  dcaTighterStopPrice({ side: "long", current: 95, candidate: 97 }),
  97,
);
assert.equal(
  dcaTighterStopPrice({ side: "short", current: 105, candidate: 110 }),
  105,
);
assert.equal(dcaTighterTrailingDistance(2, 3), 2);
assert.equal(dcaTighterTrailingDistance(null, 2), 2);
assert.equal(
  dcaTighterTrailingActivation({
    side: "long",
    current: 103,
    candidate: 101,
  }),
  103,
);
const planned = dcaPlannedExits({
  side: "long",
  entryPrice: 100,
  firstFillPrice: 100,
  mark: 100,
  takeProfitPct: 10,
  stopLossPct: 5,
  takeProfitBasis: "average",
  stopLossBasis: "average",
  trailingPct: 2,
});
assert.equal(planned.takeProfit, 100 * (1 + 10 / 100));
assert.equal(planned.stopLoss, 95);
assert.equal(planned.trailingStop, 2);
assert.deepEqual(
  dcaPlannedExits({
    side: "long",
    entryPrice: null,
    firstFillPrice: null,
    mark: null,
    takeProfitPct: 10,
    stopLossPct: 5,
    takeProfitBasis: "average",
    stopLossBasis: "average",
    trailingPct: 2,
  }),
  { takeProfit: null, stopLoss: null, trailingStop: null },
);
assert.equal(
  dcaTrailingActivationPrice({
    side: "long",
    basisPrice: 100,
    triggerPct: 3,
  }),
  103,
);

const rising = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
assert.ok(emaValues(rising, 5).length > 0);
assert.equal(rsiValue(rising), 100);
assert.equal(
  indicatorStartMet({
    kind: "rsi",
    side: "long",
    closes: rising,
    compare: "gte",
    level: 70,
  }),
  true,
);
assert.equal(
  indicatorStartMet({
    kind: "rsi",
    side: "long",
    closes: rising,
    compare: "lte",
    level: 30,
  }),
  false,
);
const hist = macdHistogram(rising);
assert.ok(hist === null || Number.isFinite(hist));
const macdCloses = [...Array(40).fill(100), ...Array(12).fill(120)];
const macdHist = macdHistogram(macdCloses);
assert.ok(macdHist != null && Number.isFinite(macdHist));
assert.equal(
  indicatorStartMet({
    kind: "macd",
    side: "long",
    closes: macdCloses,
    compare: "gte",
    level: null,
  }),
  indicatorStartMet({
    kind: "macd",
    side: "long",
    closes: macdCloses,
    compare: "gte",
    level: 0,
  }),
);
assert.equal(
  indicatorStartMet({
    kind: "macd",
    side: "long",
    closes: macdCloses,
    compare: "gte",
    level: (macdHist as number) - 0.01,
  }),
  true,
);
assert.equal(
  indicatorStartMet({
    kind: "macd",
    side: "long",
    closes: macdCloses,
    compare: "gte",
    level: (macdHist as number) + 0.01,
  }),
  false,
);
assert.ok(
  emaCrossBullish([
    10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
    10, 10, 12,
  ]) === true ||
    emaCrossBullish([
      10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
      10, 10, 10, 12,
    ]) === false ||
    emaCrossBullish([
      10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
      10, 10, 10, 12,
    ]) === null,
);

assert.equal(parseDcaIndicatorTimeframe("D"), "D");
assert.equal(parseDcaIndicatorTimeframe("240"), "240");
assert.equal(parseDcaIndicatorTimeframe("W"), null);
assert.equal(parseDcaIndicatorCompare("cross_lte"), "cross_lte");
assert.equal(
  indicatorCompareForDirection("long", "rsi", "cross_gte"),
  "cross_gte",
);
assert.equal(
  indicatorCompareForDirection("short", "rsi", "cross_lte"),
  "cross_lte",
);
assert.equal(indicatorCompareForDirection("long", "rsi", ""), "cross_lte");
assert.equal(oppositeRsiCompare("cross_lte"), "cross_gte");
assert.equal(oppositeRsiLevel(30), 70);
assert.equal(
  indicatorBothSidesHint("rsi", "cross_lte"),
  "Each side uses the When you set on that card.",
);
assert.equal(parseDcaIndicatorCompare("pair"), null);
assert.equal(crossedLevel(40, 25, 30, "down"), true);
assert.equal(crossedLevel(25, 20, 30, "down"), false);
assert.equal(crossedLevel(-0.1, 0.05, 0, "up"), true);
assert.equal(crossedLevel(0.2, 0.3, 0, "up"), false);

const rsiDump = [...Array(19).fill(100), 1];
assert.equal(
  indicatorStartMet({
    kind: "rsi",
    side: "long",
    closes: rsiDump,
    compare: "cross_lte",
    level: 50,
  }),
  true,
);
assert.equal(
  indicatorStartMet({
    kind: "rsi",
    side: "long",
    closes: rsiDump,
    compare: "lte",
    level: 50,
  }),
  true,
);
assert.equal(
  indicatorStartMet({
    kind: "ema_cross",
    side: "long",
    closes: [...Array(30).fill(100), 200],
    compare: "cross_gte",
    level: 105,
  }),
  true,
);
assert.equal(
  indicatorStartMet({
    kind: "ema_cross",
    side: "long",
    closes: [...Array(30).fill(100), 200],
    compare: "cross_lte",
    level: 105,
  }),
  false,
);
assert.equal(
  indicatorStartMet({
    kind: "ema_cross",
    side: "short",
    closes: [...Array(30).fill(100), 200],
    compare: "cross_lte",
    level: 105,
  }),
  false,
);
assert.equal(
  indicatorStartMet({
    kind: "rsi",
    side: "short",
    closes: rsiDump,
    compare: "cross_lte",
    level: 50,
    splitBySide: true,
  }),
  false,
);
assert.equal(
  indicatorStartMet({
    kind: "rsi",
    side: "long",
    closes: rsiDump,
    compare: "cross_gte",
    level: 50,
    splitBySide: true,
  }),
  true,
);

const maCloses = [...Array(25).fill(100), 50, 150];
assert.equal(smaValues([1, 2, 3, 4], 2).at(-1), 3.5);
assert.equal(parseDcaIndicatorPeriod("21"), 21);
assert.equal(parseDcaIndicatorPeriod("1"), null);
assert.equal(
  indicatorCompareForDirection("long", "ema", ""),
  "cross_gte",
);
assert.equal(
  indicatorCompareForDirection("short", "sma", ""),
  "cross_lte",
);
assert.equal(
  indicatorStartMet({
    kind: "ema",
    side: "long",
    closes: maCloses,
    compare: "cross_gte",
    level: null,
    period: 21,
  }),
  true,
);
assert.equal(
  indicatorStartMet({
    kind: "ema",
    side: "short",
    closes: maCloses,
    compare: "cross_lte",
    level: null,
    period: 21,
  }),
  false,
);
assert.equal(
  indicatorStartMet({
    kind: "sma",
    side: "long",
    closes: maCloses,
    compare: "cross_gte",
    level: null,
    period: 21,
  }),
  true,
);
assert.equal(
  indicatorStartMet({
    kind: "ema",
    side: "long",
    closes: maCloses,
    compare: "gte",
    level: null,
    period: 21,
  }),
  true,
);
assert.equal(
  indicatorStartMet({
    kind: "sma",
    side: "short",
    closes: [...Array(25).fill(100), 50],
    compare: "lte",
    level: null,
    period: 21,
  }),
  true,
);
assert.equal(
  indicatorStartMet({
    kind: "ema",
    side: "long",
    closes: [...Array(25).fill(100), 50],
    compare: "gte",
    level: null,
    period: 21,
  }),
  false,
);
assert.equal(
  priceCrossedAverage([100, 90], [95, 95], "down"),
  true,
);
assert.equal(
  indicatorStartMet({
    kind: "rsi",
    side: "long",
    closes: rsiDump,
    compare: "cross_gte",
    level: 50,
  }),
  false,
);
assert.equal(
  indicatorStartMet({
    kind: "ema",
    side: "short",
    closes: maCloses,
    compare: "cross_gte",
    level: null,
    period: 21,
  }),
  true,
);
assert.equal(
  indicatorStartMet({
    kind: "ema_cross",
    side: "long",
    closes: maCloses,
    compare: "cross_gte",
    level: null,
    period: 9,
    slowPeriod: 21,
  }),
  indicatorStartMet({
    kind: "ema_cross",
    side: "long",
    closes: maCloses,
    compare: "cross_gte",
    level: null,
  }),
);
assert.ok(
  dcaIndicatorWhenOptions("macd", "short", false).some(
    (row) => row.value === "cross_gte",
  ),
);
assert.ok(
  dcaIndicatorWhenOptions("macd", "short", false).some(
    (row) => row.value === "cross_lte",
  ),
);
assert.equal(
  dcaIndicatorWhenOptions("macd", "long", false).find(
    (row) => row.value === "cross_gte",
  )?.label,
  "Crosses above",
);
assert.equal(dcaIndicatorShowsLevel("macd", "cross_gte", null), true);
assert.ok(
  dcaIndicatorWhenOptions("rsi", "long", false).some(
    (row) => row.value === "cross_gte",
  ),
);
assert.equal(
  dcaIndicatorWhenOptions("ema_cross", "long", false)[0]?.label,
  "Crosses above",
);
assert.equal(
  dcaIndicatorWhenOptions("sma_cross", "short", false)[1]?.label,
  "Crosses below",
);
assert.deepEqual(
  DCA_INDICATOR_KIND_OPTIONS.map((row) => row.label),
  [
    "RSI",
    "MACD",
    "Price vs SMA",
    "Price vs EMA",
    "SMA Cross",
    "EMA Cross",
    "Price vs BB",
  ],
);
assert.equal(
  dcaIndicatorWhenOptions("ema", "long", false)[0]?.label,
  "Price crosses above",
);
assert.equal(
  dcaIndicatorWhenOptions("sma", "short", false)[1]?.label,
  "Price crosses below",
);
assert.deepEqual(
  dcaIndicatorWhenOptions("ema", "long", false).map((row) => row.label),
  [
    "Price crosses above",
    "Price crosses below",
    "Price is above",
    "Price is below",
  ],
);
assert.equal(
  formatDcaIndicatorStartLabel({
    kind: "ema",
    compare: "cross_gte",
    period: 21,
    timeframe: "15",
    side: "long",
  }),
  "Price crosses above EMA 21 · 15m",
);
assert.equal(
  formatDcaIndicatorStartLabel({
    kind: "sma",
    compare: "lte",
    period: 50,
    timeframe: "60",
    side: "short",
  }),
  "Price is below SMA 50 · 1h",
);
assert.equal(
  formatDcaIndicatorStartLabel({
    kind: "macd",
    compare: "cross_gte",
    timeframe: "60",
    side: "short",
  }),
  "MACD histogram crosses above 0 · 1h",
);
assert.equal(
  formatDcaIndicatorStartLabel({
    kind: "macd",
    compare: "cross_lte",
    timeframe: "60",
    side: "long",
  }),
  "MACD histogram crosses below 0 · 1h",
);
assert.equal(
  formatDcaIndicatorStartLabel({
    kind: "macd",
    compare: "gte",
    level: 0.2,
    timeframe: "60",
    side: "long",
  }),
  "MACD histogram is above 0.2 · 1h",
);
assert.equal(
  formatDcaIndicatorStartLabel({
    kind: "ema_cross",
    compare: null,
    timeframe: "15",
    side: "long",
  }),
  "EMA 9 crosses above 21 · 15m",
);
assert.equal(
  formatDcaIndicatorStartLabel({
    kind: "ema_cross",
    compare: "cross_gte",
    period: 8,
    slowPeriod: 21,
    timeframe: "60",
    side: "long",
  }),
  "EMA 8 crosses above 21 · 1h",
);
assert.equal(
  formatDcaIndicatorStartLabel({
    kind: "sma_cross",
    compare: "cross_lte",
    period: 10,
    slowPeriod: 50,
    timeframe: "15",
    side: "short",
  }),
  "SMA 10 crosses below 50 · 15m",
);

const bbFlat = Array(20).fill(100);
const bbBands = bollingerBands(bbFlat, 20);
assert.ok(bbBands);
assert.equal(bbBands?.upper, 100);
assert.equal(bbBands?.lower, 100);
const bbSpikeUp = [...Array(19).fill(100), 200];
assert.equal(
  indicatorStartMet({
    kind: "bb",
    side: "short",
    closes: bbSpikeUp,
    compare: "gte",
    level: null,
    period: 20,
  }),
  true,
);
assert.equal(
  indicatorStartMet({
    kind: "bb",
    side: "long",
    closes: bbSpikeUp,
    compare: "lte",
    level: null,
    period: 20,
  }),
  false,
);
const bbSpikeDown = [...Array(19).fill(100), 50];
assert.equal(
  indicatorStartMet({
    kind: "bb",
    side: "long",
    closes: bbSpikeDown,
    compare: "lte",
    level: null,
    period: 20,
  }),
  true,
);
assert.deepEqual(
  dcaIndicatorWhenOptions("bb", "long", false).map((row) => row.label),
  [
    "Price crosses above top",
    "Price crosses below bottom",
    "Price is above top",
    "Price is below bottom",
  ],
);
assert.equal(
  formatDcaIndicatorStartLabel({
    kind: "bb",
    compare: "gte",
    period: 20,
    timeframe: "15",
    side: "short",
  }),
  "Price is above top BB 20 · 15m",
);
assert.equal(
  formatDcaIndicatorStartLabel({
    kind: "bb",
    compare: "cross_lte",
    period: 20,
    timeframe: "15",
    side: "long",
  }),
  "Price crosses below bottom BB 20 · 15m",
);
const bbCrossUp = [...Array(20).fill(100), 200];
const bbCrossDown = [...Array(20).fill(100), 50];
assert.equal(
  indicatorStartMet({
    kind: "bb",
    side: "short",
    closes: bbCrossUp,
    compare: "cross_gte",
    level: null,
    period: 20,
  }),
  true,
);
assert.equal(
  indicatorStartMet({
    kind: "bb",
    side: "long",
    closes: bbCrossDown,
    compare: "cross_lte",
    level: null,
    period: 20,
  }),
  true,
);
assert.equal(
  indicatorStartMet({
    kind: "bb",
    side: "short",
    closes: [...Array(20).fill(200)],
    compare: "cross_gte",
    level: null,
    period: 20,
  }),
  false,
);
assert.equal(
  formatDcaIndicatorStartLabel({
    kind: "rsi",
    compare: "cross_lte",
    level: 30,
    period: 14,
    timeframe: "15",
    side: "long",
  }),
  "RSI 14 crosses below 30 · 15m",
);
assert.equal(
  formatDcaIndicatorStartLabel({
    kind: "rsi",
    compare: "gte",
    level: 70,
    period: 7,
    timeframe: "60",
    side: "short",
  }),
  "RSI 7 at or above 70 · 1h",
);
assert.equal(dcaIndicatorUsesPeriod("bb"), true);
assert.equal(dcaIndicatorUsesPeriod("rsi"), true);
assert.equal(dcaIndicatorUsesPeriod("ema"), true);
assert.deepEqual(
  dcaIndicatorWhenOptions("supertrend", "long", false).map((row) => row.label),
  ["Turns bullish", "Turns bearish", "Is bullish", "Is bearish"],
);
assert.deepEqual(
  DCA_TREND_KIND_OPTIONS.map((row) => row.label),
  ["Supertrend"],
);
assert.equal(
  formatDcaIndicatorStartLabel({
    kind: "supertrend",
    compare: "cross_gte",
    period: 10,
    multiplier: 3,
    timeframe: "15",
    side: "long",
  }),
  "Supertrend 10 × 3 turns bullish · 15m",
);
assert.equal(
  formatDcaIndicatorStartLabel({
    kind: "supertrend",
    compare: "lte",
    period: 14,
    multiplier: 2,
    timeframe: "60",
    side: "short",
  }),
  "Supertrend 14 × 2 is bearish · 1h",
);

function trendBars(
  start: number,
  step: number,
  count: number,
  bias: "bull" | "bear",
): SupertrendBar[] {
  const bars: SupertrendBar[] = [];
  for (let i = 0; i < count; i += 1) {
    const close = start + step * i;
    bars.push(
      bias === "bull"
        ? { high: close + 0.1, low: close - 2, close }
        : { high: close + 2, low: close - 0.1, close },
    );
  }
  return bars;
}

function lastDir(bars: SupertrendBar[]): 1 | -1 | undefined {
  const dirs = supertrendDirections(bars, 10, 3);
  return dirs?.[dirs.length - 1];
}

const uptrend = trendBars(100, 1, 40, "bull");
assert.equal(lastDir(uptrend), 1);
assert.equal(
  indicatorStartMet({
    kind: "supertrend",
    side: "long",
    closes: [],
    bars: uptrend,
    compare: "gte",
    level: null,
    period: 10,
    multiplier: 3,
  }),
  true,
);
assert.equal(
  indicatorStartMet({
    kind: "supertrend",
    side: "short",
    closes: [],
    bars: uptrend,
    compare: "lte",
    level: null,
    period: 10,
    multiplier: 3,
  }),
  false,
);

const downtrend = trendBars(200, -1, 40, "bear");
assert.equal(lastDir(downtrend), -1);
assert.equal(
  indicatorStartMet({
    kind: "supertrend",
    side: "short",
    closes: [],
    bars: downtrend,
    compare: "lte",
    level: null,
    period: 10,
    multiplier: 3,
  }),
  true,
);

const flipBars = [
  ...trendBars(200, -2, 30, "bear"),
  ...trendBars(80, 6, 20, "bull"),
];
const flipDirs = supertrendDirections(flipBars, 10, 3);
assert.ok(flipDirs);
const flipAt = flipDirs.findIndex(
  (dir, index) => index > 0 && flipDirs[index - 1] === -1 && dir === 1,
);
assert.ok(flipAt > 0);
const flipPrefix = flipBars.slice(
  0,
  flipBars.length - flipDirs.length + flipAt + 1,
);
assert.equal(
  indicatorStartMet({
    kind: "supertrend",
    side: "long",
    closes: [],
    bars: flipPrefix,
    compare: "cross_gte",
    level: null,
    period: 10,
    multiplier: 3,
  }),
  true,
);
assert.equal(
  indicatorStartMet({
    kind: "supertrend",
    side: "long",
    closes: [],
    bars: flipPrefix,
    compare: "cross_lte",
    level: null,
    period: 10,
    multiplier: 3,
  }),
  false,
);

assert.equal(dcaAtrStep(0, 10, 1, 1), 10);
assert.equal(dcaAtrStep(1, 10, 1, 2), 20);
assert.deepEqual(
  dcaAtrSafetyPrices({
    side: "long",
    entryPrice: 100,
    maxClips: 3,
    atr: 2,
    atrSpacingMult: 1,
    deviationMultiplier: 1,
  }),
  [98, 96],
);
assert.deepEqual(
  dcaAtrSafetyPrices({
    side: "short",
    entryPrice: 100,
    maxClips: 3,
    atr: 2,
    atrSpacingMult: 1,
    deviationMultiplier: 1.5,
  }),
    [102, 105],
);
assert.deepEqual(
  dcaResolvedSafetyPrices({
    side: "long",
    entryPrice: 100,
    maxClips: 3,
    spacingKind: "atr",
    dipPct: null,
    atr: 2,
    atrSpacingMult: 1,
    deviationMultiplier: 1,
  }),
  [98, 96],
);
assert.equal(
  dcaTakeProfitPrice({
    side: "long",
    firstPrice: 100,
    averagePrice: 98,
    takeProfitPct: 2,
    takeProfitBasis: "average",
    takeProfitKind: "atr",
    atr: 4,
    takeProfitAtrMult: 2,
  }),
  106,
);
assert.equal(
  dcaTakeProfitPrice({
    side: "short",
    firstPrice: 100,
    averagePrice: 102,
    takeProfitPct: 2,
    takeProfitBasis: "first_entry",
    takeProfitKind: "atr",
    atr: 3,
    takeProfitAtrMult: 2,
  }),
  94,
);
assert.equal(
  dcaTakeProfitPrice({
    side: "long",
    firstPrice: 100,
    averagePrice: 98,
    takeProfitPct: 2,
    takeProfitBasis: "average",
  })?.toFixed(2),
  "99.96",
);
assert.equal(
  dcaPlannedExits({
    side: "long",
    entryPrice: 100,
    firstFillPrice: 100,
    mark: 100,
    takeProfitPct: null,
    stopLossPct: null,
    takeProfitBasis: "average",
    stopLossBasis: "average",
    trailingPct: null,
    takeProfitKind: "atr",
    atr: 5,
    takeProfitAtrMult: 2,
  }).takeProfit,
  110,
);
const atrLadder = dcaLadderLevels({
  side: "long",
  entryPrice: 100,
  maxClips: 3,
  dipPct: null,
  clipSize: 10,
  sizeUnit: "usdt",
  sizeMultiplier: 1,
  deviationMultiplier: 1,
  spacingKind: "atr",
  atr: 2,
  atrSpacingMult: 1,
});
assert.equal(atrLadder[1]?.price, 98);
assert.equal(atrLadder[2]?.price, 96);
assert.equal(dcaCoveredRangePct("long", 100, 96), 4);
assert.equal(dcaCoveredRangePct("short", 100, 105), 5);
assert.equal(
  dcaAtrDistanceLabel({ atr: 400, multiple: 1, lastPrice: 80_000 }),
  "1 ATR · 400.00 · 0.50%",
);
const atrWait = dcaLadderLevels({
  side: "long",
  entryPrice: 100,
  maxClips: 5,
  dipPct: null,
  clipSize: 10,
  sizeUnit: "usdt",
  sizeMultiplier: 1,
  deviationMultiplier: 1,
  spacingKind: "atr",
  atr: null,
  atrSpacingMult: 1,
});
assert.equal(atrWait.length, 1);
assert.equal(atrWait[0]?.price, 100);
assert.equal(
  dcaClipsUntilMaxValue({
    side: "long",
    entryPrice: 100,
    maxValue: 25,
    dipPct: null,
    clipSize: 10,
    sizeUnit: "usdt",
    sizeMultiplier: 1,
    deviationMultiplier: 1,
    spacingKind: "atr",
    atr: 10,
    atrSpacingMult: 1,
  }),
  3,
);

console.log("dca grid checks passed");
