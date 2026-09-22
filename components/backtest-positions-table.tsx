"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ColumnHint } from "@/components/column-hint";
import { IconFilterClear } from "@/components/icons";
import {
  SortTh,
  TABLE_BTN_ICON,
  TABLE_FILTER_FIELD_CLASS,
  TableCard,
  TableFilterBar,
  TableFilterField,
  TableFilterSession,
  TableLabelButton,
  TablePager,
  useClientTable,
} from "@/components/table-chrome";
import { TpslPair } from "@/components/futures-tpsl";
import { LocalTime } from "@/components/local-time";
import { TokenIcon } from "@/components/token-icon";
import { ExpandableTradeRows, TradeDetailTabs } from "@/components/trade-expand";
import type { BacktestRun, SimulatedOrder } from "@/lib/backtest/model";
import {
  backtestCycleLogLines,
  backtestCycleOrdersLabel,
  backtestCycleUnrealizedUsdt,
  backtestReplayMarkPrice,
  groupBacktestOrdersIntoCycles,
  plannedExitsForBacktestCycle,
  type BacktestPositionCycle,
} from "@/lib/backtest/positions";
import { futuresDaysHeld, positionMarginUsdt, roePct } from "@/lib/futures/stats";
import { formatLeverage } from "@/lib/futures/venue-risk";
import {
  formatPct,
  formatPrice,
  formatQty,
  formatQtyFull,
  formatSignedUsd,
  formatUsd,
  signedTone,
} from "@/lib/opportunities/format";
import {
  compareTableNum,
  compareTableText,
  type TableSortDir,
} from "@/lib/table-chrome";
import { AppSelect } from "@/components/app-select";

const OPEN_COL_SPAN_DCA = 14;
const OPEN_COL_SPAN = 13;
const CLOSED_COL_SPAN = 11;

type CycleSideFilter = "" | "long" | "short";

