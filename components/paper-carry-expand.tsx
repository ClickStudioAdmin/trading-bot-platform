"use client";

import { ExpandableTradeRows, TradeDetailTabs } from "@/components/trade-expand";
import { ColumnHint } from "@/components/column-hint";
import { FuturesSourceCell } from "@/components/futures-source";
import { PendingSubmitButton, ButtonCheckIcon, useStoredButtonSuccess } from "@/components/pending-submit-button";
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
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
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
import { LocalTime } from "@/components/local-time";
import {
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
  hideUnwind = false,
}: {
  trade: OpenCarryView;
  next: PaperReturnPath;
  hideUnwind?: boolean;
}) {
  const pnlPct =
    trade.unrealizedUsdt === null
      ? null
      : carryPnlPct(trade.unrealizedUsdt, trade.notionalUsdt);

  return (
    <ExpandableTradeRows
      colSpan={11}
      details={
        <PositionDetailTabs
          orders={trade.orders}
          logs={trade.logs}
          entryBasis={trade.entryBasis}
        />
      }
    >
      <td className="min-w-0 px-4 py-3">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          <TokenIcon symbol={trade.baseCoin} />
          {trade.baseCoin}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1 pl-7 text-xs text-ink-faint">
          {trade.futureSymbol}
        </span>
      </td>
      <td className="px-4 py-3">
        <FuturesSourceCell
          source={trade.source}
          name={
            trade.ruleName ? (
              <PaperAutomationTrigger
                carryId={trade.id}
                automation={trade.automation}
                label={trade.ruleName}
                canEdit
                entrySource="engine"
                next={next}
                className="text-left text-xs text-ink-muted hover:text-ink"
              />
            ) : undefined
          }
        />
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
        <ClosePaperButton trade={trade} next={next} hideUnwind={hideUnwind} />
      </td>
    </ExpandableTradeRows>
  );
}

export function ClosedPaperCarryRows({ trade }: { trade: ClosedCarryView }) {
  const pnlPct =
    trade.realizedUsdt === null
      ? null
      : carryPnlPct(trade.realizedUsdt, trade.notionalUsdt);

  return (
    <ExpandableTradeRows
      colSpan={9}
      details={
        <PositionDetailTabs
          orders={trade.orders}
          logs={trade.logs}
          entryBasis={trade.entryBasis}
        />
      }
    >
      <td className="min-w-0 px-4 py-3">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          <TokenIcon symbol={trade.baseCoin} />
          {trade.baseCoin}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1 pl-7 text-xs text-ink-faint">
          {trade.futureSymbol}
        </span>
      </td>
      <td className="px-4 py-3">
        <FuturesSourceCell
          source={trade.source}
          ruleName={trade.ruleName}
          footer={
            <PaperAutomationTrigger
              carryId={trade.id}
              automation={trade.automation}
              label={closedTradeLabel(trade.source, trade.closeSource)}
              canEdit={false}
              entrySource={trade.source}
              closeSource={trade.closeSource}
              closeReason={trade.closeReason}
            />
          }
        />
      </td>
      <td className="px-4 py-3 text-ink-muted">
        <LocalTime at={trade.closedAtMs} mode="date" />
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
    </ExpandableTradeRows>
  );
}

