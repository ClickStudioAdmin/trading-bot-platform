"use client";

import { useCallback } from "react";
import { RemoveConnectionControl } from "@/components/remove-connection-control";
import { RenameConnectionControl } from "@/components/rename-connection-control";
import { ReplaceConnectionControl } from "@/components/replace-connection-control";
import {
  SortTh,
  StatusBadge,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_TITLE_CASE_TH_CLASS,
  TableActions,
  TableCard,
  TablePager,
  useClientTable,
} from "@/components/table-chrome";
import {
  connectionRemoveBlockers,
  formatConnectionRemoveBlockers,
} from "@/lib/accounts/model";
import {
  formatDeskBindType,
  formatExchangeEnvironmentColumn,
  formatStrategyConnectionCaption,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import type { ConnectionDeskBind } from "@/lib/exchanges/store";
import { getVenue } from "@/lib/exchanges/venues";
import {
  compareTableNum,
  compareTableText,
  type TableSortDir,
} from "@/lib/table-chrome";

function boundNames(
  row: ExchangeConnection,
  binds: ConnectionDeskBind[],
): string {
  return binds
    .filter((bind) => bind.connectionId === row.id)
    .map((bind) => bind.accountName)
    .join(" ");
}

function compareConnection(
  left: ExchangeConnection,
  right: ExchangeConnection,
  key: string,
  dir: TableSortDir,
  binds: ConnectionDeskBind[],
): number {
  if (key === "name") {
    return compareTableText(left.label ?? "", right.label ?? "", dir);
  }
  if (key === "exchange") {
    return compareTableText(
      formatExchangeEnvironmentColumn(left.venue, left.environment),
      formatExchangeEnvironmentColumn(right.venue, right.environment),
      dir,
    );
  }
  if (key === "desks") {
    return compareTableNum(
      binds.filter((bind) => bind.connectionId === left.id).length,
      binds.filter((bind) => bind.connectionId === right.id).length,
      dir,
    ) || compareTableText(boundNames(left, binds), boundNames(right, binds), dir);
  }
  return 0;
}

export function AccountConnectionsTable({
  rows,
  binds,
  canReplace,
}: {
  rows: ExchangeConnection[];
  binds: ConnectionDeskBind[];
  canReplace: boolean;
}) {
  const compare = useCallback(
    (
      left: ExchangeConnection,
      right: ExchangeConnection,
      key: string,
      dir: TableSortDir,
    ) => compareConnection(left, right, key, dir, binds),
    [binds],
  );
  const table = useClientTable(rows, compare);

  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-line bg-surface p-5 text-sm text-ink-muted">
        No exchanges connected on this login yet.
      </p>
    );
  }

  return (
    <section>
      <TableCard
        pager={
          <TablePager
            window={table.window}
            onPrev={() => table.setPage(table.window.page - 1)}
            onNext={() => table.setPage(table.window.page + 1)}
          />
        }
      >
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <SortTh
                label="Name"
                active={table.sortKey === "name"}
                dir={table.sortDir}
                onSort={() => table.onSort("name")}
              />
              <SortTh
                label="Exchange / Environment"
                className={TABLE_TITLE_CASE_TH_CLASS}
                active={table.sortKey === "exchange"}
                dir={table.sortDir}
                onSort={() => table.onSort("exchange")}
              />
              <SortTh
                label="Bound desks"
                active={table.sortKey === "desks"}
                dir={table.sortDir}
                onSort={() => table.onSort("desks")}
              />
              <th className={`px-4 py-3 font-medium ${TABLE_TITLE_CASE_TH_CLASS}`}>
                Desk Type
              </th>
              <th className={TABLE_ACTIONS_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {table.pageRows.map((row) => {
              const used = binds.filter((bind) => bind.connectionId === row.id);
              const inUse = used.length > 0;
              const caption = formatStrategyConnectionCaption(row);
              const removeBlocked = formatConnectionRemoveBlockers(
                connectionRemoveBlockers({ inUse }),
              );
              return (
                <tr
                  key={row.id}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="px-4 py-3 align-top">
                    <p>{caption.name}</p>
                    {caption.venue ? (
                      <p className="mt-1 text-hint text-ink-faint">{caption.venue}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p>{formatExchangeEnvironmentColumn(row.venue, row.environment)}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-hint text-ink-faint">
                      <span>Key ••••{row.fingerprint}</span>
                      {row.verifiedAtMs ? (
                        <StatusBadge label="Verified" status="verified" />
                      ) : null}
                      {row.status === "invalid" ? (
                        <StatusBadge label="Invalid" status="invalid" />
                      ) : null}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {used.length > 0 ? (
                      <span className="flex flex-col gap-1 text-ink-muted">
                        {used.map((bind) => (
                          <span key={`${bind.accountId}-${bind.strategy}`}>
                            {bind.accountName}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {used.length > 0 ? (
                      <span className="flex flex-col gap-1 text-ink-muted">
                        {used.map((bind) => (
                          <span key={`${bind.accountId}-${bind.strategy}-type`}>
                            {formatDeskBindType(bind.strategy)}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className={`${TABLE_ACTIONS_TD_CLASS} align-top`}>
                    <TableActions>
                      <RenameConnectionControl
                        connectionId={row.id}
                        label={row.label}
                      />
                      {canReplace &&
                      (getVenue(row.venue)?.credentialFields.length ?? 0) >
                        0 ? (
                        <ReplaceConnectionControl
                          connectionId={row.id}
                          credentialFields={
                            getVenue(row.venue)?.credentialFields ?? []
                          }
                        />
                      ) : null}
                      <RemoveConnectionControl
                        connectionId={row.id}
                        blockedMessage={inUse ? removeBlocked : null}
                      />
                    </TableActions>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>
    </section>
  );
}
