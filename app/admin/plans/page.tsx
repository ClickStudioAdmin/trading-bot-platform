import type { Metadata } from "next";
import Link from "next/link";
import { AdminPlanRowActions } from "@/components/admin-plan-row-actions";
import { PageHeading } from "@/components/page-heading";
import {
  formatPlanPrice,
  PLAN_VISIBILITY_LABELS,
  planIsArchived,
} from "@/lib/membership/catalog";
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
  const plans = listed.ok ? listed.plans : [];

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

      <div className="mt-6 overflow-x-auto rounded-card border border-line bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Members</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/plans/${plan.id}`}
                    className="font-medium text-ink hover:text-accent"
                  >
                    {plan.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {PLAN_VISIBILITY_LABELS[plan.visibility]}
                    {plan.visibility === "draft" && plan.preview
                      ? " · Preview"
                      : ""}
                    {plan.isDefault ? " · Default" : ""}
                    {plan.features.affiliate_enroll
                      ? ` · L1 ${plan.affiliateL1Pct}%`
                      : ""}
                  </p>
                </td>
                <td className="px-4 py-3 text-ink">{formatPlanPrice(plan.priceUsd)}</td>
                <td className="px-4 py-3 tabular-nums text-ink">{plan.memberCount}</td>
                <td className="px-4 py-3">
                  {planIsArchived(plan) ? (
                    <span className="text-ink-muted">Archived</span>
                  ) : (
                    <span className="text-success">
                      {plan.visibility === "draft" ? "Draft" : "Live"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/plans/${plan.id}`}
                      className="text-sm text-accent hover:text-accent-strong"
                    >
                      Edit
                    </Link>
                    <AdminPlanRowActions plan={plan} />
                  </div>
                </td>
              </tr>
            ))}
            {plans.length === 0 && listed.ok ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-ink-muted">
                  No plans yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
