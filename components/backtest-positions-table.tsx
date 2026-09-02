"use client";

import type { ReactNode } from "react";
import { ColumnHint } from "@/components/column-hint";
import { FuturesSourceCell } from "@/components/futures-source";
import { TpslPair } from "@/components/futures-tpsl";
import { LocalTime } from "@/components/local-time";
import { TokenIcon } from "@/components/token-icon";
import { ExpandableTradeRows, TradeDetailTabs } from "@/components/trade-expand";
import type { BacktestRun, SimulatedOrder } from "@/lib/backtest/model";
import {
  backtestCycleLogLines,
  backtestCycleOrdersLabel,
  backtestOpenMarkPrice,
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

const OPEN_COL_SPAN_DCA = 15;
const OPEN_COL_SPAN = 14;
const CLOSED_COL_SPAN = 10;

export function BacktestPositionsTable({ run }: { run: BacktestRun }) {
  const grouped = groupBacktestOrdersIntoCycles(run.orders);
  const dca = run.recipe.kind === "dca" || run.deskType === "dca";
  const maxClips = run.recipe.kind === "dca" ? run.recipe.maxClips : null;
  const recipeName = run.recipe.name.trim() || "Backtest";
  const mark =
    grouped.open.length === 1 && run.stats
      ? backtestOpenMarkPrice({
          side: grouped.open[0]!.side,
          entryPrice: grouped.open[0]!.entryPrice,
          qty: grouped.open[0]!.qty,
          unrealizedUsdt: run.stats.markUsdt,
        })
      : null;
  const unrealized =
    grouped.open.length === 1 && run.stats ? run.stats.markUsdt : null;

  return (
    <div className="space-y-8">
      <OpenBacktestPositions
        run={run}
        cycles={grouped.open}
        dca={dca}
        maxClips={maxClips}
        recipeName={recipeName}
        mark={mark}
        unrealized={unrealized}
      />
      <ClosedBacktestPositions
        run={run}
        cycles={grouped.closed}
        recipeName={recipeName}
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
  unrealized,
}: {
  run: BacktestRun;
  cycles: BacktestPositionCycle[];
  dca: boolean;
  maxClips: number | null;
  recipeName: string;
  mark: number | null;
  unrealized: number | null;
}) {
  const colSpan = dca ? OPEN_COL_SPAN_DCA : OPEN_COL_SPAN;
  return (
    <section>
      <SectionHead
        title="Open Positions"
        subtitle="Still open at the end of the replay. Expand for fills and synthesized logs."
      />
      <div className="min-w-0 overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint [&_th]:whitespace-nowrap">
            <tr>
              <th className="w-10 px-2 py-3 font-medium">
                <ColumnHint
                  label={<span className="sr-only">Details</span>}
                  hint="Expand for orders and the event log for this position."
                />
              </th>
              <th className="px-3 py-3 font-medium">
                <ColumnHint label="Contract" hint="USDT linear perpetual." />
              </th>
              <th className="px-3 py-3 font-medium">
                <ColumnHint
                  label="Source"
                  hint="Backtest fills are Auto. The name is the recipe on this run."
                />
              </th>
              <th className="px-3 py-3 font-medium">
                <ColumnHint
                  label="Side"
                  hint="Long or short. Both can be open on the same contract."
                />
              </th>
              {dca ? (
                <th className="px-3 py-3 font-medium">
                  <ColumnHint
                    label="Orders"
                    hint="Bot orders filled versus the max. Resting limits are not filled yet."
                  />
                </th>
              ) : null}
              <th className="px-3 py-3 font-medium">
                <ColumnHint label="Qty" hint="Base-coin size on this row." />
              </th>
              <th className="px-2 py-3 font-medium">
                <ColumnHint
                  label="Value"
                  hint="Qty × entry. P&L scales with this amount."
                />
              </th>
              <th className="px-2 py-3 font-medium">
                <ColumnHint
                  label="Entry"
                  hint="Size-weighted average fill price."
                />
              </th>
              <th className="px-2 py-3 font-medium">
                <ColumnHint
                  label="Mark"
                  hint="Last close on the replay tape."
                />
              </th>
              <th className="px-2 py-3 font-medium">
                <ColumnHint
                  label="Unrealized"
                  hint="Mark-to-market versus entry at the last bar."
                />
              </th>
              <th className="px-3 py-3 font-medium">
                <ColumnHint
                  label="P&L %"
                  hint="Unrealized ÷ value. Not annualized."
                />
              </th>
              <th className="px-3 py-3 font-medium">
                <ColumnHint
                  label="Leverage"
                  hint="Leverage used for this run’s margin book."
                />
              </th>
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
            {cycles.length === 0 ? (
              <EmptyRow
                colSpan={colSpan}
                message="No open position at the end of this run."
              />
            ) : (
              cycles.map((cycle) => (
                <OpenBacktestRows
                  key={cycle.id}
                  run={run}
                  cycle={cycle}
                  dca={dca}
                  maxClips={maxClips}
                  recipeName={recipeName}
                  colSpan={colSpan}
                  mark={mark}
                  unrealized={unrealized}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ClosedBacktestPositions({
  run,
  cycles,
  recipeName,
}: {
  run: BacktestRun;
  cycles: BacktestPositionCycle[];
  recipeName: string;
}) {
  return (
    <section>
      <SectionHead
        title="Past Positions"
        subtitle="Closed futures. Realized is mark-to-market at close."
      />
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Details"
                  hint="Expand for orders and the event log for this position."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Contract"
                  hint="USDT linear perpetual that was closed."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Source"
                  hint="Backtest fills are Auto. The name is the recipe on this run."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Closed"
                  hint="Local date this row was closed. Hover for UTC."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Days held"
                  hint="(closed time − opened time) in days."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Entry"
                  hint="Size-weighted average fill price of the open orders."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Exit"
                  hint="Close fill price on the replay tape."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Realized"
                  hint="P&L from entry to close fill, minus fees on the flatten."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="P&L %"
                  hint="Realized ÷ position value (qty × entry)."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="ROE"
                  hint="Realized ÷ initial margin (position value ÷ leverage)."
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {cycles.length === 0 ? (
              <EmptyRow
                colSpan={CLOSED_COL_SPAN}
                message="No closed positions on this run."
              />
            ) : (
              cycles.map((cycle) => (
                <ClosedBacktestRows
                  key={cycle.id}
                  run={run}
                  cycle={cycle}
                  recipeName={recipeName}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
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
  unrealized,
}: {
  run: BacktestRun;
  cycle: BacktestPositionCycle;
  dca: boolean;
  maxClips: number | null;
  recipeName: string;
  colSpan: number;
  mark: number | null;
  unrealized: number | null;
}) {
  const planned = plannedExitsForBacktestCycle(run.recipe, cycle);
  const pnlPct =
    unrealized != null && cycle.notionalUsdt > 0
      ? unrealized / cycle.notionalUsdt
      : null;
  const baseCoin = baseCoinFromSymbol(run.symbol);
  return (
    <ExpandableTradeRows
      colSpan={colSpan}
      details={<BacktestCycleDetails cycle={cycle} recipeName={recipeName} />}
    >
      <td className="min-w-0 px-3 py-3">
        <span className="flex items-start gap-2">
          <TokenIcon symbol={baseCoin} />
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-medium">
              <span>{baseCoin}</span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-ink-faint">
              {run.symbol}
            </span>
          </span>
        </span>
      </td>
      <td className="min-w-0 px-3 py-3">
        <FuturesSourceCell source="engine" ruleName={recipeName} />
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
}: {
  run: BacktestRun;
  cycle: BacktestPositionCycle;
  recipeName: string;
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
      details={<BacktestCycleDetails cycle={cycle} recipeName={recipeName} />}
    >
      <td className="min-w-0 px-4 py-3">
        <span className="flex items-start gap-4">
          <TokenIcon symbol={baseCoin} />
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-medium">
              <span>{baseCoin}</span>
            </span>
            <span
              className="mt-0.5 block text-xs text-ink-faint"
              title={cycle.qty ? formatQtyFull(cycle.qty) : undefined}
            >
              {run.symbol}
              {cycle.qty ? ` · ${formatQty(cycle.qty)}` : ""}
            </span>
          </span>
        </span>
      </td>
      <td className="px-4 py-3">
        <FuturesSourceCell source="engine" ruleName={recipeName} />
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
    return "Close";
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
