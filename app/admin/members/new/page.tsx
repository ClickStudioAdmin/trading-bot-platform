import type { Metadata } from "next";
import Link from "next/link";
import { AdminMemberForm } from "@/components/admin-member-form";
import { PageHeading } from "@/components/page-heading";
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeading overline="Admin" title="New member" />
      <p className="-mt-4 text-sm text-ink-muted">
        Creates the auth user and the members row. No public sign-up.
      </p>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
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
