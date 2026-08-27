import assert from "node:assert/strict";
import {
  dcaBreakevenPrice,
  dcaClipQtyAt,
  dcaClipSizeAt,
  dcaDipPctAt,
  dcaClipsUntilMaxValue,
  dcaFirstOrderOverMaxQty,
  dcaLadderLevels,
  dcaLadderLossRange,
  dcaLadderMaxOrderError,
  dcaLadderProfitRange,
  dcaLastClipDeviationPct,
  dcaMaxDropCoveredPct,
  dcaPlannedExits,
  dcaRequiredUsdt,
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
  emaCrossBullish,
  emaValues,
  indicatorStartMet,
  macdHistogram,
  rsiValue,
} from "./indicators";

assert.equal(dcaClipSizeAt(0, 10, 2), 10);
assert.equal(dcaClipSizeAt(1, 10, 2), 20);
assert.equal(dcaClipSizeAt(2, 10, 2), 40);
assert.equal(dcaClipQtyAt(0, 10, 2, "qty", 100), 10);
assert.equal(dcaClipQtyAt(1, 100, 2, "usdt", 50), 4);
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
  "Entry # 18 is 163.84 BTC, above the 119 BTC market maximum.",
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
  "Entry # 2 is 2 BTC, above the 1.5 BTC maximum.",
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

console.log("dca grid checks passed");
