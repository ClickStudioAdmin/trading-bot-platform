"use client";

import Link from "next/link";
import { useCallback, type ReactNode } from "react";
import { ColumnHint } from "@/components/column-hint";
import { IconClose } from "@/components/icons";
import { LocalTime } from "@/components/local-time";
import { PendingStatusChip } from "@/components/pending-status-chip";
import {
  SortTh,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TableActions,
  TableCard,
  TableFilterSession,
  TablePager,
  TablePendingIconAction,
  useClientTable,
} from "@/components/table-chrome";
import {
  FuturesWorkingColumnPicker,
  useFuturesWorkingColumns,
} from "@/components/futures-column-picker";
import { TokenIcon } from "@/components/token-icon";
import { TpslPair } from "@/components/futures-tpsl";
import { FuturesCancelAllOrders } from "@/components/futures-close-all";
import {
  futuresWorkingColumnCount,
  type FuturesWorkingColumnVisibility,
} from "@/lib/futures/columns";
import { FuturesDeskRefresh } from "@/components/futures-desk-refresh";
import { FuturesSourceCell } from "@/components/futures-source";
import { FuturesWorkingEdit } from "@/components/futures-working-edit";
import { cancelFuturesWorking } from "@/lib/futures/actions";
import {
  workingSideLabel,
  sortFuturesWorkingRows,
  workingTypeLabel,
  type FuturesWorkingOrder,
} from "@/lib/futures/working";
import { formatPrice, formatQty, formatQtyFull, formatUsd } from "@/lib/opportunities/format";
import { formatFuturesSourceKind } from "@/lib/futures/source";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import {
  compareTableNum,
  compareTableText,
  type TableSortDir,
} from "@/lib/table-chrome";

