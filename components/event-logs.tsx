"use client";

import Link from "next/link";
import { useMemo } from "react";
import { LocalTime } from "@/components/local-time";
import {
  LiveGetForm,
  SortTh,
  StatusBadge,
  TABLE_FILTER_CLEAR_CLASS,
  TABLE_FILTER_FIELD_CLASS,
  TableFilterField,
  TablePager,
  useClientTable,
} from "@/components/table-chrome";
import { eventLogOptionsForScopes } from "@/lib/logs/events";
import type { EventLogFilters, EventLogRow } from "@/lib/logs/list";
import { compareTableText, type TableSortDir } from "@/lib/table-chrome";
import { AppSelect } from "@/components/app-select";

function compareEventRows(
  left: EventLogRow,
  right: EventLogRow,
  key: string,
  dir: TableSortDir,
  accountLabel: Map<string, string>,
): number {
  if (key === "time") {
    return compareTableText(left.createdAt, right.createdAt, dir);
  }
  if (key === "level") {
    return compareTableText(left.level, right.level, dir);
  }
  if (key === "scope") {
    return compareTableText(left.scope, right.scope, dir);
  }
  if (key === "event") {
    return compareTableText(left.event, right.event, dir);
  }
  if (key === "user") {
    return compareTableText(left.userId ?? "", right.userId ?? "", dir);
  }
  if (key === "account") {
    const leftLabel = left.accountId
      ? (accountLabel.get(left.accountId) ?? left.accountId)
      : "";
    const rightLabel = right.accountId
      ? (accountLabel.get(right.accountId) ?? right.accountId)
      : "";
    return compareTableText(leftLabel, rightLabel, dir);
  }
  return compareTableText(left.message, right.message, dir);
}

function levelLabel(level: EventLogRow["level"]): string {
  if (level === "warning") {
    return "Warning";
  }
  if (level === "error") {
    return "Error";
  }
  return "Info";
}

export function EventLogs({
  rows,
  filters,
  clearHref,
  showUser,
  scopes,
  accounts,
  hidden,
}: {
  rows: EventLogRow[];
  filters: EventLogFilters;
  clearHref: string;
  showUser: boolean;
  scopes: Array<"system" | "strategy" | "trade">;
  accounts?: { id: string; label: string }[];
  hidden?: { desk?: string };
}) {
  const showAccount = Boolean(accounts);
  const columns = 5 + (showUser ? 1 : 0) + (showAccount ? 1 : 0);
  const accountLabel = useMemo(
    () =>
      new Map((accounts ?? []).map((account) => [account.id, account.label])),
    [accounts],
  );
  const events = eventLogOptionsForScopes(scopes, filters.event);
  const compare = useMemo(
    () =>
      (left: EventLogRow, right: EventLogRow, key: string, dir: TableSortDir) =>
        compareEventRows(left, right, key, dir, accountLabel),
    [accountLabel],
  );
  const table = useClientTable(rows, compare, {
    defaultKey: "time",
    defaultDir: "desc",
  });

  return (
    <>
      <LiveGetForm>
        <input type="hidden" name="page" value="1" />
        {hidden?.desk ? (
          <input type="hidden" name="desk" value={hidden.desk} />
        ) : null}
        {accounts ? (
          <TableFilterField label="Account">
            <AppSelect
              name="account"
              defaultValue={filters.account}
              className={TABLE_FILTER_FIELD_CLASS}
            >
              <option value="">All</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </AppSelect>
          </TableFilterField>
        ) : null}
        <TableFilterField label="Scope">
          <AppSelect
            name="scope"
            defaultValue={filters.scope}
            className={TABLE_FILTER_FIELD_CLASS}
          >
            <option value="">All</option>
            {scopes.map((scope) => (
              <option key={scope} value={scope}>
                {scope === "system"
                  ? "System"
                  : scope === "strategy"
                    ? "Strategy"
                    : "Trade"}
              </option>
            ))}
          </AppSelect>
        </TableFilterField>
        <TableFilterField label="Level">
          <AppSelect
            name="level"
            defaultValue={filters.level}
            className={TABLE_FILTER_FIELD_CLASS}
          >
            <option value="">All</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </AppSelect>
        </TableFilterField>
        <TableFilterField label="Event">
          <AppSelect
            name="event"
            defaultValue={filters.event}
            className={TABLE_FILTER_FIELD_CLASS}
          >
            <option value="">All</option>
            {events.map((event) => (
              <option key={event} value={event}>
                {event}
              </option>
            ))}
          </AppSelect>
        </TableFilterField>
        <Link href={clearHref} className={TABLE_FILTER_CLEAR_CLASS}>
          Clear
        </Link>
      </LiveGetForm>

      <div className="mt-6 overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <SortTh
                label="Time"
                active={table.sortKey === "time"}
                dir={table.sortDir}
                onSort={() => table.onSort("time")}
              />
              <SortTh
                label="Level"
                active={table.sortKey === "level"}
                dir={table.sortDir}
                onSort={() => table.onSort("level")}
              />
              <SortTh
                label="Scope"
                active={table.sortKey === "scope"}
                dir={table.sortDir}
                onSort={() => table.onSort("scope")}
              />
              <SortTh
                label="Event"
                active={table.sortKey === "event"}
                dir={table.sortDir}
                onSort={() => table.onSort("event")}
              />
              {showUser ? (
                <SortTh
                  label="User"
                  active={table.sortKey === "user"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("user")}
                />
              ) : null}
              {showAccount ? (
                <SortTh
                  label="Account"
                  active={table.sortKey === "account"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("account")}
                />
              ) : null}
              <SortTh
                label="Message"
                active={table.sortKey === "message"}
                dir={table.sortDir}
                onSort={() => table.onSort("message")}
              />
            </tr>
          </thead>
          <tbody>
            {table.pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns}
                  className="px-4 py-6 text-sm text-ink-muted"
                >
                  No events match.
                </td>
              </tr>
            ) : (
              table.pageRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="px-4 py-3 align-top tabular-nums text-ink-muted">
                    <LocalTime at={row.createdAt} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge
                      label={levelLabel(row.level)}
                      status={row.level}
                    />
                  </td>
                  <td className="px-4 py-3 align-top text-ink-muted">
                    {row.scope}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div>{row.event}</div>
                    {row.strategy ? (
                      <div className="text-xs text-ink-faint">{row.strategy}</div>
                    ) : null}
                  </td>
                  {showUser ? (
                    <td className="px-4 py-3 align-top font-mono text-xs text-ink-muted">
                      {row.userId ? row.userId.slice(0, 8) : "—"}
                    </td>
                  ) : null}
                  {showAccount ? (
                    <td className="px-4 py-3 align-top text-ink-muted">
                      {row.accountId
                        ? accountLabel.get(row.accountId) ?? "—"
                        : "—"}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 align-top">
                    <div>{row.message}</div>
                    {Object.keys(row.data).length > 0 ? (
                      <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-ink-faint">
                        {JSON.stringify(row.data, null, 2)}
                      </pre>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <TablePager
        window={table.window}
        onPrev={() => table.setPage(table.window.page - 1)}
        onNext={() => table.setPage(table.window.page + 1)}
        emptyLabel="No events match."
      />
      <p className="mt-3 text-xs text-ink-faint">Showing up to 100 events.</p>
    </>
  );
}
