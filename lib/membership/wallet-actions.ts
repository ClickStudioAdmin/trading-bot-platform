"use server";

import { requireAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import { writeEventLog } from "@/lib/logs/write";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  billingPath,
  checkoutPath,
  decideUpgrade,
  parsePaySubscriptionFromCredit,
} from "./billing";
import { getMemberBilling, saveBillingMethod } from "./billing-store";
import { parsePlanId } from "./form";
import { getMembershipPlan } from "./store";
import { stripeSecretConfigured, getStripe } from "./stripe";
import { watchMembershipDeposits } from "./watch-deposits";
import { planDeductDecision, roundUsd } from "./wallet";
import {
  createDepositHdSeed,
  payPlanFromWallet,
  replaceDepositHdSeed,
  revealDepositHdSeed,
  updateBillingChain,
  updateBillingToken,
  walletBookBalances,
} from "./wallet-store";
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
  redirect(`/admin/billing?error=${encodeURIComponent(error)}`);
  throw new Error(error);
}

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
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

export async function revealDepositHdSeedAction(): Promise<
  { ok: true; mnemonic: string } | { ok: false; error: string }
> {
  await requireAdmin();
  const revealed = await revealDepositHdSeed();
  if (!revealed.ok) {
    return revealed;
  }
  await writeEventLog({
    scope: "system",
    event: "membership.hd_seed_revealed",
    message: "Revealed deposit HD seed backup on admin billing",
  });
  return revealed;
}

export async function replaceDepositHdSeedAction(): Promise<
  { ok: true; mnemonic: string } | { ok: false; error: string }
> {
  await requireAdmin();
  const replaced = await replaceDepositHdSeed();
  if (!replaced.ok) {
    return replaced;
  }
  await writeEventLog({
    scope: "system",
    event: "membership.hd_seed_replaced",
    message: "Replaced unused deposit HD seed",
  });
  revalidatePath("/admin/billing");
  return replaced;
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
  revalidatePath("/admin/billing");
  redirect("/admin/billing?saved=chain");
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
  revalidatePath("/admin/billing");
  redirect("/admin/billing?saved=token");
}

export async function scanBillingDepositsAction() {
  await requireAdmin();
  const watched = await watchMembershipDeposits({ advanceCursor: true });
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

export async function checkMyDepositAction() {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
    return;
  }
  const watched = await watchMembershipDeposits({
    userId: member.id,
    advanceCursor: false,
  });
  revalidatePath("/account/billing");
  revalidatePath("/account/billing/checkout");
  if (watched.credited > 0) {
    redirect(billingPath({ deposited: String(watched.credited) }));
  }
  if (watched.errors[0]) {
    failBilling(watched.errors[0]);
  }
  redirect(billingPath({ scanned: "1" }));
}

export async function checkCheckoutDepositAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
    return;
  }
  const planId = parsePlanId(String(formData.get("planId") ?? ""));
  const watched = await watchMembershipDeposits({
    userId: member.id,
    advanceCursor: false,
  });
  revalidatePath("/account/billing");
  revalidatePath("/account/billing/checkout");
  const query = planId ? { plan: planId } : {};
  if (watched.credited > 0) {
    redirect(checkoutPath({ ...query, deposited: String(watched.credited) }));
  }
  if (watched.errors[0]) {
    redirect(checkoutPath({ ...query, error: watched.errors[0] }));
  }
  redirect(checkoutPath({ ...query, scanned: "1" }));
}

export async function payPlanWithCreditAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
    return;
  }
  const planId = parsePlanId(String(formData.get("planId") ?? ""));
  if (!planId) {
    redirect(checkoutPath({ error: "That plan is not valid." }));
    return;
  }
  const loaded = await getMembershipPlan(planId);
  if (!loaded.ok) {
    redirect(checkoutPath({ plan: planId, error: loaded.error }));
    return;
  }
  const target = loaded.plan;
  const billing = await getMemberBilling(member.id);
  const decision = decideUpgrade({
    currentPlanId: billing?.planId ?? null,
    target,
    method: "wallet",
  });
  if (decision.kind === "current") {
    redirect(checkoutPath({ plan: planId, error: "You are already on that plan." }));
    return;
  }
  if (decision.kind === "reject") {
    redirect(checkoutPath({ plan: planId, error: decision.error }));
    return;
  }
  const saved = await saveBillingMethod(member.id, "wallet", {
    paySubscriptionFromCredit: parsePaySubscriptionFromCredit(
      formData.get("paySubscriptionFromCredit"),
    ),
  });
  if (!saved.ok) {
    redirect(checkoutPath({ plan: planId, error: saved.error }));
    return;
  }
  const books = await walletBookBalances(member.id);
  const useAffiliate =
    billing?.paySubscriptionFromAffiliate === true &&
    target.features.affiliate_pay_subscription;
  const deduct = planDeductDecision({
    priceUsd: target.priceUsd,
    mainUsd: books.main,
    affiliateUsd: books.affiliate,
    useAffiliate,
  });
  if (!deduct.ok) {
    redirect(
      checkoutPath({
        plan: planId,
        error: `Need ${roundUsd(deduct.shortUsd)} more Main credit to pay this plan.`,
      }),
    );
    return;
  }
  try {
    const paid = await payPlanFromWallet({
      userId: member.id,
      planId,
      amountUsd: target.priceUsd,
      transferUsd: deduct.transferUsd,
      setEnroll: target.features.affiliate_enroll,
    });
    if (!paid.ok) {
      redirect(checkoutPath({ plan: planId, error: paid.error }));
      return;
    }
    if (billing?.stripeSubscriptionId && stripeSecretConfigured()) {
      const stripe = getStripe();
      if (stripe) {
        await stripe.subscriptions.update(billing.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
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
      },
    });
    revalidatePath("/account/billing");
    revalidatePath("/account/billing/checkout");
    revalidatePath("/account/plans");
    redirect(billingPath({ upgraded: "wallet" }));
    return;
  } catch (cause) {
    if (isNextRedirect(cause)) {
      throw cause;
    }
    redirect(
      checkoutPath({
        plan: planId,
        error:
          cause instanceof Error ? cause.message : "Wallet payment failed.",
      }),
    );
  }
}
