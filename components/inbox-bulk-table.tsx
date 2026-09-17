"use client";

import { useMemo, useState } from "react";
import { AppCheck } from "@/components/app-check";
import { LocalTime } from "@/components/local-time";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { SortTh, StatusBadge } from "@/components/table-chrome";
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

const actionLink =
  "rounded-control border border-line px-2 py-0.5 text-xs font-medium text-accent hover:text-accent-strong disabled:opacity-40";
const bulkAction =
  "rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-40";

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
}: {
  rows: InboxTableRow[];
  page: number;
  filters: InboxFilters;
  sort: InboxSortQuery;
  unread: number;
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <PendingSubmitButton
              formAction={markNotificationsReadAction}
              pendingLabel="Marking…"
              disabled={!hasSelection}
              className={bulkAction}
            >
              Mark read
            </PendingSubmitButton>
            <PendingSubmitButton
              formAction={markNotificationsUnreadAction}
              pendingLabel="Marking…"
              disabled={!hasSelection}
              className={bulkAction}
            >
              Mark unread
            </PendingSubmitButton>
          </div>
          <PendingSubmitButton
            formAction={markNotificationsReadAction}
            name="all"
            value="1"
            pendingLabel="Marking…"
            disabled={unread < 1}
            className={bulkAction}
          >
            Mark all read
          </PendingSubmitButton>
        </div>
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
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
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="submit"
                          form={`inbox-row-${row.id}`}
                          className={actionLink}
                        >
                          {row.readAt ? "Mark unread" : "Mark read"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
