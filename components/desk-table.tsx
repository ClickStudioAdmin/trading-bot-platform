"use client";

import { useCallback } from "react";
import { AccountDeleteControl } from "@/components/account-delete-control";
import { AccountRenameControl } from "@/components/account-rename-control";
import {
  SortTh,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_TITLE_CASE_TH_CLASS,
  TableActions,
  TableCard,
  TablePager,
  useClientTable,
} from "@/components/table-chrome";
import {
  formatAccountMode,
  formatAccountUsageStatus,
  formatDeleteBlockers,
  otherDeskNames,
  pickDefaultAccount,
  type TradingAccount,
} from "@/lib/accounts/model";
import type { AccountUsage } from "@/lib/accounts/store";
import {
  formatExchangeEnvironmentColumn,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import {
  compareTableText,
  type TableSortDir,
} from "@/lib/table-chrome";

function boundConnection(
  usage: AccountUsage | undefined,
  connections: readonly ExchangeConnection[],
): ExchangeConnection | null {
  const id = usage?.futuresConnectionId ?? usage?.strategyConnectionId ?? null;
  if (!id) {
    return null;
  }
  return connections.find((row) => row.id === id) ?? null;
}

function deskExchange(
  account: TradingAccount,
  usage: AccountUsage | undefined,
  connections: readonly ExchangeConnection[],
): { label: string | null; venueEnv: string } | null {
  const connection = boundConnection(usage, connections);
  if (account.mode === "live" && !connection) {
    return null;
  }
  const venue = connection?.venue ?? account.venue;
  const environment = connection?.environment ?? account.venueEnvironment;
  return {
    label: connection?.label?.trim() || null,
    venueEnv: formatExchangeEnvironmentColumn(venue, environment),
  };
}

function deskExchangeSortValue(
  account: TradingAccount,
  usage: AccountUsage | undefined,
  connections: readonly ExchangeConnection[],
): string {
  const exchange = deskExchange(account, usage, connections);
  if (!exchange) {
    return "";
  }
  return exchange.label
    ? `${exchange.label} ${exchange.venueEnv}`
    : exchange.venueEnv;
}

function deskDetails(usage: AccountUsage | undefined): string {
  return formatAccountUsageStatus({
    openCount: usage?.openCount ?? 0,
    workingCount: usage?.workingCount ?? 0,
    automationsRunning: Boolean(usage?.automationsRunning),
    reduceOnly: Boolean(usage?.reduceOnly),
  });
}

function compareDesk(
  left: TradingAccount,
  right: TradingAccount,
  key: string,
  dir: TableSortDir,
  usage: Record<string, AccountUsage>,
  connections: readonly ExchangeConnection[],
): number {
  if (key === "name") {
    return compareTableText(left.name, right.name, dir);
  }
  if (key === "mode") {
    return compareTableText(
      formatAccountMode(left.mode),
      formatAccountMode(right.mode),
      dir,
    );
  }
  if (key === "exchange") {
    return compareTableText(
      deskExchangeSortValue(left, usage[left.id], connections),
      deskExchangeSortValue(right, usage[right.id], connections),
      dir,
    );
  }
  if (key === "details") {
    return compareTableText(
      deskDetails(usage[left.id]),
      deskDetails(usage[right.id]),
      dir,
    );
  }
  return 0;
}

export function DeskTable({
  accounts,
  allAccounts,
  usage,
  connections,
  currentId,
}: {
  accounts: TradingAccount[];
  allAccounts: TradingAccount[];
  usage: Record<string, AccountUsage>;
  connections: readonly ExchangeConnection[];
  currentId: string;
}) {
  const compare = useCallback(
    (left: TradingAccount, right: TradingAccount, key: string, dir: TableSortDir) =>
      compareDesk(left, right, key, dir, usage, connections),
    [usage, connections],
  );
  const table = useClientTable(accounts, compare, { defaultKey: "name" });

  return (
    <TableCard
      pager={
        <TablePager
          window={table.window}
          onPage={(page) => table.setPage(page)}
          onPrev={() => table.setPage(table.window.page - 1)}
          onNext={() => table.setPage(table.window.page + 1)}
        />
      }
    >
        <table className="w-full min-w-[64rem] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[14rem]" />
            <col className="w-[14rem]" />
            <col className="w-[20rem]" />
            <col />
            <col className="w-[11rem]" />
          </colgroup>
          <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <SortTh
                label="Name"
                active={table.sortKey === "name"}
                dir={table.sortDir}
                onSort={() => table.onSort("name")}
              />
              <SortTh
                label="Mode"
                active={table.sortKey === "mode"}
                dir={table.sortDir}
                onSort={() => table.onSort("mode")}
              />
              <SortTh
                label="Exchange / Environment"
                className={TABLE_TITLE_CASE_TH_CLASS}
                active={table.sortKey === "exchange"}
                dir={table.sortDir}
                onSort={() => table.onSort("exchange")}
              />
              <SortTh
                label="Details"
                active={table.sortKey === "details"}
                dir={table.sortDir}
                onSort={() => table.onSort("details")}
              />
              <th className={TABLE_ACTIONS_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {table.pageRows.map((account) => {
              const row = usage[account.id];
              const blocks = row?.blocks ?? [];
              const canDelete = blocks.length === 0;
              const current = account.id === currentId;
              const usageStatus = deskDetails(row);
              const exchange = deskExchange(account, row, connections);
              const remaining = allAccounts.filter((item) => item.id !== account.id);
              const defaultSwitch = pickDefaultAccount(remaining);
              return (
                <tr
                  key={account.id}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="px-4 py-3 pr-8 align-top">{account.name}</td>
                  <td className="px-4 py-3 pr-8 align-top text-ink-muted">
                    {formatAccountMode(account.mode)}
                  </td>
                  <td className="px-4 py-3 pr-8 align-top text-ink-muted">
                    {exchange ? (
                      <>
                        {exchange.label ? <p>{exchange.label}</p> : null}
                        <p className={exchange.label ? "mt-1 text-hint text-ink-muted" : undefined}>
                          {exchange.venueEnv}
                        </p>
                      </>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 pr-8 align-top">
                    {usageStatus ? (
                      <span className="text-ink-muted">{usageStatus}</span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className={`${TABLE_ACTIONS_TD_CLASS} align-top`}>
                    <TableActions>
                      <AccountRenameControl
                        accountId={account.id}
                        accountName={account.name}
                        otherNames={otherDeskNames(allAccounts, account.id)}
                      />
                      <AccountDeleteControl
                        accountId={account.id}
                        accountName={account.name}
                        blockedMessage={
                          canDelete ? null : formatDeleteBlockers(blocks)
                        }
                        switchOptions={
                          current && canDelete
                            ? remaining.map((item) => ({
                                id: item.id,
                                name: item.name,
                                mode: formatAccountMode(item.mode),
                              }))
                            : undefined
                        }
                        defaultSwitchId={
                          current && canDelete ? defaultSwitch?.id : undefined
                        }
                      />
                    </TableActions>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
    </TableCard>
  );
}
