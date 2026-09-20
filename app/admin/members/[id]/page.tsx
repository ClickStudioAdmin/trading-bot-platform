import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminMemberForm } from "@/components/admin-member-form";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageHeading } from "@/components/page-heading";
import { parseMemberId } from "@/lib/members/form";
import { getMemberById } from "@/lib/members/list";
import { assignablePlans } from "@/lib/membership/catalog";
import { listMembershipPlans } from "@/lib/membership/store";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "Edit member",
  description: "Edit a desk member.",
};

export default async function AdminEditMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: rawId } = await params;
  const id = parseMemberId(rawId);
  if (id === null) {
    notFound();
  }
  const member = await getMemberById(id);
  if (!member) {
    notFound();
  }
  const query = await searchParams;
  const error = firstSearchValue(query.error);
  const listed = await listMembershipPlans();
  const plans = listed.ok
    ? assignablePlans(listed.plans, member.planId)
    : [];
  const loadError = listed.ok ? null : listed.error;

  const memberLabel = member.name?.trim() || member.email;

  return (
    <div>
      <Breadcrumbs
        items={[
          { href: "/admin/members", label: "Members" },
          { label: memberLabel },
        ]}
      />
      <PageHeading title="Edit member" />
      <p className="-mt-4 text-sm text-ink-muted">{member.email}</p>
      {error || loadError ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error ?? loadError}
        </p>
      ) : null}
      <AdminMemberForm
        mode="edit"
        memberId={member.id}
        values={{
          name: member.name,
          email: member.email,
          password: "",
          role: member.role,
          status: member.status,
          planId: member.planId,
          referralCode: null,
        }}
        plans={plans}
      />
    </div>
  );
}
