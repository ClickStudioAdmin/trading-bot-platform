import type { Metadata } from "next";
import Link from "next/link";
import { AdminMembersTable } from "@/components/admin-members-table";
import { PageHeading } from "@/components/page-heading";
import {
  LiveGetForm,
  TABLE_FILTER_CLEAR_CLASS,
  TABLE_FILTER_FIELD_CLASS,
  TableFilterField,
  TablePager,
} from "@/components/table-chrome";
import { listMembers } from "@/lib/members/list";
import { listMembershipPlans } from "@/lib/membership/store";
import { firstSearchValue } from "@/lib/paper/open";
import {
  MEMBER_PAGE_SIZE,
  memberListHref,
  parseMemberListQuery,
} from "@/lib/members/query";
import { tablePageWindow } from "@/lib/table-chrome";

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
  const listed = await listMembershipPlans();
  const planNames = Object.fromEntries(
    (listed.ok ? listed.plans : []).map((plan) => [plan.id, plan.name]),
  );
  const created = firstSearchValue(params.created) === "1";
  const updated = firstSearchValue(params.updated) === "1";
  const error = firstSearchValue(params.error);
  const window = tablePageWindow(list.total, list.page, MEMBER_PAGE_SIZE);

  return (
    <div>
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
        Desk accounts. Sign-in uses this table, not Supabase Auth.
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

      <LiveGetForm>
        <input type="hidden" name="page" value="1" />
        {query.sort !== "created" ? (
          <input type="hidden" name="sort" value={query.sort} />
        ) : null}
        {query.dir !== "desc" ? (
          <input type="hidden" name="dir" value={query.dir} />
        ) : null}
        <TableFilterField label="Search">
          <input
            name="q"
            defaultValue={query.q}
            className={TABLE_FILTER_FIELD_CLASS}
          />
        </TableFilterField>
        <TableFilterField label="Role">
          <select
            name="role"
            defaultValue={query.role}
            className={TABLE_FILTER_FIELD_CLASS}
          >
            <option value="">All</option>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </TableFilterField>
        <TableFilterField label="Status">
          <select
            name="status"
            defaultValue={query.status}
            className={TABLE_FILTER_FIELD_CLASS}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </TableFilterField>
        <Link href="/admin/members" className={TABLE_FILTER_CLEAR_CLASS}>
          Clear
        </Link>
      </LiveGetForm>

      <AdminMembersTable rows={list.rows} query={query} planNames={planNames} />

      <TablePager
        window={window}
        prevHref={memberListHref(query, { page: list.page - 1 })}
        nextHref={memberListHref(query, { page: list.page + 1 })}
        emptyLabel="No members."
      />
    </div>
  );
}
