import type { Metadata } from "next";
import Link from "next/link";
import { BillingMethodRadios } from "@/components/billing-method-radios";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getSessionMember } from "@/lib/auth/session";
import { continueUpgradeAction } from "@/lib/membership/billing-actions";
import { getMemberBilling } from "@/lib/membership/billing-store";
import { formatPlanPrice } from "@/lib/membership/catalog";
import { parsePlanId } from "@/lib/membership/form";
import { getMembershipPlan } from "@/lib/membership/store";
import { stripeSecretConfigured } from "@/lib/membership/stripe";
import { firstSearchValue } from "@/lib/paper/open";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Choose a payment method and continue.",
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
  const [billing, loaded] = await Promise.all([
    getMemberBilling(member.id),
    getMembershipPlan(planId),
  ]);
  if (!billing || !loaded.ok) {
    redirect("/account/plans");
  }
  const target = loaded.plan;
  const current = billing.planId === target.id;
  const error = firstSearchValue(params.error);
  const notice = firstSearchValue(params.notice);
  const checkout = firstSearchValue(params.checkout);
  const stripeReady = stripeSecretConfigured();

  return (
    <div className="max-w-lg">
      <PageHeading title="Checkout" />
      <p className="-mt-4 text-sm text-ink-muted">
        Choose Card or Crypto credit, then continue. Compare plans on{" "}
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
      {checkout === "cancel" ? (
        <p className="mt-6 text-sm text-ink-muted">Checkout canceled.</p>
      ) : null}
      {notice === "wallet" ? (
        <p className="mt-6 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Crypto credit is your collection method. Top-up is the next step.
          Your plan does not change until credit can pay the invoice.
        </p>
      ) : null}
      {!stripeReady ? (
        <p className="mt-6 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Stripe test keys are not on this environment yet. You can still
          choose a payment method.
        </p>
      ) : null}

      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">{target.name}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {formatPlanPrice(target.priceUsd)}
        </p>
        {current ? (
          <p className="mt-4 text-sm text-ink-muted">
            You are already on this plan.
          </p>
        ) : (
          <form action={continueUpgradeAction} className="mt-4 space-y-4">
            <input type="hidden" name="planId" value={target.id} />
            <BillingMethodRadios
              name="billingMethod"
              selected={billing.billingMethod}
            />
            <PendingSubmitButton
              pendingLabel="Continuing…"
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              Continue
            </PendingSubmitButton>
          </form>
        )}
      </section>

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
