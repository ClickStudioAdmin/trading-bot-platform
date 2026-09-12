"use client";

import { useState } from "react";
import { BillingMethodRadios } from "@/components/billing-method-radios";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { StripeEmbeddedCheckout } from "@/components/stripe-embedded-checkout";
import { CryptoWalletPanel } from "@/components/crypto-wallet-panel";
import { type BillingMethod } from "@/lib/membership/billing";
import {
  confirmStripePlanChangeAction,
  saveCheckoutCryptoAction,
} from "@/lib/membership/billing-actions";
import type {
  BillingChain,
  BillingToken,
  DepositAddress,
} from "@/lib/membership/wallet-store";

export function CheckoutPayment({
  planId,
  planName,
  planPrice,
  selected,
  deductSelected,
  creditUsd,
  affiliateUsd,
  depositAddress,
  addressError,
  chains,
  tokens,
  planPriceUsd,
  useAffiliate,
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
  affiliateUsd: number;
  depositAddress: DepositAddress | null;
  addressError: string | null;
  chains: BillingChain[];
  tokens: BillingToken[];
  planPriceUsd: number;
  useAffiliate: boolean;
  stripeReady: boolean;
  publishableKey: string;
  missingSecret: boolean;
  missingPublishable: boolean;
  existingStripeSubscription: boolean;
}) {
  const [method, setMethod] = useState<BillingMethod>(selected ?? "stripe");
  const [deduct, setDeduct] = useState(deductSelected);

  return (
    <div className="mt-6 grid items-start gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
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

      <section className="overflow-hidden rounded-card border border-line bg-surface p-4">
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
            <StripeEmbeddedCheckout
              key={planId}
              planId={planId}
              publishableKey={publishableKey}
            />
          )
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              Pay from Main credit, or top up on the right.
            </p>
            <CryptoWalletPanel
              mainUsd={creditUsd}
              affiliateUsd={affiliateUsd}
              address={depositAddress}
              addressError={addressError}
              chains={chains}
              tokens={tokens}
              deductOn={deduct}
              useAffiliate={useAffiliate}
              planId={planId}
              planPriceUsd={planPriceUsd}
              checkout
            />
            <form action={saveCheckoutCryptoAction}>
              <input type="hidden" name="planId" value={planId} />
              {deduct ? (
                <input
                  type="hidden"
                  name="paySubscriptionFromCredit"
                  value="1"
                />
              ) : null}
              <PendingSubmitButton
                pendingLabel="Saving…"
                successKey="save-checkout-crypto"
                className="rounded-control border border-line px-4 py-2 text-sm text-ink hover:border-line-strong"
              >
                Save Crypto method
              </PendingSubmitButton>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
