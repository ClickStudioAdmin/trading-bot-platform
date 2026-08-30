import assert from "node:assert/strict";
import {
  iconLookupKeys,
  iconUrlForSymbol,
  marketIconsByBase,
} from "./icons";

assert.deepEqual(iconLookupKeys("btc"), ["BTC"]);
assert.deepEqual(iconLookupKeys("1000PEPE"), ["1000PEPE", "PEPE"]);
assert.deepEqual(iconLookupKeys("10000SATS"), ["10000SATS", "SATS"]);
assert.deepEqual(iconLookupKeys(""), []);

const icons = marketIconsByBase([
  { symbol: "btc", image: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png" },
  { symbol: "eth", image: "https://assets.coingecko.com/coins/images/279/large/ethereum.png" },
  { symbol: "btc", image: "https://example.com/other.png" },
  { symbol: "scam", image: "http://insecure.example/x.png" },
  { symbol: "bad", image: "not-a-url" },
]);
assert.equal(
  icons.get("BTC"),
  "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
);
assert.equal(icons.has("SCAM"), false);
assert.equal(icons.has("BAD"), false);

assert.equal(
  iconUrlForSymbol(icons, "1000PEPE"),
  null,
);
assert.equal(iconUrlForSymbol(icons, "BTC"), icons.get("BTC"));
assert.equal(
  iconUrlForSymbol({ PEPE: "https://assets.coingecko.com/pepe.png" }, "1000PEPE"),
  "https://assets.coingecko.com/pepe.png",
);

console.log("market icon checks passed");
