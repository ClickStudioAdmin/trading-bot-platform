"use client";

import Link from "next/link";
import { useCallback, type ReactNode } from "react";
import { ColumnHint } from "@/components/column-hint";
import {
  SortTh,
  TableCard,
  TableFilterSession,
  TablePager,
  useClientTable,
} from "@/components/table-chrome";
import {
  PaperClosedColumnPicker,
  PaperOpenColumnPicker,
  usePaperClosedColumns,
  usePaperOpenColumns,
} from "@/components/paper-column-picker";
import {
  ClosedPaperCarryRows,
  OpenPaperCarryRows,
} from "@/components/paper-carry-expand";
import { OpenStats } from "@/components/open-stats";
import {
  formatPct,
  formatSignedUsd,
  signedTone,
} from "@/lib/opportunities/format";
import type { EventLogRow } from "@/lib/logs/list";
import type { PaperOrderRow } from "@/lib/paper/orders";
import {
  paperClosedColumnCount,
  paperOpenColumnCount,
} from "@/lib/paper/columns";
import { formatTradingDaysNote } from "@/lib/futures/stats";
import {
  openExposure,
  paperDeskStats,
  type MarkedPaperCarry,
  type PaperCarryRow,
} from "@/lib/paper/rows";
import {
  compareTableNum,
  compareTableText,
  type TableSortDir,
} from "@/lib/table-chrome";
import { carryPnlPct } from "@/lib/paper/math";

type OpenCarryView = MarkedPaperCarry & {
  orders: PaperOrderRow[];
  logs: EventLogRow[];
};
type ClosedCarryView = PaperCarryRow & {
  orders: PaperOrderRow[];
  logs: EventLogRow[];
};

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

