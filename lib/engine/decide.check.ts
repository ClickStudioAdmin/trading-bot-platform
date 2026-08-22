import assert from "node:assert/strict";
import {
  bestMatchingLayer,
  decideEntries,
  decideExits,
  type PaperEngineConfig,
  type PaperEngineLayer,
} from "./decide";
import type { ScannedOpportunity } from "../opportunities/scan";

function opportunity(
  futureSymbol: string,
  extras: Partial<ScannedOpportunity> = {},
): ScannedOpportunity {
  return {
    baseCoin: "BTC",
    spotSymbol: "BTCUSDT",
    futureSymbol,
    deliveryTimeMs: 1,
    deliveryDate: "2026-12-25",
    daysToExpiry: 30,
    futureBid: 1,
    spotAsk: 1,
    executableBasis: 0.02,
    feeRate: 0.002,
    netBasis: 0.018,
    netApr: 0.2,
    capacityUsdt: 50_000,
    ...extras,
  };
}

function layer(
  extras: Partial<PaperEngineLayer> = {},
): PaperEngineLayer {
  return {
    id: 1,
    sortOrder: 0,
    sizeType: "fixed",
    notionalUsdt: 10_000,
    minNetApr: 0.1,
    minDte: 7,
    maxDte: 90,
    minCapacityUsdt: 5_000,
    minSizeUsdt: null,
    maxOpenCount: 2,
    maxOpenNotionalUsdt: 25_000,
    closeMaxDte: 3,
    closeMinNetApr: 0.05,
    takeProfitPct: 0.01,
    stopLossPct: -0.02,
    ...extras,
  };
}

const base = layer();
const stretch = layer({
  id: 2,
  sortOrder: 1,
  notionalUsdt: 25_000,
  minNetApr: 0.2,
  maxOpenCount: 1,
  maxOpenNotionalUsdt: 25_000,
});
const config: PaperEngineConfig = { enabled: true, layers: [base, stretch] };

const high = opportunity("BTCUSDT-25JUN27", { netApr: 0.3, daysToExpiry: 40 });
const mid = opportunity("BTCUSDT-25SEP26", { netApr: 0.15, daysToExpiry: 20 });
const low = opportunity("BTCUSDT-25DEC26", { netApr: 0.02, daysToExpiry: 20 });

assert.equal(bestMatchingLayer(high, config.layers)?.id, 2);
assert.equal(bestMatchingLayer(mid, config.layers)?.id, 1);
assert.equal(bestMatchingLayer(low, config.layers), null);

assert.deepEqual(decideEntries([high], [], { ...config, enabled: false }), []);

const ranked = decideEntries([mid, low, high], [], config);
assert.deepEqual(
  ranked.map((row) => [row.opportunity.futureSymbol, row.layer.id]),
  [
    ["BTCUSDT-25JUN27", 2],
    ["BTCUSDT-25SEP26", 1],
  ],
);

const skipOpen = decideEntries(
  [high, mid],
  [
    {
      spotSymbol: "BTCUSDT",
      futureSymbol: "BTCUSDT-25JUN27",
      notionalUsdt: 10_000,
      ruleId: 2,
    },
  ],
  config,
);
assert.deepEqual(
  skipOpen.map((row) => row.opportunity.futureSymbol),
  ["BTCUSDT-25SEP26"],
);

const layerCapped = decideEntries(
  [high, opportunity("BTCUSDT-26JUN27", { netApr: 0.28 })],
  [],
  config,
);
assert.equal(layerCapped.length, 1);
assert.equal(layerCapped[0]?.layer.id, 2);

assert.equal(
  decideExits(
    [
      {
        spotSymbol: "BTCUSDT",
        futureSymbol: high.futureSymbol,
        notionalUsdt: 10_000,
        ruleId: 1,
        daysToExpiry: 2,
        markNetApr: 0.2,
        pnlPct: 0.02,
      },
    ],
    config,
  )[0]?.reason,
  "dte",
);

assert.deepEqual(
  decideExits(
    [
      {
        spotSymbol: "BTCUSDT",
        futureSymbol: high.futureSymbol,
        notionalUsdt: 10_000,
        ruleId: null,
        daysToExpiry: 2,
        markNetApr: 0.01,
        pnlPct: -0.03,
      },
    ],
    config,
  ),
  [],
);

assert.equal(
  decideExits(
    [
      {
        spotSymbol: "BTCUSDT",
        futureSymbol: high.futureSymbol,
        notionalUsdt: 10_000,
        ruleId: 1,
        daysToExpiry: 2,
        markNetApr: 0.2,
        pnlPct: 0.02,
        exits: {
          closeMaxDte: null,
          closeMinNetApr: null,
          takeProfitPct: 0.01,
          stopLossPct: null,
        },
      },
    ],
    config,
  )[0]?.reason,
  "take_profit",
);

const dynamicLayer = layer({
  sizeType: "dynamic",
  minCapacityUsdt: 20_000,
  minSizeUsdt: 5_000,
});
const thin = opportunity("BTCUSDT-25MAR27", {
  netApr: 0.16,
  capacityUsdt: 8_000,
});
const dust = opportunity("BTCUSDT-25APR27", {
  netApr: 0.17,
  capacityUsdt: 4_000,
});
const dynamicHits = decideEntries(
  [thin, dust],
  [],
  { enabled: true, layers: [dynamicLayer] },
);
assert.deepEqual(
  dynamicHits.map((row) => [row.opportunity.futureSymbol, row.notionalUsdt]),
  [["BTCUSDT-25MAR27", 8_000]],
);
assert.equal(
  decideEntries(
    [opportunity("BTCUSDT-25MAY27", { netApr: 0.18, capacityUsdt: 50_000 })],
    [],
    { enabled: true, layers: [dynamicLayer] },
  )[0]?.notionalUsdt,
  10_000,
);
assert.deepEqual(
  decideEntries(
    [thin],
    [],
    { enabled: true, layers: [layer({ minCapacityUsdt: 20_000 })] },
  ),
  [],
);

console.log("engine decide checks passed");
