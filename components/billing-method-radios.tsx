"use client";

import { useState } from "react";
import { AppCheck, AppRadio } from "@/components/app-check";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  BILLING_METHOD_LABELS,
  CRYPTO_CREDIT_DEDUCT_LABEL,
  CRYPTO_CREDIT_DEDUCT_NOTE,
  type BillingMethod,
} from "@/lib/membership/billing";
import { setBillingMethodAction } from "@/lib/membership/billing-actions";

export function BillingMethodRadios({
  name,
  selected,
  deductName = "paySubscriptionFromCredit",
  deductSelected = false,
  onMethodChange,
  onDeductChange,
}: {
  name: string;
  selected: BillingMethod | null;
  deductName?: string;
  deductSelected?: boolean;
  onMethodChange?: (method: BillingMethod) => void;
  onDeductChange?: (checked: boolean) => void;
}) {
  const [method, setMethod] = useState<BillingMethod>(selected ?? "stripe");

  function choose(next: BillingMethod) {
    setMethod(next);
    onMethodChange?.(next);
  }

  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Select payment method</legend>
      <label className="flex items-start gap-2 text-sm text-ink">
        <AppRadio
          name={name}
          value="stripe"
          checked={method === "stripe"}
          onChange={() => choose("stripe")}
        />
        <span>
          {BILLING_METHOD_LABELS.stripe}
          <span className="mt-1 block text-hint text-ink-muted">
            Automatic payments handled by Stripe.
          </span>
        </span>
      </label>
      <div className="space-y-3">
        <label className="flex items-start gap-2 text-sm text-ink">
          <AppRadio
            name={name}
            value="wallet"
            checked={method === "wallet"}
            onChange={() => choose("wallet")}
          />
          <span>
            {BILLING_METHOD_LABELS.wallet}
            <span className="mt-1 block text-hint text-ink-muted">
              Manual payments required to top up your account. Monthly
              payments are deducted from your account balance when due.
            </span>
          </span>
        </label>
        {method === "wallet" ? (
          <label className="ml-6 flex items-start gap-2 text-sm text-ink">
            <AppCheck
              name={deductName}
              value="1"
              {...(onDeductChange
                ? {
                    checked: deductSelected,
                    onChange: (event) => onDeductChange(event.target.checked),
                  }
                : { defaultChecked: deductSelected })}
            />
            <span>
              {CRYPTO_CREDIT_DEDUCT_LABEL}
              <span className="mt-1 block text-hint text-ink-muted">
                {CRYPTO_CREDIT_DEDUCT_NOTE}
              </span>
            </span>
          </label>
        ) : null}
      </div>
    </fieldset>
  );
}

export function SavedBillingMethodForm({
  selected,
  deductSelected,
  hasStripeSubscription,
}: {
  selected: BillingMethod | null;
  deductSelected: boolean;
  hasStripeSubscription: boolean;
}) {
  const savedMethod = selected ?? "stripe";
  const [method, setMethod] = useState<BillingMethod>(savedMethod);
  const [deduct, setDeduct] = useState(deductSelected);
  const dirty =
    method !== savedMethod ||
    (method === "wallet" && deduct !== deductSelected);

  return (
    <form action={setBillingMethodAction} className="mt-4 space-y-4">
      <BillingMethodRadios
        name="billingMethod"
        selected={method}
        deductSelected={deduct}
        onMethodChange={setMethod}
        onDeductChange={setDeduct}
      />
      {hasStripeSubscription &&
      savedMethod === "stripe" &&
      method === "wallet" ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Your Stripe subscription will be cancelled when you save the new
          method. Ensure you top up your account with crypto payments prior to
          the next billing cycle.
        </p>
      ) : null}
      {dirty ? (
        <PendingSubmitButton
          pendingLabel="Saving…"
          successKey="save-billing-method"
          className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          Save new payment method
        </PendingSubmitButton>
      ) : null}
    </form>
  );
}
