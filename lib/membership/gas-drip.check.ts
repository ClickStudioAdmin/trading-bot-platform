import assert from "node:assert/strict";
import { bufferedCostWei, dripNeededWei, gasWalletCanCover } from "./gas-drip";

assert.equal(bufferedCostWei(BigInt(100)), BigInt(150));
assert.equal(bufferedCostWei(BigInt(0)), BigInt(0));
assert.equal(
  dripNeededWei({
    depositBalanceWei: BigInt(200),
    estimatedCostWei: BigInt(100),
  }),
  BigInt(0),
);
assert.equal(
  dripNeededWei({
    depositBalanceWei: BigInt(10),
    estimatedCostWei: BigInt(100),
  }),
  BigInt(140),
);
assert.equal(
  gasWalletCanCover({
    gasWalletBalanceWei: BigInt(200),
    dripWei: BigInt(140),
    dripTxCostWei: BigInt(50),
  }),
  true,
);
assert.equal(
  gasWalletCanCover({
    gasWalletBalanceWei: BigInt(180),
    dripWei: BigInt(140),
    dripTxCostWei: BigInt(50),
  }),
  false,
);

console.log("membership gas drip checks passed");
