import assert from "node:assert/strict";
import {
  applyPairFilters,
  isStableBaseCoin,
  parsePairFilters,
  pairFilterInputValues,
  pairFiltersAreActive,
  uniquePairBases,
} from "./filter";

assert.equal(isStableBaseCoin("USDC"), true);
assert.equal(isStableBaseCoin("usde"), true);
assert.equal(isStableBaseCoin("BTC"), false);
assert.equal(isStableBaseCoin("1000PEPE"), false);

assert.equal(parsePairFilters({ minDte: "1,000" }).minDte, 1000);

const parsed = parsePairFilters({
  q: " btc ",
  base: "eth",
  minDte: "90",
  maxDte: "10",
});
assert.equal(parsed.q, "btc");
assert.equal(parsed.base, "ETH");
assert.equal(parsed.category, "");
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
assert.equal(parsePairFilters({ category: "Crypto" }).category, "Crypto");
assert.equal(parsePairFilters({ category: "nope" }).category, "");
assert.equal(
  applyPairFilters(
    [
      { base: "BTC", category: "Crypto" },
      { base: "TSLA", category: "Stock and metal contracts" },
    ],
    parsePairFilters({ category: "Crypto" }),
    (row) => ({ text: row.base, base: row.base, category: row.category }),
  ).length,
  1,
);

console.log("pair filter checks passed");
