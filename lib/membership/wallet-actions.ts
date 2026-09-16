"use server";

import { requireAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import { writeEventLog } from "@/lib/logs/write";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  billingPath,
  checkoutCharge,
  checkoutPath,
  decideUpgrade,
  parsePaySubscriptionFromCredit,
} from "./billing";
import {
  createCommissionsForInvoice,
  loadMemberArrears,
  requestUsdtPayout,
  sumPayableAffiliateUsd,
} from "./affiliate-store";
import {
  parsePayoutAddress,
  parsePayoutAmount,
  parsePayoutNetwork,
  withdrawAmountDecision,
  withdrawDecision,
} from "./affiliate";
import {
  applyMemberPlanNow,
  getMemberBilling,
  saveBillingMethod,
} from "./billing-store";
import { parsePlanId } from "./form";
import { getMembershipPlan } from "./store";
import { stripeSecretConfigured } from "./stripe";
import { syncStripeForCollectionMethod } from "./stripe-webhook";
import { collectOpenWalletInvoices } from "./billing-cycle-store";
import { watchMembershipDeposits } from "./watch-deposits";
import {
  parseWalletMinPayout,
  planDeductDecision,
  roundUsd,
  walletUpgradeInvoiceExternalId,
} from "./wallet";
import {
  createDepositHdSeed,
  createGasWallet,
  payPlanFromWallet,
  updateBillingChain,
  updateBillingToken,
  updateGasLowEth,
  updateWalletMinPayout,
  listAffiliatePayoutChains,
  loadWalletMinPayoutUsd,
  pendingMainWithdrawUsd,
  walletBookBalances,
} from "./wallet-store";
import { parseGasLowEth } from "./gas-drip";
import {
  parseChainName,
  parseConfirmations,
  parseExplorerUrl,
  parseOptionalAddress,
  parseRequiredAddress,
  parseRequiredTokenKind,
  parseRpcUrl,
  parseTokenDecimals,
  parseTokenSymbol,
  parseUuid,
} from "./wallet-form";

function failBilling(
  error: string,
  extra: Record<string, string | undefined> = {},
): never {
  redirect(billingPath({ ...extra, error }));
  throw new Error(error);
}

function failAdmin(error: string): never {
  redirect(`/admin/settings?tab=crypto&error=${encodeURIComponent(error)}`);
  throw new Error(error);
}

export async function createDepositHdSeedAction(): Promise<
  { ok: true; mnemonic: string } | { ok: false; error: string }
> {
  await requireAdmin();
  const created = await createDepositHdSeed();
  if (!created.ok) {
    return created;
  }
  await writeEventLog({
    scope: "system",
    event: "membership.hd_seed_created",
    message: "Created encrypted deposit HD seed",
  });
  revalidatePath("/admin/billing");
  return created;
}

export async function createGasWalletAction(): Promise<
  | { ok: true; address: string; privateKey: string }
  | { ok: false; error: string }
> {
  await requireAdmin();
  const created = await createGasWallet();
  if (!created.ok) {
    return created;
  }
  await writeEventLog({
    scope: "system",
    event: "membership.gas_wallet_created",
    message: "Created encrypted billing gas wallet",
    data: { address: created.address },
  });
  revalidatePath("/admin/billing");
  return created;
}

