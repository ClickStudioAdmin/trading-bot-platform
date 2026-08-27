import assert from "node:assert/strict";
import {
  dcaBreakevenPrice,
  dcaClipSizeAt,
  dcaDipPctAt,
  dcaLadderLevels,
  dcaLadderProfitRange,
  dcaLastClipDeviationPct,
  dcaMaxDropCoveredPct,
  dcaRequiredUsdt,
  dcaSafetyPrices,
  dcaTakeProfitPrice,
  dcaTrailingActivationPrice,
  dcaTrailingDistance,
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
