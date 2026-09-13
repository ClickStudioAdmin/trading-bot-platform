import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  approvePayoutAction,
  markPayoutPaidAction,
  rejectPayoutAction,
} from "@/lib/membership/affiliate-actions";
import {
  findMemberByEmailOrCode,
  listPayouts,
  loadDownline,
  releaseDueCommissions,
} from "@/lib/membership/affiliate-store";
import { formatUsd } from "@/lib/membership/billing";
import { firstSearchValue } from "@/lib/paper/open";
import { monthJoinedLabel } from "@/lib/membership/affiliate";

export const metadata: Metadata = {
  title: "Affiliates",
  description: "Affiliate payout queue and downline lookup.",
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
  const payouts = await listPayouts();
  const found = lookup ? await findMemberByEmailOrCode(lookup) : null;
  const downline = found ? await loadDownline(found.userId, true) : [];

  return (
    <div>
      <PageHeading overline="Admin" title="Affiliates" />
      <p className="-mt-4 text-sm text-ink-muted">
        USDT withdraw queue and downline lookup. Program knobs live on
        Settings → Affiliates. Allowed withdraw chains are ticked on
        Settings → Crypto.
      </p>
      {saved ? (
        <p className="mt-6 text-sm text-success">
          {saved === "approved"
            ? "Payout approved."
            : saved === "rejected"
              ? "Payout rejected."
              : saved === "paid"
                ? "Payout marked paid."
                : "Saved."}
        </p>
      ) : null}
      {error ? (
        <p className="mt-6 text-sm text-danger">{error}</p>
      ) : null}

      <section className="mt-6 rounded-card border border-line bg-surface p-5">
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
