import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPlanForm } from "@/components/admin-plan-form";
import { AdminPlanRowActions } from "@/components/admin-plan-row-actions";
import { PageHeading } from "@/components/page-heading";
import { getMembershipPlan } from "@/lib/membership/store";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "Edit plan",
  description: "Edit a membership plan.",
};

export default async function AdminEditPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const loaded = await getMembershipPlan(id);
  if (!loaded.ok) {
    notFound();
  }
  const query = await searchParams;
  const error = firstSearchValue(query.error);
  const saved = firstSearchValue(query.saved) === "1";
  const created = firstSearchValue(query.created) === "1";
  const cloned = firstSearchValue(query.cloned) === "1";

  return (
    <div>
      <PageHeading overline="Admin" title={loaded.plan.name} />
      <p className="-mt-4 text-sm text-ink-muted">
        {loaded.plan.memberCount} member
        {loaded.plan.memberCount === 1 ? "" : "s"} on this plan.
        {loaded.plan.isDefault ? " This is the default for new sign-ups." : ""}
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {created ? (
        <p className="mt-4 text-sm text-success">Plan created.</p>
      ) : null}
      {cloned ? (
        <p className="mt-4 text-sm text-success">
          Draft copy created. Rename it before you publish.
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 text-sm text-success">Plan saved.</p>
      ) : null}
      <div className="mt-4 flex justify-end">
        <AdminPlanRowActions plan={loaded.plan} />
      </div>
      <AdminPlanForm plan={loaded.plan} />
      <p className="mt-6">
        <Link href="/admin/plans" className="text-sm text-accent hover:text-accent-strong">
          Back to plans
        </Link>
      </p>
    </div>
  );
}
