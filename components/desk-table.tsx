"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AccountDeleteControl } from "@/components/account-delete-control";
import { AccountDisableControl } from "@/components/account-disable-control";
import { AccountRenameControl } from "@/components/account-rename-control";
import { AppSelect } from "@/components/app-select";
import { DeskTypeMark } from "@/components/desk-mark";
import { IconFilterClear, IconPlus } from "@/components/icons";
import {
  SortTh,
  StatusBadge,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_FILTER_FIELD_CLASS,
  TableActions,
  TableCard,
  TableFilterBar,
  TableFilterField,
  TableFilterSession,
  TablePager,
  useClientTable,
} from "@/components/table-chrome";
import {
  TABLE_BTN_ICON,
  TableLabelButton,
} from "@/components/table-actions";
import { deskDisableBotKind } from "@/lib/accounts/disable-desk";
import {
  buildDeskListRow,
  compareDeskList,
  DESK_LIST_TYPES,
  deskListFilterChoices,
  deskListFiltersActive,
  EMPTY_DESK_LIST_FILTERS,
  filterDeskList,
  formatDeskListStatus,
  type DeskListFilters,
  type DeskListRow,
} from "@/lib/accounts/desk-list";
import {
  createDeskPath,
  formatAccountMode,
  formatDeleteBlockers,
  formatDeskType,
  otherDeskNames,
  pickDefaultAccount,
  type TradingAccount,
} from "@/lib/accounts/model";
import type { AccountUsage } from "@/lib/accounts/store";
import type { ExchangeConnection } from "@/lib/exchanges/connections";

export function DeskTable({
  accounts,
  usage,
  connections,
  currentId,
}: {
  accounts: TradingAccount[];
  usage: Record<string, AccountUsage>;
  connections: readonly ExchangeConnection[];
  currentId: string;
}) {
  const [filters, setFilters] = useState(EMPTY_DESK_LIST_FILTERS);
  const rows = useMemo(
    () =>
      accounts.map((account) =>
        buildDeskListRow(account, usage[account.id], connections),
      ),
    [accounts, connections, usage],
  );
  const filtered = useMemo(
    () => filterDeskList(rows, filters),
    [filters, rows],
  );
  const choices = useMemo(() => deskListFilterChoices(rows), [rows]);
  const table = useClientTable(filtered, compareDeskList, { defaultKey: "name" });
  const filtering = deskListFiltersActive(filters);

  function changeFilter<K extends keyof DeskListFilters>(
    key: K,
    value: DeskListFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
    table.setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_DESK_LIST_FILTERS);
    table.setPage(1);
  }

  return (
    <>
      <TableFilterSession
        id="desks"
        actions={<CreateDeskMenu />}
      >
        <TableFilterBar>
          <TableFilterField label="Name">
            <input
              type="search"
              value={filters.name}
              onChange={(event) => changeFilter("name", event.target.value)}
              placeholder="Desk name"
              autoComplete="off"
              className={TABLE_FILTER_FIELD_CLASS}
            />
          </TableFilterField>
          <TableFilterField label="Type">
            <AppSelect
              value={filters.type}
              onChange={(event) =>
                changeFilter("type", event.target.value as DeskListFilters["type"])
              }
              className={TABLE_FILTER_FIELD_CLASS}
            >
              <option value="all">All</option>
              {choices.types.map((type) => (
                <option key={type} value={type}>
                  {formatDeskType(type)}
                </option>
              ))}
            </AppSelect>
          </TableFilterField>
          <TableFilterField label="Mode">
            <AppSelect
              value={filters.mode}
              onChange={(event) =>
                changeFilter("mode", event.target.value as DeskListFilters["mode"])
              }
              className={TABLE_FILTER_FIELD_CLASS}
            >
              <option value="all">All</option>
              <option value="paper">Paper Trading</option>
              <option value="live">Connected Exchange</option>
            </AppSelect>
          </TableFilterField>
          <TableFilterField label="Exchange">
            <AppSelect
              value={filters.exchange}
              onChange={(event) => changeFilter("exchange", event.target.value)}
              className={TABLE_FILTER_FIELD_CLASS}
            >
              <option value="all">All</option>
              {choices.exchanges.map((exchange) => (
                <option key={exchange} value={exchange}>
                  {exchange}
                </option>
              ))}
            </AppSelect>
          </TableFilterField>
          <TableFilterField label="Environment">
            <AppSelect
              value={filters.environment}
              onChange={(event) => changeFilter("environment", event.target.value)}
              className={TABLE_FILTER_FIELD_CLASS}
            >
              <option value="all">All</option>
              {choices.environments.map((environment) => (
                <option key={environment} value={environment}>
                  {environment}
                </option>
              ))}
            </AppSelect>
          </TableFilterField>
          <TableFilterField label="Status">
            <AppSelect
              value={filters.status}
              onChange={(event) =>
                changeFilter("status", event.target.value as DeskListFilters["status"])
              }
              className={TABLE_FILTER_FIELD_CLASS}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </AppSelect>
          </TableFilterField>
          <TableLabelButton
            variant="filter"
            icon={<IconFilterClear {...TABLE_BTN_ICON} />}
            onClick={clearFilters}
          >
            Clear
          </TableLabelButton>
        </TableFilterBar>
      </TableFilterSession>
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
        <table className="w-full min-w-[96rem] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[14rem]" />
            <col className="w-[12rem]" />
            <col className="w-[12rem]" />
            <col className="w-[14rem]" />
            <col className="w-[14rem]" />
            <col />
            <col className="w-[7rem]" />
            <col className="w-[7.5rem]" />
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
                label="Type"
                active={table.sortKey === "type"}
                dir={table.sortDir}
                onSort={() => table.onSort("type")}
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
                label="Environment"
                active={table.sortKey === "environment"}
                dir={table.sortDir}
                onSort={() => table.onSort("environment")}
              />
              <SortTh
                label="Details"
                active={table.sortKey === "details"}
                dir={table.sortDir}
                onSort={() => table.onSort("details")}
              />
              <SortTh
                label="Status"
                active={table.sortKey === "status"}
                dir={table.sortDir}
                onSort={() => table.onSort("status")}
              />
              <th className={TABLE_ACTIONS_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-sm text-ink-muted">
                  {filtering
                    ? "No desks match these filters."
                    : "No desks yet."}
                </td>
              </tr>
            ) : (
              table.pageRows.map((row) => (
                <DeskRow
                  key={row.account.id}
                  row={row}
                  accounts={accounts}
                  currentId={currentId}
                />
              ))
            )}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}

