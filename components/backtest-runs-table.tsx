"use client";

import { useCallback, useMemo, useState } from "react";
import { useConfirmDialog } from "@/components/confirm-modal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RemoveBacktestButton } from "@/components/backtest-run-view";
import { IconClose, IconFilterClear, IconTrash } from "@/components/icons";
import {
  SortTh,
  StatusBadge,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TABLE_FILTER_FIELD_CLASS,
  TableCard,
  TableFilterBar,
  TableFilterField,
  TableFilterSession,
  TableHideFilters,
  TableLabelButton,
  TablePager,
  useClientTable,
} from "@/components/table-chrome";
import { AppCheck } from "@/components/app-check";
import { deleteBacktestRunsAction } from "@/lib/backtest/actions";
import {
  backtestAprPct,
  backtestRoePct,
  backtestRunTitle,
  backtestRunWasLiquidated,
  backtestSavedListHref,
  backtestWindowDays,
  canDeleteBacktestRun,
  formatBacktestReturnPct,
  type BacktestRun,
  type BacktestStatus,
} from "@/lib/backtest/model";
import { formatCount, signedTone } from "@/lib/opportunities/format";
import {
  compareTableNum,
  compareTableText,
  type TableSortDir,
} from "@/lib/table-chrome";
import { AppSelect } from "@/components/app-select";

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const STATUS_FILTERS: Array<BacktestStatus | "all"> = [
  "all",
  "queued",
  "running",
  "done",
  "failed",
  "cancelled",
  "draft",
];

function compareNullableNum(
  left: number | null,
  right: number | null,
  dir: TableSortDir,
): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return compareTableNum(left, right, dir);
}

function runWinRate(row: BacktestRun): number | null {
  return row.stats && row.stats.trades > 0 ? row.stats.winRate : null;
}

function runRoe(row: BacktestRun): number | null {
  return row.stats
    ? backtestRoePct(row.stats.realizedUsdt, row.orders, row.leverage)
    : null;
}

function runApr(row: BacktestRun): number | null {
  return row.stats
    ? backtestAprPct(
        row.stats.realizedUsdt,
        row.stats.startingUsdt,
        row.fromMs,
        row.toMs,
      )
    : null;
}

function compareBacktestRun(
  left: BacktestRun,
  right: BacktestRun,
  key: string,
  dir: TableSortDir,
): number {
  if (key === "name") {
    return compareTableText(backtestRunTitle(left), backtestRunTitle(right), dir);
  }
  if (key === "type") {
    return compareTableText(left.deskType, right.deskType, dir);
  }
  if (key === "contract") {
    return compareTableText(left.symbol, right.symbol, dir);
  }
  if (key === "comps") {
    return compareTableNum(
      (left.comparableSymbols ?? []).length,
      (right.comparableSymbols ?? []).length,
      dir,
    );
  }
  if (key === "days") {
    return compareNullableNum(
      backtestWindowDays(left.fromMs, left.toMs),
      backtestWindowDays(right.fromMs, right.toMs),
      dir,
    );
  }
  if (key === "win") {
    return compareNullableNum(runWinRate(left), runWinRate(right), dir);
  }
  if (key === "roe") {
    return compareNullableNum(runRoe(left), runRoe(right), dir);
  }
  if (key === "apr") {
    return compareNullableNum(runApr(left), runApr(right), dir);
  }
  if (key === "status") {
    return compareTableText(left.status, right.status, dir);
  }
  return 0;
}

