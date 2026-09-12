"use client";

import { useState, type ChangeEvent } from "react";
import {
  BILLING_METHOD_LABELS,
  CRYPTO_CREDIT_DEDUCT_LABEL,
  type BillingMethod,
} from "@/lib/membership/billing";

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
            On-site Stripe form.
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
              Pay with listed stablecoins. They credit Your Wallets 1:1 as
              USD.
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
                Use USD credit first when the balance can cover part or all
                of the invoice. Leftover still charges Crypto.
              </span>
            </span>
          </label>
        ) : null}
      </div>
    </fieldset>
  );
}
