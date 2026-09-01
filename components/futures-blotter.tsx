"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ColumnHint } from "@/components/column-hint";
import { LocalTime } from "@/components/local-time";
import { OpenStats } from "@/components/open-stats";
import { PositionLogList } from "@/components/paper-carry-expand";
import { TokenIcon } from "@/components/token-icon";
import { ExpandableTradeRows, TradeDetailTabs } from "@/components/trade-expand";
import {
  FuturesOpenColumnPicker,
  useFuturesOpenColumns,
} from "@/components/futures-column-picker";
import { FuturesPositionBulkActions } from "@/components/futures-close-all";
import { FuturesCloseActions } from "@/components/futures-close";
import { FuturesSourceCell } from "@/components/futures-source";
import { FuturesTpslCell } from "@/components/futures-tpsl";
import { FuturesTrailingCell } from "@/components/futures-trailing";
import {
  FUTURES_DCA_OPEN_COLUMN_COUNT,
  futuresOpenColumnCount,
  type FuturesOpenColumnVisibility,
} from "@/lib/futures/columns";
import type { DcaOpenHint } from "@/lib/dca/playbook";
import { dcaHintKey } from "@/lib/dca/playbook";
import type { FuturesDeskPosition } from "@/lib/futures/list";
import type { MarkedFutures } from "@/lib/futures/mark";
import { useLiveMarkedOpen } from "@/components/live-ticker";
import { formatLeverage } from "@/lib/futures/venue-risk";
import type { FuturesOrder, FuturesTradeSource } from "@/lib/futures/model";
import { formatFuturesOrigin, resolveOrderOrigin } from "@/lib/futures/source";
import {
  effectiveLeverage,
  flattenExitPrice,
  futuresClosedStats,
  futuresDaysHeld,
  futuresOpenExposure,
  positionMarginUsdt,
  roePct,
} from "@/lib/futures/stats";
import {
  formatPct,
  formatPrice,
  formatQty,
  formatQtyFull,
  formatSignedUsd,
  formatUsd,
  signedTone,
} from "@/lib/opportunities/format";
import { FUTURES_PATHS } from "@/lib/strategies/registry";

export function FuturesOpenStats({
  signedIn,
  open,
}: {
  signedIn: boolean;
  open: MarkedFutures[];
}) {
  const rows = useLiveMarkedOpen(open);
  const notional = rows.reduce((sum, row) => sum + row.notionalUsdt, 0);
  const unrealized = rows.every((row) => row.unrealizedUsdt === null)
    ? null
    : rows.reduce((sum, row) => sum + (row.unrealizedUsdt ?? 0), 0);
  return (
    <OpenStats
      signedIn={signedIn}
      notional={notional}
      unrealized={unrealized}
      exposure={futuresOpenExposure(rows)}
    />
  );
}

