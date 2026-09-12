import { formatUnits, parseEther } from "viem";

export const DEFAULT_GAS_LOW_ETH = "0.005";
const MAX_GAS_LOW_ETH = "10";

export function parseGasLowEth(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,8})?$/.test(raw)) {
    return null;
  }
  try {
    const wei = parseEther(raw);
    if (wei <= BigInt(0) || wei > parseEther(MAX_GAS_LOW_ETH)) {
      return null;
    }
    return formatEthAmount(wei);
  } catch {
    return null;
  }
}

export function formatEthAmount(wei: bigint): string {
  return formatTokenAmount(wei, 18);
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const [whole, frac = ""] = formatUnits(amount, decimals).split(".");
  const trimmed = frac.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function isGasBalanceLow(balanceWei: bigint, lowEth: string): boolean {
  const parsed = parseGasLowEth(lowEth);
  if (!parsed) {
    return false;
  }
  return balanceWei <= parseEther(parsed);
}

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
