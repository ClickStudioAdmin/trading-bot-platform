import type { Hex } from "viem";
import { formatEthAmount, formatTokenAmount } from "./gas-drip";
import { billingPublicClient, ERC20_ABI } from "./rpc";
import type {
  BillingChain,
  BillingToken,
  DepositAddress,
  UnsweptDepositCredit,
} from "./wallet-store";

const READ_CHUNK = 8;

export type WalletAssetBalance = {
  symbol: string;
  amount: string | null;
  error: string | null;
};

export type AdminWalletSnapshot = {
  chainId: string;
  chainName: string;
  address: string | null;
  explorerUrl: string | null;
  assets: WalletAssetBalance[];
};

export type DepositSweepSnapshot = {
  chainId: string;
  chainName: string;
  addressCount: number;
  leftoverWallets: number;
  failed: number;
  assets: WalletAssetBalance[];
  creditedUnsweptCount: number;
  creditedUnsweptUsd: number;
};

type AddressAssets = {
  ethWei: bigint;
  tokens: { id: string; amount: bigint }[];
};

export function leftoverWalletCount(held: bigint[]): number {
  return held.filter((amount) => amount > BigInt(0)).length;
}

export function sumTokenAmounts(amounts: bigint[]): bigint {
  return amounts.reduce((total, amount) => total + amount, BigInt(0));
}

async function mapChunk<T, R>(
  items: T[],
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += READ_CHUNK) {
    const slice = items.slice(i, i + READ_CHUNK);
    out.push(...(await Promise.all(slice.map(work))));
  }
  return out;
}

async function readAddressAssets(
  chain: BillingChain,
  address: string,
  tokens: BillingToken[],
): Promise<AddressAssets> {
  const publicClient = billingPublicClient(chain);
  const erc20 = tokens.filter((token) => token.kind !== "native");
  const [ethWei, ...tokenAmounts] = await Promise.all([
    publicClient.getBalance({ address: address as Hex }),
    ...erc20.map((token) =>
      publicClient.readContract({
        address: token.contractAddress as Hex,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as Hex],
      }),
    ),
  ]);
  return {
    ethWei,
    tokens: erc20.map((token, index) => ({
      id: token.id,
      amount: tokenAmounts[index] ?? BigInt(0),
    })),
  };
}

function assetsFromTotals(
  ethWei: bigint,
  tokens: BillingToken[],
  tokenTotals: Map<string, bigint>,
  error: string | null,
): WalletAssetBalance[] {
  return [
    {
      symbol: "ETH",
      amount: error ? null : formatEthAmount(ethWei),
      error,
    },
    ...tokens
      .filter((token) => token.kind !== "native")
      .map((token) => ({
        symbol: token.symbol,
        amount: error
          ? null
          : formatTokenAmount(tokenTotals.get(token.id) ?? BigInt(0), token.decimals),
        error,
      })),
  ];
}

export async function listAdminWalletSnapshots(
  chains: BillingChain[],
  tokens: BillingToken[],
): Promise<AdminWalletSnapshot[]> {
  return Promise.all(
    chains.map(async (chain) => {
      const chainTokens = tokens.filter((token) => token.chainId === chain.id);
      const address = chain.adminAddress;
      if (!address) {
        return {
          chainId: chain.id,
          chainName: chain.name,
          address: null,
          explorerUrl: chain.explorerUrl,
          assets: [],
        };
      }
      try {
        const held = await readAddressAssets(chain, address, chainTokens);
        const tokenTotals = new Map(
          held.tokens.map((row) => [row.id, row.amount] as const),
        );
        return {
          chainId: chain.id,
          chainName: chain.name,
          address,
          explorerUrl: chain.explorerUrl,
          assets: assetsFromTotals(held.ethWei, chainTokens, tokenTotals, null),
        };
      } catch (cause) {
        return {
          chainId: chain.id,
          chainName: chain.name,
          address,
          explorerUrl: chain.explorerUrl,
          assets: assetsFromTotals(
            BigInt(0),
            chainTokens,
            new Map(),
            cause instanceof Error ? cause.message : "Balance unavailable.",
          ),
        };
      }
    }),
  );
}

export async function listDepositSweepSnapshots(
  chains: BillingChain[],
  tokens: BillingToken[],
  addresses: DepositAddress[],
  unswept: UnsweptDepositCredit[],
): Promise<DepositSweepSnapshot[]> {
  const unsweptByChain = new Map(
    unswept.map((row) => [row.chainId, row] as const),
  );
  return Promise.all(
    chains.map(async (chain) => {
      const chainTokens = tokens.filter((token) => token.chainId === chain.id);
      const credit = unsweptByChain.get(chain.id);
      const empty: DepositSweepSnapshot = {
        chainId: chain.id,
        chainName: chain.name,
        addressCount: addresses.length,
        leftoverWallets: 0,
        failed: 0,
        assets: assetsFromTotals(BigInt(0), chainTokens, new Map(), null),
        creditedUnsweptCount: credit?.count ?? 0,
        creditedUnsweptUsd: credit?.amountUsd ?? 0,
      };
      if (addresses.length === 0) {
        return empty;
      }
      const reads = await mapChunk(addresses, async (row) => {
        try {
          return {
            ok: true as const,
            held: await readAddressAssets(chain, row.address, chainTokens),
          };
        } catch {
          return { ok: false as const };
        }
      });
      let ethWei = BigInt(0);
      const tokenTotals = new Map<string, bigint>();
      const leftoverFlags: bigint[] = [];
      let failed = 0;
      for (const read of reads) {
        if (!read.ok) {
          failed += 1;
          leftoverFlags.push(BigInt(0));
          continue;
        }
        ethWei += read.held.ethWei;
        let held = read.held.ethWei;
        for (const token of read.held.tokens) {
          tokenTotals.set(
            token.id,
            (tokenTotals.get(token.id) ?? BigInt(0)) + token.amount,
          );
          held += token.amount;
        }
        leftoverFlags.push(held);
      }
      return {
        ...empty,
        leftoverWallets: leftoverWalletCount(leftoverFlags),
        failed,
        assets: assetsFromTotals(ethWei, chainTokens, tokenTotals, null),
      };
    }),
  );
}
