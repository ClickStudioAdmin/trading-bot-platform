"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ColumnHint } from "@/components/column-hint";
import { ContainerLoading } from "@/components/container-loading";
import {
  SortTh,
  TableCard,
  TableFilterSession,
  TablePager,
  useClientTable,
} from "@/components/table-chrome";
import { LocalTime } from "@/components/local-time";
import { OpenStats } from "@/components/open-stats";
import { PositionLogList } from "@/components/paper-carry-expand";
import { TokenIcon } from "@/components/token-icon";
import { ExpandableTradeRows, TradeDetailTabs } from "@/components/trade-expand";
import {
  FuturesClosedColumnPicker,
  FuturesOpenColumnPicker,
  useFuturesClosedColumns,
  useFuturesOpenColumns,
} from "@/components/futures-column-picker";
import { FuturesPositionBulkActions } from "@/components/futures-close-all";
import { FuturesCloseActions } from "@/components/futures-close";
import { FuturesSourceCell } from "@/components/futures-source";
import { FuturesTpslCell } from "@/components/futures-tpsl";
import { FuturesTrailingCell } from "@/components/futures-trailing";
import {
  FUTURES_DCA_OPEN_COLUMN_COUNT,
  futuresClosedColumnCount,
  futuresOpenColumnCount,
  type FuturesClosedColumnVisibility,
  type FuturesOpenColumnVisibility,
} from "@/lib/futures/columns";
import type { DcaOpenHint } from "@/lib/dca/playbook";
import { COPY_PAPER_STARTING_USDT } from "@/lib/copy/decide";
import { dcaHintKey } from "@/lib/dca/playbook";
import { formatVenueLabel } from "@/lib/exchanges/connections";
import type { FuturesDeskPosition } from "@/lib/futures/list";
import type { MarkedFutures } from "@/lib/futures/mark";
import { useLiveMarkedOpen } from "@/components/live-ticker";
import { formatLeverage, attachFuturesVenueRisk, type FuturesVenueRisk } from "@/lib/futures/venue-risk";
import {
  loadFuturesPositionFills,
  loadFuturesPositionLogs,
  loadOpenVenueRiskAction,
} from "@/lib/futures/position-fills-action";
import type { EventLogRow } from "@/lib/logs/list";
import type { FuturesOrder, FuturesTradeSource } from "@/lib/futures/model";
import {
  formatFuturesOrigin,
  formatFuturesSourceKind,
  resolveOrderOrigin,
} from "@/lib/futures/source";
import {
  effectiveLeverage,
  annualizeReturnPct,
  bookEquityDrawdown,
  deskPnlPct,
  deskWindowStats,
  flattenExitPrice,
  futuresClosedStats,
  maxRealizedLossUsdt,
  peakConcurrentCapitalUsdt,
  futuresDaysHeld,
  futuresOpenExposure,
  positionMarginUsdt,
  roePct,
} from "@/lib/futures/stats";
import {
  formatCount,
  formatPct,
  formatPrice,
  formatQty,
  formatQtyFull,
  formatSignedUsd,
  formatUsd,
  signedTone,
} from "@/lib/opportunities/format";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import {
  compareTableNum,
  compareTableText,
  type TableSortDir,
} from "@/lib/table-chrome";

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

function sourceSortText(
  source: FuturesTradeSource,
  ruleName: string | null,
  webhookNames: readonly string[],
): string {
  return `${formatFuturesSourceKind(source, ruleName, webhookNames)} ${ruleName ?? ""}`;
}

function compareOpenFutures(
  left: MarkedFutures,
  right: MarkedFutures,
  key: string,
  dir: TableSortDir,
  webhookNames: readonly string[],
): number {
  if (key === "contract") {
    return compareTableText(left.symbol, right.symbol, dir);
  }
  if (key === "source") {
    return compareTableText(
      sourceSortText(left.source, left.ruleName, webhookNames),
      sourceSortText(right.source, right.ruleName, webhookNames),
      dir,
    );
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
    return compareNullableNum(left.mark, right.mark, dir);
  }
  if (key === "unrealized") {
    return compareNullableNum(left.unrealizedUsdt, right.unrealizedUsdt, dir);
  }
  if (key === "pnl") {
    const leftPct =
      left.unrealizedUsdt === null || left.notionalUsdt <= 0
        ? null
        : left.unrealizedUsdt / left.notionalUsdt;
    const rightPct =
      right.unrealizedUsdt === null || right.notionalUsdt <= 0
        ? null
        : right.unrealizedUsdt / right.notionalUsdt;
    return compareNullableNum(leftPct, rightPct, dir);
  }
  if (key === "leverage") {
    return compareNullableNum(left.leverage, right.leverage, dir);
  }
  if (key === "liq") {
    return compareNullableNum(left.liqPrice, right.liqPrice, dir);
  }
  return 0;
}

