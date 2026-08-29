import assert from "node:assert/strict";
import {
  shouldFlattenLedgerToVenue,
  workingReduceOnlyCovers,
} from "./venue-flatten";

const base = {
  ledgerQty: 1,
  venueQty: 0,
  openedAtMs: 0,
  nowMs: 10_000,
  minAgeMs: 8_000,
  hasWorkingReduceOnly: false,
};

assert.equal(shouldFlattenLedgerToVenue(base), true);
assert.equal(
  shouldFlattenLedgerToVenue({ ...base, nowMs: 7_000 }),
  false,
);
assert.equal(
  shouldFlattenLedgerToVenue({ ...base, venueQty: 1 }),
  false,
);
assert.equal(
  shouldFlattenLedgerToVenue({ ...base, hasWorkingReduceOnly: true }),
  false,
);
assert.equal(
  shouldFlattenLedgerToVenue({
    ...base,
    ledgerQty: 1,
    venueQty: 0.4,
    hasWorkingReduceOnly: true,
  }),
  true,
);

assert.equal(
  workingReduceOnlyCovers({
    symbol: "BTC",
    side: "long",
    working: [
      { symbol: "BTC", side: "long", reduceOnly: true, status: "open" },
    ],
  }),
  true,
);
assert.equal(
  workingReduceOnlyCovers({
    symbol: "BTC",
    side: "long",
    working: [
      { symbol: "BTC", side: "short", reduceOnly: true, status: "open" },
    ],
  }),
  false,
);
assert.equal(
  workingReduceOnlyCovers({
    symbol: "BTC",
    side: "long",
    working: [{ symbol: "ETH", side: "long", reduceOnly: true }],
  }),
  false,
);

console.log("venue flatten checks passed");