export function OpenFuturesTrades({
  signedIn,
  open,
  next = FUTURES_PATHS.positions,
  showHeading = true,
  exchangeBook = false,
  emptyMessage,
  showCloseAll = false,
  workingCount = 0,
  webhookNames = [],
  showDcaColumns = false,
  playbookOwnsOrders = false,
  dcaHints = {},
  positionsHref = FUTURES_PATHS.positions,
  hideRowExits = false,
  copyDesk = false,
}: {
  signedIn: boolean;
  open: MarkedFutures[];
  next?: string;
  showHeading?: boolean;
  exchangeBook?: boolean;
  emptyMessage?: ReactNode;
  showCloseAll?: boolean;
  workingCount?: number;
  webhookNames?: readonly string[];
  showDcaColumns?: boolean;
  playbookOwnsOrders?: boolean;
  dcaHints?: Readonly<Record<string, DcaOpenHint>>;
  positionsHref?: string;
  hideRowExits?: boolean;
  copyDesk?: boolean;
}) {
  const { visible: storedVisible, setColumn } = useFuturesOpenColumns();
  const visible = hideRowExits
    ? { ...storedVisible, tpsl: false, trailing: false }
    : storedVisible;
  const rows = useLiveMarkedOpen(open);
  const colSpan = futuresOpenColumnCount(
    visible,
    showDcaColumns ? FUTURES_DCA_OPEN_COLUMN_COUNT : 0,
  );

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
            href={positionsHref}
            className="shrink-0 text-sm text-accent hover:text-accent-strong"
          >
            All positions
          </Link>
        </div>
      ) : null}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <FuturesOpenColumnPicker
          visible={visible}
          setColumn={setColumn}
          hiddenColumns={hideRowExits ? ["tpsl", "trailing"] : []}
        />
        {showCloseAll ? (
          <FuturesPositionBulkActions
            next={next}
            signedIn={signedIn}
            openCount={open.length}
            workingCount={workingCount}
            panicOnly={playbookOwnsOrders}
            copyDesk={copyDesk}
          />
        ) : null}
      </div>
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
                <ColumnHint
                  label="Contract"
                  hint="USDT linear perpetual."
                />
              </th>
              <th className="px-3 py-3 font-medium">
                <ColumnHint
                  label="Source"
                  hint="Manual is a desk click. Auto is an automation. Webhook is a TradingView strategy fill. The name is the rule or webhook that opened this row."
                />
              </th>
              <th className="px-3 py-3 font-medium">
                <ColumnHint label="Side" hint="Long or short. Both can be open on the same contract." />
              </th>
              {showDcaColumns ? (
                <th className="px-3 py-3 font-medium">
                  <ColumnHint
                    label="Orders"
                    hint="Bot orders filled versus the max. Resting limits are not filled yet."
                  />
                </th>
              ) : null}
              {visible.qty ? (
                <th className="px-3 py-3 font-medium">
                  <ColumnHint label="Qty" hint="Base-coin size on this row." />
                </th>
              ) : null}
              {visible.value ? (
                <th className="px-2 py-3 font-medium">
                  <ColumnHint
                    label="Value"
                    hint="Qty × entry. P&L scales with this amount."
                  />
                </th>
              ) : null}
              {visible.entry ? (
                <th className="px-2 py-3 font-medium">
                  <ColumnHint
                    label="Entry"
                    hint="Size-weighted average fill price."
                  />
                </th>
              ) : null}
              {visible.mark ? (
                <th className="px-2 py-3 font-medium">
                  <ColumnHint label="Mark" hint="Last price from the live Bybit ticker." />
                </th>
              ) : null}
              {visible.unrealized ? (
                <th className="px-2 py-3 font-medium">
                  <ColumnHint
                    label="Unrealized"
                    hint="Mark-to-market versus entry. Not Bybit’s invoice."
                  />
                </th>
              ) : null}
              {visible.pnl ? (
                <th className="px-3 py-3 font-medium">
                  <ColumnHint
                    label="P&L %"
                    hint="Unrealized ÷ value. Not annualized."
                  />
                </th>
              ) : null}
              {visible.leverage ? (
                <th className="px-3 py-3 font-medium">
                  <ColumnHint
                    label="Leverage"
                    hint="Venue leverage on this side. Live reads Bybit. Paper shows —."
                  />
                </th>
              ) : null}
              {visible.liq ? (
                <th className="px-2 py-3 font-medium">
                  <ColumnHint
                    label="Liq"
                    hint="Venue estimated liquidation price. Live reads Bybit. Paper shows —."
                  />
                </th>
              ) : null}
              {visible.tpsl ? (
                <th className="px-3 py-3 font-medium">
                  <ColumnHint
                    label="TP/SL"
                    hint={
                      playbookOwnsOrders
                        ? "Bot take profit / stop. Faint is the target from Automations, or a market exit. Colour means a limit is resting."
                        : "Take profit and stop loss on this row. Market fills when the trigger hits. Limit rests until mark can fill. Add when the position is open, or attach them on the order ticket."
                    }
                  />
                </th>
              ) : null}
              {visible.trailing ? (
                <th className="px-3 py-3 font-medium">
                  <ColumnHint
                    label="Trailing"
                    hint={
                      playbookOwnsOrders
                        ? "Retracement from Automations. Faint is the bot distance. Green means it is attached on this row."
                        : "Retracement distance from the best price since activation. Closes the whole row at market. Add on the ticket or here."
                    }
                  />
                </th>
              ) : null}
              <th
                className={`${playbookOwnsOrders ? "w-[9.5rem]" : "w-[8.75rem]"} px-2 py-3 font-medium`}
              >
                <ColumnHint
                  label="Close By"
                  hint={
                    copyDesk
                      ? "Close flattens this copied position at market. It does not idle a bot — this desk has no playbook. Copied limits stay until the parent cancels them or you cancel them."
                      : playbookOwnsOrders
                      ? "Close bot flattens every side, cancels working bot orders, and sets the bot to idle. Same as Close bot on Automations."
                      : exchangeBook
                        ? "Market or Limit opens a qty dialog. Market fills on Bybit now. Limit rests a reduce-only close until last trades through it."
                        : "Market or Limit opens a qty dialog. Market fills now. Limit rests a reduce-only close until mark trades through it."
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
                    to open futures and see them here.
                  </>
                }
              />
            ) : rows.length === 0 ? (
              <EmptyRow
                colSpan={colSpan}
                message={
                  emptyMessage ?? "No open futures. Place an order above."
                }
              />
            ) : (
              rows.map((trade) => (
                <OpenFuturesRows
                  key={trade.id}
                  trade={trade}
                  next={next}
                  visible={visible}
                  colSpan={colSpan}
                  webhookNames={webhookNames}
                  showDcaColumns={showDcaColumns}
                  playbookOwnsOrders={playbookOwnsOrders}
                  copyDesk={copyDesk}
                  dcaHint={
                    dcaHints[dcaHintKey(trade.symbol, trade.side)] ?? null
                  }
                />
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
  webhookNames = [],
  fallbackLeverage = null,
}: {
  signedIn: boolean;
  closed: FuturesDeskPosition[];
  webhookNames?: readonly string[];
  fallbackLeverage?: number | null;
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
                  label="Source"
                  hint="Manual is a desk click. Auto is an automation. Webhook is a TradingView strategy fill. The name is the rule or webhook that opened this row."
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
                  hint="Realized ÷ position value (qty × entry)."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="ROE"
                  hint="Realized ÷ initial margin (position value ÷ leverage). — if this row has no leverage."
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
                    to see closed futures.
                  </>
                }
              />
            ) : closed.length === 0 ? (
              <EmptyRow colSpan={10} message="No closed futures yet." />
            ) : (
              closed.map((trade) => (
                <ClosedFuturesRows
                  key={trade.id}
                  trade={trade}
                  webhookNames={webhookNames}
                  fallbackLeverage={fallbackLeverage}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export type DeskStatItem = {
  label: string;
  value: string;
  toneClass?: string;
  hint?: string;
  note?: string;
  content?: ReactNode;
};

export function FuturesPerformanceStats({
  signedIn,
  closed,
  extras,
  items: itemsOverride,
  embedded = false,
  fallbackLeverage = null,
}: {
  signedIn: boolean;
  closed: FuturesDeskPosition[];
  extras?: DeskStatItem[];
  items?: DeskStatItem[];
  embedded?: boolean;
  fallbackLeverage?: number | null;
}) {
  const stats = futuresClosedStats(closed, fallbackLeverage);
  const winRate =
    stats.closedCount === 0
      ? "—"
      : `${Math.round((stats.greenCount / stats.closedCount) * 100)}%`;
  const roeHint =
    signedIn &&
    stats.roeTradeCount > 0 &&
    stats.roeTradeCount < stats.closedCount
      ? `P&L vs initial margin (notional ÷ leverage). ROE on ${stats.roeTradeCount} of ${stats.closedCount} trades — the rest have no stored leverage.`
      : "P&L vs initial margin (notional ÷ leverage). Exchange-style ROE.";
  const items: DeskStatItem[] = itemsOverride ?? [
    ...(extras ?? []),
    {
      label: "Completed Trades",
      value: signedIn ? String(stats.closedCount) : "—",
    },
    {
      label: "Win Rate",
      value: signedIn ? winRate : "—",
    },
    {
      label: "Realized Profit",
      value: signedIn ? formatSignedUsd(stats.realizedUsdt) : "—",
      toneClass: signedTone(signedIn ? stats.realizedUsdt : null),
      hint: "Closed-trade dollars. Leverage does not change this amount.",
    },
    {
      label: "P&L",
      value:
        signedIn && stats.onNotionalPct != null
          ? formatPct(stats.onNotionalPct)
          : "—",
      toneClass: signedTone(signedIn ? stats.realizedUsdt : null),
      hint: "Realized profit ÷ sum of closed position value (qty × entry).",
      note: "Based on position value",
    },
    {
      label: "ROE",
      value: signedIn && stats.roePct != null ? formatPct(stats.roePct) : "—",
      toneClass: signedTone(signedIn ? stats.roePct : null),
      hint: roeHint,
      note: "Based on margin requirement",
    },
  ];
  const columns =
    items.length >= 6
      ? "sm:grid-cols-2 xl:grid-cols-4"
      : items.length >= 5
        ? "sm:grid-cols-2 xl:grid-cols-5"
        : "sm:grid-cols-3";

  const grid = (
    <div className={`grid gap-4 ${columns}`}>
      {items.map((item) => (
        <StatCard
          key={item.label}
          label={item.label}
          value={item.value}
          toneClass={item.toneClass}
          hint={item.hint}
          note={item.note}
          content={item.content}
          raised={embedded}
        />
      ))}
    </div>
  );
  if (embedded) {
    return grid;
  }
  return (
    <section>
      <SectionHead
        title="Desk Statistics"
        subtitle={
          signedIn ? undefined : "Sign in to see this book’s realized numbers."
        }
      />
      {grid}
    </section>
  );
}

function OpenFuturesRows({
  trade,
  next,
  visible,
  colSpan,
  webhookNames,
  showDcaColumns,
  playbookOwnsOrders,
  copyDesk,
  dcaHint,
}: {
  trade: MarkedFutures;
  next: string;
  visible: FuturesOpenColumnVisibility;
  colSpan: number;
  webhookNames: readonly string[];
  showDcaColumns: boolean;
  playbookOwnsOrders: boolean;
  copyDesk: boolean;
  dcaHint: DcaOpenHint | null;
}) {
  const pnlPct =
    trade.unrealizedUsdt === null
      ? null
      : trade.notionalUsdt > 0
        ? trade.unrealizedUsdt / trade.notionalUsdt
        : null;

  return (
    <ExpandableTradeRows
      colSpan={colSpan}
      details={
        <TradeDetailTabs
          orders={
            <FuturesOrderList
              orders={trade.orders}
              positionSource={trade.source}
              positionRuleName={trade.ruleName}
              webhookNames={webhookNames}
            />
          }
          logs={<PositionLogList logs={trade.logs} />}
        />
      }
    >
      <td className="min-w-0 px-3 py-3">
        <span className="flex items-start gap-2">
          <TokenIcon symbol={trade.baseCoin} />
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-medium">
              <span>{trade.baseCoin}</span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-ink-faint">
              {trade.symbol}
            </span>
          </span>
        </span>
      </td>
      <td className="min-w-0 px-3 py-3">
        <FuturesSourceCell
          source={trade.source}
          ruleName={trade.ruleName}
          webhookNames={webhookNames}
        />
      </td>
      <td
        className={`min-w-0 px-3 py-3 capitalize ${
          trade.side === "short" ? "text-danger" : "text-success"
        }`}
      >
        {trade.side}
      </td>
      {showDcaColumns ? (
        <td className="min-w-0 px-3 py-3 tabular-nums whitespace-nowrap">
          {dcaHint?.orders ?? "—"}
        </td>
      ) : null}
      {visible.qty ? (
        <td className="min-w-0 px-3 py-3 tabular-nums whitespace-nowrap">
          <span title={formatQtyFull(trade.qty)}>{formatQty(trade.qty)}</span>
        </td>
      ) : null}
      {visible.value ? (
        <td className="min-w-0 px-2 py-3 tabular-nums whitespace-nowrap text-ink-muted">
          {formatUsd(trade.notionalUsdt)}
        </td>
      ) : null}
      {visible.entry ? (
        <td className="min-w-0 px-2 py-3 tabular-nums whitespace-nowrap">
          {formatPrice(trade.entryPrice)}
        </td>
      ) : null}
      {visible.mark ? (
        <td className="min-w-0 px-2 py-3 tabular-nums whitespace-nowrap">
          {formatPrice(trade.mark)}
        </td>
      ) : null}
      {visible.unrealized ? (
        <td
          className={`min-w-0 px-2 py-3 tabular-nums whitespace-nowrap ${signedTone(trade.unrealizedUsdt)}`}
        >
          {trade.unrealizedUsdt === null
            ? "—"
            : formatSignedUsd(trade.unrealizedUsdt)}
        </td>
      ) : null}
      {visible.pnl ? (
        <td
          className={`min-w-0 px-3 py-3 tabular-nums whitespace-nowrap ${signedTone(pnlPct)}`}
        >
          {formatPct(pnlPct)}
        </td>
      ) : null}
      {visible.leverage ? (
        <td className="min-w-0 px-3 py-3 tabular-nums whitespace-nowrap text-ink-muted">
          {formatLeverage(trade.leverage)}
        </td>
      ) : null}
      {visible.liq ? (
        <td className="min-w-0 px-2 py-3 tabular-nums whitespace-nowrap text-ink-muted">
          {trade.liqPrice === null ? "—" : formatPrice(trade.liqPrice)}
        </td>
      ) : null}
      {visible.tpsl ? (
        <td className="min-w-0 px-3 py-3">
          <FuturesTpslCell
            positionId={trade.id}
            symbol={trade.symbol}
            side={trade.side}
            qty={trade.qty}
            entryPrice={trade.entryPrice}
            mark={trade.mark}
            last={trade.last}
            takeProfit={trade.takeProfit}
            stopLoss={trade.stopLoss}
            tpTrigger={trade.tpTrigger}
            slTrigger={trade.slTrigger}
            tpslMode={trade.tpslMode}
            tpQty={trade.tpQty}
            slQty={trade.slQty}
            tpOrderType={trade.tpOrderType}
            slOrderType={trade.slOrderType}
            tpLimitPrice={trade.tpLimitPrice}
            slLimitPrice={trade.slLimitPrice}
            liqPrice={trade.liqPrice}
            next={next}
            readOnly={playbookOwnsOrders}
            plannedTakeProfit={dcaHint?.plannedTakeProfit ?? null}
            plannedStopLoss={dcaHint?.plannedStopLoss ?? null}
            plannedTpOrderType={dcaHint?.takeProfitOrderType}
            plannedSlOrderType={dcaHint?.stopLossOrderType}
            tpLimitResting={Boolean(dcaHint?.tpLimitResting)}
          />
        </td>
      ) : null}
      {visible.trailing ? (
        <td className="min-w-0 px-3 py-3">
          <FuturesTrailingCell
            positionId={trade.id}
            symbol={trade.symbol}
            side={trade.side}
            entryPrice={trade.entryPrice}
            mark={trade.mark}
            last={trade.last}
            trailingStop={trade.trailingStop}
            trailingActive={trade.trailingActive}
            liqPrice={trade.liqPrice}
            next={next}
            readOnly={playbookOwnsOrders}
            plannedTrailing={dcaHint?.plannedTrailing ?? null}
          />
        </td>
      ) : null}
      <td className="px-2 py-3 whitespace-nowrap">
        <FuturesCloseActions
          trade={trade}
          next={next}
          playbookOwnsOrders={playbookOwnsOrders}
          playbookId={dcaHint?.playbookId ?? null}
          copyDesk={copyDesk}
        />
      </td>
    </ExpandableTradeRows>
  );
}

function ClosedFuturesRows({
  trade,
  webhookNames,
  fallbackLeverage,
}: {
  trade: FuturesDeskPosition;
  webhookNames: readonly string[];
  fallbackLeverage: number | null;
}) {
  const pnlPct =
    trade.notionalUsdt > 0 ? trade.realizedUsdt / trade.notionalUsdt : null;
  const roe = roePct(
    trade.realizedUsdt,
    positionMarginUsdt(
      trade.notionalUsdt,
      effectiveLeverage(trade.leverage, fallbackLeverage),
    ),
  );
  const held = futuresDaysHeld(trade.openedAtMs, trade.closedAtMs);
  const exit = flattenExitPrice(trade.orders);
  const baseCoin = trade.symbol.replace(/USDT$/, "");

  return (
    <ExpandableTradeRows
      colSpan={10}
      details={
        <TradeDetailTabs
          orders={
            <FuturesOrderList
              orders={trade.orders}
              positionSource={trade.source}
              positionRuleName={trade.ruleName}
              webhookNames={webhookNames}
            />
          }
          logs={<PositionLogList logs={trade.logs} />}
        />
      }
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
              title={trade.qty ? formatQtyFull(trade.qty) : undefined}
            >
              {trade.symbol}
              {trade.qty ? ` · ${formatQty(trade.qty)}` : ""}
            </span>
          </span>
        </span>
      </td>
      <td className="px-4 py-3">
        <FuturesSourceCell
          source={trade.source}
          ruleName={trade.ruleName}
          webhookNames={webhookNames}
        />
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
      <td className={`px-4 py-3 tabular-nums ${signedTone(roe)}`}>
        {formatPct(roe)}
      </td>
    </ExpandableTradeRows>
  );
}

function FuturesOrderList({
  orders,
  positionSource,
  positionRuleName,
  webhookNames,
}: {
  orders: FuturesOrder[];
  positionSource: FuturesTradeSource;
  positionRuleName: string | null;
  webhookNames: readonly string[];
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
      {orders.map((order) => {
        const origin = resolveOrderOrigin(order, {
          source: positionSource,
          ruleName: positionRuleName,
        });
        const venue = formatFuturesVenueFill(order.venueOrderId);
        return (
          <article
            key={order.id}
            className="rounded-card border border-line bg-surface-raised px-3 py-2.5"
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
            <p className="mt-0.5 text-xs text-ink-muted">
              {formatFuturesOrigin({ ...origin, webhookNames })}
            </p>
            <div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <OrderMetric label="Qty" value={String(order.qty)} />
              <OrderMetric
                label="Price"
                value={formatPrice(order.price)}
              />
              <OrderMetric
                label="Value"
                value={
                  order.notionalUsdt ? formatUsd(order.notionalUsdt) : "—"
                }
              />
              <OrderMetric
                label="Venue"
                value={venue.value}
                title={venue.title}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function formatFuturesVenueFill(venueOrderId: string | null): {
  value: string;
  title?: string;
} {
  if (!venueOrderId) {
    return { value: "Paper" };
  }
  if (venueOrderId.length <= 20) {
    return { value: venueOrderId, title: venueOrderId };
  }
  return {
    value: `${venueOrderId.slice(0, 8)}…`,
    title: venueOrderId,
  };
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
  hint,
  note,
  content,
  raised = false,
}: {
  label: string;
  value: string;
  toneClass?: string;
  hint?: string;
  note?: string;
  content?: ReactNode;
  raised?: boolean;
}) {
  return (
    <div
      className={`rounded-card border border-line p-5 ${
        raised ? "bg-surface-raised" : "bg-surface"
      }`}
    >
      {content ? (
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
            {hint ? <ColumnHint label={label} hint={hint} /> : label}
          </p>
          <div className="mt-3">{content}</div>
          {note ? (
            <p className="mt-2 text-xs text-ink-faint">{note}</p>
          ) : null}
        </div>
      ) : (
        <StatBlock
          label={label}
          value={value}
          toneClass={toneClass}
          hint={hint}
          note={note}
        />
      )}
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
      {note ? <p className="mt-2 text-xs text-ink-faint">{note}</p> : null}
    </div>
  );
}
