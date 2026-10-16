"use client";

import { type ReactNode, useMemo, useState } from "react";
import { AppCheck } from "@/components/app-check";
import { IconMail, IconMailOpen, IconMarkAllRead } from "@/components/icons";
import { LocalTime } from "@/components/local-time";
import {
  SortTh,
  StatusBadge,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TableActions,
  TableCard,
  TableFilterSession,
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

function InboxReturnFields({
  page,
  filters,
  sort,
}: {
  page: number;
  filters: InboxFilters;
  sort: InboxSortQuery;
}) {
  return (
    <>
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
    </>
  );
}

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
  filterBar,
  filtersOpen = false,
}: {
  rows: InboxTableRow[];
  page: number;
  filters: InboxFilters;
  sort: InboxSortQuery;
  unread: number;
  pager?: ReactNode;
  filterBar?: ReactNode;
  filtersOpen?: boolean;
}) {
  const ids = useMemo(() => rows.map((row) => row.id), [rows]);
  const [selected, setSelected] = useState<number[]>([]);
  const [readAtOverride, setReadAtOverride] = useState<
    Map<number, string | null>
  >(() => new Map());
  const allSelected = ids.length > 0 && ids.every((id) => selected.includes(id));
  const hasSelection = selected.length > 0;

  function shownReadAt(row: InboxTableRow): string | null {
    return readAtOverride.has(row.id)
      ? (readAtOverride.get(row.id) ?? null)
      : row.readAt;
  }

  function paintRead(targetIds: readonly number[], read: boolean) {
    if (targetIds.length === 0) {
      return;
    }
    setReadAtOverride((current) => {
      const next = new Map(current);
      const stamp = read ? new Date().toISOString() : null;
      for (const id of targetIds) {
        next.set(id, stamp);
      }
      return next;
    });
  }

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
      <TableFilterSession
        defaultOpen={filtersOpen}
        toolbar={
          hasSelection ? (
            <>
              <TablePendingLabelButton
                form="inbox-bulk"
                formAction={markNotificationsReadAction}
                name="intent"
                value="read"
                pendingLabel="Marking…"
                icon={<IconMailOpen {...TABLE_BTN_ICON} />}
              >
                Mark read
              </TablePendingLabelButton>
              <TablePendingLabelButton
                form="inbox-bulk"
                formAction={markNotificationsUnreadAction}
                name="intent"
                value="unread"
                pendingLabel="Marking…"
                icon={<IconMail {...TABLE_BTN_ICON} />}
              >
                Mark unread
              </TablePendingLabelButton>
            </>
          ) : undefined
        }
        actions={
          <TablePendingLabelButton
            form="inbox-mark-all"
            formAction={markNotificationsReadAction}
            pendingLabel="Marking…"
            disabled={unread < 1}
            icon={<IconMarkAllRead {...TABLE_BTN_ICON} />}
          >
            Mark all read
          </TablePendingLabelButton>
        }
      >
        {filterBar}
      </TableFilterSession>
      <form
        id="inbox-mark-all"
        action={markNotificationsReadAction}
        className="hidden"
        onSubmit={() => paintRead(ids, true)}
      >
        <input type="hidden" name="all" value="1" />
        <InboxReturnFields page={page} filters={filters} sort={sort} />
      </form>
      <form
        id="inbox-bulk"
        onSubmit={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          const intent =
            submitter instanceof HTMLButtonElement ? submitter.value : "";
          if (intent === "read" || intent === "unread") {
            paintRead(selected, intent === "read");
          }
        }}
      >
        <InboxReturnFields page={page} filters={filters} sort={sort} />
        <TableCard pager={pager}>
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
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
                <th className={TABLE_ACTIONS_TH_CLASS}>Actions</th>
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
                      shownReadAt(row) ? "" : "bg-warning/5"
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
                          shownReadAt(row)
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
                        label={shownReadAt(row) ? "Read" : "Unread"}
                        status={shownReadAt(row) ? "read" : "unread"}
                      />
                    </td>
                    <td className={`${TABLE_ACTIONS_TD_CLASS} align-top`}>
                      <TableActions>
                        <TableIconAction
                          type="submit"
                          form={`inbox-row-${row.id}`}
                          label={shownReadAt(row) ? "Mark unread" : "Mark read"}
                          detail={
                            shownReadAt(row)
                              ? "Show this notice as unread."
                              : "Mark this notice as read."
                          }
                        >
                          {shownReadAt(row) ? (
                            <IconMail {...TABLE_BTN_ICON} />
                          ) : (
                            <IconMailOpen {...TABLE_BTN_ICON} />
                          )}
                        </TableIconAction>
                      </TableActions>
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
              shownReadAt(row)
                ? markNotificationsUnreadAction
                : markNotificationsReadAction
            }
            onSubmit={() => paintRead([row.id], !shownReadAt(row))}
          >
            <input type="hidden" name="id" value={row.id} />
            <InboxReturnFields page={page} filters={filters} sort={sort} />
          </form>
        </div>
      ))}
    </div>
  );
}
