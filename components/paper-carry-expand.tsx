"use client";

import { useId, useState, type ReactNode } from "react";
import { ColumnHint } from "@/components/column-hint";
import { PaperAutomationTrigger } from "@/components/paper-automation-trigger";
import { TokenIcon } from "@/components/token-icon";
import {
  closedTradeLabel,
  formatExitOrderType,
} from "@/lib/paper/automation";
import {
  formatPct,
  formatPrice,
  formatSignedUsd,
  formatUsd,
  signedTone,
} from "@/lib/opportunities/format";
import { closeOpenPaperCarry } from "@/lib/paper/actions";
import { carryPnlPct, clipPnl } from "@/lib/paper/math";
import {
  fillSlip,
  formatCloseOrderWhy,
  formatOrderConditions,
  formatOrderHeadline,
  formatOrderWhy,
  type PaperOrderRow,
} from "@/lib/paper/orders";
import type { PaperReturnPath } from "@/lib/paper/open";
import {
  formatDeskDate,
  formatDeskDateTime,
  type MarkedPaperCarry,
  type PaperCarryRow,
} from "@/lib/paper/rows";

type OpenCarryView = MarkedPaperCarry & { orders: PaperOrderRow[] };
type ClosedCarryView = PaperCarryRow & { orders: PaperOrderRow[] };

