"use client";

import { useState } from "react";
import { BillingMethodRadios } from "@/components/billing-method-radios";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { StripeEmbeddedCheckout } from "@/components/stripe-embedded-checkout";
import {
  CryptoWalletPanel,
  LiveMainWallet,
  TopUpWallet,
  useLiveMainWallet,
} from "@/components/crypto-wallet-panel";
import { formatUsd, type BillingMethod } from "@/lib/membership/billing";
import {
  confirmStripePlanChangeAction,
  saveCheckoutCryptoAction,
} from "@/lib/membership/billing-actions";
import { planDeductDecision } from "@/lib/membership/wallet";
import type {
  BillingChain,
  BillingToken,
  DepositAddress,
} from "@/lib/membership/wallet-store";

export function CheckoutPayment({
  planId,
  planName,
  planPrice,
  currentPlanName,
  chargeKind,
  chargeBasis,
  dueUsd,
  selected,
  deductSelected,
  creditUsd,
  affiliateUsd,
  depositAddress,
  addressError,
  chains,
  tokens,
  useAffiliate,
  stripeReady,
  publishableKey,
  missingSecret,
  missingPublishable,
  existingStripeSubscription,
  showMethodPicker,
}: {
  planId: string;
  planName: string;
  planPrice: string;
  currentPlanName: string | null;
  chargeKind: "initial" | "upgrade";
  chargeBasis: "full" | "prorate" | "delta";
  dueUsd: number;
  selected: BillingMethod | null;
  deductSelected: boolean;
  creditUsd: number;
  affiliateUsd: number;
  depositAddress: DepositAddress | null;
  addressError: string | null;
  chains: BillingChain[];
  tokens: BillingToken[];
  useAffiliate: boolean;
  stripeReady: boolean;
  publishableKey: string;
  missingSecret: boolean;
  missingPublishable: boolean;
  existingStripeSubscription: boolean;
  showMethodPicker: boolean;
}) {
  const [method, setMethod] = useState<BillingMethod>(selected ?? "stripe");
  const [deduct, setDeduct] = useState(deductSelected);
  const cryptoSaved = selected === "wallet";
  const upgrade = chargeKind === "upgrade";
  const useCardOnFile = upgrade || (existingStripeSubscription && !showMethodPicker);

  return (
    <LiveMainWallet initialMainUsd={creditUsd}>
    <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(22rem,28rem)_minmax(26rem,1fr)]">
      <div className="space-y-5">
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">{planName}</h2>
          <dl className="mt-4 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-3 text-sm">
            <dt className="text-ink-muted">Upgrading from:</dt>
            <dd className="text-ink">{currentPlanName ?? "—"}</dd>
            <dt className="text-ink-muted">Due Today:</dt>
            <dd className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
              {formatUsd(dueUsd)}
            </dd>
            <dt className="text-ink-muted">Then:</dt>
            <dd className="text-ink">{planPrice}</dd>
          </dl>
          {showMethodPicker ? (
            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-3 text-sm font-medium text-ink">
                Payment method
              </p>
              <BillingMethodRadios
                name="billingMethod"
                selected={method}
                deductSelected={deduct}
                onMethodChange={setMethod}
                onDeductChange={setDeduct}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">
              Paying with {method === "wallet" ? "Crypto" : "the card on file"}.
              Change method on Billing.
            </p>
          )}
          {showMethodPicker && method === "wallet" ? (
            <form action={saveCheckoutCryptoAction} className="mt-4">
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
                className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
              >
                Save method
              </PendingSubmitButton>
              {!cryptoSaved ? (
                <p className="mt-3 text-xs text-ink-faint">
                  Save Crypto as your method to see your deposit address and
                  pay with credit.
                </p>
              ) : null}
            </form>
          ) : null}
        </section>
        <CheckoutTopUp
          always={!upgrade}
          visible={method === "wallet" && cryptoSaved}
          dueUsd={dueUsd}
          creditUsd={creditUsd}
          affiliateUsd={affiliateUsd}
          useAffiliate={useAffiliate}
          address={depositAddress}
          addressError={addressError}
          chains={chains}
          tokens={tokens}
          planId={planId}
        />
      </div>

      <section className="overflow-hidden rounded-card border border-line bg-surface p-4">
        {method === "stripe" ? (
          useCardOnFile ? (
            <form action={confirmStripePlanChangeAction} className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">
                {upgrade ? "Pay with card" : "Card"}
              </h2>
              <p className="text-sm text-ink-muted">
                {upgrade
                  ? chargeBasis === "delta"
                    ? `A one-off charge of ${formatUsd(dueUsd)} (the difference from your current plan). Then the new monthly fee.`
                    : `A one-off charge of ${formatUsd(dueUsd)} for the rest of this cycle. The new monthly fee starts next cycle.`
                  : "A card is already on file. Confirm to start this plan on Stripe."}
              </p>
              <input type="hidden" name="planId" value={planId} />
              <PendingSubmitButton
                pendingLabel={upgrade ? "Paying…" : "Updating…"}
                className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
              >
                {upgrade
                  ? `Pay ${formatUsd(dueUsd)} today`
                  : "Confirm plan change"}
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
              {upgrade
                ? `${formatUsd(dueUsd)} will be deducted from Main for the rest of this cycle.`
                : cryptoSaved
                  ? "Pay from Main credit, or top up on the left."
                  : "Save Crypto as your method, then pay from Main credit."}
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
              planPriceUsd={dueUsd}
              checkout
              booksOnly
              payEnabled={cryptoSaved}
            />
          </div>
        )}
      </section>
    </div>
    </LiveMainWallet>
  );
}

function CheckoutTopUp({
  always,
  visible,
  dueUsd,
  creditUsd,
  affiliateUsd,
  useAffiliate,
  address,
  addressError,
  chains,
  tokens,
  planId,
}: {
  always: boolean;
  visible: boolean;
  dueUsd: number;
  creditUsd: number;
  affiliateUsd: number;
  useAffiliate: boolean;
  address: DepositAddress | null;
  addressError: string | null;
  chains: BillingChain[];
  tokens: BillingToken[];
  planId: string;
}) {
  const live = useLiveMainWallet(creditUsd);
  const short = !planDeductDecision({
    priceUsd: dueUsd,
    mainUsd: live.mainUsd,
    affiliateUsd,
    useAffiliate,
  }).ok;
  if (!visible || (!always && !short)) {
    return null;
  }
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <TopUpWallet
        address={address}
        addressError={addressError}
        chains={chains}
        tokens={tokens}
        planId={planId}
        checkout
      />
    </section>
  );
}
