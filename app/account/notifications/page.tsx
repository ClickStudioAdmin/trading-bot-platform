import type { Metadata } from "next";
import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getSessionMember } from "@/lib/auth/session";
import {
  markNotificationsReadAction,
  markNotificationsUnreadAction,
} from "@/lib/notifications/actions";
import {
  inboxPageLabel,
  inboxPath,
  parseInboxPage,
} from "@/lib/notifications/inbox";
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
  const page = parseInboxPage(firstSearchValue(params.page));
  const [list, unread] = await Promise.all([
    listUserNotificationPage(member.id, page),
    countUnreadUserNotifications(member.id),
  ]);
  if (page !== list.page) {
    redirect(inboxPath(list.page));
  }

  return (
    <div>
      <PageHeading
        title="Inbox"
        actions={
          unread > 0 ? (
            <form action={markNotificationsReadAction}>
              <input type="hidden" name="all" value="1" />
              <input type="hidden" name="page" value={String(list.page)} />
              <PendingSubmitButton
                pendingLabel="Marking…"
                className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
              >
                Mark all read
              </PendingSubmitButton>
            </form>
          ) : null
        }
      />
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
      {list.total === 0 ? (
        <p className="mt-6 rounded-card border border-line bg-surface px-5 py-6 text-sm text-ink-muted">
          No notices yet.
        </p>
      ) : (
        <div className="mt-6">
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {list.rows.map((row) => (
              <li
                key={row.id}
                className={`flex flex-wrap items-start justify-between gap-3 px-5 py-4 ${
                  row.readAt ? "" : "bg-warning/5"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <form action={markNotificationsReadAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="next" value={row.href} />
                    <button
                      type="submit"
                      className={`text-left text-sm hover:text-accent ${
                        row.readAt ? "text-ink-muted" : "font-medium text-ink"
                      }`}
                    >
                      {row.title}
                    </button>
                  </form>
                  {row.body ? (
                    <p className="mt-1 text-sm text-ink-muted">{row.body}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-ink-faint">
                    <LocalTime at={row.createdAt} />
                  </p>
                </div>
                <form
                  action={
                    row.readAt
                      ? markNotificationsUnreadAction
                      : markNotificationsReadAction
                  }
                >
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="page" value={String(list.page)} />
                  <PendingSubmitButton
                    pendingLabel="Saving…"
                    className="rounded-control px-2 py-1 text-xs text-ink-faint hover:bg-surface-raised hover:text-ink"
                  >
                    {row.readAt ? "Mark unread" : "Mark read"}
                  </PendingSubmitButton>
                </form>
              </li>
            ))}
          </ul>
          <InboxPager list={list} />
        </div>
      )}
    </div>
  );
}

function InboxPager({
  list,
}: {
  list: {
    page: number;
    pageCount: number;
    total: number;
    from: number;
    to: number;
  };
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
              href={inboxPath(list.page - 1)}
              className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Previous
            </Link>
          ) : null}
          {list.page < list.pageCount ? (
            <Link
              href={inboxPath(list.page + 1)}
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
