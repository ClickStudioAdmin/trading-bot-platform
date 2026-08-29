import assert from "node:assert/strict";
import { formatMarketCap, marketCapByBase } from "@/lib/market/caps";
import {
  PAIRS_PAGE_SIZE,
  paginatePairRows,
  pairPageHref,
  pairPageLabel,
  sortByMarketCap,
} from "@/lib/pairs/page";

assert.equal(PAIRS_PAGE_SIZE, 50);

const caps = marketCapByBase([
  { symbol: "btc", market_cap: 2_000_000_000_000 },
  { symbol: "eth", market_cap: 400_000_000_000 },
  { symbol: "btc", market_cap: 1 },
  { symbol: "doge", market_cap: 0 },
]);
assert.equal(caps.get("BTC"), 2_000_000_000_000);
assert.equal(caps.get("ETH"), 400_000_000_000);
assert.equal(caps.has("DOGE"), false);

assert.equal(formatMarketCap(2_100_000_000_000), "$2.1T");
assert.equal(formatMarketCap(45_200_000_000), "$45.2B");
assert.equal(formatMarketCap(120_000_000), "$120.0M");
assert.equal(formatMarketCap(null), "—");

const ranked = sortByMarketCap(
  [
    { base: "AAA", symbol: "AAAUSDT" },
    { base: "ETH", symbol: "ETHUSDT" },
    { base: "BTC", symbol: "BTCUSDT" },
    { base: "ETH", symbol: "ETHUSDT-26SEP26" },
  ],
  (row) => caps.get(row.base) ?? null,
  (left, right) => left.symbol.localeCompare(right.symbol),
);
assert.deepEqual(
  ranked.map((row) => row.symbol),
  ["BTCUSDT", "ETHUSDT", "ETHUSDT-26SEP26", "AAAUSDT"],
);

const many = Array.from({ length: 51 }, (_, index) => index);
const first = paginatePairRows(many, "1");
assert.equal(first.page, 1);
assert.equal(first.pageCount, 2);
assert.equal(first.rows.length, 50);
assert.equal(first.from, 0);
assert.equal(first.to, 50);
const second = paginatePairRows(many, "2");
assert.equal(second.rows.length, 1);
assert.equal(second.from, 50);
assert.equal(second.to, 51);
assert.equal(paginatePairRows(many, "99").page, 2);
assert.equal(paginatePairRows([], "3").page, 1);

assert.equal(
  pairPageHref({
    path: "/strategies/futures/pairs",
    deskId: "11111111-1111-4111-8111-111111111111",
    filters: { q: "btc", base: "BTC", minDte: null, maxDte: null },
    page: 2,
  }),
  "/strategies/futures/pairs?desk=11111111-1111-4111-8111-111111111111&q=btc&base=BTC&page=2",
);
assert.equal(
  pairPageHref({
    path: "/strategies/cash-and-carry/pairs",
    filters: { q: "", base: "", minDte: 10, maxDte: 90 },
    page: 1,
  }),
  "/strategies/cash-and-carry/pairs?minDte=10&maxDte=90",
);
assert.equal(
  pairPageLabel({ page: 1, total: 51, from: 0, to: 50 }),
  "Showing 1–50 of 51",
);

console.log("pair page checks passed");
