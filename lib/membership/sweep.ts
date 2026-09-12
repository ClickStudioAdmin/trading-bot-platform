import type { BillingChain, BillingToken } from "./wallet-store";
import { billingPublicClient, billingWalletClient, ERC20_ABI } from "./rpc";

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
    const balance = await publicClient.readContract({
      address: input.token.contractAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [from],
    });
    const amount = balance < input.amount ? balance : input.amount;
    if (amount <= BigInt(0)) {
      return { ok: false, error: "Deposit address token balance is zero." };
    }
    const hash = await wallet.writeContract({
      address: input.token.contractAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [admin as `0x${string}`, amount],
    });
    return { ok: true, txHash: hash };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Sweep failed.",
    };
  }
}
