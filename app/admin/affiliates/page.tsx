import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  approvePayoutAction,
  markPayoutPaidAction,
  rejectPayoutAction,
  saveAffiliateSettingsAction,
} from "@/lib/membership/affiliate-actions";
import {
  findMemberByEmailOrCode,
  listPayouts,
  loadAffiliateSettings,
  loadDownline,
  releaseDueCommissions,
} from "@/lib/membership/affiliate-store";
import { formatUsd } from "@/lib/membership/billing";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import { firstSearchValue } from "@/lib/paper/open";
import { monthJoinedLabel } from "@/lib/membership/affiliate";

export const metadata: Metadata = {
  title: "Affiliates",
  description: "Affiliate program settings and payout queue.",
};

export default async function AdminAffiliatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const saved = firstSearchValue(params.saved);
  const error = firstSearchValue(params.error);
  const lookup = firstSearchValue(params.q) ?? "";
  await releaseDueCommissions();
  const [settings, payouts] = await Promise.all([
    loadAffiliateSettings(),
    listPayouts(),
  ]);
  const found = lookup ? await findMemberByEmailOrCode(lookup) : null;
  const downline = found ? await loadDownline(found.userId, true) : [];

  return (
    <div>
      <PageHeading overline="Admin" title="Affiliates" />
      <p className="-mt-4 text-sm text-ink-muted">
        Program knobs and the USDT withdraw queue. Default L1–L5 apply to
        affiliates who are not platform members, and to unpaid members.
        Platform members on a current plan use that plan’s rates. Allowed
        withdraw chains are ticked on Settings → Crypto.
      </p>
      {saved ? (
        <p className="mt-6 text-sm text-success">
          {saved === "approved"
            ? "Payout approved."
            : saved === "rejected"
              ? "Payout rejected."
              : saved === "paid"
                ? "Payout marked paid."
                : "Settings saved."}
        </p>
      ) : null}
      {error ? (
        <p className="mt-6 text-sm text-danger">{error}</p>
      ) : null}

      <form
        action={saveAffiliateSettingsAction}
        className="mt-6 max-w-lg space-y-4 rounded-card border border-line bg-surface p-5"
      >
        <h2 className="text-lg font-semibold tracking-tight">Program</h2>
        <label className="block text-sm text-ink">
          Maximum depth
          <input
            type="number"
            name="maxDepth"
            min={1}
            max={5}
            required
            defaultValue={settings.maxDepth}
            className={BILLING_FIELD_CLASS}
          />
          <span className="mt-1 block text-xs text-ink-muted">
            Default 2. Hard cap 5. A plan can earn fewer levels than this.
          </span>
        </label>
        <label className="block text-sm text-ink">
          Hold days
          <input
            type="number"
            name="holdDays"
            min={0}
            required
            defaultValue={settings.holdDays}
            className={BILLING_FIELD_CLASS}
          />
          <span className="mt-1 block text-xs text-ink-muted">
            Commission stays pending this many days. Refund in the hold voids
            it. Use 0 while testing.
          </span>
        </label>
        <label className="block text-sm text-ink">
          Minimum payout (USD)
          <input
            type="number"
            name="minPayoutUsd"
            min={0}
            step="0.01"
            required
            defaultValue={settings.minPayoutUsd}
            className={BILLING_FIELD_CLASS}
          />
        </label>
        <fieldset className="space-y-3">
          <legend className="text-sm text-ink">Default affiliate rates</legend>
          <p className="text-xs text-ink-muted">
            For affiliates who are not platform users. L1–L5 cannot add up to
            more than 100%.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(
              [
                ["defaultL1Pct", "L1", settings.defaultL1Pct],
                ["defaultL2Pct", "L2", settings.defaultL2Pct],
                ["defaultL3Pct", "L3", settings.defaultL3Pct],
                ["defaultL4Pct", "L4", settings.defaultL4Pct],
                ["defaultL5Pct", "L5", settings.defaultL5Pct],
              ] as const
            ).map(([name, label, value]) => (
              <label key={name} className="block text-sm text-ink">
                {label}
                <input
                  type="number"
                  name={name}
                  min={0}
                  max={100}
                  step="0.01"
                  required
                  defaultValue={value}
                  className={BILLING_FIELD_CLASS}
                />
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm text-ink">
          Downgrade grace days
          <input
            type="number"
            name="downgradeGraceDays"
            min={0}
            required
            defaultValue={settings.downgradeGraceDays}
            className={BILLING_FIELD_CLASS}
          />
          <span className="mt-1 block text-xs text-ink-muted">
            Saved now. Auto-exit after grace waits for the next membership
            step.
          </span>
        </label>
        <PendingSubmitButton
          pendingLabel="Saving…"
          successKey="save-affiliate-settings"
          className="rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink"
        >
          Save settings
        </PendingSubmitButton>
      </form>

      <section className="mt-8 rounded-card border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Payout queue
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Approve or reject a request, then mark paid after you send USDT.
            </p>
          </div>
          <a
            href="/admin/affiliates/export"
            className="text-sm text-accent hover:underline"
          >
            Export CSV
          </a>
        </div>
        {payouts.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No payouts yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Member</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Network</th>
                  <th className="py-2 pr-3 font-medium">Address</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id} className="border-t border-line">
                    <td className="py-3 pr-3 text-ink-muted">
                      {monthJoinedLabel(payout.createdAt)}
                    </td>
                    <td className="py-3 pr-3">{payout.email ?? payout.userId}</td>
                    <td className="py-3 pr-3 tabular-nums">
                      {formatUsd(payout.amountUsd)}
                    </td>
                    <td className="py-3 pr-3">{payout.network ?? "—"}</td>
                    <td className="max-w-[10rem] truncate py-3 pr-3 font-mono text-xs">
                      {payout.address ?? "—"}
                    </td>
                    <td className="py-3 pr-3 capitalize">{payout.status}</td>
                    <td className="py-3">
                      {payout.status === "requested" ||
                      payout.status === "approved" ? (
                        <div className="flex flex-wrap gap-2">
                          {payout.status === "requested" ? (
                            <form action={approvePayoutAction}>
                              <input
                                type="hidden"
                                name="payoutId"
                                value={payout.id}
                              />
                              <PendingSubmitButton
                                pendingLabel="…"
                                className="rounded-control border border-line px-2 py-1 text-xs text-ink hover:border-line-strong"
                              >
                                Approve
                              </PendingSubmitButton>
                            </form>
                          ) : null}
                          <form action={rejectPayoutAction}>
                            <input
                              type="hidden"
                              name="payoutId"
                              value={payout.id}
                            />
                            <PendingSubmitButton
                              pendingLabel="…"
                              className="rounded-control border border-line px-2 py-1 text-xs text-danger hover:border-line-strong"
                            >
                              Reject
                            </PendingSubmitButton>
                          </form>
                          <form action={markPayoutPaidAction} className="flex gap-2">
                            <input
                              type="hidden"
                              name="payoutId"
                              value={payout.id}
                            />
                            <input
                              name="externalId"
                              placeholder="Tx hash"
                              className="w-28 rounded-control border border-line bg-canvas px-2 py-1 text-xs text-ink"
                            />
                            <PendingSubmitButton
                              pendingLabel="…"
                              className="rounded-control bg-accent-strong px-2 py-1 text-xs font-medium text-ink"
                            >
                              Mark paid
                            </PendingSubmitButton>
                          </form>
                        </div>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Downline lookup</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Admin view may show email. The member portal never does.
        </p>
        <form className="mt-4 flex flex-wrap gap-3" method="get">
          <input
            name="q"
            defaultValue={lookup}
            placeholder="Email or referral code"
            className="min-w-[16rem] flex-1 rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
          />
          <button
            type="submit"
            className="rounded-control bg-accent-strong px-3 py-2 text-sm font-medium text-ink"
          >
            Look up
          </button>
        </form>
        {lookup && !found ? (
          <p className="mt-4 text-sm text-warning">No member matched that.</p>
        ) : null}
        {found ? (
          <div className="mt-4">
            <p className="text-sm text-ink-muted">
              {found.email} · {downline.length} downline
            </p>
            {downline.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No referrals yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {downline.map((row) => (
                  <li key={row.userId}>
                    L{row.level} · {row.label}
                    {row.email && row.email !== row.label ? ` · ${row.email}` : ""}
                    {row.firstPaidAt ? " · paid" : " · attributed"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
