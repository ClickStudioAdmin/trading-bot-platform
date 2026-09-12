import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutPayment } from "@/components/checkout-payment";
import { PageHeading } from "@/components/page-heading";
import { getSessionMember } from "@/lib/auth/session";
import { hasUsableStripeSubscription } from "@/lib/membership/billing";
import { getMemberBilling } from "@/lib/membership/billing-store";
import { loadMemberDepositContext } from "@/lib/membership/wallet-store";
import { formatPlanPrice } from "@/lib/membership/catalog";
import { parsePlanId } from "@/lib/membership/form";
import { getMembershipPlan } from "@/lib/membership/store";
import {
  stripePublishableConfigured,
  stripePublishableKey,
  stripeSecretConfigured,
} from "@/lib/membership/stripe";
import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Choose a payment method and pay on this page.",
};

export default async function AccountCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const params = await searchParams;
  const planId = parsePlanId(firstSearchValue(params.plan) ?? "");
  if (!planId) {
    redirect("/account/plans");
  }
  const [billing, loaded, deposit] = await Promise.all([
    getMemberBilling(member.id),
    getMembershipPlan(planId),
    loadMemberDepositContext(member.id),
  ]);
  if (!billing || !loaded.ok) {
    redirect("/account/plans");
  }
  const target = loaded.plan;
  const current = billing.planId === target.id;
  const error = firstSearchValue(params.error);
  const deposited = firstSearchValue(params.deposited);
  const scanned = firstSearchValue(params.scanned) === "1";
  const stripeReady = stripeSecretConfigured();

  return (
    <div className="max-w-4xl">
      <PageHeading title="Checkout" />
      <p className="-mt-4 max-w-2xl text-sm text-ink-muted">
        Choose Card or Crypto. The payment form stays on this page. Compare
        plans on{" "}
        <Link href="/account/plans" className="text-accent">
          Plans
        </Link>
        .
      </p>
      {error ? (
        <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {deposited ? (
        <p className="mt-6 text-sm text-success">
          Credited {deposited} deposit{deposited === "1" ? "" : "s"} to Main.
        </p>
      ) : null}
      {scanned ? (
        <p className="mt-6 text-sm text-ink-muted">
          No new confirmed deposits in the recent window.
        </p>
      ) : null}

      {current ? (
        <section className="mt-6 max-w-lg rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">{target.name}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {formatPlanPrice(target.priceUsd)}
          </p>
          <p className="mt-4 text-sm text-ink-muted">
            You are already on this plan.
          </p>
        </section>
      ) : (
        <CheckoutPayment
          planId={target.id}
          planName={target.name}
          planPrice={formatPlanPrice(target.priceUsd)}
          selected={billing.billingMethod}
          deductSelected={billing.paySubscriptionFromCredit}
          creditUsd={deposit.books.main}
          affiliateUsd={deposit.books.affiliate}
          depositAddress={deposit.address}
          addressError={deposit.addressError}
          chains={deposit.chains}
          tokens={deposit.tokens}
          planPriceUsd={target.priceUsd}
          useAffiliate={
            billing.paySubscriptionFromAffiliate &&
            target.features.affiliate_pay_subscription
          }
          stripeReady={stripeReady}
          publishableKey={stripePublishableKey()}
          missingSecret={!stripeReady}
          missingPublishable={!stripePublishableConfigured()}
          existingStripeSubscription={hasUsableStripeSubscription(billing)}
        />
      )}

      <p className="mt-4 text-sm text-ink-faint">
        <Link href="/account/plans" className="text-accent">
          Back to Plans
        </Link>
        {" · "}
        <Link href="/account/billing" className="text-accent">
          Billing
        </Link>
      </p>
    </div>
  );
}
