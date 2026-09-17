import type { Metadata } from "next";
import Link from "next/link";
import { AdminPlansTable } from "@/components/admin-plans-table";
import { PageHeading } from "@/components/page-heading";
import { planIsArchived, planIsDraft } from "@/lib/membership/catalog";
import { listMembershipPlans } from "@/lib/membership/store";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "Plans",
  description: "Membership plan catalog.",
};

export default async function AdminPlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const listed = await listMembershipPlans();
  const error = firstSearchValue(params.error) ?? (listed.ok ? null : listed.error);
  const archived = firstSearchValue(params.archived) === "1";
  const unarchived = firstSearchValue(params.unarchived) === "1";
  const deleted = firstSearchValue(params.deleted) === "1";
  const statusRaw = (firstSearchValue(params.status) ?? "").trim().toLowerCase();
  const status =
    statusRaw === "live" || statusRaw === "draft" || statusRaw === "archived"
      ? statusRaw
      : "";
  const plans = (listed.ok ? listed.plans : []).filter((plan) => {
    if (status === "archived") {
      return planIsArchived(plan);
    }
    if (status === "draft") {
      return !planIsArchived(plan) && planIsDraft(plan);
    }
    if (status === "live") {
      return !planIsArchived(plan) && !planIsDraft(plan);
    }
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading overline="Admin" title="Plans" />
        <Link
          href="/admin/plans/new"
          className="mb-6 rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          New plan
        </Link>
      </div>
      <p className="-mt-4 text-sm text-ink-muted">
        Features, caps, and affiliate rates. A plan with members cannot be
        deleted — archive it instead.
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {archived ? (
        <p className="mt-4 text-sm text-success">Plan archived.</p>
      ) : null}
      {unarchived ? (
        <p className="mt-4 text-sm text-success">Plan restored to the catalog.</p>
      ) : null}
      {deleted ? (
        <p className="mt-4 text-sm text-success">Unused plan deleted.</p>
      ) : null}

      <AdminPlansTable plans={plans} status={status} />
    </div>
  );
}