export function OpenPaperCarryRows({
  trade,
  next,
}: {
  trade: OpenCarryView;
  next: PaperReturnPath;
}) {
  const pnlPct =
    trade.unrealizedUsdt === null
      ? null
      : carryPnlPct(trade.unrealizedUsdt, trade.notionalUsdt);

  return (
    <ExpandableOrderRows
      colSpan={9}
      orders={trade.orders}
      entryBasis={trade.entryBasis}
    >
      <td className="px-4 py-3">
        <span className="flex items-center gap-2 font-medium">
          <TokenIcon symbol={trade.baseCoin} />
          {trade.baseCoin}
          <PositionKind source={trade.source} />
          {trade.ruleName ? (
            <PaperAutomationTrigger
              carryId={trade.id}
              automation={trade.automation}
              label={trade.ruleName}
              canEdit
              entrySource="engine"
              next={next}
              className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-normal text-accent hover:text-accent-strong"
            />
          ) : null}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1 pl-7 text-xs text-ink-faint">
          Long spot · short {trade.futureSymbol}
        </span>
      </td>
      <td className="px-4 py-3 tabular-nums text-ink-muted">
        {trade.daysToExpiry === null ? "—" : trade.daysToExpiry.toFixed(1)}
      </td>
      <td className="px-4 py-3 tabular-nums text-ink-muted">
        {formatUsd(trade.notionalUsdt)}
      </td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(trade.entryBasis)}`}>
        {formatPct(trade.entryBasis)}
      </td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(trade.markBasis)}`}>
        {formatPct(trade.markBasis)}
      </td>
      <td
        className={`px-4 py-3 tabular-nums ${signedTone(trade.unrealizedUsdt)}`}
      >
        {trade.unrealizedUsdt === null
          ? "—"
          : formatSignedUsd(trade.unrealizedUsdt)}
      </td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(pnlPct)}`}>
        {formatPct(pnlPct)}
      </td>
      <td className="px-4 py-3">
        <ClosePaperButton trade={trade} next={next} />
      </td>
    </ExpandableOrderRows>
  );
}

export function ClosedPaperCarryRows({ trade }: { trade: ClosedCarryView }) {
  const pnlPct =
    trade.realizedUsdt === null
      ? null
      : carryPnlPct(trade.realizedUsdt, trade.notionalUsdt);

  return (
    <ExpandableOrderRows
      colSpan={8}
      orders={trade.orders}
      entryBasis={trade.entryBasis}
    >
      <td className="px-4 py-3">
        <span className="flex items-center gap-2 font-medium">
          <TokenIcon symbol={trade.baseCoin} />
          {trade.baseCoin}
          <PositionKind source={trade.source} />
          {trade.ruleName ? (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-normal text-accent">
              {trade.ruleName}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1 pl-7 text-xs text-ink-faint">
          {trade.futureSymbol}
          {" · "}
          <PaperAutomationTrigger
            carryId={trade.id}
            automation={trade.automation}
            label={closedTradeLabel(trade.source, trade.closeSource)}
            canEdit={false}
            entrySource={trade.source}
            closeSource={trade.closeSource}
            closeReason={trade.closeReason}
          />
        </span>
      </td>
      <td className="px-4 py-3 text-ink-muted">
        {formatDeskDate(trade.closedAtMs)}
      </td>
      <td className="px-4 py-3 tabular-nums text-ink-muted">
        {trade.daysHeld === null ? "—" : trade.daysHeld.toFixed(1)}
      </td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(trade.entryBasis)}`}>
        {formatPct(trade.entryBasis)}
      </td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(trade.exitBasis)}`}>
        {formatPct(trade.exitBasis)}
      </td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(trade.realizedUsdt)}`}>
        {trade.realizedUsdt === null
          ? "—"
          : formatSignedUsd(trade.realizedUsdt)}
      </td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(pnlPct)}`}>
        {formatPct(pnlPct)}
      </td>
    </ExpandableOrderRows>
  );
}

function ExpandableOrderRows({
  orders,
  entryBasis,
  colSpan,
  children,
}: {
  orders: PaperOrderRow[];
  entryBasis: number;
  colSpan: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <>
      <tr className="border-b border-line last:border-b-0">
        <td className="px-4 py-3">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            aria-label={open ? "Hide order details" : "Show order details"}
            onClick={() => setOpen((current) => !current)}
          >
            <ChevronIcon className={open ? "rotate-90" : undefined} />
          </button>
        </td>
        {children}
      </tr>
      {open ? (
        <tr className="border-b border-line last:border-b-0">
          <td colSpan={colSpan} className="bg-canvas px-4 py-4" id={panelId}>
            <PaperOrderList orders={orders} entryBasis={entryBasis} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`h-4 w-4 ${className ?? ""}`}
    >
      <path
        d="M6 3.5 11 8l-5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClosePaperButton({
  trade,
  next,
}: {
  trade: MarkedPaperCarry;
  next: PaperReturnPath;
}) {
  if (trade.status === "closing") {
    return (
      <ColumnHint
        hint="Exit already submitted. Later ticks clip to usable book until the row is flat."
        label={
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning">
            Closing
          </span>
        }
      />
    );
  }

  if (trade.markBasis === null) {
    return (
      <span
        className="text-xs text-ink-faint"
        title="That pair is not in the live scan"
      >
        No mark
      </span>
    );
  }

  const actionClass =
    "rounded-control bg-accent-strong px-2.5 py-1 text-xs font-medium whitespace-nowrap text-ink";
  const auto = trade.source === "engine";
  const dynamicExit = trade.automation.exitSizeType === "dynamic";

  return (
    <div className="flex flex-nowrap items-center gap-2">
      <form action={closeOpenPaperCarry}>
        <input type="hidden" name="carryId" value={trade.id} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="mode" value={auto && dynamicExit ? "unwind" : "market"} />
        <ColumnHint
          hint={
            auto ? (
              <AutoCloseHint automation={trade.automation} />
            ) : (
              "Close at market"
            )
          }
          label={
            <button type="submit" className={actionClass}>
              Close
            </button>
          }
        />
      </form>
      {trade.source === "manual" ? (
        <form action={closeOpenPaperCarry}>
          <input type="hidden" name="carryId" value={trade.id} />
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="mode" value="unwind" />
          <ColumnHint
            hint="Unwind position over time & ASAP (based on the usable book setting)"
            label={
              <button type="submit" className={actionClass}>
                Unwind
              </button>
            }
          />
        </form>
      ) : null}
    </div>
  );
}

function AutoCloseHint({
  automation,
}: {
  automation: MarkedPaperCarry["automation"];
}) {
  const orderType = formatExitOrderType(automation);
  return (
    <span className="block space-y-1">
      <span className="block text-ink">
        Close using this set’s exit order type
      </span>
      {orderType ? (
        <span className="block">{orderType}</span>
      ) : (
        <span className="block">No exit order type stored.</span>
      )}
    </span>
  );
}

function PositionKind({
  source,
}: {
  source: MarkedPaperCarry["source"];
}) {
  return (
    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-normal text-accent">
      {source === "engine" ? "Auto" : "Manual"}
    </span>
  );
}

function PaperOrderList({
  orders,
  entryBasis,
}: {
  orders: PaperOrderRow[];
  entryBasis: number;
}) {
  if (orders.length === 0) {
    return <p className="text-sm text-ink-muted">No orders recorded.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.08em] text-ink-faint">
        Orders
      </p>
      {orders.map((order) => (
        <PaperOrderCard
          key={order.id}
          order={order}
          entryBasis={entryBasis}
        />
      ))}
      <p className="text-xs text-ink-faint">
        Paper fill equals the scan. No Bybit order.
      </p>
    </div>
  );
}

function PaperOrderCard({
  order,
  entryBasis,
}: {
  order: PaperOrderRow;
  entryBasis: number;
}) {
  if (order.side === "close") {
    return <CloseOrderCard order={order} entryBasis={entryBasis} />;
  }
  return <OpenOrderCard order={order} />;
}

function OpenOrderCard({ order }: { order: PaperOrderRow }) {
  const conditions = formatOrderConditions(order).filter(
    (line) => !line.startsWith("Order Type"),
  );
  const slip = fillSlip(order);

  return (
    <article className="rounded-card border border-line bg-surface-raised p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="text-sm font-semibold tracking-tight">
          {formatOrderHeadline(order)}
        </h3>
        <p className="text-xs text-ink-muted">
          {formatDeskDateTime(order.filledAtMs)}
          {" · "}
          {formatUsd(order.notionalUsdt)}
        </p>
      </header>
      <p className="mt-0.5 text-xs text-ink-muted">{formatOrderWhy(order)}</p>
      {conditions.length > 0 ? (
        <p className="mt-0.5 text-sm text-ink-muted">{conditions.join(" · ")}</p>
      ) : null}
      <ComparePairs
        leftTitle="Theoretical · scan"
        rightTitle="Execution · paper"
        rows={[
          {
            left: {
              label: "Net basis",
              value: formatPct(order.theoretical.netBasis),
              tone: order.theoretical.netBasis,
            },
            right: {
              label: "Fill basis",
              value: formatPct(order.fillBasis),
              tone: order.fillBasis,
            },
          },
          {
            right: { label: "Slip vs scan", value: formatPct(slip), tone: slip },
          },
          {
            left: {
              label: "Net APR",
              value: formatPct(order.theoretical.netApr),
              tone: order.theoretical.netApr,
            },
          },
          {
            left: {
              label: "DTE",
              value:
                order.theoretical.daysToExpiry === null
                  ? "—"
                  : order.theoretical.daysToExpiry.toFixed(1),
            },
          },
          {
            left: {
              label: "Executable",
              value: formatPct(order.theoretical.executableBasis),
              tone: order.theoretical.executableBasis,
            },
          },
          {
            left: {
              label: "Capacity",
              value:
                order.theoretical.capacityUsdt === null
                  ? "—"
                  : formatUsd(order.theoretical.capacityUsdt),
            },
            right: {
              label: "Notional",
              value: formatUsd(order.notionalUsdt),
            },
          },
          {
            left: {
              label: "Spot ask",
              value: formatPrice(order.theoretical.spotAsk),
            },
            right: {
              label: "Buy spot",
              value: formatPrice(order.theoretical.spotAsk),
            },
          },
          {
            left: {
              label: "Future bid",
              value: formatPrice(order.theoretical.futureBid),
            },
            right: {
              label: "Sell future",
              value: formatPrice(order.theoretical.futureBid),
            },
          },
          {
            left: {
              label: "Fees + slip",
              value: formatPct(order.theoretical.feeRate),
            },
          },
          {
            right: {
              label: "Filled",
              value: formatDeskDateTime(order.filledAtMs),
            },
          },
        ]}
      />
    </article>
  );
}

function CloseOrderCard({
  order,
  entryBasis,
}: {
  order: PaperOrderRow;
  entryBasis: number;
}) {
  const captured = entryBasis - order.fillBasis;
  const pnl = clipPnl({
    entryBasis,
    fillBasis: order.fillBasis,
    notionalUsdt: order.notionalUsdt,
    feeRate: order.theoretical.feeRate,
  });
  const rows: { label: string; value: string; tone?: number | null }[] = [
    {
      label: "Usable book",
      value:
        order.theoretical.capacityUsdt === null
          ? "—"
          : formatUsd(order.theoretical.capacityUsdt),
    },
    {
      label: "Clip amount",
      value: formatUsd(order.notionalUsdt),
    },
    {
      label: "DTE",
      value:
        order.theoretical.daysToExpiry === null
          ? "—"
          : order.theoretical.daysToExpiry.toFixed(1),
    },
    {
      label: "Basis captured",
      value: formatPct(captured),
      tone: captured,
    },
    {
      label: "Exit basis",
      value: formatPct(order.fillBasis),
      tone: order.fillBasis,
    },
    {
      label: "Clip P&L",
      value:
        pnl === null
          ? "—"
          : `${formatSignedUsd(pnl.usdt)} (${formatPct(pnl.pct)})`,
      tone: pnl?.usdt ?? null,
    },
  ];

  return (
    <article className="rounded-card border border-line bg-surface-raised px-3 py-2.5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="text-sm font-semibold tracking-tight">
          {formatOrderHeadline(order)}
        </h3>
        <p className="text-xs text-ink-muted">
          {formatDeskDateTime(order.filledAtMs)}
          {" · "}
          {formatUsd(order.notionalUsdt)}
        </p>
      </header>
      <p className="mt-0.5 text-xs text-ink-muted">{formatCloseOrderWhy(order)}</p>
      <ValueList rows={rows} />
    </article>
  );
}

type MetricRow = { label: string; value: string; tone?: number | null };

function ComparePairs({
  leftTitle,
  rightTitle,
  rows,
}: {
  leftTitle: string;
  rightTitle: string;
  rows: { left?: MetricRow; right?: MetricRow }[];
}) {
  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-x-6">
        <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
          {leftTitle}
        </p>
        <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
          {rightTitle}
        </p>
      </div>
      <div className="mt-2 space-y-1">
        {rows.map((row, index) => (
          <div
            key={`${row.left?.label ?? "empty"}-${row.right?.label ?? "empty"}-${index}`}
            className="grid grid-cols-2 gap-x-6"
          >
            <MetricCell row={row.left} />
            <MetricCell row={row.right} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ValueList({
  rows,
}: {
  rows: MetricRow[];
}) {
  return (
    <div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
      {rows.map((row) => (
        <MetricCell key={row.label} row={row} />
      ))}
    </div>
  );
}

function MetricCell({ row }: { row?: MetricRow }) {
  if (!row) {
    return <div />;
  }
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-muted">{row.label}</span>
      <span
        className={`tabular-nums ${row.tone === undefined ? "text-ink" : signedTone(row.tone)}`}
      >
        {row.value}
      </span>
    </div>
  );
}
