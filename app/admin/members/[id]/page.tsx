import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminMemberForm } from "@/components/admin-member-form";
import { PageHeading } from "@/components/page-heading";
import { parseMemberId } from "@/lib/members/form";
import { getMemberById } from "@/lib/members/list";
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeading overline="Admin" title="Edit member" />
      <p className="-mt-4 text-sm text-ink-muted">{member.email}</p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
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
        }}
      />
      <p className="mt-6">
        <Link href="/admin/members" className="text-sm text-accent hover:text-accent-strong">
          Back to members
        </Link>
      </p>
    </main>
  );
}