function ClosePaperButton({
  trade,
  next,
  hideUnwind = false,
}: {
  trade: MarkedPaperCarry;
  next: PaperReturnPath;
  hideUnwind?: boolean;
}) {
  const closeKey = `close-${trade.id}`;
  const ok = useStoredButtonSuccess(closeKey);

  if (trade.status === "closing") {
    return (
      <ColumnHint
        hint="Exit already submitted. Later ticks clip to usable book until the row is flat."
        label={
          <span className="inline-grid justify-items-center rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning">
            <span className="invisible col-start-1 row-start-1">Closing</span>
            <span className="col-start-1 row-start-1 inline-flex items-center justify-center">
              {ok ? <ButtonCheckIcon /> : "Closing"}
            </span>
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
          ) : hideUnwind ? (
            "Close both Bybit legs at market."
          ) : (
            "Close at market"
          )
        }
        label={
          <PendingSubmitButton
            name="mode"
            value={auto && dynamicExit && !hideUnwind ? "unwind" : "market"}
            pendingLabel="Closing"
            successKey={closeKey}
            className={actionClass}
          >
            Close
          </PendingSubmitButton>
        }
      />
      {trade.source === "manual" && !hideUnwind ? (
        <ColumnHint
          hint="Unwind position over time & ASAP (based on the usable book setting)"
          label={
            <PendingSubmitButton
              name="mode"
              value="unwind"
              pendingLabel="Unwinding"
              successKey={closeKey}
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

function PositionDetailTabs({
  orders,
  logs,
  entryBasis,
}: {
  orders: PaperOrderRow[];
  logs: EventLogRow[];
  entryBasis: number;
}) {
  return (
    <TradeDetailTabs
      orders={<PaperOrderList orders={orders} entryBasis={entryBasis} />}
      logs={<PositionLogList logs={logs} />}
    />
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
  );
}

export function PositionLogList({ logs }: { logs: EventLogRow[] }) {
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
                  <LocalTime at={log.createdAt} />
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
    if (
      key === "carryId" ||
      key === "positionId" ||
      key === "ruleId" ||
      key === "workingId" ||
      key === "webhookId" ||
      value === null ||
      value === undefined ||
      value === ""
    ) {
      continue;
    }
    const row = formatLogDataField(key, value, log.strategy);
    if (row) {
      rows.push(row);
    }
  }
  return rows;
}

function formatLogDataField(
  key: string,
  value: unknown,
  strategy?: string | null,
): MetricRow | null {
  const label =
    key === "ruleName" && strategy === FUTURES_STRATEGY_ID
      ? "Automation"
      : (LOG_FIELD_LABELS[key] ?? labelFromKey(key));

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
      if (value === "webhook") {
        return { label, value: "Webhook" };
      }
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
      if (value === "close") {
        return { label, value: "Close" };
      }
      if (value === "open") {
        return { label, value: "Open" };
      }
      if (value === "long" || value === "short") {
        return { label, value: value === "long" ? "Long" : "Short" };
      }
    }
    if (key === "action") {
      if (value === "buy" || value === "sell" || value === "flatten") {
        return {
          label,
          value: value === "buy" ? "Buy" : value === "sell" ? "Sell" : "Close",
        };
      }
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
  notionalUsdt: "Value",
  clipUsdt: "Clip value",
  entryBasis: "Entry basis",
  source: "Source",
  closeSource: "Close source",
  mode: "Mode",
  reason: "Reason",
  closeReason: "Reason",
  ruleName: "Set",
  webhook: "Webhook",
  closeMaxDte: "Close max DTE",
  closeMinNetApr: "Close min APR",
  takeProfitPct: "Take profit",
  stopLossPct: "Stop loss",
  symbol: "Contract",
  qty: "Qty",
  action: "Action",
  side: "Side",
  price: "Price",
  entryPrice: "Entry",
  positionId: "Position",
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
    return "Close";
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
    "trade.futures": "Futures",
    "trade.futures_failed": "Futures failed",
    "engine.open_failed": "Engine open failed",
    "engine.close_failed": "Engine close failed",
  };
  return labels[event] ?? event;
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
          <LocalTime at={order.filledAtMs} />
        </p>
      </header>
      <p className="mt-0.5 text-xs text-ink-muted">{formatOrderWhy(order)}</p>
      {conditions.length > 0 ? (
        <p className="mt-0.5 text-sm text-ink-muted">{conditions.join(" · ")}</p>
      ) : null}
      <ComparePairs
        leftTitle="Theoretical · scan"
        rightTitle="Fill"
        rows={[
          {
            left: {
              label: "Scan basis",
              value: formatPct(order.theoretical.executableBasis),
              hint: "Gross (future bid − spot ask) / spot ask from the scan. Before fees.",
            },
            right: {
              label: "Fill basis",
              value: formatPct(order.fillBasis),
              tone: order.fillBasis,
              hint: "Gross from exchange fill prices when present. Paper copies the scan net.",
            },
          },
          {
            left: {
              label: "Net APR",
              value: formatPct(order.theoretical.netApr),
              tone: order.theoretical.netApr,
              hint: "Scan net basis × 365 / DTE. After assumed fees and slip.",
            },
            right: {
              label: "Scan vs Fill",
              value: formatPct(slip),
              tone: slip,
              hint: "Fill basis minus scan basis when this clip has exchange fill prices. Paper is 0.",
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
            right:
              order.fillQty !== null && order.fillQty > 0
                ? {
                    label: "Fill qty",
                    value: String(Number(order.fillQty.toPrecision(8))),
                  }
                : {
                    label: "Order value",
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
              value: formatPrice(
                order.fillSpotPrice ?? order.theoretical.spotAsk,
              ),
            },
          },
          {
            left: {
              label: "Future bid",
              value: formatPrice(order.theoretical.futureBid),
            },
            right: {
              label: "Sell future",
              value: formatPrice(
                order.fillFuturePrice ?? order.theoretical.futureBid,
              ),
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
            right:
              order.fillQty !== null && order.fillQty > 0
                ? {
                    label: "Order value",
                    value: formatUsd(order.notionalUsdt),
                  }
                : undefined,
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
          <LocalTime at={order.filledAtMs} />
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
  const packed = rows.filter((row) => row.left || row.right);
  return (
    <div className="mt-3">
      <div className="grid grid-cols-2 gap-x-6">
        <p className="text-sm font-semibold tracking-tight">
          {leftTitle}
        </p>
        <p className="text-sm font-semibold tracking-tight">
          {rightTitle}
        </p>
      </div>
      <div className="mt-2 space-y-1">
        {packed.map((row, index) => (
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
