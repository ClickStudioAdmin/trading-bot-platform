import type { Metadata } from "next";
import { AdminMembersTable } from "@/components/admin-members-table";
import { PageHeading } from "@/components/page-heading";
import { IconFilterClear, IconPlus } from "@/components/icons";
import {
  LiveGetForm,
  TABLE_BTN_ICON,
  TABLE_FILTER_FIELD_CLASS,
  TableCard,
  TableFilterField,
  TableFilterSession,
  TableLabelButton,
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
import { AppSelect } from "@/components/app-select";

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
      <PageHeading overline="Admin" title="Members" />
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

      <TableFilterSession
        actions={
          <TableLabelButton
            href="/admin/members/new"
            variant="primary"
            icon={<IconPlus {...TABLE_BTN_ICON} />}
          >
            New member
          </TableLabelButton>
        }
      >
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
              <AppSelect
                name="role"
                defaultValue={query.role}
                className={TABLE_FILTER_FIELD_CLASS}
              >
                <option value="">All</option>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </AppSelect>
            </TableFilterField>
            <TableFilterField label="Status">
              <AppSelect
                name="status"
                defaultValue={query.status}
                className={TABLE_FILTER_FIELD_CLASS}
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </AppSelect>
            </TableFilterField>
            <TableLabelButton
              href="/admin/members"
              variant="filter"
              icon={<IconFilterClear {...TABLE_BTN_ICON} />}
            >
              Clear
            </TableLabelButton>
          </LiveGetForm>
      </TableFilterSession>

      <TableCard
        pager={
          <TablePager
            window={window}
            prevHref={memberListHref(query, { page: list.page - 1 })}
            nextHref={memberListHref(query, { page: list.page + 1 })}
            emptyLabel="No members."
          />
        }
      >
        <AdminMembersTable rows={list.rows} query={query} planNames={planNames} />
      </TableCard>
    </div>
  );
}
