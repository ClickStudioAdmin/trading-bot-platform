"use client";

import { useState } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Modal } from "@/components/template-modals";
import { saveAffiliatePayoutSettingsAction } from "@/lib/membership/affiliate-actions";
import { formatUsd } from "@/lib/membership/billing";
import type { AffiliatePayoutSettings } from "@/lib/membership/affiliate";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";

const secondary =
  "rounded-control border border-line bg-surface-raised px-3 py-1.5 text-sm font-medium text-ink hover:border-line-strong";

export function AffiliatePayoutSettingsButton({
  settings,
  minPayoutUsd,
  chains,
}: {
  settings: AffiliatePayoutSettings;
  minPayoutUsd: number;
  chains: Array<{ slug: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [autoPayout, setAutoPayout] = useState(settings.autoPayout);

  return (
    <>
      <button
        type="button"
        className={secondary}
        onClick={() => {
          setAutoPayout(settings.autoPayout);
          setOpen(true);
        }}
      >
        Manage payout settings
      </button>
      {open ? (
        <Modal
          title="Payout settings"
          onClose={() => setOpen(false)}
          elevated
        >
          <p className="mt-2 text-sm text-ink-muted">
            Saved chain and address are used on each withdraw so you do not
            re-enter them. Auto payouts open a payout request for the full
            payable when the balance is over the amount you set. That request
            uses the same queue as Request withdraw — admin still approves,
            sends USDT, and marks it paid.
          </p>
          <form
            action={saveAffiliatePayoutSettingsAction}
            className="mt-4 space-y-3"
          >
            <label className="block text-sm text-ink">
              Chain
              <select
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
              </select>
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
              <input
                type="checkbox"
                name="autoPayout"
                value="1"
                checked={autoPayout}
                onChange={(event) => setAutoPayout(event.target.checked)}
                className="mt-0.5 size-4"
              />
              <span>
                Auto payouts
                <span className="mt-0.5 block text-xs text-ink-muted">
                  When payable is over your amount, open a payout request for
                  the full payable. Same path as a manual withdraw.
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
              Save settings
            </PendingSubmitButton>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
