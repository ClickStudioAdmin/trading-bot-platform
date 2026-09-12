export function bufferedCostWei(estimateWei: bigint): bigint {
  if (estimateWei <= BigInt(0)) {
    return BigInt(0);
  }
  return (estimateWei * BigInt(3)) / BigInt(2);
}

export function dripNeededWei(input: {
  depositBalanceWei: bigint;
  estimatedCostWei: bigint;
}): bigint {
  const need = bufferedCostWei(input.estimatedCostWei);
  if (input.depositBalanceWei >= need) {
    return BigInt(0);
  }
  return need - input.depositBalanceWei;
}

export function gasWalletCanCover(input: {
  gasWalletBalanceWei: bigint;
  dripWei: bigint;
  dripTxCostWei: bigint;
}): boolean {
  return input.gasWalletBalanceWei >= input.dripWei + input.dripTxCostWei;
}
