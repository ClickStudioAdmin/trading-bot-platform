import type { Metadata } from "next";
import Link from "next/link";
import { AdminPlanForm } from "@/components/admin-plan-form";
import { PageHeading } from "@/components/page-heading";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "New plan",
  description: "Create a membership plan.",
};

export default async function AdminNewPlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = firstSearchValue(params.error);

  return (
    <div>
      <PageHeading overline="Admin" title="New plan" />
      <p className="-mt-4 text-sm text-ink-muted">
        Ticks and caps are read by the app. No hardcoded Pro after the seed
        rows.
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <AdminPlanForm />
      <p className="mt-6">
        <Link href="/admin/plans" className="text-sm text-accent hover:text-accent-strong">
          Back to plans
        </Link>
      </p>
    </div>
  );
}
