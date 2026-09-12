export const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export type WatchedTransfer = {
  txHash: string;
  logIndex: number;
  from: string;
  to: string;
  amount: bigint;
  blockNumber: bigint;
};

export function hexToBigInt(value: string): bigint | null {
  const raw = value.trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) {
    return null;
  }
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export function topicAddress(topic: string): string | null {
  const raw = topic.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(raw)) {
    return null;
  }
  return `0x${raw.slice(-40)}`;
}

export function padAddressTopic(address: string): string | null {
  const raw = address.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(raw)) {
    return null;
  }
  return `0x${raw.slice(2).padStart(64, "0")}`;
}

export function parseErc20TransferLog(log: {
  topics?: readonly string[] | null;
  data?: string | null;
  transactionHash?: string | null;
  logIndex?: number | string | null;
  blockNumber?: number | string | bigint | null;
}): WatchedTransfer | null {
  const topics = log.topics ?? [];
  if (topics.length < 3) {
    return null;
  }
  if (topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC) {
    return null;
  }
  const from = topicAddress(topics[1] ?? "");
  const to = topicAddress(topics[2] ?? "");
  const amount = hexToBigInt(String(log.data ?? ""));
  const txHash = String(log.transactionHash ?? "").toLowerCase();
  if (!from || !to || amount === null || !/^0x[0-9a-f]{64}$/.test(txHash)) {
    return null;
  }
  const logIndex = Number(log.logIndex);
  const blockNumber =
    typeof log.blockNumber === "bigint"
      ? log.blockNumber
      : hexToBigInt(String(log.blockNumber ?? ""));
  if (!Number.isInteger(logIndex) || logIndex < 0 || blockNumber === null) {
    return null;
  }
  return {
    txHash,
    logIndex,
    from,
    to,
    amount,
    blockNumber,
  };
}

export function confirmedBlock(
  logBlock: bigint,
  headBlock: bigint,
  confirmations: number,
): boolean {
  if (confirmations < 1) {
    return false;
  }
  return headBlock >= logBlock + BigInt(confirmations - 1);
}

export function scanWindow(input: {
  headBlock: bigint;
  lastScanned: bigint | null;
  lookback: bigint;
  chunk: bigint;
}): { fromBlock: bigint; toBlock: bigint } | null {
  if (input.headBlock < BigInt(0) || input.chunk < BigInt(1)) {
    return null;
  }
  const floor =
    input.lastScanned !== null && input.lastScanned >= BigInt(0)
      ? input.lastScanned + BigInt(1)
      : input.headBlock > input.lookback
        ? input.headBlock - input.lookback
        : BigInt(0);
  if (floor > input.headBlock) {
    return null;
  }
  const toBlock =
    floor + input.chunk - BigInt(1) > input.headBlock
      ? input.headBlock
      : floor + input.chunk - BigInt(1);
  return { fromBlock: floor, toBlock };
}