export function FuturesWorkingOrders({
  signedIn,
  working,
  next = FUTURES_PATHS.positions,
  exchangeBook = false,
  baseCoins,
  webhookNames = [],
  emptyMessage,
  playbookOwnsOrders = false,
  copyDesk = false,
  exchangeName = "Bybit",
  urgentRefresh = false,
  filterBar,
  filtersOpen = false,
  cancelAllCount,
}: {
  signedIn: boolean;
  working: FuturesWorkingOrder[];
  next?: string;
  exchangeBook?: boolean;
  baseCoins: Record<string, string>;
  webhookNames?: readonly string[];
  emptyMessage?: ReactNode;
  playbookOwnsOrders?: boolean;
  copyDesk?: boolean;
  exchangeName?: string;
  urgentRefresh?: boolean;
  filterBar?: ReactNode;
  filtersOpen?: boolean;
  cancelAllCount?: number;
}) {
  const showOrderMeta = !playbookOwnsOrders;
  const { visible: storedVisible, setColumn } = useFuturesWorkingColumns();
  const visible = showOrderMeta
    ? storedVisible
    : { ...storedVisible, tpsl: false, trailing: false };
  const colSpan = futuresWorkingColumnCount(
    visible,
    showOrderMeta ? 1 : 0,
  );
  const rows = sortFuturesWorkingRows(working);
  const compare = useCallback(
    (
      left: FuturesWorkingOrder,
      right: FuturesWorkingOrder,
      key: string,
      dir: TableSortDir,
    ) => {
      if (key === "contract") {
        return compareTableText(left.symbol, right.symbol, dir);
      }
      if (key === "source") {
        return compareTableText(
          `${formatFuturesSourceKind(left.source, left.ruleName, webhookNames)} ${left.ruleName ?? ""}`,
          `${formatFuturesSourceKind(right.source, right.ruleName, webhookNames)} ${right.ruleName ?? ""}`,
          dir,
        );
      }
      if (key === "side") {
        return compareTableText(left.action, right.action, dir);
      }
      if (key === "type") {
        return compareTableText(workingTypeLabel(left), workingTypeLabel(right), dir);
      }
      if (key === "qty") {
        return compareTableNum(left.remainingQty, right.remainingQty, dir);
      }
      if (key === "limit") {
        return compareTableNum(left.limitPrice, right.limitPrice, dir);
      }
      if (key === "value") {
        return compareTableNum(
          left.remainingQty * left.limitPrice,
          right.remainingQty * right.limitPrice,
          dir,
        );
      }
      if (key === "time") {
        return compareTableNum(left.createdAtMs, right.createdAtMs, dir);
      }
      return 0;
    },
    [webhookNames],
  );
  const table = useClientTable(rows, compare);
  const urgent =
    urgentRefresh ||
    working.some((row) => row.status === "cancelling");
  return (
    <section>
      <FuturesDeskRefresh urgent={urgent} />
      <div className="mb-3">
        <h2 className="text-xl font-semibold tracking-tight text-ink">
          Open orders{" "}
          <span className="text-base font-semibold">({rows.length})</span>
        </h2>
      </div>
      <TableFilterSession
        defaultOpen={filtersOpen}
        actions={
          <>
            <FuturesWorkingColumnPicker
              visible={visible}
              setColumn={setColumn}
              hiddenColumns={showOrderMeta ? [] : ["tpsl", "trailing"]}
            />
            {showOrderMeta && working.length > 0 ? (
              <FuturesCancelAllOrders
                next={next}
                signedIn={signedIn}
                workingCount={cancelAllCount ?? working.length}
              />
            ) : null}
          </>
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
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
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
              {visible.side ? (
                <SortTh
                  label="Side"
                  active={table.sortKey === "side"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("side")}
                />
              ) : null}
              {visible.type ? (
                <SortTh
                  label="Type"
                  active={table.sortKey === "type"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("type")}
                />
              ) : null}
              {visible.qty ? (
                <SortTh
                  label="Qty"
                  active={table.sortKey === "qty"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("qty")}
                />
              ) : null}
              {visible.limit ? (
                <SortTh
                  label="Limit"
                  active={table.sortKey === "limit"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("limit")}
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
              {visible.time ? (
                <SortTh
                  label="Open Time"
                  active={table.sortKey === "time"}
                  dir={table.sortDir}
                  onSort={() => table.onSort("time")}
                />
              ) : null}
              {visible.tpsl ? (
                <th className="px-4 py-3 font-medium">
                  <ColumnHint
                    label="TP/SL"
                    hint="Stops attached when this limit was placed. They move onto the position when it fills."
                  />
                </th>
              ) : null}
              {visible.trailing ? (
                <th className="px-4 py-3 font-medium">
                  <ColumnHint
                    label="Trailing"
                    hint="Retracement attached when this limit was placed. It moves onto the position when it fills."
                  />
                </th>
              ) : null}
              {showOrderMeta ? (
                <th className={TABLE_ACTIONS_TH_CLASS}>
                  <ColumnHint
                    label="Actions"
                    hint={
                      exchangeBook
                        ? "Edit remaining qty or limit on Bybit, or cancel the rest."
                        : "Edit remaining qty or limit, or cancel this paper order. No Bybit order."
                    }
                  />
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {!signedIn ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-6 text-sm text-ink-muted">
                  <Link href="/sign-in" className="text-accent">
                    Sign in
                  </Link>{" "}
                  to place limits and watch them here.
                </td>
              </tr>
            ) : table.pageRows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-6 text-sm text-ink-muted">
                  {emptyMessage ??
                    "No working limits. Choose Limit on Place an order, or Limit on an open row."}
                </td>
              </tr>
            ) : (
              table.pageRows.map((row) => (
                <WorkingRow
                  key={row.id}
                  row={row}
                  next={next}
                  baseCoin={
                    baseCoins[row.symbol] ??
                    (row.symbol.replace(/USDT$|USDC$/i, "") || row.symbol)
                  }
                  webhookNames={webhookNames}
                  showOrderMeta={showOrderMeta}
                  visible={visible}
                />
              ))
            )}
          </tbody>
        </table>
      </TableCard>
    </section>
  );
}

function WorkingRow({
  row,
  next,
  baseCoin,
  webhookNames,
  showOrderMeta,
  visible,
}: {
  row: FuturesWorkingOrder;
  next: string;
  baseCoin: string;
  webhookNames: readonly string[];
  showOrderMeta: boolean;
  visible: FuturesWorkingColumnVisibility;
}) {
  const remainingNotional = row.remainingQty * row.limitPrice;
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-4 py-3">
        <span className="flex items-start gap-4">
          <TokenIcon symbol={baseCoin} />
          <span className="min-w-0">
            <span className="block font-medium">{baseCoin}</span>
            <p className="mt-0.5 text-hint text-ink-faint">{row.symbol}</p>
          </span>
        </span>
      </td>
      {visible.source ? (
        <td className="px-4 py-3">
          <FuturesSourceCell
            source={row.source}
            ruleName={row.ruleName}
            webhookNames={webhookNames}
          />
        </td>
      ) : null}
      {visible.side ? (
        <td
          className={`px-4 py-3 ${
            row.action === "sell" ? "text-danger" : "text-success"
          }`}
        >
          {workingSideLabel(row.action)}
        </td>
      ) : null}
      {visible.type ? (
        <td className="px-4 py-3">
          <span className="flex flex-wrap items-center gap-2">
            {workingTypeLabel(row)}
            {!showOrderMeta && row.status === "cancelling" ? (
              <PendingStatusChip
                label="Cancelling"
                hint="Cancel submitted. This order leaves when the venue confirms."
              />
            ) : null}
          </span>
        </td>
      ) : null}
      {visible.qty ? (
        <td className="px-4 py-3 tabular-nums">
          <span title={formatQtyFull(row.remainingQty)}>
            {formatQty(row.remainingQty)}
          </span>
          {row.filledQty > 0 ? (
            <span
              className="block text-hint text-ink-faint"
              title={formatQtyFull(row.filledQty)}
            >
              {formatQty(row.filledQty)} filled
            </span>
          ) : null}
        </td>
      ) : null}
      {visible.limit ? (
        <td className="px-4 py-3 tabular-nums">{formatPrice(row.limitPrice)}</td>
      ) : null}
      {visible.value ? (
        <td className="px-4 py-3 tabular-nums">{formatUsd(remainingNotional)}</td>
      ) : null}
      {visible.time ? (
        <td className="px-4 py-3 text-ink-muted">
          <LocalTime at={row.createdAtMs} />
        </td>
      ) : null}
      {visible.tpsl ? (
        <td className="px-4 py-3">
          {row.takeProfit === null && row.stopLoss === null ? (
            <span className="text-ink-faint">—</span>
          ) : (
            <TpslPair
              takeProfit={row.takeProfit}
              stopLoss={row.stopLoss}
              mode={row.tpslMode}
              tpOrderType={row.tpOrderType}
              slOrderType={row.slOrderType}
            />
          )}
        </td>
      ) : null}
      {visible.trailing ? (
        <td className="px-4 py-3">
          {row.trailingStop === null ? (
            <span className="text-ink-faint">—</span>
          ) : (
            <span className="tabular-nums">{formatPrice(row.trailingStop)}</span>
          )}
        </td>
      ) : null}
      {showOrderMeta ? (
        <td className={TABLE_ACTIONS_TD_CLASS}>
          {row.status === "cancelling" ? (
            <PendingStatusChip
              label="Cancelling"
              hint="Cancel submitted. This order leaves when the venue confirms."
            />
          ) : (
            <TableActions>
              <FuturesWorkingEdit
                workingId={row.id}
                symbol={row.symbol}
                action={row.action}
                reduceOnly={row.reduceOnly}
                remainingQty={row.remainingQty}
                filledQty={row.filledQty}
                limitPrice={row.limitPrice}
                next={next}
              />
              <form action={cancelFuturesWorking}>
                <input type="hidden" name="next" value={next} />
                <input type="hidden" name="workingId" value={row.id} />
                <TablePendingIconAction
                  pendingLabel="Cancelling"
                  successKey={`working-cancel-${row.id}`}
                  label="Cancel"
                  detail="Cancel the remaining size."
                >
                  <IconClose {...TABLE_BTN_ICON} />
                </TablePendingIconAction>
              </form>
            </TableActions>
          )}
        </td>
      ) : null}
    </tr>
  );
}
