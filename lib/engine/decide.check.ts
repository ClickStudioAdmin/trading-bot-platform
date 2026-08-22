import assert from "node:assert/strict";
import { decideEntries, decideExits, type PaperEngineRules } from "./decide";
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

const rules: PaperEngineRules = {
  enabled: true,
  notionalUsdt: 10_000,
  minNetApr: 0.1,
  minDte: 7,
  maxDte: 90,
  minCapacityUsdt: 5_000,
  maxOpenCount: 2,
  maxOpenNotionalUsdt: 25_000,
  closeMaxDte: 3,
  closeMinNetApr: 0.05,
  takeProfitPct: 0.01,
  stopLossPct: -0.02,
};

const high = opportunity("BTCUSDT-25JUN27", { netApr: 0.3, daysToExpiry: 40 });
const mid = opportunity("BTCUSDT-25SEP26", { netApr: 0.15, daysToExpiry: 20 });
const low = opportunity("BTCUSDT-25DEC26", { netApr: 0.02, daysToExpiry: 20 });

assert.deepEqual(decideEntries([high, mid, low], [], { ...rules, enabled: false }), []);
assert.deepEqual(decideEntries([high], [], { ...rules, notionalUsdt: 0 }), []);

const ranked = decideEntries([mid, low, high], [], rules);
assert.deepEqual(
  ranked.map((row) => row.futureSymbol),
  ["BTCUSDT-25JUN27", "BTCUSDT-25SEP26"],
);

const skipOpen = decideEntries(
  [high, mid],
  [{ spotSymbol: "BTCUSDT", futureSymbol: "BTCUSDT-25JUN27", notionalUsdt: 10_000 }],
  rules,
);
assert.deepEqual(
  skipOpen.map((row) => row.futureSymbol),
  ["BTCUSDT-25SEP26"],
);

const countCapped = decideEntries([high, mid], [], { ...rules, maxOpenCount: 1 });
assert.equal(countCapped.length, 1);
assert.equal(countCapped[0]?.futureSymbol, "BTCUSDT-25JUN27");

const notionalCapped = decideEntries(
  [high, mid],
  [{ spotSymbol: "ETHUSDT", futureSymbol: "ETHUSDT-25JUN27", notionalUsdt: 20_000 }],
  rules,
);
assert.equal(notionalCapped.length, 0);

assert.deepEqual(
  decideExits(
    [
      {
        spotSymbol: "BTCUSDT",
        futureSymbol: high.futureSymbol,
        notionalUsdt: 10_000,
        daysToExpiry: 2,
        markNetApr: 0.2,
        pnlPct: 0.02,
      },
    ],
    rules,
  ).map((row) => row.reason),
  ["dte"],
);

assert.deepEqual(
  decideExits(
    [
      {
        spotSymbol: "BTCUSDT",
        futureSymbol: high.futureSymbol,
        notionalUsdt: 10_000,
        daysToExpiry: 20,
        markNetApr: 0.01,
        pnlPct: 0.02,
      },
    ],
    rules,
  ).map((row) => row.reason),
  ["mark_apr"],
);

assert.deepEqual(
  decideExits(
    [
      {
        spotSymbol: "BTCUSDT",
        futureSymbol: high.futureSymbol,
        notionalUsdt: 10_000,
        daysToExpiry: 20,
        markNetApr: 0.2,
        pnlPct: 0.015,
      },
    ],
    rules,
  ).map((row) => row.reason),
  ["take_profit"],
);

assert.deepEqual(
  decideExits(
    [
      {
        spotSymbol: "BTCUSDT",
        futureSymbol: high.futureSymbol,
        notionalUsdt: 10_000,
        daysToExpiry: 20,
        markNetApr: 0.2,
        pnlPct: -0.03,
      },
    ],
    rules,
  ).map((row) => row.reason),
  ["stop_loss"],
);

assert.deepEqual(
  decideExits(
    [
      {
        spotSymbol: "BTCUSDT",
        futureSymbol: high.futureSymbol,
        notionalUsdt: 10_000,
        daysToExpiry: null,
        markNetApr: null,
        pnlPct: null,
      },
    ],
    rules,
  ),
  [],
);

assert.deepEqual(
  decideExits(
    [
      {
        spotSymbol: "BTCUSDT",
        futureSymbol: high.futureSymbol,
        notionalUsdt: 10_000,
        daysToExpiry: 2,
        markNetApr: 0.01,
        pnlPct: -0.03,
      },
    ],
    { ...rules, enabled: false },
  ),
  [],
);

console.log("engine decide checks passed");
