"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BillingMethodRadios } from "@/components/billing-method-radios";
import {
  ButtonBusyIcon,
  PendingSubmitButton,
} from "@/components/pending-submit-button";
import { StripeEmbeddedCheckout } from "@/components/stripe-embedded-checkout";
import {
  CryptoWalletPanel,
  LiveMainWallet,
  TopUpWallet,
  useLiveMainWallet,
} from "@/components/crypto-wallet-panel";
import {
  BILLING_METHOD_LABELS,
  formatUsd,
  type BillingMethod,
} from "@/lib/membership/billing";
import {
  confirmStripePlanChangeAction,
  saveCheckoutMethodAction,
} from "@/lib/membership/billing-actions";
import {
  checkCheckoutDepositAction,
  payCheckoutWithCreditAction,
  payPlanWithCreditAction,
} from "@/lib/membership/wallet-actions";
import {
  ACCOUNT_UPGRADE_DEPOSIT_NOTE,
  ACCOUNT_WALLET_DEPOSIT_NOTE,
  checkoutPartialCreditNotice,
  planDeductDecision,
} from "@/lib/membership/wallet";
import type {
  BillingChain,
  BillingToken,
  DepositAddress,
} from "@/lib/membership/wallet-store";

const DEPOSIT_POLL_MS = 10_000;

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
  const persistChain = useRef(Promise.resolve());
  const upgrade = chargeKind === "upgrade";
  const useCardOnFile = upgrade || (existingStripeSubscription && !showMethodPicker);

  function persistCheckoutMethod(
    nextMethod: BillingMethod,
    nextDeduct: boolean,
  ) {
    if (!showMethodPicker) {
      return;
    }
    const form = new FormData();
    form.set("planId", planId);
    form.set("billingMethod", nextMethod);
    if (nextDeduct) {
      form.set("paySubscriptionFromCredit", "1");
    }
    persistChain.current = persistChain.current
      .catch(() => undefined)
      .then(() => saveCheckoutMethodAction(form));
  }

  return (
    <LiveMainWallet initialMainUsd={creditUsd}>
    <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(22rem,28rem)_minmax(26rem,1fr)]">
      <div className="space-y-5">
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">
            Subscription Details
          </h2>
          <dl className="mt-4 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-3 text-sm">
            <dt className="text-ink-muted">Current Plan:</dt>
            <dd className="text-ink">{currentPlanName ?? "—"}</dd>
            <dt className="text-ink-muted">Upgrading to:</dt>
            <dd className="text-ink">{planName}</dd>
            <dt className="text-ink-muted">Due Today:</dt>
            <dd className="tabular-nums text-ink">{formatUsd(dueUsd)}</dd>
            <dt className="text-ink-muted">Then:</dt>
            <dd className="text-ink">{planPrice}</dd>
            {showMethodPicker ? null : (
              <>
                <dt className="text-ink-muted">Payment Method:</dt>
                <dd className="text-ink">{BILLING_METHOD_LABELS[method]}</dd>
              </>
            )}
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
                onMethodChange={(next) => {
                  setMethod(next);
                  persistCheckoutMethod(next, deduct);
                }}
                onDeductChange={(checked) => {
                  setDeduct(checked);
                  persistCheckoutMethod(method, checked);
                }}
              />
            </div>
          ) : null}
        </section>
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
          <CheckoutCryptoPay
            upgrade={upgrade}
            planId={planId}
            dueUsd={dueUsd}
            deduct={deduct}
            creditUsd={creditUsd}
            affiliateUsd={affiliateUsd}
            useAffiliate={useAffiliate}
            address={depositAddress}
            addressError={addressError}
            chains={chains}
            tokens={tokens}
          />
        )}
      </section>
    </div>
    </LiveMainWallet>
  );
}

