import Link from "next/link";
import { ColumnHint } from "@/components/column-hint";
import { LocalTime } from "@/components/local-time";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { TokenIcon } from "@/components/token-icon";
import { TpslPair } from "@/components/futures-tpsl";
import { FuturesCancelAllOrders } from "@/components/futures-close-all";
import { FuturesWorkingEdit } from "@/components/futures-working-edit";
import { cancelFuturesWorking } from "@/lib/futures/actions";
import {
  workingActionLabel,
  type FuturesWorkingOrder,
} from "@/lib/futures/working";
import { formatPrice, formatUsd } from "@/lib/opportunities/format";
import { FUTURES_PATHS } from "@/lib/strategies/registry";

const ACTION_CLASS =
  "rounded-control bg-accent-strong px-2.5 py-1 text-xs font-medium whitespace-nowrap text-ink";

export function FuturesWorkingOrders({
  signedIn,
  working,
  next = FUTURES_PATHS.positions,
  exchangeBook = false,
  baseCoinFor,
}: {
  signedIn: boolean;
  working: FuturesWorkingOrder[];
  next?: string;
  exchangeBook?: boolean;
  baseCoinFor: (symbol: string) => string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Open orders</h2>
          <p className="text-sm text-ink-muted">
            {exchangeBook
              ? "Working limits on Bybit. Fills appear on the position when they match. Edit remaining qty or limit. Cancel removes the rest."
              : "Working paper limits. They fill when mark crosses the limit. Edit remaining qty or limit. Cancel drops the rest."}
          </p>
        </div>
        <div className="shrink-0">
          <FuturesCancelAllOrders
            next={next}
            signedIn={signedIn}
            workingCount={working.length}
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Contract"
                  hint="USDT linear perpetual this limit is working on."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Side"
                  hint="Buy opens or adds a long. Sell opens or adds a short. Close is a reduce-only limit on an open row."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint label="Qty" hint="Original size. Filled is how much has matched so far." />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Limit"
                  hint="GTC limit price. Size in USDT used this price, not mark."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Order Value"
                  hint="Remaining qty × limit."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Open Time"
                  hint="Local time this limit was placed. Hover for UTC."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="TP/SL"
                  hint="Stops attached when this limit was placed. They move onto the position when it fills."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Trailing"
                  hint="Retracement attached when this limit was placed. It moves onto the position when it fills."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Actions"
                  hint={
                    exchangeBook
                      ? "Edit remaining qty or limit on Bybit, or cancel the rest."
                      : "Edit remaining qty or limit, or cancel this paper order. No Bybit order."
                  }
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {!signedIn ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-sm text-ink-muted">
                  <Link href="/sign-in" className="text-accent">
                    Sign in
                  </Link>{" "}
                  to place limits and watch them here.
                </td>
              </tr>
            ) : working.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-sm text-ink-muted">
                  No working limits. Choose Limit on Place an order, or Limit on an open row.
                </td>
              </tr>
            ) : (
              working.map((row) => (
                <WorkingRow
                  key={row.id}
                  row={row}
                  next={next}
                  baseCoin={baseCoinFor(row.symbol)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WorkingRow({
  row,
  next,
  baseCoin,
}: {
  row: FuturesWorkingOrder;
  next: string;
  baseCoin: string;
}) {
  const remainingNotional = row.remainingQty * row.limitPrice;
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-4 py-3">
        <span className="flex items-start gap-4">
          <TokenIcon symbol={baseCoin} />
          <span className="min-w-0">
            <span className="block font-medium">{baseCoin}</span>
            <p className="mt-0.5 text-xs text-ink-faint">{row.symbol}</p>
          </span>
        </span>
      </td>
      <td className="px-4 py-3">
        {workingActionLabel(row.action, row.reduceOnly)}
      </td>
      <td className="px-4 py-3 tabular-nums">
        {row.remainingQty}
        {row.filledQty > 0 ? (
          <span className="block text-xs text-ink-faint">
            {row.filledQty} filled
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 tabular-nums">{formatPrice(row.limitPrice)}</td>
      <td className="px-4 py-3 tabular-nums">{formatUsd(remainingNotional)}</td>
      <td className="px-4 py-3 text-ink-muted">
        <LocalTime at={row.createdAtMs} />
      </td>
      <td className="px-4 py-3">
        {row.takeProfit === null && row.stopLoss === null ? (
          <span className="text-ink-faint">—</span>
        ) : (
          <TpslPair
            takeProfit={row.takeProfit}
            stopLoss={row.stopLoss}
            mode={row.tpslMode}
          />
        )}
      </td>
      <td className="px-4 py-3">
        {row.trailingStop === null ? (
          <span className="text-ink-faint">—</span>
        ) : (
          <span className="tabular-nums">{formatPrice(row.trailingStop)}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <ColumnHint
            hint="Change remaining qty or limit"
            label={
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
            }
          />
          <form action={cancelFuturesWorking}>
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="workingId" value={row.id} />
            <ColumnHint
              hint="Cancel remaining size"
              label={
                <PendingSubmitButton
                  pendingLabel="Cancelling"
                  successKey={`working-cancel-${row.id}`}
                  className={ACTION_CLASS}
                >
                  Cancel
                </PendingSubmitButton>
              }
            />
          </form>
        </div>
      </td>
    </tr>
  );
}