export async function saveGasLowEthAction(formData: FormData) {
  await requireAdmin();
  const lowEth = parseGasLowEth(formData.get("lowEth"));
  if (!lowEth) {
    failAdmin("Low ETH level must be above 0 and at most 10, with up to 8 decimals.");
  }
  const saved = await updateGasLowEth(lowEth);
  if (!saved.ok) {
    failAdmin(saved.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.gas_low_updated",
    message: `Set gas wallet low ETH level to ${lowEth}`,
    data: { lowEth },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/billing");
  redirect("/admin/settings?tab=crypto&saved=gaslow");
}

export async function saveWalletMinPayoutAction(formData: FormData) {
  await requireAdmin();
  const min = parseWalletMinPayout(formData.get("walletMinPayoutUsd"));
  if (!min.ok) {
    failAdmin(min.error);
  }
  const saved = await updateWalletMinPayout(min.usd);
  if (!saved.ok) {
    failAdmin(saved.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.wallet_min_payout",
    message: `Set Main Wallet minimum withdraw to ${min.usd}`,
    data: { walletMinPayoutUsd: min.usd },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/account/billing");
  redirect("/admin/settings?tab=crypto&saved=walletmin");
}

export async function saveBillingChainAction(formData: FormData) {
  await requireAdmin();
  const id = parseUuid(formData.get("chainId"));
  const name = parseChainName(formData.get("name"));
  const rpcUrl = parseRpcUrl(formData.get("rpcUrl"));
  const explorer = parseExplorerUrl(formData.get("explorerUrl"));
  const confirmations = parseConfirmations(formData.get("confirmations"));
  const adminAddress = parseOptionalAddress(formData.get("adminAddress"));
  if (!id || !name || !rpcUrl || confirmations === null || explorer === undefined) {
    failAdmin("Check the chain name, public RPC, explorer URL, and confirmations.");
  }
  if (adminAddress === undefined) {
    failAdmin("Admin receive address must be a public 0x EVM address.");
  }
  const saved = await updateBillingChain({
    id,
    name,
    rpcUrl,
    explorerUrl: explorer,
    confirmations,
    adminAddress,
    affiliatePayouts: formData.get("affiliatePayouts") === "on",
  });
  if (!saved.ok) {
    failAdmin(saved.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.billing_chain",
    message: `Updated billing chain ${name}`,
    data: { chainId: id },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/billing");
  revalidatePath("/account/affiliates");
  redirect("/admin/settings?tab=crypto&saved=chain");
}

export async function saveBillingTokenAction(formData: FormData) {
  await requireAdmin();
  const id = parseUuid(formData.get("tokenId"));
  const symbol = parseTokenSymbol(formData.get("symbol"));
  const contractAddress = parseRequiredAddress(formData.get("contractAddress"));
  const decimals = parseTokenDecimals(formData.get("decimals"));
  const kind = parseRequiredTokenKind(formData.get("kind"));
  if (!id || !symbol || !contractAddress || decimals === null || !kind) {
    failAdmin("Check the token symbol, contract, decimals, and kind.");
  }
  const saved = await updateBillingToken({
    id,
    symbol,
    contractAddress,
    decimals,
    kind,
  });
  if (!saved.ok) {
    failAdmin(saved.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.billing_token",
    message: `Updated billing token ${symbol}`,
    data: { tokenId: id },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/billing");
  redirect("/admin/settings?tab=crypto&saved=token");
}

export async function scanBillingDepositsAction() {
  await requireAdmin();
  const watched = await watchMembershipDeposits({ advanceCursor: true });
  if (watched.creditedUserIds.length > 0) {
    await collectOpenWalletInvoices({
      userIds: [...new Set(watched.creditedUserIds)],
    });
  }
  await writeEventLog({
    scope: "system",
    event: "membership.deposit_watched",
    message: `Scanned deposits: ${watched.credited} credited`,
    data: {
      scanned: watched.scanned,
      credited: watched.credited,
      swept: watched.swept,
      errors: watched.errors.slice(0, 5),
    },
  });
  revalidatePath("/admin/billing");
  const error = watched.errors[0];
  redirect(
    error
      ? `/admin/billing?scanned=1&error=${encodeURIComponent(error)}`
      : `/admin/billing?scanned=1&credited=${watched.credited}`,
  );
}

export type CheckDepositResult =
  | { ok: true; credited: number; mainUsd: number }
  | { ok: false; error: string; mainUsd?: number };

async function checkMemberDeposit(): Promise<CheckDepositResult> {
  const member = await getSessionMember();
  if (!member) {
    return { ok: false, error: "Sign in to check deposits." };
  }
  const watched = await watchMembershipDeposits({
    userId: member.id,
    advanceCursor: false,
  });
  if (watched.credited > 0) {
    await collectOpenWalletInvoices({ userIds: [member.id] });
  }
  const books = await walletBookBalances(member.id);
  if (watched.errors[0] && watched.credited === 0) {
    return { ok: false, error: watched.errors[0], mainUsd: books.main };
  }
  return { ok: true, credited: watched.credited, mainUsd: books.main };
}

export async function checkMyDepositAction(): Promise<CheckDepositResult> {
  return checkMemberDeposit();
}

export async function readMyAccountBalanceAction(): Promise<
  | { ok: true; mainUsd: number; pendingWithdrawUsd: number }
  | { ok: false; error: string }
> {
  const member = await getSessionMember();
  if (!member) {
    return { ok: false, error: "Sign in to check Account Balance." };
  }
  const [books, pendingWithdrawUsd] = await Promise.all([
    walletBookBalances(member.id),
    pendingMainWithdrawUsd(member.id),
  ]);
  return { ok: true, mainUsd: books.main, pendingWithdrawUsd };
}

export async function checkCheckoutDepositAction(): Promise<CheckDepositResult> {
  return checkMemberDeposit();
}

export type PayPlanCreditResult =
  | { ok: true; planName: string }
  | { ok: false; error: string };

async function payPlanWithCredit(
  formData: FormData,
): Promise<PayPlanCreditResult> {
  const member = await getSessionMember();
  if (!member) {
    return { ok: false, error: "Sign in to continue." };
  }
  const planId = parsePlanId(String(formData.get("planId") ?? ""));
  if (!planId) {
    return { ok: false, error: "That plan is not valid." };
  }
  const loaded = await getMembershipPlan(planId);
  if (!loaded.ok) {
    return { ok: false, error: loaded.error };
  }
  const target = loaded.plan;
  const billing = await getMemberBilling(member.id);
  const decision = decideUpgrade({
    currentPlanId: billing?.planId ?? null,
    target,
    method: "wallet",
  });
  if (decision.kind === "current") {
    return { ok: false, error: "You are already on that plan." };
  }
  if (decision.kind === "reject") {
    return { ok: false, error: decision.error };
  }
  const currentPlan = billing
    ? await getMembershipPlan(billing.planId)
    : { ok: false as const, error: "No plan" };
  const charge = checkoutCharge({
    currentPriceUsd: currentPlan.ok ? currentPlan.plan.priceUsd : 0,
    targetPriceUsd: target.priceUsd,
    periodEnd: billing?.periodEnd ?? null,
  });
  if (charge.kind === "initial") {
    const saved = await saveBillingMethod(member.id, "wallet", {
      paySubscriptionFromCredit: parsePaySubscriptionFromCredit(
        formData.get("paySubscriptionFromCredit"),
      ),
    });
    if (!saved.ok) {
      return { ok: false, error: saved.error };
    }
  }
  const [books, payableAffiliateUsd] = await Promise.all([
    walletBookBalances(member.id),
    sumPayableAffiliateUsd(member.id),
  ]);
  const useAffiliate =
    billing?.paySubscriptionFromAffiliate === true &&
    target.features.affiliate_pay_subscription;
  if (charge.kind === "upgrade" && charge.dueUsd < 0.01) {
    const applied = await applyMemberPlanNow({
      userId: member.id,
      planId,
      periodEnd: charge.periodEnd,
    });
    if (!applied.ok) {
      return { ok: false, error: applied.error };
    }
    revalidatePath("/account/billing");
    revalidatePath("/account/billing/checkout");
    revalidatePath("/account/plans");
    return { ok: true, planName: target.name };
  }
  const deduct = planDeductDecision({
    priceUsd: charge.dueUsd,
    mainUsd: books.main,
    affiliateUsd: payableAffiliateUsd,
    useAffiliate,
  });
  if (!deduct.ok) {
    return {
      ok: false,
      error: `Need ${roundUsd(deduct.shortUsd)} more Account Balance credit to pay this plan.`,
    };
  }
  try {
    const now = Date.now();
    const paid = await payPlanFromWallet({
      userId: member.id,
      planId,
      amountUsd: charge.dueUsd,
      transferUsd: deduct.transferUsd,
      setEnroll: true,
      nowMs: now,
      periodEnd: charge.kind === "upgrade" ? charge.periodEnd : undefined,
      externalId:
        charge.kind === "upgrade"
          ? walletUpgradeInvoiceExternalId(
              member.id,
              planId,
              charge.periodEnd,
            )
          : undefined,
    });
    if (!paid.ok) {
      return { ok: false, error: paid.error };
    }
    const commissions = await createCommissionsForInvoice({
      invoiceId: paid.invoiceId,
      sourceUserId: member.id,
      method: "wallet",
      status: "paid",
      amountUsd: charge.dueUsd,
    });
    if (!commissions.ok) {
      return { ok: false, error: commissions.error };
    }
    if (billing?.stripeSubscriptionId && stripeSecretConfigured()) {
      const synced = await syncStripeForCollectionMethod({
        userId: member.id,
        method: "wallet",
        subscriptionId: billing.stripeSubscriptionId,
      });
      if (!synced.ok) {
        return { ok: false, error: synced.error };
      }
    }
    await writeEventLog({
      scope: "system",
      event: "membership.invoice_paid",
      message: `Paid ${target.name} from crypto credit`,
      userId: member.id,
      data: {
        planId,
        invoiceId: paid.invoiceId,
        transferUsd: deduct.transferUsd,
        method: "wallet",
        dueUsd: charge.dueUsd,
        kind: charge.kind,
      },
    });
    const { notifyInvoicePaid } = await import(
      "@/lib/notifications/commercial"
    );
    await notifyInvoicePaid({
      userId: member.id,
      invoiceId: paid.invoiceId,
      planId,
      amountUsd: charge.dueUsd,
      periodEnd:
        charge.kind === "upgrade" ? charge.periodEnd : billing?.periodEnd ?? null,
    });
    revalidatePath("/account/billing");
    revalidatePath("/account/billing/checkout");
    revalidatePath("/account/plans");
    return { ok: true, planName: target.name };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Wallet payment failed.",
    };
  }
}

export async function payCheckoutWithCreditAction(
  formData: FormData,
): Promise<PayPlanCreditResult> {
  return payPlanWithCredit(formData);
}

export async function payPlanWithCreditAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
    return;
  }
  const result = await payPlanWithCredit(formData);
  const planId = parsePlanId(String(formData.get("planId") ?? ""));
  if (!result.ok) {
    redirect(checkoutPath({ plan: planId || "", error: result.error }));
    return;
  }
  redirect(billingPath({ upgraded: "wallet" }));
}

export async function requestMainWalletWithdrawAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const payoutChains = await listAffiliatePayoutChains();
  const network = parsePayoutNetwork(
    formData.get("network"),
    payoutChains.map((chain) => chain.slug),
  );
  if (!network.ok) {
    failBilling(network.error, { tab: "wallet" });
  }
  const address = parsePayoutAddress(formData.get("address"));
  if (!address.ok) {
    failBilling(address.error, { tab: "wallet" });
  }
  const amount = parsePayoutAmount(formData.get("amountUsd"));
  if (!amount.ok) {
    failBilling(amount.error, { tab: "wallet" });
  }
  const [minPayoutUsd, arrears, books] = await Promise.all([
    loadWalletMinPayoutUsd(),
    loadMemberArrears(member.id),
    walletBookBalances(member.id),
  ]);
  const allowed = withdrawDecision({
    arrears,
    payableUsd: books.main,
    minPayoutUsd,
    balanceNoun: "Account Balance",
  });
  if (!allowed.ok) {
    failBilling(allowed.reason, { tab: "wallet" });
  }
  const amountOk = withdrawAmountDecision({
    payableUsd: books.main,
    minPayoutUsd,
    amountUsd: amount.amountUsd,
  });
  if (!amountOk.ok) {
    failBilling(amountOk.reason, { tab: "wallet" });
  }
  const requested = await requestUsdtPayout({
    userId: member.id,
    network: network.network,
    address: address.address,
    amountUsd: amount.amountUsd,
    book: "main",
  });
  if (!requested.ok) {
    failBilling(requested.error, { tab: "wallet" });
  }
  await writeEventLog({
    scope: "system",
    event: "membership.wallet_withdraw_requested",
    message: "Requested a USDT Account Balance withdraw",
    userId: member.id,
    data: {
      payoutId: requested.payoutId,
      network: network.network,
      amountUsd: amount.amountUsd,
    },
  });
  revalidatePath("/account/billing");
  revalidatePath("/admin/billing");
  revalidatePath("/admin/affiliates");
  redirect(billingPath({ tab: "wallet", saved: "withdraw" }));
}
