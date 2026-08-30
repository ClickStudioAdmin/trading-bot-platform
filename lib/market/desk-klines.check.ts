import assert from "node:assert/strict";
import { hyperliquidCandleInterval } from "./desk-klines";

assert.equal(hyperliquidCandleInterval("5"), "5m");
assert.equal(hyperliquidCandleInterval("60"), "1h");
assert.equal(hyperliquidCandleInterval("D"), "1d");
assert.equal(hyperliquidCandleInterval("720"), "12h");
assert.equal(hyperliquidCandleInterval("360"), "4h");

console.log("desk kline interval checks passed");
