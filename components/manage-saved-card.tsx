"use client";

import { useState } from "react";
import { StripeEmbeddedCard } from "@/components/stripe-embedded-checkout";

export function ManageSavedCard({
  cardLabel,
  expiryLabel,
  publishableKey,
}: {
  cardLabel: string;
  expiryLabel: string | null;
  publishableKey: string;
}) {
  const [updating, setUpdating] = useState(false);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Manage card</h2>
      {updating ? (
        <>
          <p className="text-sm text-ink-muted">
            Enter the new card Stripe should charge. You stay on this page.
          </p>
          <StripeEmbeddedCard publishableKey={publishableKey} />
          <button
            type="button"
            onClick={() => setUpdating(false)}
            className="rounded-control border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-raised"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink">{cardLabel}</p>
          {expiryLabel ? (
            <p className="text-sm text-ink-muted">{expiryLabel}</p>
          ) : null}
          <button
            type="button"
            onClick={() => setUpdating(true)}
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent"
          >
            Update Card
          </button>
        </>
      )}
    </div>
  );
}
