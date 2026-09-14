"use client";

import { useState, type ChangeEvent } from "react";
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
        <input
          type="radio"
          name={name}
          value="stripe"
          checked={method === "stripe"}
          onChange={() => choose("stripe")}
          className="mt-0.5"
        />
        <span>
          {BILLING_METHOD_LABELS.stripe}
          <span className="mt-1 block text-xs text-ink-faint">
            Automatic payments handled by Stripe.
          </span>
        </span>
      </label>
      <div className="space-y-3">
        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="radio"
            name={name}
            value="wallet"
            checked={method === "wallet"}
            onChange={() => choose("wallet")}
            className="mt-0.5"
          />
          <span>
            {BILLING_METHOD_LABELS.wallet}
            <span className="mt-1 block text-xs text-ink-faint">
              Manual payments to top up your account balance.
            </span>
          </span>
        </label>
        {method === "wallet" ? (
          <label className="ml-6 flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name={deductName}
              value="1"
              {...(onDeductChange
                ? {
                    checked: deductSelected,
                    onChange: (event: ChangeEvent<HTMLInputElement>) =>
                      onDeductChange(event.target.checked),
                  }
                : { defaultChecked: deductSelected })}
              className="mt-0.5"
            />
            <span>
              {CRYPTO_CREDIT_DEDUCT_LABEL}
              <span className="mt-1 block text-xs text-ink-faint">
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
}: {
  selected: BillingMethod | null;
  deductSelected: boolean;
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
