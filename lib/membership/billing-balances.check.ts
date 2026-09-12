import assert from "node:assert/strict";
import { leftoverWalletCount, sumTokenAmounts } from "./billing-balances";

assert.equal(leftoverWalletCount([]), 0);
assert.equal(
  leftoverWalletCount([BigInt(0), BigInt(1), BigInt(0), BigInt(4)]),
  2,
);
assert.equal(
  sumTokenAmounts([BigInt(1), BigInt(2), BigInt("2500000")]),
  BigInt("2500003"),
);

console.log("membership billing balances checks passed");
