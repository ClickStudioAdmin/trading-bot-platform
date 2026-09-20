import type { Metadata } from "next";
import { AdminPayoutQueue } from "@/components/admin-payout-queue";
import { PageHeading } from "@/components/page-heading";
import {
  parsePayoutFileStatus,
  parsePayoutStatus,
} from "@/lib/membership/affiliate";
import {
  findMemberByEmailOrCode,
  listPayoutFiles,
  listPayouts,
  loadAdminPayoutQueueStats,
  loadDownline,
  releaseDueCommissions,
} from "@/lib/membership/affiliate-store";
import { firstSearchValue } from "@/lib/paper/open";

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
  const fileCount = firstSearchValue(params.count);
  const lookup = firstSearchValue(params.q) ?? "";
  const fileStatus = parsePayoutFileStatus(firstSearchValue(params.fileStatus)) ?? "";
  const fileQ = (firstSearchValue(params.fileQ) ?? "").trim();
  const payoutStatus = parsePayoutStatus(firstSearchValue(params.payoutStatus)) ?? "";
  await releaseDueCommissions();
  const [payouts, files, stats] = await Promise.all([
    listPayouts(),
    listPayoutFiles(),
    loadAdminPayoutQueueStats(),
  ]);
  const found = lookup ? await findMemberByEmailOrCode(lookup) : null;
  const downline = found ? await loadDownline(found.userId, true) : [];

  return (
    <div>
      <PageHeading overline="Admin" title="Affiliates" />
      {saved ? (
        <p className="mt-6 text-sm text-success">
          {saved === "files"
            ? `Generated ${fileCount || "the"} payout list${fileCount === "1" ? "" : "s"}.`
            : saved === "rejected"
              ? "Payout rejected."
              : saved === "file-paid"
                ? "Payout file marked paid."
                : saved === "paid"
                  ? "Payout marked paid."
                  : saved === "approved"
                    ? "Payout approved."
                    : "Saved."}
        </p>
      ) : null}
      {error ? (
        <p className="mt-6 text-sm text-danger">{error}</p>
      ) : null}

      <AdminPayoutQueue
        book="affiliate"
        stats={stats}
        files={files}
        payouts={payouts}
        fileStatus={fileStatus}
        fileQ={fileQ}
        payoutStatus={payoutStatus}
        keep={{ q: lookup || undefined }}
      />

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
                    {row.firstPaidAt ? " · paid" : " · signup"}
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
