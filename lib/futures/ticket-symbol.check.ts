import assert from "node:assert/strict";
import { ticketSymbolFromCookie } from "./ticket-symbol";

const options = [{ symbol: "BTCUSDT" }, { symbol: "SOLUSDT" }];

assert.equal(ticketSymbolFromCookie("SOLUSDT", options, "BTCUSDT"), "SOLUSDT");
assert.equal(ticketSymbolFromCookie("ETHUSDT", options, "BTCUSDT"), "BTCUSDT");
assert.equal(ticketSymbolFromCookie(undefined, options, "BTCUSDT"), "BTCUSDT");
assert.equal(ticketSymbolFromCookie("  ", options, "BTC"), "BTC");

console.log("ticket symbol checks passed");