function CheckoutCryptoPay({
  upgrade,
  planId,
  dueUsd,
  deduct,
  creditUsd,
  affiliateUsd,
  useAffiliate,
  address,
  addressError,
  chains,
  tokens,
}: {
  upgrade: boolean;
  planId: string;
  dueUsd: number;
  deduct: boolean;
  creditUsd: number;
  affiliateUsd: number;
  useAffiliate: boolean;
  address: DepositAddress | null;
  addressError: string | null;
  chains: BillingChain[];
  tokens: BillingToken[];
}) {
  const live = useLiveMainWallet(creditUsd);
  const canPay = planDeductDecision({
    priceUsd: dueUsd,
    mainUsd: live.mainUsd,
    affiliateUsd,
    useAffiliate,
  }).ok;

  if (upgrade) {
    return (
      <div className="space-y-4">
        <CryptoWalletPanel
          mainUsd={creditUsd}
          affiliateUsd={affiliateUsd}
          address={address}
          addressError={addressError}
          chains={chains}
          tokens={tokens}
          deductOn={deduct}
          useAffiliate={useAffiliate}
          planId={planId}
          planPriceUsd={dueUsd}
          checkout
          booksOnly
          payEnabled
        />
        {canPay ? null : (
          <div className="space-y-4 border-t border-line pt-4">
            <TopUpWallet
              address={address}
              addressError={addressError}
              chains={chains}
              tokens={tokens}
              planId={planId}
              checkout
              showCheck={false}
              showBalance={false}
              instructions={ACCOUNT_UPGRADE_DEPOSIT_NOTE}
            />
            <CheckoutDepositWatcher
              planId={planId}
              dueUsd={dueUsd}
              deduct={deduct}
              affiliateUsd={affiliateUsd}
              useAffiliate={useAffiliate}
              autoPay={false}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <CheckoutInitialCrypto
      planId={planId}
      dueUsd={dueUsd}
      deduct={deduct}
      affiliateUsd={affiliateUsd}
      useAffiliate={useAffiliate}
      address={address}
      addressError={addressError}
      chains={chains}
      tokens={tokens}
    />
  );
}

function CheckoutDepositWatcher({
  planId,
  dueUsd,
  deduct,
  affiliateUsd,
  useAffiliate,
  autoPay,
}: {
  planId: string;
  dueUsd: number;
  deduct: boolean;
  affiliateUsd: number;
  useAffiliate: boolean;
  autoPay: boolean;
}) {
  const live = useLiveMainWallet(0);
  const [paying, setPaying] = useState(false);
  const [credited, setCredited] = useState(false);
  const [paidPlan, setPaidPlan] = useState<string | null>(null);
  const payingRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function completePay() {
      if (!autoPay || payingRef.current) {
        return;
      }
      payingRef.current = true;
      setPaying(true);
      const form = new FormData();
      form.set("planId", planId);
      if (deduct) {
        form.set("paySubscriptionFromCredit", "1");
      }
      const paid = await payCheckoutWithCreditAction(form);
      if (cancelled) {
        return;
      }
      if (!paid.ok) {
        payingRef.current = false;
        setPaying(false);
        live.setStatus({ error: paid.error });
        return;
      }
      setPaidPlan(paid.planName);
      live.setStatus({
        notice: `Payment received. You're on ${paid.planName}.`,
        noticeOk: true,
      });
    }

    async function poll() {
      if (cancelled || busyRef.current || payingRef.current) {
        return;
      }
      busyRef.current = true;
      try {
        const result = await checkCheckoutDepositAction();
        if (cancelled) {
          return;
        }
        if (typeof result.mainUsd === "number") {
          live.setMainUsd(result.mainUsd);
        }
        if (!result.ok) {
          live.setStatus({ error: result.error });
          return;
        }
        if (result.credited > 0) {
          setCredited(true);
        }
        const mainUsd =
          typeof result.mainUsd === "number" ? result.mainUsd : live.mainUsd;
        const decision = planDeductDecision({
          priceUsd: dueUsd,
          mainUsd,
          affiliateUsd,
          useAffiliate,
        });
        if (decision.ok) {
          await completePay();
        } else {
          live.setStatus({
            notice:
              result.credited > 0
                ? checkoutPartialCreditNotice(formatUsd(decision.shortUsd))
                : null,
            noticeOk: result.credited > 0,
          });
        }
      } catch {
        if (!cancelled) {
          live.setStatus({ error: "Could not check for deposits." });
        }
      } finally {
        busyRef.current = false;
      }
    }

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, DEPOSIT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [planId, dueUsd, deduct, affiliateUsd, useAffiliate, autoPay]);

  if (paidPlan) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-success" role="status">
          Payment received. You're on {paidPlan}.
        </p>
        <Link
          href="/account/billing"
          className="inline-flex rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent"
        >
          Go to Billing
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm text-ink-muted" role="status">
        <ButtonBusyIcon />
        {paying
          ? "Deposit received. Completing payment…"
          : credited
            ? "Waiting for enough confirmed credit…"
            : "Waiting for deposit…"}
      </p>
      {live.error ? (
        <p className="text-sm text-danger" role="alert">
          {live.error}
        </p>
      ) : null}
      {live.notice && !paying ? (
        <p className="text-sm text-success" role="status">
          {live.notice}
        </p>
      ) : null}
    </div>
  );
}

function CheckoutInitialCrypto({
  planId,
  dueUsd,
  deduct,
  affiliateUsd,
  useAffiliate,
  address,
  addressError,
  chains,
  tokens,
}: {
  planId: string;
  dueUsd: number;
  deduct: boolean;
  affiliateUsd: number;
  useAffiliate: boolean;
  address: DepositAddress | null;
  addressError: string | null;
  chains: BillingChain[];
  tokens: BillingToken[];
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">
        Fund your account with Crypto
      </h2>
      <TopUpWallet
        address={address}
        addressError={addressError}
        chains={chains}
        tokens={tokens}
        planId={planId}
        checkout
        heading={null}
        showCheck={false}
        instructions={ACCOUNT_WALLET_DEPOSIT_NOTE}
        dueUsd={dueUsd}
      />
      <CheckoutDepositWatcher
        planId={planId}
        dueUsd={dueUsd}
        deduct={deduct}
        affiliateUsd={affiliateUsd}
        useAffiliate={useAffiliate}
        autoPay
      />
    </div>
  );
}
