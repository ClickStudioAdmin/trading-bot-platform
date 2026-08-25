"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ColumnHint } from "@/components/column-hint";
import { LocalTime } from "@/components/local-time";
import { PositionLogList } from "@/components/paper-carry-expand";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { TokenIcon } from "@/components/token-icon";
import { ExpandableTradeRows, TradeDetailTabs } from "@/components/trade-expand";
import { submitFuturesTrade } from "@/lib/futures/actions";
import type { FuturesDeskPosition } from "@/lib/futures/list";
import type { MarkedFutures } from "@/lib/futures/mark";
import type { FuturesOrder } from "@/lib/futures/model";
import {
  flattenExitPrice,
  futuresClosedStats,
  futuresDaysHeld,
  futuresOpenExposure,
} from "@/lib/futures/stats";
import {
  formatPct,
  formatPrice,
  formatSignedUsd,
  formatUsd,
  signedTone,
} from "@/lib/opportunities/format";
import { FUTURES_PATHS } from "@/lib/strategies/registry";

const ACTION_CLASS =
  "rounded-control bg-accent-strong px-2.5 py-1 text-xs font-medium whitespace-nowrap text-ink";
const EXPOSURE_BARS = ["bg-accent", "bg-success", "bg-warning"] as const;

export function FuturesOpenStats({
  signedIn,
  open,
}: {
  signedIn: boolean;
  open: MarkedFutures[];
}) {
  const notional = open.reduce((sum, row) => sum + row.notionalUsdt, 0);
  const unrealized = open.every((row) => row.unrealizedUsdt === null)
    ? null
    : open.reduce((sum, row) => sum + (row.unrealizedUsdt ?? 0), 0);
  const exposure = futuresOpenExposure(open);

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        label="Open notional"
        value={signedIn && notional > 0 ? formatUsd(notional) : "—"}
      />
      <StatCard
        label="Unrealized P&L"
        value={
          signedIn && unrealized !== null ? formatSignedUsd(unrealized) : "—"
        }
        toneClass={signedTone(signedIn ? unrealized : null)}
      />
      <div className="rounded-card border border-line bg-surface p-5">
        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
          Open exposure
        </p>
        {signedIn && exposure.length > 0 ? (
          <>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface-raised">
              {exposure.map((slice, index) => (
                <span
                  key={slice.baseCoin}
                  className={EXPOSURE_BARS[index % EXPOSURE_BARS.length]}
                  style={{ width: `${slice.share * 100}%` }}
                />
              ))}
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {exposure.map((slice) => (
                <li
                  key={slice.baseCoin}
                  className="flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <TokenIcon symbol={slice.baseCoin} />
                    {slice.baseCoin}
                  </span>
                  <span className="tabular-nums text-ink-muted">
                    {formatUsd(slice.notionalUsdt)} ·{" "}
                    {(slice.share * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">
            {signedIn ? "No open exposure." : "Sign in to see exposure."}
          </p>
        )}
      </div>
    </section>
  );
}

export function OpenFuturesTrades({
  signedIn,
  open,
  next = FUTURES_PATHS.positions,
  showHeading = true,
  exchangeBook = false,
  emptyMessage,
}: {
  signedIn: boolean;
  open: MarkedFutures[];
  next?: string;
  showHeading?: boolean;
  exchangeBook?: boolean;
  emptyMessage?: ReactNode;
}) {
  return (
    <section>
      {showHeading ? (
        <div className="mb-3 flex items-end justify-between gap-3">
          <SectionHead
            title="Current Positions"
            subtitle={
              exchangeBook
                ? "Open USDT perpetuals on the bound exchange. Close that side on Bybit."
                : "Open paper futures. Close writes the ledger only — no Bybit order."
            }
            className=""
          />
          <Link
            href={FUTURES_PATHS.positions}
            className="shrink-0 text-sm text-accent hover:text-accent-strong"
          >
            All positions
          </Link>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[60rem] text-left text-sm">
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
                  hint="USDT linear perpetual. Badge is Manual until alert automations ship."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint label="Side" hint="Long or short. Both can be open on the same contract." />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint label="Qty" hint="Base-coin size on this row." />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Notional"
                  hint="Qty × entry. P&L scales with this amount."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Entry"
                  hint="Size-weighted average fill price."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint label="Mark" hint="Last price from the live Bybit ticker." />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Unrealized"
                  hint="Mark-to-market versus entry. Not Bybit’s invoice."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="P&L %"
                  hint="Unrealized ÷ notional. Not annualized."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Actions"
                  hint={
                    exchangeBook
                      ? "Close this row at market on Bybit. A long and a short on the same contract are separate rows."
                      : "Close this row. A long and a short on the same contract are separate rows."
                  }
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {!signedIn ? (
              <EmptyRow
                colSpan={10}
                message={
                  <>
                    <Link href="/sign-in" className="text-accent">
                      Sign in
                    </Link>{" "}
                    to open futures and see them here.
                  </>
                }
              />
            ) : open.length === 0 ? (
              <EmptyRow
                colSpan={10}
                message={
                  emptyMessage ?? "No open futures. Place an order above."
                }
              />
            ) : (
              open.map((trade) => (
                <OpenFuturesRows key={trade.id} trade={trade} next={next} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ClosedFuturesTrades({
  signedIn,
  closed,
}: {
  signedIn: boolean;
  closed: FuturesDeskPosition[];
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
                <ColumnHint label="Contract" hint="USDT linear perpetual that was closed." />
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
                  hint="Size-weighted average fill price of the open clips."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Exit"
                  hint="Close fill price. Paper uses mark at close."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Realized"
                  hint="P&L from entry to close mark or fill."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="P&L %"
                  hint="Realized ÷ notional. Same figure as Realized."
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {!signedIn ? (
              <EmptyRow
                colSpan={8}
                message={
                  <>
                    <Link href="/sign-in" className="text-accent">
                      Sign in
                    </Link>{" "}
                    to see closed futures.
                  </>
                }
              />
            ) : closed.length === 0 ? (
              <EmptyRow colSpan={8} message="No closed futures yet." />
            ) : (
              closed.map((trade) => (
                <ClosedFuturesRows key={trade.id} trade={trade} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function FuturesPerformanceStats({
  signedIn,
  closed,
}: {
  signedIn: boolean;
  closed: FuturesDeskPosition[];
}) {
  const stats = futuresClosedStats(closed);
  const winRate =
    stats.closedCount === 0
      ? "—"
      : `${Math.round((stats.greenCount / stats.closedCount) * 100)}%`;

  return (
    <section>
      <SectionHead
        title="Strategy statistics"
        subtitle={
          signedIn ? undefined : "Sign in to see this book’s realized numbers."
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Realized P&L"
          value={
            signedIn
              ? stats.realizedPct === null
                ? formatSignedUsd(stats.realizedUsdt)
                : `${formatSignedUsd(stats.realizedUsdt)} (${formatPct(stats.realizedPct)})`
              : "—"
          }
          toneClass={signedTone(signedIn ? stats.realizedUsdt : null)}
        />
        <div className="grid grid-cols-2 gap-6 rounded-card border border-line bg-surface p-5">
          <StatBlock
            label="Completed Trades"
            value={signedIn ? String(stats.closedCount) : "—"}
          />
          <StatBlock
            label="Win Rate"
            value={signedIn ? winRate : "—"}
          />
        </div>
      </div>
    </section>
  );
}

function OpenFuturesRows({
  trade,
  next,
}: {
  trade: MarkedFutures;
  next: string;
}) {
  const pnlPct =
    trade.unrealizedUsdt === null
      ? null
      : trade.notionalUsdt > 0
        ? trade.unrealizedUsdt / trade.notionalUsdt
        : null;

  return (
    <ExpandableTradeRows
      colSpan={10}
      details={
        <TradeDetailTabs
          orders={<FuturesOrderList orders={trade.orders} />}
          logs={<PositionLogList logs={trade.logs} />}
        />
      }
    >
      <td className="min-w-0 px-4 py-3">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          <TokenIcon symbol={trade.baseCoin} />
          {trade.baseCoin}
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-normal text-accent">
            Manual
          </span>
        </span>
        <span className="mt-0.5 block pl-7 text-xs text-ink-faint">
          {trade.symbol}
        </span>
      </td>
      <td className="px-4 py-3 capitalize text-ink-muted">{trade.side}</td>
      <td className="px-4 py-3 tabular-nums">{trade.qty}</td>
      <td className="px-4 py-3 tabular-nums text-ink-muted">
        {formatUsd(trade.notionalUsdt)}
      </td>
      <td className="px-4 py-3 tabular-nums">{formatPrice(trade.entryPrice)}</td>
      <td className="px-4 py-3 tabular-nums">{formatPrice(trade.mark)}</td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(trade.unrealizedUsdt)}`}>
        {trade.unrealizedUsdt === null
          ? "—"
          : formatSignedUsd(trade.unrealizedUsdt)}
      </td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(pnlPct)}`}>
        {formatPct(pnlPct)}
      </td>
      <td className="px-4 py-3">
        <form action={submitFuturesTrade}>
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="symbol" value={trade.symbol} />
          <input type="hidden" name="positionId" value={trade.id} />
          <ColumnHint
            hint="Close at market"
            label={
              <PendingSubmitButton
                pendingLabel="Closing"
                successKey={`flatten-${trade.id}`}
                name="action"
                value="close"
                className={ACTION_CLASS}
              >
                Close
              </PendingSubmitButton>
            }
          />
        </form>
      </td>
    </ExpandableTradeRows>
  );
}

function ClosedFuturesRows({
  trade,
}: {
  trade: FuturesDeskPosition;
}) {
  const pnlPct =
    trade.notionalUsdt > 0 ? trade.realizedUsdt / trade.notionalUsdt : null;
  const held = futuresDaysHeld(trade.openedAtMs, trade.closedAtMs);
  const exit = flattenExitPrice(trade.orders);
  const baseCoin = trade.symbol.replace(/USDT$/, "");

  return (
    <ExpandableTradeRows
      colSpan={8}
      details={
        <TradeDetailTabs
          orders={<FuturesOrderList orders={trade.orders} />}
          logs={<PositionLogList logs={trade.logs} />}
        />
      }
    >
      <td className="min-w-0 px-4 py-3">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          <TokenIcon symbol={baseCoin} />
          {baseCoin}
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-normal text-accent">
            Manual
          </span>
        </span>
        <span className="mt-0.5 block pl-7 text-xs text-ink-faint">
          {trade.symbol}
          {trade.qty ? ` · ${trade.qty}` : ""}
        </span>
      </td>
      <td className="px-4 py-3 text-ink-muted">
        {trade.closedAtMs ? (
          <LocalTime at={trade.closedAtMs} mode="date" />
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3 tabular-nums text-ink-muted">
        {held === null ? "—" : held.toFixed(1)}
      </td>
      <td className="px-4 py-3 tabular-nums">{formatPrice(trade.entryPrice)}</td>
      <td className="px-4 py-3 tabular-nums">
        {exit === null ? "—" : formatPrice(exit)}
      </td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(trade.realizedUsdt)}`}>
        {formatSignedUsd(trade.realizedUsdt)}
      </td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(pnlPct)}`}>
        {formatPct(pnlPct)}
      </td>
    </ExpandableTradeRows>
  );
}

function FuturesOrderList({ orders }: { orders: FuturesOrder[] }) {
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
      {orders.map((order) => (
        <article
          key={order.id}
          className="rounded-card border border-line bg-surface-raised p-4"
        >
          <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h3 className="text-sm font-semibold tracking-tight">
              {order.action === "flatten"
                ? "Close"
                : order.action === "sell"
                  ? "Sell"
                  : "Buy"}
            </h3>
            <p className="text-xs text-ink-muted">
              <LocalTime at={order.filledAtMs} />
            </p>
          </header>
          <p className="mt-0.5 text-sm text-ink-muted">
            {order.qty}
            {order.price ? ` @ ${formatPrice(order.price)}` : ""}
            {order.notionalUsdt
              ? ` · ${formatUsd(order.notionalUsdt)}`
              : ""}
          </p>
          {order.venueOrderId ? (
            <p className="mt-0.5 text-xs text-ink-faint">
              Venue {order.venueOrderId}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-ink-faint">Paper fill</p>
          )}
        </article>
      ))}
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
  className = "mb-3",
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {subtitle ? <p className="text-sm text-ink-muted">{subtitle}</p> : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  toneClass,
}: {
  label: string;
  value: string;
  toneClass?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <StatBlock label={label} value={value} toneClass={toneClass} />
    </div>
  );
}

function StatBlock({
  label,
  value,
  toneClass,
}: {
  label: string;
  value: string;
  toneClass?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <p
        className={`mt-3 text-2xl font-semibold tracking-tight ${toneClass ?? "text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}
