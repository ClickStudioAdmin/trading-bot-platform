import { writeEventLog } from "@/lib/logs/write";
import { rpcBlockNumber, rpcGetLogs } from "./rpc";
import {
  creditOnChainDeposit,
  listBillingChains,
  listBillingTokens,
  listDepositAddresses,
  loadDepositMnemonic,
  markChainScanned,
  markDepositSwept,
  type BillingChain,
  type BillingToken,
  type DepositAddress,
} from "./wallet-store";
import {
  confirmedBlock,
  ERC20_TRANSFER_TOPIC,
  padAddressTopic,
  parseErc20TransferLog,
  scanWindow,
} from "./watch";
import { tokenAmountToUsd } from "./wallet";
import { sweepDepositToken } from "./sweep";

const LOOKBACK_BLOCKS = BigInt(8000);
const CHUNK_BLOCKS = BigInt(2000);
const ADDRESS_CHUNK = 20;

export type WatchDepositsResult = {
  scanned: number;
  credited: number;
  swept: number;
  errors: string[];
};

function addressMap(rows: DepositAddress[]): Map<string, DepositAddress> {
  return new Map(rows.map((row) => [row.address.toLowerCase(), row]));
}

async function logsForChunk(input: {
  chain: BillingChain;
  token: BillingToken;
  fromBlock: bigint;
  toBlock: bigint;
  addresses: DepositAddress[];
}) {
  const topicsTo = input.addresses
    .map((row) => padAddressTopic(row.address))
    .filter((row): row is string => Boolean(row));
  if (topicsTo.length === 0) {
    return [];
  }
  return rpcGetLogs(input.chain.rpcUrl, {
    address: input.token.contractAddress,
    fromBlock: input.fromBlock,
    toBlock: input.toBlock,
    topics: [ERC20_TRANSFER_TOPIC, null, topicsTo],
  });
}

async function creditLog(input: {
  chain: BillingChain;
  token: BillingToken;
  byAddress: Map<string, DepositAddress>;
  log: {
    topics: readonly string[];
    data: string;
    transactionHash: string;
    logIndex: number | string;
    blockNumber: string | number | bigint;
  };
  mnemonic: string | null;
}): Promise<"credited" | "swept" | "skipped"> {
  const parsed = parseErc20TransferLog(input.log);
  if (!parsed) {
    return "skipped";
  }
  const dest = input.byAddress.get(parsed.to);
  if (!dest) {
    return "skipped";
  }
  const usd = tokenAmountToUsd(
    parsed.amount,
    input.token.decimals,
    input.token.kind,
  );
  if (usd === null) {
    return "skipped";
  }
  const credited = await creditOnChainDeposit({
    userId: dest.userId,
    chainId: input.chain.id,
    tokenId: input.token.id,
    txHash: parsed.txHash,
    logIndex: parsed.logIndex,
    fromAddress: parsed.from,
    toAddress: parsed.to,
    tokenAmount: parsed.amount.toString(),
    amountUsd: usd,
    blockNumber: parsed.blockNumber,
  });
  if (!credited.ok) {
    throw new Error(credited.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.deposit_credited",
    message: `Credited ${usd} USD on ${input.chain.name}`,
    userId: dest.userId,
    data: {
      chainId: input.chain.id,
      txHash: parsed.txHash,
      logIndex: parsed.logIndex,
      amountUsd: usd,
    },
  });
  if (!input.chain.adminAddress || !input.mnemonic) {
    return "credited";
  }
  const swept = await sweepDepositToken({
    chain: input.chain,
    token: input.token,
    mnemonic: input.mnemonic,
    derivationIndex: dest.derivationIndex,
    amount: parsed.amount,
  });
  if (swept.ok) {
    await markDepositSwept(
      input.chain.id,
      parsed.txHash,
      parsed.logIndex,
      swept.txHash,
    );
    await writeEventLog({
      scope: "system",
      event: "membership.deposit_swept",
      message: `Swept deposit on ${input.chain.name}`,
      userId: dest.userId,
      data: {
        chainId: input.chain.id,
        depositTx: parsed.txHash,
        sweepTx: swept.txHash,
      },
    });
    return "swept";
  }
  await writeEventLog({
    level: "warning",
    scope: "system",
    event: "membership.deposit_swept",
    message: `Sweep skipped: ${swept.error}`,
    userId: dest.userId,
    data: { chainId: input.chain.id, depositTx: parsed.txHash },
  });
  return "credited";
}

export async function watchMembershipDeposits(input: {
  userId?: string;
  advanceCursor?: boolean;
}): Promise<WatchDepositsResult> {
  const result: WatchDepositsResult = {
    scanned: 0,
    credited: 0,
    swept: 0,
    errors: [],
  };
  const chains = await listBillingChains();
  if (chains.length === 0) {
    result.errors.push("No billing chains are configured for this environment.");
    return result;
  }
  const tokens = await listBillingTokens(chains.map((chain) => chain.id));
  const addresses = (await listDepositAddresses()).filter((row) =>
    input.userId ? row.userId === input.userId : true,
  );
  if (addresses.length === 0) {
    result.errors.push("No deposit addresses to watch yet.");
    return result;
  }
  const mnemonic = await loadDepositMnemonic();
  const byAddress = addressMap(addresses);

  for (const chain of chains) {
    const chainTokens = tokens.filter((token) => token.chainId === chain.id);
    if (chainTokens.length === 0) {
      continue;
    }
    try {
      const head = await rpcBlockNumber(chain.rpcUrl);
      for (const token of chainTokens) {
        if (token.kind !== "stable") {
          continue;
        }
        let window = scanWindow({
          headBlock: head,
          lastScanned: input.advanceCursor
            ? chain.lastScannedBlock === null
              ? null
              : BigInt(chain.lastScannedBlock)
            : null,
          lookback: LOOKBACK_BLOCKS,
          chunk: CHUNK_BLOCKS,
        });
        while (window) {
          for (let i = 0; i < addresses.length; i += ADDRESS_CHUNK) {
            const slice = addresses.slice(i, i + ADDRESS_CHUNK);
            const logs = await logsForChunk({
              chain,
              token,
              fromBlock: window.fromBlock,
              toBlock: window.toBlock,
              addresses: slice,
            });
            result.scanned += logs.length;
            for (const log of logs) {
              const parsedHead = parseErc20TransferLog(log);
              if (
                !parsedHead ||
                !confirmedBlock(parsedHead.blockNumber, head, chain.confirmations)
              ) {
                continue;
              }
              try {
                const outcome = await creditLog({
                  chain,
                  token,
                  byAddress,
                  log,
                  mnemonic,
                });
                if (outcome === "credited" || outcome === "swept") {
                  result.credited += 1;
                }
                if (outcome === "swept") {
                  result.swept += 1;
                }
              } catch (cause) {
                result.errors.push(
                  cause instanceof Error ? cause.message : "Credit failed.",
                );
              }
            }
          }
          if (!input.advanceCursor || window.toBlock >= head) {
            break;
          }
          window = scanWindow({
            headBlock: head,
            lastScanned: window.toBlock,
            lookback: LOOKBACK_BLOCKS,
            chunk: CHUNK_BLOCKS,
          });
        }
      }
      if (input.advanceCursor) {
        await markChainScanned(chain.id, head);
      }
    } catch (cause) {
      result.errors.push(
        cause instanceof Error
          ? `${chain.name}: ${cause.message}`
          : `${chain.name}: RPC failed.`,
      );
    }
  }
  return result;
}
