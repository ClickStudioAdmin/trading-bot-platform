import assert from "node:assert/strict";
import { parseTickerSymbolsQuery } from "./tickers";

assert.deepEqual(parseTickerSymbolsQuery("btcusdt,ETHUSDT,btcusdt"), [
  "BTCUSDT",
  "ETHUSDT",
]);
assert.deepEqual(parseTickerSymbolsQuery("nope,SOLUSDT"), ["NOPE", "SOLUSDT"]);
assert.deepEqual(parseTickerSymbolsQuery("btc,ETHUSDT"), ["BTC", "ETHUSDT"]);
assert.equal(parseTickerSymbolsQuery("").length, 0);

console.log("market ticker checks passed");
