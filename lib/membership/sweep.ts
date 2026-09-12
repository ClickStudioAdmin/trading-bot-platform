import type { Hex } from "viem";
import { writeEventLog } from "@/lib/logs/write";
import { dripNeededWei, gasWalletCanCover } from "./gas-drip";
import {
  billingPublicClient,
  billingWalletClient,
  billingWalletFromPrivateKey,
  ERC20_ABI,
} from "./rpc";
import type { BillingChain, BillingToken } from "./wallet-store";
import { loadGasPrivateKey } from "./wallet-store";

const FALLBACK_SWEEP_COST_WEI = BigInt("200000000000000");
const FALLBACK_DRIP_TX_WEI = BigInt("30000000000000");

async function estimateSweepCostWei(input: {
  chain: BillingChain;
  token: BillingToken;
  from: Hex;
  admin: Hex;
  amount: bigint;
}): Promise<bigint> {
  try {
    const publicClient = billingPublicClient(input.chain);
    const gas = await publicClient.estimateContractGas({
      address: input.token.contractAddress as Hex,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [input.admin, input.amount],
      account: input.from,
    });
    const fees = await publicClient.estimateFeesPerGas();
    const fee = fees.maxFeePerGas ?? fees.gasPrice ?? BigInt(0);
    const cost = gas * fee;
    return cost > BigInt(0) ? cost : FALLBACK_SWEEP_COST_WEI;
  } catch {
    return FALLBACK_SWEEP_COST_WEI;
  }
}

async function estimateDripTxCostWei(chain: BillingChain): Promise<bigint> {
  try {
    const publicClient = billingPublicClient(chain);
    const fees = await publicClient.estimateFeesPerGas();
    const fee = fees.maxFeePerGas ?? fees.gasPrice ?? BigInt(0);
    const cost = BigInt(21000) * fee;
    return cost > BigInt(0) ? cost : FALLBACK_DRIP_TX_WEI;
  } catch {
    return FALLBACK_DRIP_TX_WEI;
  }
}

async function fundDepositGas(input: {
  chain: BillingChain;
  token: BillingToken;
  depositAddress: Hex;
  admin: Hex;
  amount: bigint;
}): Promise<{ ok: true; dripped: boolean; txHash?: string } | { ok: false; error: string }> {
  const publicClient = billingPublicClient(input.chain);
  const depositBalance = await publicClient.getBalance({
    address: input.depositAddress,
  });
  const estimatedCost = await estimateSweepCostWei({
    chain: input.chain,
    token: input.token,
    from: input.depositAddress,
    admin: input.admin,
    amount: input.amount,
  });
  const dripWei = dripNeededWei({
    depositBalanceWei: depositBalance,
    estimatedCostWei: estimatedCost,
  });
  if (dripWei <= BigInt(0)) {
    return { ok: true, dripped: false };
  }
  const privateKey = await loadGasPrivateKey();
  if (!privateKey) {
    return {
      ok: false,
      error:
        "Deposit address needs ETH for gas. Create and fund the dedicated gas wallet on Admin → Billing.",
    };
  }
  const gasWallet = billingWalletFromPrivateKey(input.chain, privateKey);
  const gasAddress = gasWallet.account.address;
  const gasBalance = await publicClient.getBalance({ address: gasAddress });
  const dripTxCost = await estimateDripTxCostWei(input.chain);
  if (
    !gasWalletCanCover({
      gasWalletBalanceWei: gasBalance,
      dripWei,
      dripTxCostWei: dripTxCost,
    })
  ) {
    return {
      ok: false,
      error: `Gas wallet ${gasAddress} needs more ETH on ${input.chain.name} to drip gas.`,
    };
  }
  const hash = await gasWallet.sendTransaction({
    to: input.depositAddress,
    value: dripWei,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return { ok: true, dripped: true, txHash: hash };
}

export async function sweepDepositToken(input: {
  chain: BillingChain;
  token: BillingToken;
  mnemonic: string;
  derivationIndex: number;
  amount: bigint;
}): Promise<{ ok: true; txHash: string } | { ok: false; error: string }> {
  const admin = input.chain.adminAddress;
  if (!admin) {
    return { ok: false, error: "No admin receive address on this chain." };
  }
  if (input.amount <= BigInt(0)) {
    return { ok: false, error: "Nothing to sweep." };
  }
  try {
    const publicClient = billingPublicClient(input.chain);
    const wallet = billingWalletClient(
      input.chain,
      input.mnemonic,
      input.derivationIndex,
    );
    const from = wallet.account.address;
    const funded = await fundDepositGas({
      chain: input.chain,
      token: input.token,
      depositAddress: from,
      admin: admin as Hex,
      amount: input.amount,
    });
    if (!funded.ok) {
      return funded;
    }
    if (funded.dripped && funded.txHash) {
      await writeEventLog({
        scope: "system",
        event: "membership.gas_drip",
        message: `Dripped gas to ${from} on ${input.chain.name}`,
        data: { chainId: input.chain.id, dripTx: funded.txHash },
      });
    }
    const balance = await publicClient.readContract({
      address: input.token.contractAddress as Hex,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [from],
    });
    const amount = balance < input.amount ? balance : input.amount;
    if (amount <= BigInt(0)) {
      return { ok: false, error: "Deposit address token balance is zero." };
    }
    const hash = await wallet.writeContract({
      address: input.token.contractAddress as Hex,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [admin as Hex, amount],
    });
    return { ok: true, txHash: hash };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Sweep failed.",
    };
  }
}
