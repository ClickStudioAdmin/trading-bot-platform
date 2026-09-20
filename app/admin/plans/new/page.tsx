import type { Metadata } from "next";
import { AdminPlanForm } from "@/components/admin-plan-form";
import { Breadcrumbs } from "@/components/breadcrumbs";
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
      <Breadcrumbs
        items={[
          { href: "/admin/plans", label: "Plans" },
          { label: "New plan" },
        ]}
      />
      <PageHeading title="New plan" />
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <AdminPlanForm />
    </div>
  );
}
