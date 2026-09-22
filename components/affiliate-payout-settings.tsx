"use client";

import { useState } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { saveAffiliatePayoutSettingsAction } from "@/lib/membership/affiliate-actions";
import { formatUsd } from "@/lib/membership/billing";
import type { AffiliatePayoutSettings } from "@/lib/membership/affiliate";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import { AppSelect } from "@/components/app-select";
import { AppCheck } from "@/components/app-check";

export function AffiliatePayoutSettingsForm({
  settings,
  minPayoutUsd,
  chains,
}: {
  settings: AffiliatePayoutSettings;
  minPayoutUsd: number;
  chains: Array<{ slug: string; name: string }>;
}) {
  const [autoPayout, setAutoPayout] = useState(settings.autoPayout);

  return (
    <form action={saveAffiliatePayoutSettingsAction} className="mt-4 space-y-3">
      <label className="block text-sm text-ink">
        Chain
        <AppSelect
          name="network"
          required
          defaultValue={settings.network ?? chains[0]?.slug ?? ""}
          className={BILLING_FIELD_CLASS}
        >
          {chains.map((chain) => (
            <option key={chain.slug} value={chain.slug}>
              {chain.name}
            </option>
          ))}
        </AppSelect>
      </label>
      <label className="block text-sm text-ink">
        Address
        <input
          name="address"
          required
          defaultValue={settings.address ?? ""}
          placeholder="0x…"
          className={BILLING_FIELD_CLASS}
        />
      </label>
      <label className="flex items-start gap-2 text-sm text-ink">
        <AppCheck
          name="autoPayout"
          value="1"
          checked={autoPayout}
          onChange={(event) => setAutoPayout(event.target.checked)}
        />
        <span>
          Auto payouts
          <span className="mt-0.5 block text-xs text-ink-muted">
            When payable is over your amount, open a payout request for the
            full payable. Same path as a manual withdraw.
          </span>
        </span>
      </label>
      <label className="block text-sm text-ink">
        Auto payout when payable is over
        <input
          name="autoPayoutUsd"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={minPayoutUsd + 0.01}
          disabled={!autoPayout}
          required={autoPayout}
          defaultValue={settings.autoPayoutUsd ?? ""}
          placeholder={(minPayoutUsd + 0.01).toFixed(2)}
          className={BILLING_FIELD_CLASS}
        />
        <span className="mt-1 block text-xs text-ink-muted">
          Must be more than the program minimum {formatUsd(minPayoutUsd)}.
        </span>
      </label>
      <PendingSubmitButton
        pendingLabel="Saving…"
        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
      >
        Save payout settings
      </PendingSubmitButton>
    </form>
  );
}
