import assert from "node:assert/strict";
import {
  applyOpportunityFilters,
  filterInputValues,
  filtersAreActive,
  parseOpportunityFilters,
} from "./filter";
import type { ScannedOpportunity } from "./scan";

function row(
  patch: Partial<ScannedOpportunity> &
    Pick<ScannedOpportunity, "netApr" | "daysToExpiry" | "capacityUsdt">,
): ScannedOpportunity {
  return {
    baseCoin: "BTC",
    spotSymbol: "BTCUSDT",
    futureSymbol: "BTCUSDT-26DEC25",
    deliveryTimeMs: 0,
    deliveryDate: "2025-12-26",
    futureBid: 1,
    spotAsk: 1,
    executableBasis: 0,
    feeRate: 0,
    netBasis: 0,
    ...patch,
  };
}

const rows = [
  row({ futureSymbol: "A", netApr: 0.12, daysToExpiry: 10, capacityUsdt: 8_000 }),
  row({ futureSymbol: "B", netApr: 0.04, daysToExpiry: 40, capacityUsdt: 20_000 }),
  row({ futureSymbol: "C", netApr: null, daysToExpiry: 5, capacityUsdt: 50_000 }),
  row({ futureSymbol: "D", netApr: 0.2, daysToExpiry: 200, capacityUsdt: 1_000 }),
];

const parsed = parseOpportunityFilters({
  minApr: "10",
  minDte: "7",
  maxDte: "90",
  minCapacity: "5000",
});
assert.equal(parsed.minNetApr, 0.1);
assert.equal(parsed.minDte, 7);
assert.equal(parsed.maxDte, 90);
assert.equal(parsed.minCapacityUsdt, 5000);
assert.equal(filtersAreActive(parsed), true);

const swapped = parseOpportunityFilters({ minDte: "90", maxDte: "7" });
assert.equal(swapped.minDte, 7);
assert.equal(swapped.maxDte, 90);

assert.deepEqual(parseOpportunityFilters({ minApr: "nope" }), {
  minNetApr: null,
  minDte: null,
  maxDte: null,
  minCapacityUsdt: null,
});
assert.equal(filtersAreActive(parseOpportunityFilters({})), false);

const filtered = applyOpportunityFilters(rows, parsed);
assert.deepEqual(
  filtered.map((item) => item.futureSymbol),
  ["A"],
);

const aprOnly = applyOpportunityFilters(
  rows,
  parseOpportunityFilters({ minApr: "10" }),
);
assert.deepEqual(
  aprOnly.map((item) => item.futureSymbol),
  ["A", "D"],
);

const inputs = filterInputValues(parsed);
assert.equal(inputs.minApr, "10");
assert.equal(inputs.minDte, "7");
assert.equal(inputs.maxDte, "90");
assert.equal(inputs.minCapacity, "5000");

console.log("opportunity filter checks passed");
