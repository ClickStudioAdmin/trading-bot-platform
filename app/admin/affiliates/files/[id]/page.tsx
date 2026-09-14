import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { payoutStatusLabel } from "@/lib/membership/affiliate";
import {
  listPayoutsForFile,
  loadPayoutFile,
} from "@/lib/membership/affiliate-store";
import { formatUsd } from "@/lib/membership/billing";
import { parseUuid } from "@/lib/membership/wallet-form";
import { formatLocalDate, parseDisplayTime } from "@/lib/time/display";

export const metadata: Metadata = {
  title: "Payout file",
  description: "Payments on an affiliate payout file.",
};

export default async function AdminPayoutFilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = parseUuid(rawId);
  if (!id) {
    notFound();
  }
  const file = await loadPayoutFile(id);
  if (!file) {
    notFound();
  }
  const payouts = await listPayoutsForFile(id);
  const created = parseDisplayTime(file.createdAt);
  const paid = parseDisplayTime(file.paidAt);

  return (
    <div>
      <PageHeading overline="Admin" title="Payout file" />
      <p className="-mt-4 text-sm text-ink-muted">
        {file.network} · {file.payoutCount} payment
        {file.payoutCount === 1 ? "" : "s"} · {formatUsd(file.amountUsd)} ·{" "}
        {file.status === "paid" ? "Paid" : "Pending"}
        {created ? ` · ${formatLocalDate(created)}` : ""}
        {paid ? ` · paid ${formatLocalDate(paid)}` : ""}
      </p>
      {file.externalId ? (
        <p className="mt-2 font-mono text-xs text-ink-muted">{file.externalId}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/admin/affiliates" className="text-sm text-accent hover:underline">
          Back to payouts
        </Link>
        <a
          href={`/admin/affiliates/files/${file.id}/export`}
          className="text-sm text-accent hover:underline"
        >
          Download CSV
        </a>
      </div>

      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Payments</h2>
        {payouts.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No payments on this file.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Member</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Network</th>
                  <th className="py-2 pr-3 font-medium">Address</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => {
                  const requested = parseDisplayTime(payout.createdAt);
                  const settled = parseDisplayTime(payout.paidAt);
                  return (
                    <tr key={payout.id} className="border-t border-line">
                      <td className="py-3 pr-3 whitespace-nowrap text-ink-muted">
                        {requested ? formatLocalDate(requested) : "—"}
                      </td>
                      <td className="py-3 pr-3">{payout.email ?? payout.userId}</td>
                      <td className="py-3 pr-3 tabular-nums">
                        {formatUsd(payout.amountUsd)}
                      </td>
                      <td className="py-3 pr-3">{payout.network ?? "—"}</td>
                      <td className="py-3 pr-3 font-mono text-xs break-all">
                        {payout.address ?? "—"}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        {payoutStatusLabel(payout.status)}
                      </td>
                      <td className="py-3 whitespace-nowrap text-ink-muted">
                        {settled ? formatLocalDate(settled) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
