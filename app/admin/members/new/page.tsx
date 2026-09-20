import type { Metadata } from "next";
import { AdminMemberForm } from "@/components/admin-member-form";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageHeading } from "@/components/page-heading";
import {
  assignablePlans,
  defaultAssignablePlanId,
} from "@/lib/membership/catalog";
import { listMembershipPlans } from "@/lib/membership/store";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "New member",
  description: "Create a desk member and sign-in.",
};

export default async function AdminNewMemberPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = firstSearchValue(params.error);
  const listed = await listMembershipPlans();
  const plans = listed.ok ? assignablePlans(listed.plans) : [];
  const planId = defaultAssignablePlanId(plans) ?? "";
  const loadError = listed.ok ? null : listed.error;

  return (
    <div>
      <Breadcrumbs
        items={[
          { href: "/admin/members", label: "Members" },
          { label: "New member" },
        ]}
      />
      <PageHeading title="New member" />
      {error || loadError ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error ?? loadError}
        </p>
      ) : null}
      <AdminMemberForm
        mode="create"
        values={{
          name: "",
          email: "",
          password: "",
          role: "member",
          status: "active",
          planId,
          referralCode: null,
        }}
        plans={plans}
      />
    </div>
  );
}
