"use client";

import { useCallback } from "react";
import { AccountDeleteControl } from "@/components/account-delete-control";
import { AccountRenameControl } from "@/components/account-rename-control";
import { SortTh, TableCard, TablePager, useClientTable } from "@/components/table-chrome";
import {
  formatAccountMode,
  formatAccountUsageStatus,
  formatDeleteBlockers,
  formatDeskExchangeCaption,
  otherDeskNames,
  pickDefaultAccount,
  type TradingAccount,
} from "@/lib/accounts/model";
import type { AccountUsage } from "@/lib/accounts/store";
import {
  compareTableText,
  type TableSortDir,
} from "@/lib/table-chrome";

function deskExchange(
  account: TradingAccount,
  usage: AccountUsage | undefined,
): string {
  return (
    formatDeskExchangeCaption(
      account,
      Boolean(usage?.futuresConnectionId ?? usage?.strategyConnectionId),
    ) ?? ""
  );
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
      deskExchange(left, usage[left.id]),
      deskExchange(right, usage[right.id]),
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
  currentId,
}: {
  accounts: TradingAccount[];
  allAccounts: TradingAccount[];
  usage: Record<string, AccountUsage>;
  currentId: string;
}) {
  const compare = useCallback(
    (left: TradingAccount, right: TradingAccount, key: string, dir: TableSortDir) =>
      compareDesk(left, right, key, dir, usage),
    [usage],
  );
  const table = useClientTable(accounts, compare);

  return (
    <TableCard
      pager={
        <TablePager
          window={table.window}
          onPrev={() => table.setPage(table.window.page - 1)}
          onNext={() => table.setPage(table.window.page + 1)}
        />
      }
    >
        <table className="w-full min-w-[64rem] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[14rem]" />
            <col className="w-[14rem]" />
            <col className="w-[16rem]" />
            <col />
            <col className="w-[11rem]" />
          </colgroup>
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
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
                label="Exchange"
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
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {table.pageRows.map((account) => {
              const row = usage[account.id];
              const blocks = row?.blocks ?? [];
              const canDelete = blocks.length === 0;
              const current = account.id === currentId;
              const usageStatus = deskDetails(row);
              const exchange = deskExchange(account, row);
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
                    {exchange || <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-4 py-3 pr-8 align-top">
                    {usageStatus ? (
                      <span className="text-ink-muted">{usageStatus}</span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap items-center gap-3">
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
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
    </TableCard>
  );
}
