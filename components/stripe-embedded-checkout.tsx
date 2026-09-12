"use client";

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import { useMemo, useRef } from "react";
import { createEmbeddedCheckoutSecret } from "@/lib/membership/billing-actions";

const stripeByKey = new Map<string, Promise<Stripe | null>>();

function stripePromiseFor(publishableKey: string) {
  const existing = stripeByKey.get(publishableKey);
  if (existing) {
    return existing;
  }
  const loaded = loadStripe(publishableKey);
  stripeByKey.set(publishableKey, loaded);
  return loaded;
}

export function StripeEmbeddedCheckout({
  planId,
  publishableKey,
}: {
  planId: string;
  publishableKey: string;
}) {
  const router = useRouter();
  const planRef = useRef(planId);
  planRef.current = planId;
  const options = useMemo(
    () => ({
      fetchClientSecret: async () => {
        const result = await createEmbeddedCheckoutSecret(planRef.current);
        if (!result.ok) {
          throw new Error(result.error);
        }
        return result.clientSecret;
      },
      onComplete: () => {
        router.push("/account/billing?checkout=success");
      },
    }),
    [router],
  );

  return (
    <div id="checkout" className="min-h-64">
      <EmbeddedCheckoutProvider
        stripe={stripePromiseFor(publishableKey)}
        options={options}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
