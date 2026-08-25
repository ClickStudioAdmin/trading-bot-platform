import Link from "next/link";
import { ColumnHint } from "@/components/column-hint";
import { LocalTime } from "@/components/local-time";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { TokenIcon } from "@/components/token-icon";
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
      <div className="mb-3">
        <h2 className="text-xl font-semibold tracking-tight">Open orders</h2>
        <p className="text-sm text-ink-muted">
          {exchangeBook
            ? "Working limits on Bybit. Fills appear on the position when they match. Cancel removes the rest."
            : "Working paper limits. They fill when mark crosses the limit. Cancel drops the rest."}
        </p>
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
                <ColumnHint label="Side" hint="Buy opens or adds a long. Sell opens or adds a short." />
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
                  label="Notional"
                  hint="Remaining qty × limit."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Working since"
                  hint="Local time this limit was placed. Hover for UTC."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Actions"
                  hint={
                    exchangeBook
                      ? "Cancel this order on Bybit."
                      : "Cancel this paper order. No Bybit order."
                  }
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {!signedIn ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-sm text-ink-muted">
                  <Link href="/sign-in" className="text-accent">
                    Sign in
                  </Link>{" "}
                  to place limits and watch them here.
                </td>
              </tr>
            ) : working.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-sm text-ink-muted">
                  No working limits. Choose Limit on Place an order.
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
        <span className="flex flex-wrap items-center gap-2 font-medium">
          <TokenIcon symbol={baseCoin} />
          {baseCoin}
        </span>
        <p className="text-xs text-ink-faint">{row.symbol}</p>
      </td>
      <td className="px-4 py-3">{workingActionLabel(row.action)}</td>
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
      </td>
    </tr>
  );
}
