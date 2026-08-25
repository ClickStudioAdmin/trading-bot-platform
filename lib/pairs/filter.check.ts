import assert from "node:assert/strict";
import {
  applyPairFilters,
  parsePairFilters,
  pairFilterInputValues,
  pairFiltersAreActive,
  uniquePairBases,
} from "./filter";

const parsed = parsePairFilters({
  q: " btc ",
  base: "eth",
  minDte: "90",
  maxDte: "10",
});
assert.equal(parsed.q, "btc");
assert.equal(parsed.base, "ETH");
assert.equal(parsed.minDte, 10);
assert.equal(parsed.maxDte, 90);
assert.equal(pairFiltersAreActive(parsed), true);
assert.deepEqual(pairFilterInputValues(parsed).base, "ETH");

const rows = [
  { base: "BTC", symbol: "BTCUSDT-25SEP26", dte: 30 },
  { base: "ETH", symbol: "ETHUSDT", dte: 0 },
  { base: "SOL", symbol: "SOLUSDT", dte: 80 },
];

const bySearch = applyPairFilters(rows, parsePairFilters({ q: "btc" }), (row) => ({
  text: `${row.base} ${row.symbol}`,
  base: row.base,
  dte: row.dte,
}));
assert.equal(bySearch.length, 1);
assert.equal(bySearch[0]?.base, "BTC");

const byBase = applyPairFilters(rows, parsePairFilters({ base: "SOL" }), (row) => ({
  text: `${row.base} ${row.symbol}`,
  base: row.base,
  dte: row.dte,
}));
assert.equal(byBase.length, 1);
assert.equal(byBase[0]?.symbol, "SOLUSDT");

const byDte = applyPairFilters(
  rows,
  parsePairFilters({ minDte: "20", maxDte: "40" }),
  (row) => ({
    text: `${row.base} ${row.symbol}`,
    base: row.base,
    dte: row.dte,
  }),
);
assert.equal(byDte.length, 1);
assert.equal(byDte[0]?.base, "BTC");

const skipDte = applyPairFilters(
  rows,
  parsePairFilters({ minDte: "20" }),
  (row) => ({
    text: `${row.base} ${row.symbol}`,
    base: row.base,
  }),
);
assert.equal(skipDte.length, 3);

assert.deepEqual(uniquePairBases(["SOL", "AAA", "BTC", "ETH"]), [
  "BTC",
  "ETH",
  "SOL",
  "AAA",
]);

assert.equal(pairFiltersAreActive(parsePairFilters({})), false);

console.log("pair filter checks passed");
