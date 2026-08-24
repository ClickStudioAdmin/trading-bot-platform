"use client";

import { useId, useState, type ReactNode } from "react";
import { ColumnHint } from "@/components/column-hint";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { PaperAutomationTrigger } from "@/components/paper-automation-trigger";
import { TokenIcon } from "@/components/token-icon";
import {
  closedTradeLabel,
  formatExitOrderType,
  formatSourceWord,
} from "@/lib/paper/automation";
import {
  formatPct,
  formatPrice,
  formatSignedUsd,
  formatUsd,
  signedTone,
} from "@/lib/opportunities/format";
import type { EventLogRow } from "@/lib/logs/list";
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

type OpenCarryView = MarkedPaperCarry & {
  orders: PaperOrderRow[];
  logs: EventLogRow[];
};
type ClosedCarryView = PaperCarryRow & {
  orders: PaperOrderRow[];
  logs: EventLogRow[];
};

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
      colSpan={10}
      orders={trade.orders}
      logs={trade.logs}
      entryBasis={trade.entryBasis}
    >
      <td className="min-w-0 px-4 py-3">
        <span className="flex flex-wrap items-center gap-2 font-medium">
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
          {trade.futureSymbol}
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
      <td className={`px-4 py-3 tabular-nums ${signedTone(trade.markApr)}`}>
        {formatPct(trade.markApr)}
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
      logs={trade.logs}
      entryBasis={trade.entryBasis}
    >
      <td className="min-w-0 px-4 py-3">
        <span className="flex flex-wrap items-center gap-2 font-medium">
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
  logs,
  entryBasis,
  colSpan,
  children,
}: {
  orders: PaperOrderRow[];
  logs: EventLogRow[];
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
            aria-label={open ? "Hide position details" : "Show position details"}
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
            <PositionDetailTabs
              orders={orders}
              logs={logs}
              entryBasis={entryBasis}
            />
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
    <form
      action={closeOpenPaperCarry}
      className="flex flex-nowrap items-center gap-2"
    >
      <input type="hidden" name="carryId" value={trade.id} />
      <input type="hidden" name="next" value={next} />
      <ColumnHint
        hint={
          auto ? (
            <AutoCloseHint automation={trade.automation} />
          ) : (
            "Close at market"
          )
        }
        label={
          <PendingSubmitButton
            name="mode"
            value={auto && dynamicExit ? "unwind" : "market"}
            pendingLabel="Closing"
            className={actionClass}
          >
            Close
          </PendingSubmitButton>
        }
      />
      {trade.source === "manual" ? (
        <ColumnHint
          hint="Unwind position over time & ASAP (based on the usable book setting)"
          label={
            <PendingSubmitButton
              name="mode"
              value="unwind"
              pendingLabel="Unwinding"
              className={actionClass}
            >
              Unwind
            </PendingSubmitButton>
          }
        />
      ) : null}
    </form>
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

function PositionDetailTabs({
  orders,
  logs,
  entryBasis,
}: {
  orders: PaperOrderRow[];
  logs: EventLogRow[];
  entryBasis: number;
}) {
  const [tab, setTab] = useState<"orders" | "logs">("orders");
  const ordersPanelId = useId();
  const logsPanelId = useId();

  return (
    <div>
      <div
        role="tablist"
        aria-label="Position details"
        className="flex gap-1 border-b border-line"
      >
        <TabButton
          selected={tab === "orders"}
          panelId={ordersPanelId}
          onClick={() => setTab("orders")}
        >
          Orders
        </TabButton>
        <TabButton
          selected={tab === "logs"}
          panelId={logsPanelId}
          onClick={() => setTab("logs")}
        >
          Position logs
        </TabButton>
      </div>
      <div
        className="pt-4"
        role="tabpanel"
        id={tab === "orders" ? ordersPanelId : logsPanelId}
      >
        {tab === "orders" ? (
          <PaperOrderList orders={orders} entryBasis={entryBasis} />
        ) : (
          <PositionLogList logs={logs} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  selected,
  panelId,
  onClick,
  children,
}: {
  selected: boolean;
  panelId: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={panelId}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        selected
          ? "border-accent text-ink"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
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
    <div>
      <div
        className="panel-scroll space-y-2"
        tabIndex={0}
        role="region"
        aria-label="Orders"
      >
        {orders.map((order) => (
          <PaperOrderCard
            key={order.id}
            order={order}
            entryBasis={entryBasis}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Paper fill equals the scan. No Bybit order.
      </p>
    </div>
  );
}

function PositionLogList({ logs }: { logs: EventLogRow[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No events recorded for this position yet. New opens, adds, closes, and
        exit edits appear here.
      </p>
    );
  }

  return (
    <div>
      <div
        className="panel-scroll space-y-2"
        tabIndex={0}
        role="region"
        aria-label="Position logs"
      >
        {logs.map((log) => {
          const rows = logDetailRows(log);
          return (
            <article
              key={log.id}
              className="rounded-card border border-line bg-surface-raised p-4"
            >
              <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <h3 className="text-sm font-semibold tracking-tight">
                  {formatLogEvent(log.event)}
                </h3>
                <p className="text-xs text-ink-muted">
                  {formatLogTime(log.createdAt)}
                </p>
              </header>
              <p className="mt-0.5 text-sm text-ink-muted">{log.message}</p>
              <p className={`mt-0.5 text-xs ${logLevelTone(log.level)}`}>
                {[log.event, log.scope, log.strategy, log.level !== "info" ? log.level : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {rows.length > 0 ? <ValueList rows={rows} /> : null}
            </article>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Trade events for this position. Same log as Activity.
      </p>
    </div>
  );
}

function logDetailRows(log: EventLogRow): MetricRow[] {
  const rows: MetricRow[] = [];
  for (const [key, value] of Object.entries(log.data)) {
    if (key === "carryId" || value === null || value === undefined || value === "") {
      continue;
    }
    const row = formatLogDataField(key, value);
    if (row) {
      rows.push(row);
    }
  }
  return rows;
}

function formatLogDataField(key: string, value: unknown): MetricRow | null {
  const label = LOG_FIELD_LABELS[key] ?? labelFromKey(key);

  if (typeof value === "number" && Number.isFinite(value)) {
    if (/basis|apr|pct$/i.test(key)) {
      return { label, value: formatPct(value), tone: value };
    }
    if (/usdt$/i.test(key) || key === "notionalUsdt" || key === "clipUsdt") {
      return { label, value: formatUsd(value) };
    }
    if (/dte$/i.test(key)) {
      return { label, value: Number.isInteger(value) ? String(value) : value.toFixed(1) };
    }
    return { label, value: String(value) };
  }

  if (typeof value === "boolean") {
    return { label, value: value ? "Yes" : "No" };
  }

  if (typeof value === "string") {
    if (key === "source" || key === "closeSource") {
      return {
        label,
        value: value === "engine" || value === "manual" ? formatSourceWord(value) : value,
      };
    }
    if (key === "mode") {
      return { label, value: formatLogMode(value) };
    }
    if (key === "reason" || key === "closeReason") {
      return { label, value: formatLogReason(value) };
    }
    if (key === "side") {
      return { label, value: value === "close" ? "Close" : "Open" };
    }
    return { label, value };
  }

  if (typeof value === "object") {
    return { label, value: JSON.stringify(value) };
  }

  return { label, value: String(value) };
}

const LOG_FIELD_LABELS: Record<string, string> = {
  spotSymbol: "Spot",
  futureSymbol: "Future",
  notionalUsdt: "Notional",
  clipUsdt: "Clip value",
  entryBasis: "Entry basis",
  source: "Source",
  closeSource: "Close source",
  mode: "Mode",
  reason: "Reason",
  closeReason: "Reason",
  ruleName: "Set",
  closeMaxDte: "Close max DTE",
  closeMinNetApr: "Close min APR",
  takeProfitPct: "Take profit",
  stopLossPct: "Stop loss",
  side: "Side",
};

function labelFromKey(key: string): string {
  return key
    .replace(/Usdt$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatLogMode(mode: string): string {
  if (mode === "unwind") {
    return "Unwind";
  }
  if (mode === "market") {
    return "Flatten";
  }
  return mode;
}

function formatLogReason(reason: string): string {
  const labels: Record<string, string> = {
    dte: "DTE",
    mark_apr: "Mark APR",
    take_profit: "Take profit",
    stop_loss: "Stop loss",
    unwind: "Unwind",
  };
  return labels[reason] ?? reason;
}

function formatLogEvent(event: string): string {
  const labels: Record<string, string> = {
    "trade.opened": "Opened",
    "trade.added": "Added",
    "trade.closed": "Closed",
    "trade.unwound": "Unwound",
    "trade.exits_updated": "Exits updated",
    "trade.open_failed": "Open failed",
    "trade.close_failed": "Close failed",
    "trade.exits_failed": "Exit update failed",
    "trade.order_failed": "Order write failed",
    "engine.open_failed": "Engine open failed",
    "engine.close_failed": "Engine close failed",
  };
  return labels[event] ?? event;
}

function formatLogTime(createdAt: string): string {
  const ms = Date.parse(createdAt);
  return formatDeskDateTime(Number.isFinite(ms) ? ms : null);
}

function logLevelTone(level: EventLogRow["level"]): string {
  if (level === "error") {
    return "text-danger";
  }
  if (level === "warning") {
    return "text-warning";
  }
  return "text-ink-muted";
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
              hint: `Fees + slip: ${formatPct(order.theoretical.feeRate)}`,
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
              label: "Scan basis",
              value: formatPct(order.theoretical.executableBasis),
              hint: "Gross basis before slippage + fees",
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
              label: "Capacity",
              value:
                order.theoretical.capacityUsdt === null
                  ? "—"
                  : formatUsd(order.theoretical.capacityUsdt),
            },
            right: {
              label: "Order value",
              value: formatUsd(order.notionalUsdt),
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
      label: "Clip value",
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
        </p>
      </header>
      <p className="mt-0.5 text-xs text-ink-muted">{formatCloseOrderWhy(order)}</p>
      <ValueList rows={rows} />
    </article>
  );
}

type MetricRow = {
  label: string;
  value: string;
  tone?: number | null;
  hint?: string;
};

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
  const value = (
    <span
      className={`tabular-nums ${row.tone === undefined ? "text-ink" : signedTone(row.tone)}`}
    >
      {row.value}
    </span>
  );
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-muted">{row.label}</span>
      {row.hint ? <ColumnHint label={value} hint={row.hint} /> : value}
    </div>
  );
}