export function OpenPaperTrades({
  signedIn,
  open,
  next = "/strategies/cash-and-carry",
  showHeading = true,
  exchangeBook = false,
  positionsHref = "/strategies/cash-and-carry/positions",
  opportunitiesHref = "/strategies/cash-and-carry/opportunities",
  filterBar,
  filtersOpen = false,
  emptyMessage,
}: {
  signedIn: boolean;
  open: OpenCarryView[];
  next?: string;
  showHeading?: boolean;
  exchangeBook?: boolean;
  positionsHref?: string;
  opportunitiesHref?: string;
  filterBar?: ReactNode;
  filtersOpen?: boolean;
  emptyMessage?: ReactNode;
}) {
  const { visible, setColumn } = usePaperOpenColumns();
  const colSpan = paperOpenColumnCount(visible);
  const compare = useCallback(
    (left: OpenCarryView, right: OpenCarryView, key: string, dir: TableSortDir) => {
      if (key === "pair") {
        return compareTableText(
          `${left.baseCoin} ${left.futureSymbol}`,
          `${right.baseCoin} ${right.futureSymbol}`,
          dir,
        );
      }
      if (key === "source") {
        return compareTableText(
          `${left.source} ${left.ruleName ?? ""}`,
          `${right.source} ${right.ruleName ?? ""}`,
          dir,
        );
      }
      if (key === "dte") {
        return compareNullableNum(left.daysToExpiry, right.daysToExpiry, dir);
      }
      if (key === "value") {
        return compareTableNum(left.notionalUsdt, right.notionalUsdt, dir);
      }
      if (key === "entry") {
        return compareTableNum(left.entryBasis, right.entryBasis, dir);
      }
      if (key === "mark") {
        return compareNullableNum(left.markBasis, right.markBasis, dir);
      }
      if (key === "apr") {
        return compareNullableNum(left.markApr, right.markApr, dir);
      }
      if (key === "unrealized") {
        return compareNullableNum(left.unrealizedUsdt, right.unrealizedUsdt, dir);
      }
      if (key === "pnl") {
        return compareNullableNum(
          left.unrealizedUsdt === null
            ? null
            : carryPnlPct(left.unrealizedUsdt, left.notionalUsdt),
          right.unrealizedUsdt === null
            ? null
            : carryPnlPct(right.unrealizedUsdt, right.notionalUsdt),
          dir,
        );
      }
      return 0;
    },
    [],
  );
  const table = useClientTable(open, compare);

  return (
    <section>
      {showHeading ? (
        <div className="mb-3 flex items-end justify-between gap-3">
          <SectionHead
            title="Current Positions"
            subtitle={
              exchangeBook
                ? "Open cash-and-carry on the bound exchange. Close exits both Bybit legs."
                : "Open paper carries. Unrealized includes open and close fees on both legs. Close is paper only — no Bybit order."
            }
            className=""
          />
          <Link
            href={positionsHref}
            className="shrink-0 text-sm text-accent hover:text-accent-strong"
          >
            All positions
          </Link>
        </div>
      ) : null}
      <TableFilterSession
        defaultOpen={filtersOpen}
        actions={
          <PaperOpenColumnPicker visible={visible} setColumn={setColumn} />
        }
      >
        {filterBar}
      </TableFilterSession>
      <TableCard
        pager={
          <TablePager
            window={table.window}
            onPrev={() => table.setPage(table.window.page - 1)}
            onNext={() => table.setPage(table.window.page + 1)}
          />
        }
      >
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Details"
                  hint={
                    exchangeBook
                      ? "Expand for orders and the event log for this position."
                      : "Expand for paper orders and the event log for this position."
                  }
                />
              </th>
              <SortTh
                label="Pair"
                active={table.sortKey === "pair"}
                dir={table.sortDir}
                onSort={() => table.onSort("pair")}
              />
              <SortTh
                label="Source"
                active={table.sortKey === "source"}
                dir={table.sortDir}
                onSort={() => table.onSort("source")}
              />
              {visible.dte ? (
                <SortTh
                  label="DTE"
                  active={table.sortKey === "dte"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("dte")}
                />
              ) : null}
              {visible.value ? (
                <SortTh
                  label="Order Value"
                  active={table.sortKey === "value"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("value")}
                />
              ) : null}
              {visible.entry ? (
                <SortTh
                  label="Entry basis"
                  active={table.sortKey === "entry"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("entry")}
                />
              ) : null}
              {visible.mark ? (
                <SortTh
                  label="Mark basis"
                  active={table.sortKey === "mark"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("mark")}
                />
              ) : null}
              {visible.apr ? (
                <SortTh
                  label="Net APR"
                  active={table.sortKey === "apr"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("apr")}
                />
              ) : null}
              {visible.unrealized ? (
                <SortTh
                  label="Unrealized"
                  active={table.sortKey === "unrealized"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("unrealized")}
                />
              ) : null}
              {visible.pnl ? (
                <SortTh
                  label="P&L %"
                  active={table.sortKey === "pnl"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("pnl")}
                />
              ) : null}
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Close By"
                  hint={
                    exchangeBook
                      ? "Manual Close exits both Bybit legs at market. Auto Close uses that bot’s exit order type. Unwind clips to usable book on the exchange."
                      : "Manual Close exits remaining size at the live scan. Auto Close uses only that bot’s exit order type — Fixed closes remaining size, Dynamic clips to usable book. It does not wait for APR, DTE, take profit, or stop loss. Unwind is manual only. After an exit is submitted, Close is replaced by Closing. No Bybit order."
                  }
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {!signedIn ? (
              <EmptyRow
                colSpan={colSpan}
                message={
                  <>
                    <Link href="/sign-in" className="text-accent">
                      Sign in
                    </Link>{" "}
                    to open paper carries and see them here.
                  </>
                }
              />
            ) : table.pageRows.length === 0 ? (
              <EmptyRow
                colSpan={colSpan}
                message={
                  emptyMessage ?? (
                  <>
                    {exchangeBook
                      ? "No open carries. Open one from "
                      : "No open paper carries. Open one from "}
                    <Link href={opportunitiesHref} className="text-accent">
                      Opportunities
                    </Link>
                    .
                  </>
                  )
                }
              />
            ) : (
              table.pageRows.map((trade) => (
                <OpenPaperCarryRows
                  key={trade.id}
                  trade={trade}
                  next={next}
                  visible={visible}
                  colSpan={colSpan}
                />
              ))
            )}
          </tbody>
        </table>
      </TableCard>
    </section>
  );
}

