"use client";

import { useId, useState, type ReactNode } from "react";
import { PaperAutomationTrigger } from "@/components/paper-automation-trigger";
import { TokenIcon } from "@/components/token-icon";
import { closedTradeLabel } from "@/lib/paper/automation";
import {
  formatPct,
  formatPrice,
  formatSignedUsd,
  formatUsd,
  signedTone,
} from "@/lib/opportunities/format";
import { closeOpenPaperCarry } from "@/lib/paper/actions";
import { carryPnlPct } from "@/lib/paper/math";
import {
  fillSlip,
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
    <ExpandableOrderRows colSpan={8} orders={trade.orders}>
      {(toggle) => (
        <>
      <td className="px-4 py-3">
        <span className="flex items-center gap-2 font-medium">
          <TokenIcon symbol={trade.baseCoin} />
          {trade.baseCoin}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1 pl-7 text-xs text-ink-faint">
          Long spot · short {trade.futureSymbol}
          {" · "}
          {trade.source === "engine" ? (
            <PaperAutomationTrigger
              carryId={trade.id}
              automation={trade.automation}
              label="Engine"
              canEdit
              entrySource="engine"
              next={next}
            />
          ) : (
            "Manual"
          )}
          {" · "}
          {toggle}
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
        </>
      )}
    </ExpandableOrderRows>
  );
}

export function ClosedPaperCarryRows({ trade }: { trade: ClosedCarryView }) {
  return (
    <ExpandableOrderRows colSpan={7} orders={trade.orders}>
      {(toggle) => (
        <>
      <td className="px-4 py-3">
        <span className="flex items-center gap-2 font-medium">
          <TokenIcon symbol={trade.baseCoin} />
          {trade.baseCoin}
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
          {" · "}
          {toggle}
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
      <td className={`px-4 py-3 tabular-nums ${signedTone(trade.realizedApr)}`}>
        {formatPct(trade.realizedApr)}
      </td>
        </>
      )}
    </ExpandableOrderRows>
  );
}

function ExpandableOrderRows({
  orders,
  colSpan,
  children,
}: {
  orders: PaperOrderRow[];
  colSpan: number;
  children: (toggle: ReactNode) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggle = (
    <button
      type="button"
      className="text-ink-faint hover:text-ink"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      onClick={() => setOpen((current) => !current)}
    >
      {open ? "Hide orders" : "Orders"}
    </button>
  );

  return (
    <>
      <tr className="border-b border-line last:border-b-0">
        {children(toggle)}
      </tr>
      {open ? (
        <tr className="border-b border-line last:border-b-0">
          <td colSpan={colSpan} className="bg-canvas px-4 py-4" id={panelId}>
            <PaperOrderList orders={orders} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ClosePaperButton({
  trade,
  next,
}: {
  trade: MarkedPaperCarry;
  next: PaperReturnPath;
}) {
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

  return (
    <form action={closeOpenPaperCarry}>
      <input type="hidden" name="carryId" value={trade.id} />
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        className="rounded-control bg-accent-strong px-2.5 py-1 text-xs font-medium text-ink"
      >
        Close
      </button>
    </form>
  );
}

function PaperOrderList({ orders }: { orders: PaperOrderRow[] }) {
  if (orders.length === 0) {
    return <p className="text-sm text-ink-muted">No orders recorded.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.08em] text-ink-faint">
        Orders
      </p>
      {orders.map((order) => (
        <PaperOrderCard key={order.id} order={order} />
      ))}
      <p className="text-xs text-ink-faint">
        Paper fill equals the scan. No Bybit order.
      </p>
    </div>
  );
}

function PaperOrderCard({ order }: { order: PaperOrderRow }) {
  const conditions = formatOrderConditions(order);
  const slip = fillSlip(order);
  const empty =
    order.side === "open"
      ? order.source === "engine"
        ? "No entry filters."
        : "No automation entry."
      : order.source === "engine"
        ? "No exit filters stored."
        : "No auto exits armed.";

  return (
    <article className="rounded-card border border-line bg-surface-raised p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">
          {formatOrderHeadline(order)}
        </h3>
        <p className="text-xs text-ink-muted">
          {formatDeskDateTime(order.filledAtMs)}
          {" · "}
          {formatUsd(order.notionalUsdt)}
        </p>
      </header>
      <p className="mt-2 text-sm text-ink-muted">{formatOrderWhy(order)}</p>
      {conditions.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">
          {conditions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-ink-faint">{empty}</p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ValueList
          title="Theoretical · scan"
          rows={[
            {
              label: "Net basis",
              value: formatPct(order.theoretical.netBasis),
              tone: order.theoretical.netBasis,
            },
            {
              label: "Net APR",
              value: formatPct(order.theoretical.netApr),
              tone: order.theoretical.netApr,
            },
            {
              label: "DTE",
              value:
                order.theoretical.daysToExpiry === null
                  ? "—"
                  : order.theoretical.daysToExpiry.toFixed(1),
            },
            {
              label: "Executable",
              value: formatPct(order.theoretical.executableBasis),
              tone: order.theoretical.executableBasis,
            },
            {
              label: "Capacity",
              value:
                order.theoretical.capacityUsdt === null
                  ? "—"
                  : formatUsd(order.theoretical.capacityUsdt),
            },
            {
              label: "Spot ask",
              value: formatPrice(order.theoretical.spotAsk),
            },
            {
              label: "Future bid",
              value: formatPrice(order.theoretical.futureBid),
            },
            {
              label: "Fees + slip",
              value: formatPct(order.theoretical.feeRate),
              tone: order.theoretical.feeRate,
            },
          ]}
        />
        <ValueList
          title="Execution · paper"
          rows={[
            {
              label: "Fill basis",
              value: formatPct(order.fillBasis),
              tone: order.fillBasis,
            },
            { label: "Slip vs scan", value: formatPct(slip), tone: slip },
            { label: "Notional", value: formatUsd(order.notionalUsdt) },
            {
              label: "Buy spot",
              value: formatPrice(order.theoretical.spotAsk),
            },
            {
              label: "Sell future",
              value: formatPrice(order.theoretical.futureBid),
            },
            { label: "Filled", value: formatDeskDateTime(order.filledAtMs) },
          ]}
        />
      </div>
    </article>
  );
}

function ValueList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; tone?: number | null }[];
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
        {title}
      </p>
      <dl className="mt-2 space-y-1 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">{row.label}</dt>
            <dd
              className={`tabular-nums ${row.tone === undefined ? "text-ink" : signedTone(row.tone)}`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
