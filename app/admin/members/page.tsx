import type { Metadata } from "next";
import Link from "next/link";
import { AdminMembersTable } from "@/components/admin-members-table";
import { PageHeading } from "@/components/page-heading";
import { listMembers } from "@/lib/members/list";
import { firstSearchValue } from "@/lib/paper/open";
import {
  MEMBER_PAGE_SIZE,
  memberListHref,
  parseMemberListQuery,
} from "@/lib/members/query";

export const metadata: Metadata = {
  title: "Members",
  description: "Create and edit desk members.",
};

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = parseMemberListQuery(params);
  const list = await listMembers(query);
  const created = firstSearchValue(params.created) === "1";
  const updated = firstSearchValue(params.updated) === "1";
  const error = firstSearchValue(params.error);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading overline="Admin" title="Members" />
        <Link
          href="/admin/members/new"
          className="mb-6 rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          New member
        </Link>
      </div>
      <p className="-mt-4 text-sm text-ink-muted">
        Desk accounts. Creating a member also creates their sign-in.
      </p>
      {error || list.error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error ?? list.error}
        </p>
      ) : null}
      {created ? (
        <p className="mt-4 text-sm text-success">Member created.</p>
      ) : null}
      {updated ? (
        <p className="mt-4 text-sm text-success">Member saved.</p>
      ) : null}

      <form
        method="get"
        className="mt-6 rounded-card border border-line bg-surface p-4"
      >
        {query.sort !== "created" ? (
          <input type="hidden" name="sort" value={query.sort} />
        ) : null}
        {query.dir !== "desc" ? (
          <input type="hidden" name="dir" value={query.dir} />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs text-ink-muted">
            Search
            <input
              name="q"
              defaultValue={query.q}
              placeholder="Name or email"
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
            />
          </label>
          <label className="block text-xs text-ink-muted">
            Role
            <select
              name="role"
              defaultValue={query.role}
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
            >
              <option value="">All</option>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="block text-xs text-ink-muted">
            Status
            <select
              name="status"
              defaultValue={query.status}
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            Apply filters
          </button>
          <Link
            href="/admin/members"
            className="rounded-control border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
          >
            Clear
          </Link>
        </div>
      </form>

      <AdminMembersTable rows={list.rows} query={query} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
        <p>
          {list.total === 0
            ? "No members."
            : `Showing ${(list.page - 1) * MEMBER_PAGE_SIZE + 1}–${Math.min(list.page * MEMBER_PAGE_SIZE, list.total)} of ${list.total}`}
        </p>
        <div className="flex gap-2">
          {list.page > 1 ? (
            <Link
              href={memberListHref(query, { page: list.page - 1 })}
              className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Previous
            </Link>
          ) : null}
          {list.page < list.pageCount ? (
            <Link
              href={memberListHref(query, { page: list.page + 1 })}
              className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
