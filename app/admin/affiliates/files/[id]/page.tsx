import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPayoutFilePaymentsTable } from "@/components/admin-payout-tables";
import { PageHeading } from "@/components/page-heading";
import {
  adminPayoutsPath,
  parsePayoutStatus,
} from "@/lib/membership/affiliate";
import {
  listPayoutsForFile,
  loadPayoutFile,
} from "@/lib/membership/affiliate-store";
import { formatUsd } from "@/lib/membership/billing";
import { parseUuid } from "@/lib/membership/wallet-form";
import { firstSearchValue } from "@/lib/paper/open";
import { formatLocalDate, parseDisplayTime } from "@/lib/time/display";

export const metadata: Metadata = {
  title: "Payout file",
  description: "Payments on an affiliate payout file.",
};

export default async function AdminPayoutFilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  const query = await searchParams;
  const status = parsePayoutStatus(firstSearchValue(query.status)) ?? "";
  const payouts = await listPayoutsForFile(id);
  const rows = status
    ? payouts.filter((payout) => payout.status === status)
    : payouts;
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
        <Link
          href={adminPayoutsPath(file.book)}
          className="text-sm text-accent hover:underline"
        >
          {file.book === "main" ? "Back to withdrawals" : "Back to payouts"}
        </Link>
        <a
          href={`/admin/affiliates/files/${file.id}/export`}
          className="text-sm text-accent hover:underline"
        >
          Download CSV
        </a>
      </div>

      {payouts.length === 0 && !status ? (
        <p className="mt-6 text-sm text-ink-muted">No payments on this file.</p>
      ) : (
        <div className="mt-6">
          <AdminPayoutFilePaymentsTable
            payouts={rows}
            status={status}
            fileId={file.id}
          />
        </div>
      )}
    </div>
  );
}
