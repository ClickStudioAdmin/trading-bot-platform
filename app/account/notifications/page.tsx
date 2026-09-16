import type { Metadata } from "next";
import Link from "next/link";
import { InboxBulkTable } from "@/components/inbox-bulk-table";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { listTradingAccounts } from "@/lib/accounts/store";
import { getSessionMember } from "@/lib/auth/session";
import { resolveInboxHref } from "@/lib/notifications/hrefs";
import {
  inboxHasFilters,
  inboxFilterTemplates,
  inboxPageLabel,
  inboxPath,
  parseInboxFilters,
  parseInboxPage,
} from "@/lib/notifications/inbox";
import { NOTIFICATION_LABELS, memberSettingGroups } from "@/lib/notifications/settings";
import { firstSearchValue } from "@/lib/paper/open";
import {
  countUnreadUserNotifications,
  listUserNotificationPage,
} from "@/lib/notifications/store";
import { redirect } from "next/navigation";

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
  const page = parseInboxPage(firstSearchValue(params.page));
  const templates = inboxFilterTemplates(filters, groups);
  const events = groups.flatMap((group) =>
    filters.scope && group.id !== filters.scope ? [] : group.ids,
  );
  const [list, unread, desks] = await Promise.all([
    listUserNotificationPage(member.id, page, undefined, {
      status: filters.status,
      templates,
    }),
    countUnreadUserNotifications(member.id),
    listTradingAccounts(member.id),
  ]);
  if (page !== list.page) {
    redirect(inboxPath(list.page, filters));
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
      <p className="-mt-4 text-sm text-ink-muted">
        Email copies land here. This badge is unread notices only. Work that
        still needs doing stays on Overview and Billing. Change what you get on{" "}
        <Link
          href="/account/settings?tab=notifications"
          className="text-accent hover:text-accent-strong"
        >
          Settings → Notifications
        </Link>
        .
      </p>
      <form
        method="get"
        className="mt-6 rounded-card border border-line bg-surface p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs text-ink-muted">
            Status
            <select
              name="status"
              defaultValue={filters.status}
              className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
            >
              <option value="">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </label>
          <label className="block text-xs text-ink-muted">
            Scope
            <select
              name="scope"
              defaultValue={filters.scope}
              className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
            >
              <option value="">All</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-ink-muted">
            Event
            <select
              name="event"
              defaultValue={filters.event}
              className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
            >
              <option value="">All</option>
              {events.map((id) => (
                <option key={id} value={id}>
                  {NOTIFICATION_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <PendingSubmitButton
            pendingLabel="Applying…"
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            Apply filters
          </PendingSubmitButton>
          <Link
            href="/account/notifications"
            className="rounded-control border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
          >
            Clear
          </Link>
        </div>
      </form>
      {list.total === 0 && !filteredEmpty ? (
        <p className="mt-6 rounded-card border border-line bg-surface px-5 py-6 text-sm text-ink-muted">
          No notices yet.
        </p>
      ) : (
        <div className="mt-6">
          <InboxBulkTable
            rows={rows}
            page={list.page}
            filters={filters}
            unread={unread}
          />
          <InboxPager list={list} filters={filters} />
        </div>
      )}
    </div>
  );
}

function InboxPager({
  list,
  filters,
}: {
  list: {
    page: number;
    pageCount: number;
    total: number;
    from: number;
    to: number;
  };
  filters: Parameters<typeof inboxPath>[1];
}) {
  if (list.total === 0) {
    return null;
  }
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
      <p>{inboxPageLabel(list)}</p>
      {list.pageCount > 1 ? (
        <div className="flex gap-2">
          {list.page > 1 ? (
            <Link
              href={inboxPath(list.page - 1, filters)}
              className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Previous
            </Link>
          ) : null}
          {list.page < list.pageCount ? (
            <Link
              href={inboxPath(list.page + 1, filters)}
              className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