function DeskRow({
  row,
  accounts,
  currentId,
}: {
  row: DeskListRow;
  accounts: TradingAccount[];
  currentId: string;
}) {
  const account = row.account;
  const current = account.id === currentId;
  const blocks = row.blocks;
  const canDelete = blocks.length === 0;
  const remaining = accounts.filter((item) => item.id !== account.id);
  const defaultSwitch = pickDefaultAccount(remaining);
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-4 py-3 pr-8 align-top">{account.name}</td>
      <td className="px-4 py-3 pr-8 align-top">
        <p>{formatDeskType(account.deskType)}</p>
        {account.copyOfAccountId ? (
          <p className="mt-1 text-hint text-ink-muted">Copy</p>
        ) : null}
      </td>
      <td className="px-4 py-3 pr-8 align-top text-ink-muted">
        {formatAccountMode(account.mode)}
      </td>
      <td className="px-4 py-3 pr-8 align-top text-ink-muted">
        {row.exchange ? (
          <>
            <p>{row.exchange}</p>
            {row.connection ? (
              <p className="mt-1 text-hint text-ink-muted">{row.connection}</p>
            ) : null}
          </>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </td>
      <td className="px-4 py-3 pr-8 align-top text-ink-muted">
        {row.environment ? (
          <span title={row.environmentTitle ?? undefined}>{row.environment}</span>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </td>
      <td className="px-4 py-3 pr-8 align-top text-ink-muted">
        <div className="space-y-1">
          {row.detailLines.map((line) => (
            <p key={line} className="tabular-nums">
              {line}
            </p>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 pr-8 align-top">
        <StatusBadge
          label={formatDeskListStatus(row.status)}
          tone={row.status === "active" ? "success" : "muted"}
        />
      </td>
      <td className={`${TABLE_ACTIONS_TD_CLASS} align-top`}>
        <TableActions>
          <AccountRenameControl
            accountId={account.id}
            accountName={account.name}
            otherNames={otherDeskNames(accounts, account.id)}
          />
          <AccountDisableControl
            accountId={account.id}
            accountName={account.name}
            kind={deskDisableBotKind(account)}
          />
          <AccountDeleteControl
            accountId={account.id}
            accountName={account.name}
            blockedMessage={canDelete ? null : formatDeleteBlockers(blocks)}
            switchOptions={
              current && canDelete
                ? remaining.map((item) => ({
                    id: item.id,
                    name: item.name,
                    mode: formatAccountMode(item.mode),
                  }))
                : undefined
            }
            defaultSwitchId={current && canDelete ? defaultSwitch?.id : undefined}
          />
        </TableActions>
      </td>
    </tr>
  );
}

function CreateDeskMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <TableLabelButton
        variant="primary"
        icon={<IconPlus {...TABLE_BTN_ICON} />}
        expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        Create Desk
      </TableLabelButton>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-64 rounded-card border border-line bg-surface p-1"
        >
          {DESK_LIST_TYPES.map((type) => (
            <Link
              key={type}
              role="menuitem"
              href={createDeskPath(type)}
              className="flex items-center gap-2 rounded-control px-2 py-1.5 text-sm text-ink hover:bg-surface-raised"
              onClick={() => setOpen(false)}
            >
              <DeskTypeMark deskType={type} />
              {formatDeskType(type)}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
