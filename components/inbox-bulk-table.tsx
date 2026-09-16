"use client";

import { useMemo, useState } from "react";
import { LocalTime } from "@/components/local-time";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  markNotificationsReadAction,
  markNotificationsUnreadAction,
} from "@/lib/notifications/actions";
import type { InboxFilters } from "@/lib/notifications/inbox";

const actionLink =
  "rounded-control border border-line px-2 py-0.5 text-xs font-medium text-accent hover:text-accent-strong disabled:opacity-40";

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
}: {
  rows: InboxTableRow[];
  page: number;
  filters: InboxFilters;
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
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <PendingSubmitButton
            formAction={markNotificationsReadAction}
            pendingLabel="Marking…"
            disabled={!hasSelection}
            className={actionLink}
          >
            Mark read
          </PendingSubmitButton>
          <PendingSubmitButton
            formAction={markNotificationsUnreadAction}
            pendingLabel="Marking…"
            disabled={!hasSelection}
            className={actionLink}
          >
            Mark unread
          </PendingSubmitButton>
        </div>
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={ids.length === 0}
                    aria-label="Select all notices on this page"
                    className="size-4 accent-accent"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-sm text-ink-muted">
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
                      <input
                        type="checkbox"
                        name="id"
                        value={row.id}
                        checked={selected.includes(row.id)}
                        onChange={() => toggleOne(row.id)}
                        aria-label={`Select ${row.title}`}
                        className="size-4 accent-accent"
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
          </form>
        </div>
      ))}
    </div>
  );
}