function compareClosedFutures(
  left: FuturesDeskPosition,
  right: FuturesDeskPosition,
  key: string,
  dir: TableSortDir,
  webhookNames: readonly string[],
  fallbackLeverage: number | null,
): number {
  if (key === "contract") {
    return compareTableText(left.symbol, right.symbol, dir);
  }
  if (key === "source") {
    return compareTableText(
      sourceSortText(left.source, left.ruleName, webhookNames),
      sourceSortText(right.source, right.ruleName, webhookNames),
      dir,
    );
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
    return compareNullableNum(
      flattenExitPrice(left.orders),
      flattenExitPrice(right.orders),
      dir,
    );
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
      roePct(
        left.realizedUsdt,
        positionMarginUsdt(
          left.notionalUsdt,
          effectiveLeverage(left.leverage, fallbackLeverage),
        ),
      ),
      roePct(
        right.realizedUsdt,
        positionMarginUsdt(
          right.notionalUsdt,
          effectiveLeverage(right.leverage, fallbackLeverage),
        ),
      ),
      dir,
    );
  }
  return 0;
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
  toolbarActions,
  filterBar,
  filtersOpen = false,
  closeAllOpenCount,
  deferFills = false,
  deferVenueRisk = false,
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
  toolbarActions?: ReactNode;
  filterBar?: ReactNode;
  filtersOpen?: boolean;
  closeAllOpenCount?: number;
  deferFills?: boolean;
  deferVenueRisk?: boolean;
}) {
  const { visible: storedVisible, setColumn } = useFuturesOpenColumns();
  const visible = hideRowExits
    ? { ...storedVisible, tpsl: false, trailing: false }
    : storedVisible;
  const marked = useLiveMarkedOpen(open);
  const venueRisk = useDeferredVenueRisk(deferVenueRisk);
  const rows = useMemo(
    () => (venueRisk ? attachFuturesVenueRisk(marked, venueRisk) : marked),
    [marked, venueRisk],
  );
  const compare = useCallback(
    (left: MarkedFutures, right: MarkedFutures, key: string, dir: TableSortDir) =>
      compareOpenFutures(left, right, key, dir, webhookNames),
    [webhookNames],
  );
  const table = useClientTable(rows, compare, { defaultKey: "contract" });
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
      <TableFilterSession
        defaultOpen={filtersOpen}
        actions={
          <>
            <FuturesOpenColumnPicker
              visible={visible}
              setColumn={setColumn}
              hiddenColumns={hideRowExits ? ["tpsl", "trailing"] : []}
            />
            {showCloseAll ? (
              <FuturesPositionBulkActions
                next={next}
                signedIn={signedIn}
                openCount={closeAllOpenCount ?? open.length}
                workingCount={workingCount}
                panicOnly={playbookOwnsOrders}
                copyDesk={copyDesk}
              />
            ) : null}
            {toolbarActions}
          </>
        }
      >
        {filterBar}
      </TableFilterSession>
      <TableCard
        className="min-w-0 mt-6"
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
                label="Source"
                active={table.sortKey === "source"}
                dir={table.sortDir}
                onSort={() => table.onSort("source")}
              />
              <SortTh
                label="Side"
                active={table.sortKey === "side"}
                dir={table.sortDir}
                onSort={() => table.onSort("side")}
              />
              {showDcaColumns ? (
                <th className="px-3 py-3 font-medium">
                  <ColumnHint
                    label="Orders"
                    hint="Bot orders filled versus the max. Resting limits are not filled yet."
                  />
                </th>
              ) : null}
              {visible.qty ? (
                <SortTh
                  label="Qty"
                  active={table.sortKey === "qty"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("qty")}
                />
              ) : null}
              {visible.value ? (
                <SortTh
                  label="Value"
                  active={table.sortKey === "value"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("value")}
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
              {visible.mark ? (
                <SortTh
                  label="Mark"
                  active={table.sortKey === "mark"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("mark")}
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
              {visible.leverage ? (
                <SortTh
                  label="Leverage"
                  active={table.sortKey === "leverage"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("leverage")}
                />
              ) : null}
              {visible.liq ? (
                <SortTh
                  label="Liq"
                  active={table.sortKey === "liq"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("liq")}
                />
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
                      ? "Close flattens this side and cancels its bot orders. The bot stays armed. Idle the bot with Close bot on Automations."
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
            ) : table.pageRows.length === 0 ? (
              <EmptyRow
                colSpan={colSpan}
                message={
                  emptyMessage ?? "No open futures. Place an order above."
                }
              />
            ) : (
              table.pageRows.map((trade) => (
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
                  deferFills={deferFills}
                  dcaHint={
                    dcaHints[dcaHintKey(trade.symbol, trade.side)] ?? null
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

export function ClosedFuturesTrades({
  signedIn,
  closed,
  webhookNames = [],
  fallbackLeverage = null,
  filterBar,
  filtersOpen = false,
  emptyMessage,
  deferFills = false,
}: {
  signedIn: boolean;
  closed: FuturesDeskPosition[];
  webhookNames?: readonly string[];
  fallbackLeverage?: number | null;
  filterBar?: ReactNode;
  filtersOpen?: boolean;
  emptyMessage?: ReactNode;
  deferFills?: boolean;
}) {
  const compare = useCallback(
    (
      left: FuturesDeskPosition,
      right: FuturesDeskPosition,
      key: string,
      dir: TableSortDir,
    ) =>
      compareClosedFutures(
        left,
        right,
        key,
        dir,
        webhookNames,
        fallbackLeverage,
      ),
    [fallbackLeverage, webhookNames],
  );
  const table = useClientTable(closed, compare, {
    defaultKey: "closed",
    defaultDir: "desc",
  });
  const { visible, setColumn } = useFuturesClosedColumns();
  const colSpan = futuresClosedColumnCount(visible);
  return (
    <section>
      <SectionHead title="Past Positions" />
      <TableFilterSession
        defaultOpen={filtersOpen}
        actions={
          <FuturesClosedColumnPicker visible={visible} setColumn={setColumn} />
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
                label="Contract"
                active={table.sortKey === "contract"}
                dir={table.sortDir}
                onSort={() => table.onSort("contract")}
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
              {visible.roe ? (
                <SortTh
                  label="ROE"
                  active={table.sortKey === "roe"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("roe")}
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
                    to see closed futures.
                  </>
                }
              />
            ) : table.pageRows.length === 0 ? (
              <EmptyRow
                colSpan={colSpan}
                message={emptyMessage ?? "No closed futures yet."}
              />
            ) : (
              table.pageRows.map((trade) => (
                <ClosedFuturesRows
                  key={trade.id}
                  trade={trade}
                  visible={visible}
                  colSpan={colSpan}
                  webhookNames={webhookNames}
                  fallbackLeverage={fallbackLeverage}
                  deferFills={deferFills}
                />
              ))
            )}
          </tbody>
        </table>
      </TableCard>
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

const LIVE_DRAWDOWN_HINT =
  "Closed-book dollars. Giveback is peak-to-trough of cumulative realized. Max realized loss is the largest losing trade. Not venue wallet equity, and not other desks on a shared key.";
const PAPER_DRAWDOWN_HINT =
  "Peak-to-trough of this paper book (start + realized closes). Percent is versus that peak.";

function drawdownCard(input: {
  signedIn: boolean;
  exchangeBook: boolean;
  empty: boolean;
  givebackUsdt: number;
  worstCloseUsdt: number | null;
  paper: { maxDrawdownUsdt: number; maxDrawdownPct: number | null };
}): DeskStatItem {
  const hint = input.exchangeBook ? LIVE_DRAWDOWN_HINT : PAPER_DRAWDOWN_HINT;
  if (!input.signedIn || input.empty) {
    return { label: "Max Drawdown", value: "—", hint };
  }
  if (input.exchangeBook) {
    const giveback =
      input.givebackUsdt > 0
        ? formatSignedUsd(-input.givebackUsdt)
        : formatSignedUsd(0);
    const worst =
      input.worstCloseUsdt == null
        ? "—"
        : formatSignedUsd(input.worstCloseUsdt);
    return {
      label: "Max Drawdown",
      value: giveback,
      hint,
      content: (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p
              className={`text-2xl font-semibold tracking-tight tabular-nums ${signedTone(-input.givebackUsdt)}`}
            >
              {giveback}
            </p>
            <p className="mt-2 text-hint text-ink-muted">Realized giveback</p>
          </div>
          <div>
            <p
              className={`text-2xl font-semibold tracking-tight tabular-nums ${signedTone(input.worstCloseUsdt)}`}
            >
              {worst}
            </p>
            <p className="mt-2 text-hint text-ink-muted">Max realized loss</p>
          </div>
        </div>
      ),
    };
  }
  const dip = input.paper.maxDrawdownUsdt;
  const pct = input.paper.maxDrawdownPct;
  return {
    label: "Max Drawdown",
    value:
      pct == null
        ? dip > 0
          ? formatSignedUsd(-dip)
          : formatSignedUsd(0)
        : formatPct(pct),
    toneClass: signedTone(dip > 0 ? -dip : 0),
    hint,
    note: dip > 0 ? formatSignedUsd(-dip) : undefined,
  };
}

export function FuturesPerformanceStats({
  signedIn,
  closed,
  extras,
  items: itemsOverride,
  embedded = false,
  fallbackLeverage = null,
  exchangeBook = false,
  paperStartingUsdt = COPY_PAPER_STARTING_USDT,
  openUnrealizedUsdt = null,
  open = [],
  scope,
}: {
  signedIn: boolean;
  closed: FuturesDeskPosition[];
  extras?: DeskStatItem[];
  items?: DeskStatItem[];
  embedded?: boolean;
  fallbackLeverage?: number | null;
  exchangeBook?: boolean;
  paperStartingUsdt?: number;
  openUnrealizedUsdt?: number | null;
  open?: FuturesDeskPosition[];
  scope?: ReactNode;
}) {
  const stats = futuresClosedStats(closed, fallbackLeverage);
  const drawdown = deskWindowStats(closed);
  const pnlPct = deskPnlPct({
    realizedUsdt: stats.realizedUsdt,
    startingUsdt: exchangeBook ? null : paperStartingUsdt,
    capitalUsedUsdt: peakConcurrentCapitalUsdt(
      [...closed, ...open],
      fallbackLeverage,
    ),
  });
  const aprPct = annualizeReturnPct(pnlPct, stats.tradingDays);
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
      label: "Days Trading",
      value:
        signedIn && stats.tradingDays != null
          ? formatCount(stats.tradingDays)
          : "—",
      hint: "Inclusive UTC days from the first closed trade to the last closed trade.",
    },
    {
      label: "Completed Trades",
      value: signedIn ? formatCount(stats.closedCount) : "—",
    },
    {
      label: "Win Rate",
      value: signedIn ? winRate : "—",
    },
    drawdownCard({
      signedIn,
      exchangeBook,
      empty: stats.closedCount === 0,
      givebackUsdt: drawdown.maxDrawdownUsdt,
      worstCloseUsdt: maxRealizedLossUsdt(closed),
      paper: bookEquityDrawdown({
        startingUsdt: paperStartingUsdt,
        closed,
        openUnrealizedUsdt,
      }),
    }),
    {
      label: "Realized Profit",
      value: signedIn ? formatSignedUsd(stats.realizedUsdt) : "—",
      toneClass: signedTone(signedIn ? stats.realizedUsdt : null),
      hint: "Closed-trade dollars. Leverage does not change this amount.",
    },
    {
      label: "P&L",
      value: signedIn && pnlPct != null ? formatPct(pnlPct) : "—",
      toneClass: signedTone(signedIn ? stats.realizedUsdt : null),
      hint: exchangeBook
        ? "Realized profit ÷ peak margin posted at once (position value ÷ leverage, or position value if leverage is unknown)."
        : "Realized profit ÷ paper starting balance.",
      note: exchangeBook ? "Based on capital used" : "Based on starting balance",
    },
    {
      label: "ROE",
      value: signedIn && stats.roePct != null ? formatPct(stats.roePct) : "—",
      toneClass: signedTone(signedIn ? stats.roePct : null),
      hint: roeHint,
      note: "Based on margin requirement",
    },
    {
      label: "APR",
      value: signedIn && aprPct != null ? formatPct(aprPct) : "—",
      toneClass: signedTone(signedIn ? aprPct : null),
      hint: "Compound annualization of P&L over the calendar span of this book (first close to last close). Short windows inflate APR.",
      note: "Annualized P&L",
    },
  ];
  const columns =
    items.length >= 7
      ? "sm:grid-cols-2 xl:grid-cols-4"
      : items.length === 6
        ? "sm:grid-cols-2 xl:grid-cols-3"
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
        action={scope}
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
  deferFills = false,
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
  deferFills?: boolean;
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
        deferFills ? (
          <DeferredPositionFills
            positionId={trade.id}
            positionSource={trade.source}
            positionRuleName={trade.ruleName}
            webhookNames={webhookNames}
          />
        ) : (
          <TradeDetailTabs
            orders={
              <FuturesOrderList
                orders={trade.orders}
                positionSource={trade.source}
                positionRuleName={trade.ruleName}
                webhookNames={webhookNames}
              />
            }
            logs={<DeferredPositionLogs positionId={trade.id} />}
          />
        )
      }
    >
      <td className="min-w-0 px-3 py-3">
        <span className="flex items-start gap-2">
          <TokenIcon symbol={trade.baseCoin} />
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-medium">
              <span>{trade.baseCoin}</span>
            </span>
            <span className="mt-0.5 block truncate text-hint text-ink-muted">
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
          closing={
            trade.status === "closing" || Boolean(dcaHint?.closing)
          }
          copyDesk={copyDesk}
        />
      </td>
    </ExpandableTradeRows>
  );
}

function ClosedFuturesRows({
  trade,
  visible,
  colSpan,
  webhookNames,
  fallbackLeverage,
  deferFills = false,
}: {
  trade: FuturesDeskPosition;
  visible: FuturesClosedColumnVisibility;
  colSpan: number;
  webhookNames: readonly string[];
  fallbackLeverage: number | null;
  deferFills?: boolean;
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
      colSpan={colSpan}
      details={
        deferFills ? (
          <DeferredPositionFills
            positionId={trade.id}
            positionSource={trade.source}
            positionRuleName={trade.ruleName}
            webhookNames={webhookNames}
          />
        ) : (
          <TradeDetailTabs
            orders={
              <FuturesOrderList
                orders={trade.orders}
                positionSource={trade.source}
                positionRuleName={trade.ruleName}
                webhookNames={webhookNames}
              />
            }
            logs={<DeferredPositionLogs positionId={trade.id} />}
          />
        )
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
              className="mt-0.5 block text-hint text-ink-muted"
              title={trade.qty ? formatQtyFull(trade.qty) : undefined}
            >
              {trade.symbol}
              {trade.qty ? ` · ${formatQty(trade.qty)}` : ""}
            </span>
          </span>
        </span>
      </td>
      {visible.source ? (
        <td className="px-4 py-3">
          <FuturesSourceCell
            source={trade.source}
            ruleName={trade.ruleName}
            webhookNames={webhookNames}
          />
        </td>
      ) : null}
      {visible.closed ? (
        <td className="px-4 py-3 text-ink-muted">
          {trade.closedAtMs ? (
            <LocalTime at={trade.closedAtMs} mode="date" />
          ) : (
            "—"
          )}
        </td>
      ) : null}
      {visible.days ? (
        <td className="px-4 py-3 tabular-nums text-ink-muted">
          {held === null ? "—" : held.toFixed(1)}
        </td>
      ) : null}
      {visible.entry ? (
        <td className="px-4 py-3 tabular-nums">{formatPrice(trade.entryPrice)}</td>
      ) : null}
      {visible.exit ? (
        <td className="px-4 py-3 tabular-nums">
          {exit === null ? "—" : formatPrice(exit)}
        </td>
      ) : null}
      {visible.realized ? (
        <td className={`px-4 py-3 tabular-nums ${signedTone(trade.realizedUsdt)}`}>
          {formatSignedUsd(trade.realizedUsdt)}
        </td>
      ) : null}
      {visible.pnl ? (
        <td className={`px-4 py-3 tabular-nums ${signedTone(pnlPct)}`}>
          {formatPct(pnlPct)}
        </td>
      ) : null}
      {visible.roe ? (
        <td className={`px-4 py-3 tabular-nums ${signedTone(roe)}`}>
          {formatPct(roe)}
        </td>
      ) : null}
    </ExpandableTradeRows>
  );
}

function useDeferredVenueRisk(enabled: boolean) {
  const [risk, setRisk] = useState<Map<string, FuturesVenueRisk> | null>(null);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    let dead = false;
    void loadOpenVenueRiskAction()
      .then((record) => {
        if (!dead) {
          setRisk(new Map(Object.entries(record)));
        }
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [enabled]);
  return risk;
}

function DeferredPositionFills({
  positionId,
  positionSource,
  positionRuleName,
  webhookNames,
}: {
  positionId: string;
  positionSource: FuturesTradeSource;
  positionRuleName: string | null;
  webhookNames: readonly string[];
}) {
  const [orders, setOrders] = useState<FuturesOrder[] | null>(null);
  useEffect(() => {
    let dead = false;
    void loadFuturesPositionFills(positionId)
      .then((result) => {
        if (!dead) {
          setOrders(result.orders);
        }
      })
      .catch(() => {
        if (!dead) {
          setOrders([]);
        }
      });
    return () => {
      dead = true;
    };
  }, [positionId]);
  if (!orders) {
    return <ContainerLoading label="Loading orders" />;
  }
  return (
    <TradeDetailTabs
      orders={
        <FuturesOrderList
          orders={orders}
          positionSource={positionSource}
          positionRuleName={positionRuleName}
          webhookNames={webhookNames}
        />
      }
      logs={<DeferredPositionLogs positionId={positionId} />}
    />
  );
}

function DeferredPositionLogs({ positionId }: { positionId: string }) {
  const [logs, setLogs] = useState<EventLogRow[] | null>(null);
  useEffect(() => {
    let dead = false;
    void loadFuturesPositionLogs(positionId)
      .then((result) => {
        if (!dead) {
          setLogs(result);
        }
      })
      .catch(() => {
        if (!dead) {
          setLogs([]);
        }
      });
    return () => {
      dead = true;
    };
  }, [positionId]);
  if (!logs) {
    return <ContainerLoading label="Loading logs" />;
  }
  return <PositionLogList logs={logs} />;
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
        const venue = order.venue ? formatVenueLabel(order.venue) : "Paper";
        return (
          <article
            key={order.id}
            className="rounded-card border border-line bg-surface-raised px-3 py-2.5"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <h3 className="text-lg font-semibold tracking-tight text-ink">
                {order.action === "flatten"
                  ? "Close"
                  : order.action === "sell"
                    ? "Sell"
                    : "Buy"}
              </h3>
              <p className="text-sm text-ink-muted">
                <LocalTime at={order.filledAtMs} />
              </p>
            </header>
            <p className="mt-0.5 text-sm text-ink-muted">
              {formatFuturesOrigin({ ...origin, webhookNames })}
            </p>
            <div className="mt-2 grid min-w-0 grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
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
              <OrderMetric label="Venue" value={venue} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function OrderMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
      <span className="shrink-0 text-xs uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </span>
      <span className="min-w-0 break-all text-right tabular-nums text-ink">
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
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
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
            <p className="mt-2 text-hint text-ink-muted">{note}</p>
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
        className={`mt-3 text-2xl font-semibold tabular-nums tracking-tight ${toneClass ?? "text-ink"}`}
      >
        {value}
      </p>
      {note ? <p className="mt-2 text-hint text-ink-muted">{note}</p> : null}
    </div>
  );
}
