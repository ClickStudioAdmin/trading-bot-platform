import type { Hex } from "viem";
import {
  DEFAULT_GAS_LOW_ETH,
  formatEthAmount,
  isGasBalanceLow,
  parseGasLowEth,
} from "./gas-drip";
import { billingPublicClient } from "./rpc";
import type { BillingChain } from "./wallet-store";

export type GasChainBalance = {
  chainId: string;
  name: string;
  explorerUrl: string | null;
  balanceEth: string | null;
  low: boolean;
  error: string | null;
};

export function gasExplorerAddressUrl(
  explorerUrl: string | null,
  address: string,
): string | null {
  if (!explorerUrl) {
    return null;
  }
  return `${explorerUrl.replace(/\/$/, "")}/address/${address}`;
}

export async function listGasWalletBalances(
  address: string,
  chains: BillingChain[],
  lowEth: string,
): Promise<GasChainBalance[]> {
  const threshold = parseGasLowEth(lowEth) ?? DEFAULT_GAS_LOW_ETH;
  return Promise.all(
    chains.map(async (chain) => {
      try {
        const publicClient = billingPublicClient(chain);
        const balanceWei = await publicClient.getBalance({
          address: address as Hex,
        });
        return {
          chainId: chain.id,
          name: chain.name,
          explorerUrl: chain.explorerUrl,
          balanceEth: formatEthAmount(balanceWei),
          low: isGasBalanceLow(balanceWei, threshold),
          error: null,
        };
      } catch (cause) {
        return {
          chainId: chain.id,
          name: chain.name,
          explorerUrl: chain.explorerUrl,
          balanceEth: null,
          low: false,
          error: cause instanceof Error ? cause.message : "Balance unavailable.",
        };
      }
    }),
  );
}
