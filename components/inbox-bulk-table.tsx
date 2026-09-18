"use client";

import { type ReactNode, useMemo, useState } from "react";
import { AppCheck } from "@/components/app-check";
import { IconMail, IconMailOpen, IconMarkAllRead } from "@/components/icons";
import { LocalTime } from "@/components/local-time";
import {
  SortTh,
  StatusBadge,
  TABLE_BTN_ICON,
  TableCard,
  TableIconAction,
  TablePendingLabelButton,
} from "@/components/table-chrome";
import {
  markNotificationsReadAction,
  markNotificationsUnreadAction,
} from "@/lib/notifications/actions";
import {
  inboxPath,
  toggleInboxSort,
  type InboxFilters,
  type InboxSortQuery,
} from "@/lib/notifications/inbox";

export type InboxTableRow = {
  id: number;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

export function InboxBulkTable({
  rows,
  page,
  filters,
  sort,
  unread,
  pager,
}: {
  rows: InboxTableRow[];
  page: number;
  filters: InboxFilters;
  sort: InboxSortQuery;
  unread: number;
  pager?: ReactNode;
}) {
  const ids = useMemo(() => rows.map((row) => row.id), [rows]);
  const [selected, setSelected] = useState<number[]>([]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.includes(id));
  const hasSelection = selected.length > 0;

  function toggleAll() {
    setSelected(allSelected ? [] : ids);
  }

  function toggleOne(id: number) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  return (
    <div>
      <form>
        <input type="hidden" name="page" value={String(page)} />
        <input type="hidden" name="status" value={filters.status} />
        <input type="hidden" name="scope" value={filters.scope} />
        <input type="hidden" name="event" value={filters.event} />
        {sort.sort !== "date" ? (
          <input type="hidden" name="sort" value={sort.sort} />
        ) : null}
        {sort.dir !== "desc" ? (
          <input type="hidden" name="dir" value={sort.dir} />
        ) : null}
        <div
          className={`mb-3 flex flex-wrap items-center gap-3 ${
            hasSelection ? "justify-between" : "justify-end"
          }`}
        >
          {hasSelection ? (
            <div className="flex flex-wrap gap-2">
              <TablePendingLabelButton
                formAction={markNotificationsReadAction}
                pendingLabel="Marking…"
                icon={<IconMailOpen {...TABLE_BTN_ICON} />}
              >
                Mark read
              </TablePendingLabelButton>
              <TablePendingLabelButton
                formAction={markNotificationsUnreadAction}
                pendingLabel="Marking…"
                icon={<IconMail {...TABLE_BTN_ICON} />}
              >
                Mark unread
              </TablePendingLabelButton>
            </div>
          ) : null}
          <TablePendingLabelButton
            formAction={markNotificationsReadAction}
            name="all"
            value="1"
            pendingLabel="Marking…"
            disabled={unread < 1}
            icon={<IconMarkAllRead {...TABLE_BTN_ICON} />}
          >
            Mark all read
          </TablePendingLabelButton>
        </div>
        <TableCard className="" pager={pager}>
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
              <tr>
                <th className="w-10 px-4 py-3">
                  <AppCheck
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={ids.length === 0}
                    aria-label="Select all notices on this page"
                    className=""
                  />
                </th>
                <SortTh
                  label="Message"
                  active={sort.sort === "message"}
                  dir={sort.dir}
                  href={inboxPath(1, filters, toggleInboxSort(sort, "message"))}
                />
                <SortTh
                  label="Date"
                  active={sort.sort === "date"}
                  dir={sort.dir}
                  href={inboxPath(1, filters, toggleInboxSort(sort, "date"))}
                />
                <SortTh
                  label="Status"
                  active={sort.sort === "status"}
                  dir={sort.dir}
                  href={inboxPath(1, filters, toggleInboxSort(sort, "status"))}
                />
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-ink-muted">
                    No notices match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-line last:border-b-0 ${
                      row.readAt ? "" : "bg-warning/5"
                    }`}
                  >
                    <td className="px-4 py-3 align-top">
                      <AppCheck
                        name="id"
                        value={row.id}
                        checked={selected.includes(row.id)}
                        onChange={() => toggleOne(row.id)}
                        aria-label={`Select ${row.title}`}
                        className=""
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <button
                        type="submit"
                        form={`inbox-open-${row.id}`}
                        className={`text-left hover:text-accent ${
                          row.readAt
                            ? "text-ink-muted"
                            : "font-medium text-ink"
                        }`}
                      >
                        {row.title}
                      </button>
                      {row.body ? (
                        <p className="mt-1 text-ink-muted">{row.body}</p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-ink-muted">
                      <LocalTime at={row.createdAt} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StatusBadge
                        label={row.readAt ? "Read" : "Unread"}
                        status={row.readAt ? "read" : "unread"}
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <TableIconAction
                        type="submit"
                        form={`inbox-row-${row.id}`}
                        label={row.readAt ? "Mark unread" : "Mark read"}
                        detail={
                          row.readAt
                            ? "Show this notice as unread."
                            : "Mark this notice as read."
                        }
                      >
                        {row.readAt ? (
                          <IconMail {...TABLE_BTN_ICON} />
                        ) : (
                          <IconMailOpen {...TABLE_BTN_ICON} />
                        )}
                      </TableIconAction>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableCard>
      </form>
      {rows.map((row) => (
        <div key={row.id} className="hidden">
          <form id={`inbox-open-${row.id}`} action={markNotificationsReadAction}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="next" value={row.href} />
          </form>
          <form
            id={`inbox-row-${row.id}`}
            action={
              row.readAt
                ? markNotificationsUnreadAction
                : markNotificationsReadAction
            }
          >
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="page" value={String(page)} />
            <input type="hidden" name="status" value={filters.status} />
            <input type="hidden" name="scope" value={filters.scope} />
            <input type="hidden" name="event" value={filters.event} />
            {sort.sort !== "date" ? (
              <input type="hidden" name="sort" value={sort.sort} />
            ) : null}
            {sort.dir !== "desc" ? (
              <input type="hidden" name="dir" value={sort.dir} />
            ) : null}
          </form>
        </div>
      ))}
    </div>
  );
}