export function ClosedPaperTrades({
  signedIn,
  closed,
  filterBar,
  filtersOpen = false,
  emptyMessage,
}: {
  signedIn: boolean;
  closed: ClosedCarryView[];
  filterBar?: ReactNode;
  filtersOpen?: boolean;
  emptyMessage?: ReactNode;
}) {
  const compare = useCallback(
    (left: ClosedCarryView, right: ClosedCarryView, key: string, dir: TableSortDir) => {
      if (key === "pair") {
        return compareTableText(
          `${left.baseCoin} ${left.futureSymbol}`,
          `${right.baseCoin} ${right.futureSymbol}`,
          dir,
        );
      }
      if (key === "source") {
        return compareTableText(
          `${left.source} ${left.ruleName ?? ""}`,
          `${right.source} ${right.ruleName ?? ""}`,
          dir,
        );
      }
      if (key === "closed") {
        return compareNullableNum(left.closedAtMs, right.closedAtMs, dir);
      }
      if (key === "days") {
        return compareNullableNum(left.daysHeld, right.daysHeld, dir);
      }
      if (key === "entry") {
        return compareTableNum(left.entryBasis, right.entryBasis, dir);
      }
      if (key === "exit") {
        return compareNullableNum(left.exitBasis, right.exitBasis, dir);
      }
      if (key === "realized") {
        return compareNullableNum(left.realizedUsdt, right.realizedUsdt, dir);
      }
      if (key === "pnl") {
        return compareNullableNum(
          left.realizedUsdt === null
            ? null
            : carryPnlPct(left.realizedUsdt, left.notionalUsdt),
          right.realizedUsdt === null
            ? null
            : carryPnlPct(right.realizedUsdt, right.notionalUsdt),
          dir,
        );
      }
      return 0;
    },
    [],
  );
  const table = useClientTable(closed, compare);
  const { visible, setColumn } = usePaperClosedColumns();
  const colSpan = paperClosedColumnCount(visible);
  return (
    <section>
      <SectionHead title="Past Positions" />
      <TableFilterSession
        defaultOpen={filtersOpen}
        actions={
          <PaperClosedColumnPicker visible={visible} setColumn={setColumn} />
        }
      >
        {filterBar}
      </TableFilterSession>
      <TableCard
        pager={
          <TablePager
            window={table.window}
            onPrev={() => table.setPage(table.window.page - 1)}
            onNext={() => table.setPage(table.window.page + 1)}
          />
        }
      >
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Details"
                  hint="Expand for orders and the event log for this position."
                />
              </th>
              <SortTh
                label="Pair"
                active={table.sortKey === "pair"}
                dir={table.sortDir}
                onSort={() => table.onSort("pair")}
              />
              {visible.source ? (
                <SortTh
                  label="Source"
                  active={table.sortKey === "source"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("source")}
                />
              ) : null}
              {visible.closed ? (
                <SortTh
                  label="Closed"
                  active={table.sortKey === "closed"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("closed")}
                />
              ) : null}
              {visible.days ? (
                <SortTh
                  label="Days held"
                  active={table.sortKey === "days"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("days")}
                />
              ) : null}
              {visible.entry ? (
                <SortTh
                  label="Entry"
                  active={table.sortKey === "entry"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("entry")}
                />
              ) : null}
              {visible.exit ? (
                <SortTh
                  label="Exit"
                  active={table.sortKey === "exit"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("exit")}
                />
              ) : null}
              {visible.realized ? (
                <SortTh
                  label="Realized"
                  active={table.sortKey === "realized"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("realized")}
                />
              ) : null}
              {visible.pnl ? (
                <SortTh
                  label="P&L %"
                  active={table.sortKey === "pnl"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("pnl")}
                />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {!signedIn ? (
              <EmptyRow
                colSpan={colSpan}
                message={
                  <>
                    <Link href="/sign-in" className="text-accent">
                      Sign in
                    </Link>{" "}
                    to see closed paper carries.
                  </>
                }
              />
            ) : table.pageRows.length === 0 ? (
              <EmptyRow
                colSpan={colSpan}
                message={emptyMessage ?? "No closed paper carries yet."}
              />
            ) : (
              table.pageRows.map((trade) => (
                <ClosedPaperCarryRows
                  key={trade.id}
                  trade={trade}
                  visible={visible}
                  colSpan={colSpan}
                />
              ))
            )}
          </tbody>
        </table>
      </TableCard>
    </section>
  );
}

export function PaperPerformanceStats({
  signedIn,
  closed,
  scope,
}: {
  signedIn: boolean;
  closed: PaperCarryRow[];
  scope?: ReactNode;
}) {
  const stats = paperDeskStats([], closed);
  const winRate =
    stats.closedCount === 0
      ? "—"
      : `${Math.round((stats.greenCount / stats.closedCount) * 100)}%`;

  return (
    <section>
      <SectionHead
        title="Desk Statistics"
        subtitle={
          signedIn ? undefined : "Sign in to see your paper desk numbers."
        }
        action={scope}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Completed Trades"
          value={signedIn ? String(stats.closedCount) : "—"}
          note={signedIn ? formatTradingDaysNote(stats.tradingDays) : undefined}
        />
        <StatCard
          label="Win Rate"
          value={signedIn ? winRate : "—"}
        />
        <StatCard
          label="Realized Profit"
          value={signedIn ? formatSignedUsd(stats.realizedUsdt) : "—"}
          toneClass={signedTone(signedIn ? stats.realizedUsdt : null)}
          hint="Closed-carry dollars."
        />
        <StatCard
          label="P&L"
          value={
            signedIn && stats.realizedPct != null
              ? formatPct(stats.realizedPct)
              : "—"
          }
          toneClass={signedTone(signedIn ? stats.realizedUsdt : null)}
          hint="Realized profit ÷ sum of closed carry value."
          note="Based on position value"
        />
      </div>
    </section>
  );
}

export function PaperOpenStats({
  signedIn,
  open,
}: {
  signedIn: boolean;
  open: MarkedPaperCarry[];
}) {
  const stats = paperDeskStats(open, []);
  return (
    <OpenStats
      signedIn={signedIn}
      notional={stats.openNotionalUsdt}
      unrealized={stats.unrealizedUsdt}
      exposure={openExposure(open)}
    />
  );
}

function EmptyRow({
  colSpan,
  message,
}: {
  colSpan: number;
  message: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-6 text-sm text-ink-muted">
        {message}
      </td>
    </tr>
  );
}

function SectionHead({
  title,
  subtitle,
  action,
  className = "mb-3",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 ${className}`.trim()}
    >
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  toneClass,
  hint,
  note,
}: {
  label: string;
  value: string;
  toneClass?: string;
  hint?: string;
  note?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <StatBlock
        label={label}
        value={value}
        toneClass={toneClass}
        hint={hint}
        note={note}
      />
    </div>
  );
}

function StatBlock({
  label,
  value,
  toneClass,
  hint,
  note,
}: {
  label: string;
  value: string;
  toneClass?: string;
  hint?: string;
  note?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        {hint ? <ColumnHint label={label} hint={hint} /> : label}
      </p>
      <p
        className={`mt-3 text-2xl font-semibold tracking-tight ${toneClass ?? "text-ink"}`}
      >
        {value}
      </p>
      {note ? <p className="mt-2 text-hint text-ink-faint">{note}</p> : null}
    </div>
  );
}
