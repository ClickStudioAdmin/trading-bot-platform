import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  type Hex,
} from "viem";
import type { BillingChain } from "./wallet-store";
import { privateKeyToAccount } from "viem/accounts";
import { deriveDepositAccount } from "./hd";

const ERC20_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

export function evmChainFromBilling(chain: BillingChain) {
  return defineChain({
    id: chain.chainId,
    name: chain.name,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [chain.rpcUrl] },
    },
    blockExplorers: chain.explorerUrl
      ? {
          default: { name: chain.name, url: chain.explorerUrl },
        }
      : undefined,
  });
}

export function billingPublicClient(chain: BillingChain) {
  return createPublicClient({
    chain: evmChainFromBilling(chain),
    transport: http(chain.rpcUrl),
  });
}

export function billingWalletClient(
  chain: BillingChain,
  mnemonic: string,
  index: number,
) {
  const account = deriveDepositAccount(mnemonic, index);
  return createWalletClient({
    account,
    chain: evmChainFromBilling(chain),
    transport: http(chain.rpcUrl),
  });
}

export function billingWalletFromPrivateKey(
  chain: BillingChain,
  privateKey: Hex,
) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: evmChainFromBilling(chain),
    transport: http(chain.rpcUrl),
  });
}

export type RpcLog = {
  topics: string[];
  data: string;
  transactionHash: string;
  logIndex: string | number;
  blockNumber: string;
};

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) {
    throw new Error(`RPC ${method} failed (${response.status}).`);
  }
  const body = (await response.json()) as {
    result?: T;
    error?: { message?: string };
  };
  if (body.error?.message) {
    throw new Error(body.error.message);
  }
  if (body.result === undefined) {
    throw new Error(`RPC ${method} returned no result.`);
  }
  return body.result;
}

export async function rpcBlockNumber(rpcUrl: string): Promise<bigint> {
  const hex = await rpcCall<string>(rpcUrl, "eth_blockNumber", []);
  const value = BigInt(hex);
  return value;
}

export async function rpcGetLogs(
  rpcUrl: string,
  input: {
    address: string;
    fromBlock: bigint;
    toBlock: bigint;
    topics: (string | string[] | null)[];
  },
): Promise<RpcLog[]> {
  return rpcCall<RpcLog[]>(rpcUrl, "eth_getLogs", [
    {
      address: input.address,
      fromBlock: `0x${input.fromBlock.toString(16)}`,
      toBlock: `0x${input.toBlock.toString(16)}`,
      topics: input.topics,
    },
  ]);
}

export { ERC20_ABI };
export type { Hex };
