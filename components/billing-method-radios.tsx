import {
  BILLING_METHOD_LABELS,
  type BillingMethod,
} from "@/lib/membership/billing";

export function BillingMethodRadios({
  name,
  selected,
}: {
  name: string;
  selected: BillingMethod | null;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Select payment method</legend>
      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="radio"
          name={name}
          value="stripe"
          defaultChecked={selected === "stripe" || selected === null}
          className="mt-0.5"
        />
        <span>
          {BILLING_METHOD_LABELS.stripe}
          <span className="mt-1 block text-xs text-ink-faint">
            Stripe Checkout and Customer Portal.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="radio"
          name={name}
          value="wallet"
          defaultChecked={selected === "wallet"}
          className="mt-0.5"
        />
        <span>
          {BILLING_METHOD_LABELS.wallet}
          <span className="mt-1 block text-xs text-ink-faint">
            Pay from USD credit. Top-up is next.
          </span>
        </span>
      </label>
    </fieldset>
  );
}