function cycleHaystack(run: BacktestRun, cycle: BacktestPositionCycle): string {
  return [
    run.symbol,
    cycle.side,
    cycle.status,
    cycle.exitReason ?? "",
    String(cycle.qty),
    String(cycle.entryPrice),
    cycle.exitPrice ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function filterCycles(
  run: BacktestRun,
  cycles: BacktestPositionCycle[],
  query: string,
  side: CycleSideFilter,
): BacktestPositionCycle[] {
  const needle = query.trim().toLowerCase();
  return cycles.filter((cycle) => {
    if (side && cycle.side !== side) {
      return false;
    }
    return !needle || cycleHaystack(run, cycle).includes(needle);
  });
}

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

function compareOpenCycle(
  left: BacktestPositionCycle,
  right: BacktestPositionCycle,
  key: string,
  dir: TableSortDir,
  mark: number | null,
  leverage: number | null,
): number {
  if (key === "contract") {
    return 0;
  }
  if (key === "side") {
    return compareTableText(left.side, right.side, dir);
  }
  if (key === "qty") {
    return compareTableNum(left.qty, right.qty, dir);
  }
  if (key === "value") {
    return compareTableNum(left.notionalUsdt, right.notionalUsdt, dir);
  }
  if (key === "entry") {
    return compareTableNum(left.entryPrice, right.entryPrice, dir);
  }
  if (key === "mark") {
    return compareNullableNum(mark, mark, dir);
  }
  if (key === "unrealized") {
    return compareNullableNum(
      backtestCycleUnrealizedUsdt(left, mark),
      backtestCycleUnrealizedUsdt(right, mark),
      dir,
    );
  }
  if (key === "pnl") {
    const leftU = backtestCycleUnrealizedUsdt(left, mark);
    const rightU = backtestCycleUnrealizedUsdt(right, mark);
    return compareNullableNum(
      leftU != null && left.notionalUsdt > 0 ? leftU / left.notionalUsdt : null,
      rightU != null && right.notionalUsdt > 0
        ? rightU / right.notionalUsdt
        : null,
      dir,
    );
  }
  if (key === "leverage") {
    return compareNullableNum(leverage, leverage, dir);
  }
  return 0;
}

function compareClosedCycle(
  left: BacktestPositionCycle,
  right: BacktestPositionCycle,
  key: string,
  dir: TableSortDir,
  leverage: number | null,
): number {
  if (key === "side") {
    return compareTableText(left.side, right.side, dir);
  }
  if (key === "value") {
    return compareTableNum(left.notionalUsdt, right.notionalUsdt, dir);
  }
  if (key === "closed") {
    return compareNullableNum(left.closedAtMs, right.closedAtMs, dir);
  }
  if (key === "days") {
    return compareNullableNum(
      futuresDaysHeld(left.openedAtMs, left.closedAtMs),
      futuresDaysHeld(right.openedAtMs, right.closedAtMs),
      dir,
    );
  }
  if (key === "entry") {
    return compareTableNum(left.entryPrice, right.entryPrice, dir);
  }
  if (key === "exit") {
    return compareNullableNum(left.exitPrice, right.exitPrice, dir);
  }
  if (key === "realized") {
    return compareTableNum(left.realizedUsdt, right.realizedUsdt, dir);
  }
  if (key === "pnl") {
    return compareNullableNum(
      left.notionalUsdt > 0 ? left.realizedUsdt / left.notionalUsdt : null,
      right.notionalUsdt > 0 ? right.realizedUsdt / right.notionalUsdt : null,
      dir,
    );
  }
  if (key === "roe") {
    return compareNullableNum(
      roePct(left.realizedUsdt, positionMarginUsdt(left.notionalUsdt, leverage)),
      roePct(
        right.realizedUsdt,
        positionMarginUsdt(right.notionalUsdt, leverage),
      ),
      dir,
    );
  }
  return 0;
}

export function BacktestPositionsTable({
  run,
  focusCycleId = null,
  onFocusCycleId,
}: {
  run: BacktestRun;
  focusCycleId?: string | null;
  onFocusCycleId?: (id: string | null) => void;
}) {
  const grouped = groupBacktestOrdersIntoCycles(run.orders);
  const dca = run.recipe.kind === "dca" || run.deskType === "dca";
  const maxClips = run.recipe.kind === "dca" ? run.recipe.maxClips : null;
  const recipeName = run.recipe.name.trim() || "Backtest";
  const mark = run.stats
    ? backtestReplayMarkPrice({
        opens: grouped.open,
        markUsdt: run.stats.markUsdt,
        lastPrice: run.stats.lastPrice,
      })
    : null;

  function selectCycle(id: string) {
    const next = focusCycleId === id ? null : id;
    onFocusCycleId?.(next);
    if (next) {
      document
        .getElementById("backtest-price-chart")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return (
    <div className="space-y-8">
      <OpenBacktestPositions
        run={run}
        cycles={grouped.open}
        dca={dca}
        maxClips={maxClips}
        recipeName={recipeName}
        mark={mark}
        focusCycleId={focusCycleId}
        onSelectCycle={onFocusCycleId ? selectCycle : undefined}
      />
      <ClosedBacktestPositions
        run={run}
        cycles={grouped.closed}
        recipeName={recipeName}
        focusCycleId={focusCycleId}
        onSelectCycle={onFocusCycleId ? selectCycle : undefined}
      />
    </div>
  );
}

function OpenBacktestPositions({
  run,
  cycles,
  dca,
  maxClips,
  recipeName,
  mark,
  focusCycleId,
  onSelectCycle,
}: {
  run: BacktestRun;
  cycles: BacktestPositionCycle[];
  dca: boolean;
  maxClips: number | null;
  recipeName: string;
  mark: number | null;
  focusCycleId: string | null;
  onSelectCycle?: (id: string) => void;
}) {
  const colSpan = dca ? OPEN_COL_SPAN_DCA : OPEN_COL_SPAN;
  const compare = useCallback(
    (
      left: BacktestPositionCycle,
      right: BacktestPositionCycle,
      key: string,
      dir: TableSortDir,
    ) => compareOpenCycle(left, right, key, dir, mark, run.leverage),
    [mark, run.leverage],
  );
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<CycleSideFilter>("");
  const filtered = useMemo(
    () => filterCycles(run, cycles, query, side),
    [cycles, query, run, side],
  );
  const table = useClientTable(filtered, compare);
  return (
    <section>
      <SectionHead
        title="Open Positions"
        subtitle="Still open at the end of the replay. Click a row to pin it on the chart."
      />
      {cycles.length > 0 ? (
        <CycleFilters
          query={query}
          side={side}
          onQuery={(value) => {
            setQuery(value);
            table.setPage(1);
          }}
          onSide={(value) => {
            setSide(value);
            table.setPage(1);
          }}
          onClear={() => {
            setQuery("");
            setSide("");
            table.setPage(1);
          }}
        />
      ) : null}
      <TableCard
        className=""
        pager={
          <TablePager
            window={table.window}
            onPrev={() => table.setPage(table.window.page - 1)}
            onNext={() => table.setPage(table.window.page + 1)}
          />
        }
      >
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="w-10 px-2 py-3 font-medium">
                <ColumnHint
                  label={<span className="sr-only">Details</span>}
                  hint="Expand for orders and the event log for this position."
                />
              </th>
              <SortTh
                label="Contract"
                active={table.sortKey === "contract"}
                dir={table.sortDir}
                onSort={() => table.onSort("contract")}
              />
              <SortTh
                label="Side"
                active={table.sortKey === "side"}
                dir={table.sortDir}
                onSort={() => table.onSort("side")}
              />
              {dca ? (
                <th className="px-3 py-3 font-medium">
                  <ColumnHint
                    label="Orders"
                    hint="Bot orders filled versus the max. Resting limits are not filled yet."
                  />
                </th>
              ) : null}
              <SortTh
                label="Qty"
                active={table.sortKey === "qty"}
                dir={table.sortDir}
                onSort={() => table.onSort("qty")}
              />
              <SortTh
                label="Value"
                active={table.sortKey === "value"}
                dir={table.sortDir}
                onSort={() => table.onSort("value")}
              />
              <SortTh
                label="Entry"
                active={table.sortKey === "entry"}
                dir={table.sortDir}
                onSort={() => table.onSort("entry")}
              />
              <SortTh
                label="Mark"
                active={table.sortKey === "mark"}
                dir={table.sortDir}
                onSort={() => table.onSort("mark")}
              />
              <SortTh
                label="Unrealized"
                active={table.sortKey === "unrealized"}
                dir={table.sortDir}
                onSort={() => table.onSort("unrealized")}
              />
              <SortTh
                label="P&L %"
                active={table.sortKey === "pnl"}
                dir={table.sortDir}
                onSort={() => table.onSort("pnl")}
              />
              <SortTh
                label="Leverage"
                active={table.sortKey === "leverage"}
                dir={table.sortDir}
                onSort={() => table.onSort("leverage")}
              />
              <th className="px-2 py-3 font-medium">
                <ColumnHint
                  label="Liq"
                  hint="Replay does not model liquidation. Always —."
                />
              </th>
              <th className="px-3 py-3 font-medium">
                <ColumnHint
                  label="TP/SL"
                  hint="Bot take profit / stop from the recipe at the current average entry. Faint is the planned level."
                />
              </th>
              <th className="px-3 py-3 font-medium">
                <ColumnHint
                  label="Trailing"
                  hint="Retracement from the recipe. Faint is the bot distance."
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {table.pageRows.length === 0 ? (
              <EmptyRow
                colSpan={colSpan}
                message={
                  cycles.length === 0
                    ? "No open position at the end of this run."
                    : "No positions match."
                }
              />
            ) : (
              table.pageRows.map((cycle) => (
                <OpenBacktestRows
                  key={cycle.id}
                  run={run}
                  cycle={cycle}
                  dca={dca}
                  maxClips={maxClips}
                  recipeName={recipeName}
                  colSpan={colSpan}
                  mark={mark}
                  selected={focusCycleId === cycle.id}
                  onSelect={
                    onSelectCycle ? () => onSelectCycle(cycle.id) : undefined
                  }
                />
              ))
            )}
          </tbody>
        </table>
      </TableCard>
    </section>
  );
}

function ClosedBacktestPositions({
  run,
  cycles,
  recipeName,
  focusCycleId,
  onSelectCycle,
}: {
  run: BacktestRun;
  cycles: BacktestPositionCycle[];
  recipeName: string;
  focusCycleId: string | null;
  onSelectCycle?: (id: string) => void;
}) {
  const compare = useCallback(
    (
      left: BacktestPositionCycle,
      right: BacktestPositionCycle,
      key: string,
      dir: TableSortDir,
    ) => compareClosedCycle(left, right, key, dir, run.leverage),
    [run.leverage],
  );
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<CycleSideFilter>("");
  const filtered = useMemo(
    () => filterCycles(run, cycles, query, side),
    [cycles, query, run, side],
  );
  const table = useClientTable(filtered, compare);
  return (
    <section>
      <SectionHead
        title="Past Positions"
        subtitle="Closed futures. Click a row to pin that trade on the chart."
      />
      {cycles.length > 0 ? (
        <CycleFilters
          query={query}
          side={side}
          onQuery={(value) => {
            setQuery(value);
            table.setPage(1);
          }}
          onSide={(value) => {
            setSide(value);
            table.setPage(1);
          }}
          onClear={() => {
            setQuery("");
            setSide("");
            table.setPage(1);
          }}
        />
      ) : null}
      <TableCard
        className=""
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
                label="Contract"
                active={table.sortKey === "contract"}
                dir={table.sortDir}
                onSort={() => table.onSort("contract")}
              />
              <SortTh
                label="Side"
                active={table.sortKey === "side"}
                dir={table.sortDir}
                onSort={() => table.onSort("side")}
              />
              <SortTh
                label="Value"
                active={table.sortKey === "value"}
                dir={table.sortDir}
                onSort={() => table.onSort("value")}
              />
              <SortTh
                label="Closed"
                active={table.sortKey === "closed"}
                dir={table.sortDir}
                onSort={() => table.onSort("closed")}
              />
              <SortTh
                label="Days held"
                active={table.sortKey === "days"}
                dir={table.sortDir}
                onSort={() => table.onSort("days")}
              />
              <SortTh
                label="Entry"
                active={table.sortKey === "entry"}
                dir={table.sortDir}
                onSort={() => table.onSort("entry")}
              />
              <SortTh
                label="Exit"
                active={table.sortKey === "exit"}
                dir={table.sortDir}
                onSort={() => table.onSort("exit")}
              />
              <SortTh
                label="Realized"
                active={table.sortKey === "realized"}
                dir={table.sortDir}
                onSort={() => table.onSort("realized")}
              />
              <SortTh
                label="P&L %"
                active={table.sortKey === "pnl"}
                dir={table.sortDir}
                onSort={() => table.onSort("pnl")}
              />
              <SortTh
                label="ROE"
                active={table.sortKey === "roe"}
                dir={table.sortDir}
                onSort={() => table.onSort("roe")}
              />
            </tr>
          </thead>
          <tbody>
            {table.pageRows.length === 0 ? (
              <EmptyRow
                colSpan={CLOSED_COL_SPAN}
                message={
                  cycles.length === 0
                    ? "No closed positions on this run."
                    : "No positions match."
                }
              />
            ) : (
              table.pageRows.map((cycle) => (
                <ClosedBacktestRows
                  key={cycle.id}
                  run={run}
                  cycle={cycle}
                  recipeName={recipeName}
                  selected={focusCycleId === cycle.id}
                  onSelect={
                    onSelectCycle ? () => onSelectCycle(cycle.id) : undefined
                  }
                />
              ))
            )}
          </tbody>
        </table>
      </TableCard>
    </section>
  );
}

function OpenBacktestRows({
  run,
  cycle,
  dca,
  maxClips,
  recipeName,
  colSpan,
  mark,
  selected,
  onSelect,
}: {
  run: BacktestRun;
  cycle: BacktestPositionCycle;
  dca: boolean;
  maxClips: number | null;
  recipeName: string;
  colSpan: number;
  mark: number | null;
  selected: boolean;
  onSelect?: () => void;
}) {
  const planned = plannedExitsForBacktestCycle(run.recipe, cycle);
  const unrealized = backtestCycleUnrealizedUsdt(cycle, mark);
  const pnlPct =
    unrealized != null && cycle.notionalUsdt > 0
      ? unrealized / cycle.notionalUsdt
      : null;
  const baseCoin = baseCoinFromSymbol(run.symbol);
  return (
    <ExpandableTradeRows
      colSpan={colSpan}
      selected={selected}
      onSelect={onSelect}
      details={<BacktestCycleDetails cycle={cycle} recipeName={recipeName} />}
    >
      <td className="min-w-0 px-3 py-3">
        <span className="flex items-start gap-2">
          <TokenIcon symbol={baseCoin} />
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-medium">
              <span>{baseCoin}</span>
              {selected ? (
                <span className="rounded-control bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-accent">
                  On chart
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block truncate text-hint text-ink-faint">
              {run.symbol}
            </span>
          </span>
        </span>
      </td>
      <td
        className={`min-w-0 px-3 py-3 capitalize ${
          cycle.side === "short" ? "text-danger" : "text-success"
        }`}
      >
        {cycle.side}
      </td>
      {dca ? (
        <td className="min-w-0 px-3 py-3 tabular-nums whitespace-nowrap">
          {backtestCycleOrdersLabel(cycle, maxClips)}
        </td>
      ) : null}
      <td className="min-w-0 px-3 py-3 tabular-nums whitespace-nowrap">
        <span title={formatQtyFull(cycle.qty)}>{formatQty(cycle.qty)}</span>
      </td>
      <td className="min-w-0 px-2 py-3 tabular-nums whitespace-nowrap text-ink-muted">
        {formatUsd(cycle.notionalUsdt)}
      </td>
      <td className="min-w-0 px-2 py-3 tabular-nums whitespace-nowrap">
        {formatPrice(cycle.entryPrice)}
      </td>
      <td className="min-w-0 px-2 py-3 tabular-nums whitespace-nowrap">
        {formatPrice(mark)}
      </td>
      <td
        className={`min-w-0 px-2 py-3 tabular-nums whitespace-nowrap ${signedTone(unrealized)}`}
      >
        {unrealized == null ? "—" : formatSignedUsd(unrealized)}
      </td>
      <td
        className={`min-w-0 px-3 py-3 tabular-nums whitespace-nowrap ${signedTone(pnlPct)}`}
      >
        {formatPct(pnlPct)}
      </td>
      <td className="min-w-0 px-3 py-3 tabular-nums whitespace-nowrap text-ink-muted">
        {formatLeverage(run.leverage)}
      </td>
      <td className="min-w-0 px-2 py-3 tabular-nums whitespace-nowrap text-ink-muted">
        —
      </td>
      <td className="min-w-0 px-3 py-3">
        {planned.takeProfit != null || planned.stopLoss != null ? (
          <TpslPair
            takeProfit={planned.takeProfit}
            stopLoss={planned.stopLoss}
            tpOrderType={
              run.recipe.kind === "dca"
                ? run.recipe.takeProfitOrderType
                : "market"
            }
            slOrderType="market"
            tpTone="planned"
            slTone="planned"
          />
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </td>
      <td className="min-w-0 px-3 py-3">
        {planned.trailingStop != null ? (
          <span className="tabular-nums text-ink-faint">
            {formatPrice(planned.trailingStop)}
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </td>
    </ExpandableTradeRows>
  );
}

function ClosedBacktestRows({
  run,
  cycle,
  recipeName,
  selected,
  onSelect,
}: {
  run: BacktestRun;
  cycle: BacktestPositionCycle;
  recipeName: string;
  selected: boolean;
  onSelect?: () => void;
}) {
  const pnlPct =
    cycle.notionalUsdt > 0 ? cycle.realizedUsdt / cycle.notionalUsdt : null;
  const roe = roePct(
    cycle.realizedUsdt,
    positionMarginUsdt(cycle.notionalUsdt, run.leverage),
  );
  const held = futuresDaysHeld(cycle.openedAtMs, cycle.closedAtMs);
  const baseCoin = baseCoinFromSymbol(run.symbol);
  return (
    <ExpandableTradeRows
      colSpan={CLOSED_COL_SPAN}
      selected={selected}
      onSelect={onSelect}
      details={<BacktestCycleDetails cycle={cycle} recipeName={recipeName} />}
    >
      <td className="min-w-0 px-4 py-3">
        <span className="flex items-start gap-4">
          <TokenIcon symbol={baseCoin} />
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-medium">
              <span>{baseCoin}</span>
              {selected ? (
                <span className="rounded-control bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-accent">
                  On chart
                </span>
              ) : null}
              {cycle.exitReason === "liquidation" ? (
                <span className="rounded-control bg-danger/15 px-1.5 py-0.5 text-[11px] font-medium text-danger">
                  Liq
                </span>
              ) : null}
            </span>
            <span
              className="mt-0.5 block text-hint text-ink-faint"
              title={cycle.qty ? formatQtyFull(cycle.qty) : undefined}
            >
              {run.symbol}
              {cycle.qty ? ` · ${formatQty(cycle.qty)}` : ""}
            </span>
          </span>
        </span>
      </td>
      <td
        className={`px-4 py-3 capitalize ${
          cycle.side === "short" ? "text-danger" : "text-success"
        }`}
      >
        {cycle.side}
      </td>
      <td className="px-4 py-3 tabular-nums text-ink-muted">
        {formatUsd(cycle.notionalUsdt)}
      </td>
      <td className="px-4 py-3 text-ink-muted">
        {cycle.closedAtMs ? (
          <LocalTime at={cycle.closedAtMs} mode="date" />
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3 tabular-nums text-ink-muted">
        {held === null ? "—" : held.toFixed(1)}
      </td>
      <td className="px-4 py-3 tabular-nums">{formatPrice(cycle.entryPrice)}</td>
      <td className="px-4 py-3 tabular-nums">
        {cycle.exitPrice == null ? "—" : formatPrice(cycle.exitPrice)}
      </td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(cycle.realizedUsdt)}`}>
        {formatSignedUsd(cycle.realizedUsdt)}
      </td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(pnlPct)}`}>
        {formatPct(pnlPct)}
      </td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(roe)}`}>
        {formatPct(roe)}
      </td>
    </ExpandableTradeRows>
  );
}

function BacktestCycleDetails({
  cycle,
  recipeName,
}: {
  cycle: BacktestPositionCycle;
  recipeName: string;
}) {
  return (
    <TradeDetailTabs
      orders={<BacktestOrderCards orders={cycle.orders} recipeName={recipeName} />}
      logs={<BacktestLogList cycle={cycle} />}
    />
  );
}

function BacktestOrderCards({
  orders,
  recipeName,
}: {
  orders: SimulatedOrder[];
  recipeName: string;
}) {
  if (orders.length === 0) {
    return <p className="text-sm text-ink-muted">No orders recorded.</p>;
  }
  return (
    <div
      className="panel-scroll space-y-2"
      tabIndex={0}
      role="region"
      aria-label="Orders"
    >
      {orders.map((order, index) => (
        <article
          key={`${order.atMs}-${order.action}-${index}`}
          className="rounded-card border border-line bg-surface-raised px-3 py-2.5"
        >
          <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h3 className="text-sm font-semibold tracking-tight">
              {orderCardTitle(order)}
            </h3>
            <p className="text-xs text-ink-muted">
              <LocalTime at={order.atMs} />
            </p>
          </header>
          <p className="mt-0.5 text-xs text-ink-muted">
            Auto · {recipeName}
          </p>
          <div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <OrderMetric
              label="Qty"
              value={formatQty(order.qty)}
              title={formatQtyFull(order.qty)}
            />
            <OrderMetric label="Price" value={formatPrice(order.price)} />
            <OrderMetric
              label="Value"
              value={
                order.qty > 0 && order.price > 0
                  ? formatUsd(order.qty * order.price)
                  : "—"
              }
            />
            <OrderMetric label="Venue" value="Backtest" />
          </div>
        </article>
      ))}
    </div>
  );
}

function BacktestLogList({ cycle }: { cycle: BacktestPositionCycle }) {
  const logs = backtestCycleLogLines(cycle);
  if (logs.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No events recorded for this position yet.
      </p>
    );
  }
  return (
    <div
      className="panel-scroll space-y-2"
      tabIndex={0}
      role="region"
      aria-label="Position logs"
    >
      {logs.map((log, index) => (
        <article
          key={`${log.atMs}-${index}`}
          className="min-w-0 overflow-hidden rounded-card border border-line bg-surface-raised p-4"
        >
          <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h3 className="min-w-0 text-sm font-semibold tracking-tight">
              {log.message}
            </h3>
            <p className="shrink-0 text-xs text-ink-muted">
              <LocalTime at={log.atMs} />
            </p>
          </header>
        </article>
      ))}
    </div>
  );
}

function orderCardTitle(order: SimulatedOrder): string {
  if (order.action === "flatten") {
    return order.reason === "liquidation" ? "Liquidation" : "Close";
  }
  return order.action === "sell" ? "Sell" : "Buy";
}

function baseCoinFromSymbol(symbol: string): string {
  return symbol.replace(/USDT$|USDC$/i, "") || symbol;
}

function OrderMetric({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
      <span className="shrink-0 text-ink-muted">{label}</span>
      <span
        className="min-w-0 truncate tabular-nums text-ink"
        title={title ?? value}
      >
        {value}
      </span>
    </div>
  );
}

function CycleFilters({
  query,
  side,
  onQuery,
  onSide,
  onClear,
}: {
  query: string;
  side: CycleSideFilter;
  onQuery: (value: string) => void;
  onSide: (value: CycleSideFilter) => void;
  onClear: () => void;
}) {
  return (
    <TableFilterSession>
        <TableFilterBar className="mb-4">
          <TableFilterField label="Search">
            <input
              type="search"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Contract or side"
              autoComplete="off"
              className={TABLE_FILTER_FIELD_CLASS}
            />
          </TableFilterField>
          <TableFilterField label="Side">
            <AppSelect
              value={side}
              onChange={(event) => onSide(event.target.value as CycleSideFilter)}
              className={TABLE_FILTER_FIELD_CLASS}
            >
              <option value="">All</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </AppSelect>
          </TableFilterField>
          <TableLabelButton
            variant="filter"
            icon={<IconFilterClear {...TABLE_BTN_ICON} />}
            onClick={onClear}
          >
            Clear
          </TableLabelButton>
        </TableFilterBar>
    </TableFilterSession>
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
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {subtitle ? <p className="text-sm text-ink-muted">{subtitle}</p> : null}
    </div>
  );
}
