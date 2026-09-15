import { writeEventLog } from "@/lib/logs/write";
import { rpcBlockNumber, rpcGetLogs } from "./rpc";
import {
  creditOnChainDeposit,
  listBillingChains,
  listBillingTokens,
  listDepositAddresses,
  listUnsweptDepositTxs,
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
  scanWindows,
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
  creditedUserIds: string[];
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
}): Promise<{ created: boolean; swept: boolean; userId?: string }> {
  const parsed = parseErc20TransferLog(input.log);
  if (!parsed) {
    return { created: false, swept: false };
  }
  const dest = input.byAddress.get(parsed.to);
  if (!dest) {
    return { created: false, swept: false };
  }
  const usd = tokenAmountToUsd(
    parsed.amount,
    input.token.decimals,
    input.token.kind,
  );
  if (usd === null) {
    return { created: false, swept: false };
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
  if (credited.created) {
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
  }
  if (!input.chain.adminAddress || !input.mnemonic) {
    return { created: credited.created, swept: false, userId: dest.userId };
  }
  const swept = await sweepDepositToken({
    chain: input.chain,
    token: input.token,
    mnemonic: input.mnemonic,
    derivationIndex: dest.derivationIndex,
    amount: parsed.amount,
  });
  if (!swept.ok) {
    const { notifySweepFailed } = await import("@/lib/notifications/critical");
    try {
      await notifySweepFailed({
        depositTxId: `${input.chain.id}:${parsed.txHash}:${parsed.logIndex}`,
        chainName: input.chain.name,
        detail: swept.error,
      });
    } catch {
      // Notices must never block deposit credit.
    }
  }
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
    return { created: credited.created, swept: true, userId: dest.userId };
  }
  await writeEventLog({
    level: "warning",
    scope: "system",
    event: "membership.sweep_failed",
    message: `Sweep skipped: ${swept.error}`,
    userId: dest.userId,
    data: { chainId: input.chain.id, depositTx: parsed.txHash },
  });
  return { created: credited.created, swept: false, userId: dest.userId };
}

export async function watchMembershipDeposits(input: {
  userId?: string;
  advanceCursor?: boolean;
}): Promise<WatchDepositsResult> {
  const result: WatchDepositsResult = {
    scanned: 0,
    credited: 0,
    swept: 0,
    creditedUserIds: [],
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
        const windows = scanWindows({
          headBlock: head,
          lastScanned: input.advanceCursor
            ? chain.lastScannedBlock === null
              ? null
              : BigInt(chain.lastScannedBlock)
            : null,
          lookback: LOOKBACK_BLOCKS,
          chunk: CHUNK_BLOCKS,
        });
        for (const window of windows) {
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
                if (outcome.created) {
                  result.credited += 1;
                  if (outcome.userId) {
                    result.creditedUserIds.push(outcome.userId);
                  }
                }
                if (outcome.swept) {
                  result.swept += 1;
                }
              } catch (cause) {
                result.errors.push(
                  cause instanceof Error ? cause.message : "Credit failed.",
                );
              }
            }
          }
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
  if (mnemonic) {
    await sweepOpenCredits({
      mnemonic,
      chains,
      tokens,
      addresses,
      userId: input.userId,
      result,
    });
  }
  return result;
}

function tokenAmountBigInt(raw: string): bigint | null {
  const whole = raw.trim().split(".")[0] ?? "";
  if (!/^\d+$/.test(whole)) {
    return null;
  }
  try {
    const amount = BigInt(whole);
    return amount > BigInt(0) ? amount : null;
  } catch {
    return null;
  }
}

async function sweepOpenCredits(input: {
  mnemonic: string;
  chains: BillingChain[];
  tokens: BillingToken[];
  addresses: DepositAddress[];
  userId?: string;
  result: WatchDepositsResult;
}): Promise<void> {
  const rows = await listUnsweptDepositTxs(input.userId);
  if (rows.length === 0) {
    return;
  }
  const chainById = new Map(input.chains.map((row) => [row.id, row]));
  const tokenById = new Map(input.tokens.map((row) => [row.id, row]));
  const destByAddress = addressMap(input.addresses);
  for (const row of rows) {
    const chain = chainById.get(row.chainId);
    const token = tokenById.get(row.tokenId);
    const dest = destByAddress.get(row.toAddress);
    const amount = tokenAmountBigInt(row.tokenAmount);
    if (!chain?.adminAddress || !token || !dest || !amount) {
      continue;
    }
    const swept = await sweepDepositToken({
      chain,
      token,
      mnemonic: input.mnemonic,
      derivationIndex: dest.derivationIndex,
      amount,
    });
    if (!swept.ok) {
      try {
        const { notifySweepFailed } = await import(
          "@/lib/notifications/critical"
        );
        await notifySweepFailed({
          depositTxId: `${chain.id}:${row.txHash}:${row.logIndex}`,
          chainName: chain.name,
          detail: swept.error,
        });
      } catch {
        // Notices must never block a sweep retry.
      }
      await writeEventLog({
        level: "warning",
        scope: "system",
        event: "membership.sweep_failed",
        message: `Sweep retry skipped: ${swept.error}`,
        userId: dest.userId,
        data: { chainId: chain.id, depositTx: row.txHash },
      });
      input.result.errors.push(`${chain.name}: ${swept.error}`);
      continue;
    }
    await markDepositSwept(chain.id, row.txHash, row.logIndex, swept.txHash);
    await writeEventLog({
      scope: "system",
      event: "membership.deposit_swept",
      message: `Swept deposit on ${chain.name}`,
      userId: dest.userId,
      data: {
        chainId: chain.id,
        depositTx: row.txHash,
        sweepTx: swept.txHash,
      },
    });
    input.result.swept += 1;
  }
}
