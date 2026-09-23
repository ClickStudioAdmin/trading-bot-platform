import type { Metadata } from "next";
import { InboxBulkTable } from "@/components/inbox-bulk-table";
import { PageHeading } from "@/components/page-heading";
import { IconFilterClear } from "@/components/icons";
import {
  LiveGetForm,
  TABLE_BTN_ICON,
  TABLE_FILTER_FIELD_CLASS,
  TableFilterField,
  TableLabelButton,
  TablePager,
} from "@/components/table-chrome";
import { listTradingAccounts } from "@/lib/accounts/store";
import { getSessionMember } from "@/lib/auth/session";
import { resolveInboxHref } from "@/lib/notifications/hrefs";
import {
  inboxHasFilters,
  inboxFilterTemplates,
  inboxPath,
  parseInboxFilters,
  parseInboxPage,
  parseInboxSort,
} from "@/lib/notifications/inbox";
import { NOTIFICATION_LABELS, memberSettingGroups } from "@/lib/notifications/settings";
import { firstSearchValue } from "@/lib/paper/open";
import {
  countUnreadUserNotifications,
  listUserNotificationPage,
} from "@/lib/notifications/store";
import { redirect } from "next/navigation";
import { AppSelect } from "@/components/app-select";

export const metadata: Metadata = {
  title: "Inbox",
  description: "Notices for this login.",
};

export default async function AccountNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const params = await searchParams;
  const groups = memberSettingGroups(!member.platformMember);
  const filters = parseInboxFilters(params, groups);
  const sort = parseInboxSort(params);
  const page = parseInboxPage(firstSearchValue(params.page));
  const templates = inboxFilterTemplates(filters, groups);
  const events = groups.flatMap((group) =>
    filters.scope && group.id !== filters.scope ? [] : group.ids,
  );
  const [list, unread, desks] = await Promise.all([
    listUserNotificationPage(member.id, page, undefined, {
      status: filters.status,
      templates,
      sort: sort.sort,
      dir: sort.dir,
    }),
    countUnreadUserNotifications(member.id),
    listTradingAccounts(member.id),
  ]);
  if (page !== list.page) {
    redirect(inboxPath(list.page, filters, sort));
  }
  const rows = list.rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    href: resolveInboxHref({
      href: row.href,
      title: row.title,
      template: row.template,
      desks,
    }),
    readAt: row.readAt,
    createdAt: row.createdAt,
  }));
  const filteredEmpty = list.total === 0 && inboxHasFilters(filters);

  return (
    <div>
      <PageHeading title="Inbox" />
      {list.total === 0 && !filteredEmpty ? (
        <p className="mt-6 rounded-card border border-line bg-surface px-5 py-6 text-sm text-ink-muted">
          No notices yet.
        </p>
      ) : (
        <InboxBulkTable
          rows={rows}
          page={list.page}
          filters={filters}
          sort={sort}
          unread={unread}
          filtersOpen={inboxHasFilters(filters)}
          filterBar={
            <LiveGetForm>
              <input type="hidden" name="page" value="1" />
              {sort.sort !== "date" ? (
                <input type="hidden" name="sort" value={sort.sort} />
              ) : null}
              {sort.dir !== "desc" ? (
                <input type="hidden" name="dir" value={sort.dir} />
              ) : null}
              <TableFilterField label="Status">
                <AppSelect
                  name="status"
                  defaultValue={filters.status}
                  className={TABLE_FILTER_FIELD_CLASS}
                >
                  <option value="">All</option>
                  <option value="unread">Unread</option>
                  <option value="read">Read</option>
                </AppSelect>
              </TableFilterField>
              <TableFilterField label="Scope">
                <AppSelect
                  name="scope"
                  defaultValue={filters.scope}
                  className={TABLE_FILTER_FIELD_CLASS}
                >
                  <option value="">All</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label}
                    </option>
                  ))}
                </AppSelect>
              </TableFilterField>
              <TableFilterField label="Event">
                <AppSelect
                  name="event"
                  defaultValue={filters.event}
                  className={TABLE_FILTER_FIELD_CLASS}
                >
                  <option value="">All</option>
                  {events.map((id) => (
                    <option key={id} value={id}>
                      {NOTIFICATION_LABELS[id]}
                    </option>
                  ))}
                </AppSelect>
              </TableFilterField>
              <TableLabelButton
                href="/account/notifications"
                variant="filter"
                icon={<IconFilterClear {...TABLE_BTN_ICON} />}
              >
                Clear
              </TableLabelButton>
            </LiveGetForm>
          }
          pager={
            <TablePager
              window={list}
              prevHref={inboxPath(list.page - 1, filters, sort)}
              nextHref={inboxPath(list.page + 1, filters, sort)}
              pageHref={(page) => inboxPath(page, filters, sort)}
              emptyLabel="No notices."
            />
          }
        />
      )}
    </div>
  );
}
