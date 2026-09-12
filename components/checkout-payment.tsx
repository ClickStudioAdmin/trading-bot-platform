"use client";

import { useState } from "react";
import { BillingMethodRadios } from "@/components/billing-method-radios";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { StripeEmbeddedCheckout } from "@/components/stripe-embedded-checkout";
import {
  CRYPTO_CREDIT_DEDUCT_LABEL,
  formatUsd,
  type BillingMethod,
} from "@/lib/membership/billing";
import {
  confirmStripePlanChangeAction,
  saveCheckoutCryptoAction,
} from "@/lib/membership/billing-actions";

export function CheckoutPayment({
  planId,
  planName,
  planPrice,
  selected,
  deductSelected,
  creditUsd,
  stripeReady,
  publishableKey,
  missingSecret,
  missingPublishable,
  existingStripeSubscription,
}: {
  planId: string;
  planName: string;
  planPrice: string;
  selected: BillingMethod | null;
  deductSelected: boolean;
  creditUsd: number;
  stripeReady: boolean;
  publishableKey: string;
  missingSecret: boolean;
  missingPublishable: boolean;
  existingStripeSubscription: boolean;
}) {
  const [method, setMethod] = useState<BillingMethod>(selected ?? "stripe");
  const [deduct, setDeduct] = useState(deductSelected);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">{planName}</h2>
        <p className="mt-1 text-sm text-ink-muted">{planPrice}</p>
        <div className="mt-4">
          <BillingMethodRadios
            name="billingMethod"
            selected={method}
            deductSelected={deduct}
            onMethodChange={setMethod}
            onDeductChange={setDeduct}
          />
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-5">
        {method === "stripe" ? (
          existingStripeSubscription ? (
            <form action={confirmStripePlanChangeAction} className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">Card</h2>
              <p className="text-sm text-ink-muted">
                A card is already on file. Confirm to change this plan on
                Stripe. You stay on this site.
              </p>
              <input type="hidden" name="planId" value={planId} />
              <PendingSubmitButton
                pendingLabel="Updating…"
                className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
              >
                Confirm plan change
              </PendingSubmitButton>
            </form>
          ) : !stripeReady || !publishableKey ? (
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Card</h2>
              <p className="mt-2 text-sm text-warning">
                {missingSecret && missingPublishable
                  ? "This environment has no Stripe keys. Add STRIPE_SECRET_KEY (sk_test_) and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_) to .env.local, then restart next dev."
                  : missingSecret
                    ? "Missing STRIPE_SECRET_KEY (sk_test_) in .env.local. Restart next dev after adding it."
                    : "Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_) in .env.local. Restart next dev after adding it."}
              </p>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Card</h2>
              <p className="mt-1 mb-4 text-sm text-ink-muted">
                Pay on this page. The form stays on TBP.
              </p>
              <StripeEmbeddedCheckout
                key={planId}
                planId={planId}
                publishableKey={publishableKey}
              />
            </div>
          )
        ) : (
          <form action={saveCheckoutCryptoAction} className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Crypto</h2>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {formatUsd(creditUsd)}
            </p>
            <p className="text-sm text-ink-muted">
              USD credit on this login. Deposit addresses and top-up are the
              next step. The plan does not change until Crypto or credit can
              pay the invoice.
            </p>
            {deduct ? (
              <p className="text-xs text-ink-faint">
                {CRYPTO_CREDIT_DEDUCT_LABEL} is on.
              </p>
            ) : null}
            <input type="hidden" name="planId" value={planId} />
            {deduct ? (
              <input type="hidden" name="paySubscriptionFromCredit" value="1" />
            ) : null}
            <div className="flex flex-wrap gap-3">
              <PendingSubmitButton
                pendingLabel="Saving…"
                successKey="save-checkout-crypto"
                className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
              >
                Save Crypto method
              </PendingSubmitButton>
              <button
                type="button"
                disabled
                className="rounded-control bg-accent-strong/40 px-4 py-2 text-sm font-medium text-ink"
              >
                Top up
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