export function BacktestRunsTable({
  runs,
  memberId,
  isAdmin,
  primaryRunId,
  returnTo = "/account/backtests",
  watchRunId,
}: {
  runs: BacktestRun[];
  memberId: string;
  isAdmin: boolean;
  primaryRunId?: string;
  returnTo?: string;
  watchRunId?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | BacktestStatus>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { confirm, dialog } = useConfirmDialog();
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return runs.filter((row) => {
      if (status !== "all" && row.status !== status) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const hay = [
        backtestRunTitle(row),
        row.symbol,
        row.deskType === "dca" ? "dca" : "perps",
        row.status,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [query, runs, status]);
  const compare = useCallback(
    (left: BacktestRun, right: BacktestRun, key: string, dir: TableSortDir) =>
      compareBacktestRun(left, right, key, dir),
    [],
  );
  const table = useClientTable(filtered, compare);
  const removableIds = table.pageRows
    .filter((row) => canDeleteBacktestRun(row, memberId, isAdmin))
    .map((row) => row.id);
  const listedRemovableIds = filtered
    .filter((row) => canDeleteBacktestRun(row, memberId, isAdmin))
    .map((row) => row.id);
  const allSelected =
    removableIds.length > 0 && removableIds.every((id) => selected.has(id));
  const selectedCount = [...selected].filter((id) =>
    listedRemovableIds.includes(id),
  ).length;

  function toggleRow(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) {
        for (const id of removableIds) {
          next.delete(id);
        }
      } else {
        for (const id of removableIds) {
          next.add(id);
        }
      }
      return next;
    });
  }

  function clearFilters() {
    setQuery("");
    setStatus("all");
    table.setPage(1);
  }

  async function deleteSelected() {
    if (selectedCount === 0 || pending) {
      return;
    }
    const label = selectedCount === 1 ? "backtest" : "backtests";
    const ok = await confirm({
      title: `Delete ${selectedCount} ${label}?`,
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) {
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    const data = new FormData();
    for (const id of selected) {
      if (listedRemovableIds.includes(id)) {
        data.append("runId", id);
      }
    }
    const result = await deleteBacktestRunsAction(data);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not remove those backtests.");
      return;
    }
    const deletedCurrent = Boolean(watchRunId && selected.has(watchRunId));
    setSelected(new Set());
    if (result.notes?.[0]) {
      setMessage(result.notes[0]);
    }
    if (deletedCurrent) {
      router.push(backtestSavedListHref());
    }
    router.refresh();
  }

  return (
    <div>
      {dialog}
      <TableFilterSession
        toolbar={
          selectedCount > 0 ? (
            <>
              <p className="text-sm text-ink-muted">{selectedCount} selected</p>
              <TableLabelButton
                variant="danger"
                disabled={pending}
                icon={<IconTrash {...TABLE_BTN_ICON} />}
                onClick={() => void deleteSelected()}
              >
                {pending ? "Deleting…" : "Delete"}
              </TableLabelButton>
              <TableLabelButton
                variant="bulk"
                disabled={pending}
                icon={<IconClose {...TABLE_BTN_ICON} />}
                onClick={() => setSelected(new Set())}
              >
                Clear
              </TableLabelButton>
            </>
          ) : undefined
        }
      >
          <TableFilterBar>
            <TableFilterField label="Search">
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  table.setPage(1);
                }}
                placeholder="Name or contract"
                autoComplete="off"
                className={TABLE_FILTER_FIELD_CLASS}
              />
            </TableFilterField>
            <TableFilterField label="Status">
              <AppSelect
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as "all" | BacktestStatus);
                  table.setPage(1);
                }}
                className={TABLE_FILTER_FIELD_CLASS}
              >
                {STATUS_FILTERS.map((value) => (
                  <option key={value} value={value}>
                    {value === "all" ? "All statuses" : statusLabel(value)}
                  </option>
                ))}
              </AppSelect>
            </TableFilterField>
            <TableLabelButton
              variant="filter"
              icon={<IconFilterClear {...TABLE_BTN_ICON} />}
              onClick={clearFilters}
            >
              Clear
            </TableLabelButton>
            <TableHideFilters />
          </TableFilterBar>
      </TableFilterSession>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
      <TableCard
        pager={
          <TablePager
            window={table.window}
            onPrev={() => table.setPage(table.window.page - 1)}
            onNext={() => table.setPage(table.window.page + 1)}
          />
        }
      >
        <table className="w-full min-w-max text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint [&_th]:whitespace-nowrap">
            <tr>
              <th className="w-10 px-4 py-3">
                {removableIds.length > 0 ? (
                  <AppCheck
                    checked={allSelected}
                    onChange={toggleAll}
                    indeterminate={selectedCount > 0 && !allSelected}
                    aria-label="Select all backtests"
                    className=""
                  />
                ) : null}
              </th>
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
                label="Contract"
                active={table.sortKey === "contract"}
                dir={table.sortDir}
                onSort={() => table.onSort("contract")}
              />
              <SortTh
                label="Comps"
                active={table.sortKey === "comps"}
                dir={table.sortDir}
                onSort={() => table.onSort("comps")}
              />
              <SortTh
                label="Days"
                active={table.sortKey === "days"}
                dir={table.sortDir}
                onSort={() => table.onSort("days")}
              />
              <SortTh
                label="Win Rate"
                active={table.sortKey === "win"}
                dir={table.sortDir}
                onSort={() => table.onSort("win")}
              />
              <SortTh
                label="ROE"
                active={table.sortKey === "roe"}
                dir={table.sortDir}
                onSort={() => table.onSort("roe")}
              />
              <SortTh
                label="APR"
                active={table.sortKey === "apr"}
                dir={table.sortDir}
                onSort={() => table.onSort("apr")}
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
            {table.pageRows.map((row) => (
              <BacktestRunRow
                key={row.id}
                row={row}
                memberId={memberId}
                isAdmin={isAdmin}
                isPrimary={row.id === primaryRunId}
                returnTo={returnTo}
                selected={selected.has(row.id)}
                onToggle={() => toggleRow(row.id)}
              />
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function BacktestRunRow({
  row,
  memberId,
  isAdmin,
  isPrimary,
  returnTo,
  selected,
  onToggle,
}: {
  row: BacktestRun;
  memberId: string;
  isAdmin: boolean;
  isPrimary: boolean;
  returnTo: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const href = `/account/backtests/${row.id}`;
  const title = backtestRunTitle(row);
  const days = backtestWindowDays(row.fromMs, row.toMs);
  const canRemove = canDeleteBacktestRun(row, memberId, isAdmin);
  const winRate =
    row.stats && row.stats.trades > 0
      ? `${Math.round(row.stats.winRate * 100)}%`
      : "—";
  const roe = row.stats
    ? backtestRoePct(row.stats.realizedUsdt, row.orders, row.leverage)
    : null;
  const apr = row.stats
    ? backtestAprPct(
        row.stats.realizedUsdt,
        row.stats.startingUsdt,
        row.fromMs,
        row.toMs,
      )
    : null;
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-4 py-3">
        {canRemove ? (
          <AppCheck
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${title}`}
            className=""
          />
        ) : null}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex flex-wrap items-center gap-2">
          <Link href={href} className="text-accent hover:underline">
            {title}
          </Link>
          {isPrimary ? (
            <span className="rounded-control bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-accent">
              Primary Pair
            </span>
          ) : null}
          {backtestRunWasLiquidated(row.orders) ? (
            <span className="rounded-control bg-danger/15 px-1.5 py-0.5 text-[11px] font-medium text-danger">
              Liq
            </span>
          ) : null}
          {row.userId == null ? (
            <span className="text-xs text-ink-faint">published</span>
          ) : null}
        </span>
      </td>
      <td className="px-4 py-3 text-ink-muted">
        {row.deskType === "dca" ? "DCA" : "Perps"}
      </td>
      <td className="px-4 py-3 font-medium tabular-nums">{row.symbol}</td>
      <td className="px-4 py-3 text-ink-muted">
        {(row.comparableSymbols ?? []).length > 0
          ? `+${row.comparableSymbols.length}`
          : "—"}
      </td>
      <td className="px-4 py-3 tabular-nums text-ink-muted">
        {days != null ? formatCount(days) : "—"}
      </td>
      <td className="px-4 py-3 tabular-nums">{winRate}</td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(roe)}`}>
        {formatBacktestReturnPct(roe)}
      </td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(apr)}`}>
        {formatBacktestReturnPct(apr)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge label={statusLabel(row.status)} status={row.status} />
      </td>
      <td className={TABLE_ACTIONS_TD_CLASS}>
        <RemoveBacktestButton
          runId={row.id}
          canRemove={canRemove}
          returnTo={returnTo}
          compact
        />
      </td>
    </tr>
  );
}
