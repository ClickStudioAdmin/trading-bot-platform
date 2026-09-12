import assert from "node:assert/strict";
import {
  bufferedCostWei,
  dripNeededWei,
  formatEthAmount,
  formatTokenAmount,
  gasWalletCanCover,
  isGasBalanceLow,
  parseGasLowEth,
} from "./gas-drip";

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

assert.equal(parseGasLowEth("0.005"), "0.005");
assert.equal(parseGasLowEth("0"), null);
assert.equal(parseGasLowEth("11"), null);
assert.equal(parseGasLowEth("0.000000001"), null);
assert.equal(formatEthAmount(BigInt("5000000000000000")), "0.005");
assert.equal(formatTokenAmount(BigInt("2500000"), 6), "2.5");
assert.equal(formatTokenAmount(BigInt(0), 6), "0");
assert.equal(
  isGasBalanceLow(BigInt("5000000000000000"), "0.005"),
  true,
);
assert.equal(
  isGasBalanceLow(BigInt("5000000000000001"), "0.005"),
  false,
);

console.log("membership gas drip checks passed");
