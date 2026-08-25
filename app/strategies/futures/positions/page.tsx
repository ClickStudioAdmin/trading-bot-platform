import type { Metadata } from "next";
import { FuturesFlash } from "@/components/futures-flash";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getSessionContext } from "@/lib/auth/session";
import { fetchBybitTickers } from "@/lib/exchanges/bybit/client";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { submitFuturesTrade } from "@/lib/futures/actions";
import { loadFuturesPositions } from "@/lib/futures/list";
import { futuresPnlUsdt, markFromTicker } from "@/lib/futures/math";
import { loadFuturesSettings } from "@/lib/futures/settings";
import {
  formatPrice,
  formatSignedUsd,
  signedTone,
} from "@/lib/opportunities/format";
import { firstSearchValue } from "@/lib/paper/open";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { formatLocalDateTimeShort } from "@/lib/time/display";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Futures positions",
  description: "Open USDT perpetual positions.",
};

const NEXT = FUTURES_PATHS.positions;

export default async function FuturesPositionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const params = await searchParams;
  const open = await loadFuturesPositions({ status: "open" });
  const closed = (await loadFuturesPositions({ status: "closed" })).slice(0, 8);
  const settings = await loadFuturesSettings(session.account.id);
  const live = accountCanHoldConnections(session.account.mode);
  let tickers = new Map<
    string,
    { lastPrice?: string; bid1Price?: string; ask1Price?: string }
  >();
  try {
    tickers = await fetchBybitTickers("linear");
  } catch {
    tickers = new Map();
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Positions" />
      <FuturesFlash
        opened={firstSearchValue(params.paper) === "opened"}
        added={firstSearchValue(params.paper) === "added"}
        closed={firstSearchValue(params.paper) === "closed"}
        liveOpened={firstSearchValue(params.paper) === "live-opened"}
        liveAdded={firstSearchValue(params.paper) === "live-added"}
        liveClosed={firstSearchValue(params.paper) === "live-closed"}
        error={firstSearchValue(params.paperError)}
      />

      <section className="rounded-card border border-line bg-surface p-5">
        <h3 className="text-sm font-medium text-ink">Place an order</h3>
        <p className="mt-1 text-sm text-ink-muted">
          USDT linear perpetual. Buy opens or adds a long. Sell opens or adds
          a short. Flatten closes the open row. No flip in one click.
          {settings.reduceOnly
            ? " Reduce only is on — Buy and Sell are blocked."
            : ""}
        </p>
        <form action={submitFuturesTrade} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="next" value={NEXT} />
          <label className="block text-sm text-ink">
            Symbol
            <input
              name="symbol"
              defaultValue="BTCUSDT"
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm uppercase text-ink focus:border-line-strong focus:outline-none"
            />
          </label>
          <label className="block text-sm text-ink">
            Qty
            <input
              name="qty"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.001"
              className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <PendingSubmitButton
              pendingLabel="Buying…"
              successKey="futures-buy"
              name="action"
              value="buy"
              className="rounded-control bg-accent-strong px-3 py-2 text-xs font-medium text-ink"
            >
              Buy
            </PendingSubmitButton>
            <PendingSubmitButton
              pendingLabel="Selling…"
              successKey="futures-sell"
              name="action"
              value="sell"
              className="rounded-control border border-line bg-surface-raised px-3 py-2 text-xs font-medium text-ink"
            >
              Sell
            </PendingSubmitButton>
            <PendingSubmitButton
              pendingLabel="Flattening…"
              successKey="futures-flatten"
              name="action"
              value="flatten"
              className="rounded-control border border-line px-3 py-2 text-xs font-medium text-ink-muted"
            >
              Flatten
            </PendingSubmitButton>
          </div>
        </form>
        {live && !settings.connectionId ? (
          <p className="mt-3 text-xs text-warning">
            Bind an exchange in Strategy Settings before these buttons place
            venue orders.
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="mb-3 text-xl font-semibold tracking-tight">Open</h3>
        {open.length === 0 ? (
          <p className="rounded-card border border-line bg-surface p-5 text-sm text-ink-muted">
            No open futures on this book.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
                <tr>
                  <th className="px-4 py-3 font-medium">Contract</th>
                  <th className="px-4 py-3 font-medium">Side</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Entry</th>
                  <th className="px-4 py-3 font-medium">Mark</th>
                  <th className="px-4 py-3 font-medium">Unrealized</th>
                  <th className="px-4 py-3 text-right font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {open.map((row) => {
                  const mark = markFromTicker(tickers.get(row.symbol) ?? {});
                  const pnl =
                    mark === null
                      ? null
                      : futuresPnlUsdt({
                          side: row.side,
                          qty: row.qty,
                          entryPrice: row.entryPrice,
                          exitPrice: mark,
                        });
                  return (
                    <tr key={row.id} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-3 font-medium">{row.symbol}</td>
                      <td className="px-4 py-3 capitalize text-ink-muted">
                        {row.side}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{row.qty}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatPrice(row.entryPrice)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatPrice(mark)}
                      </td>
                      <td
                        className={`px-4 py-3 tabular-nums ${signedTone(pnl)}`}
                      >
                        {pnl === null ? "—" : formatSignedUsd(pnl)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <form action={submitFuturesTrade}>
                          <input type="hidden" name="next" value={NEXT} />
                          <input type="hidden" name="symbol" value={row.symbol} />
                          <PendingSubmitButton
                            pendingLabel="Flattening…"
                            successKey={`flatten-${row.id}`}
                            name="action"
                            value="flatten"
                            className="rounded-control border border-line px-3 py-1.5 text-xs font-medium text-ink-muted"
                          >
                            Flatten
                          </PendingSubmitButton>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {closed.length > 0 ? (
        <section>
          <h3 className="mb-3 text-xl font-semibold tracking-tight">
            Recently closed
          </h3>
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
                <tr>
                  <th className="px-4 py-3 font-medium">Contract</th>
                  <th className="px-4 py-3 font-medium">Side</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Realized</th>
                  <th className="px-4 py-3 font-medium">Closed</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-3">{row.symbol}</td>
                    <td className="px-4 py-3 capitalize text-ink-muted">
                      {row.side}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.qty}</td>
                    <td
                      className={`px-4 py-3 tabular-nums ${signedTone(row.realizedUsdt)}`}
                    >
                      {formatSignedUsd(row.realizedUsdt)}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {row.closedAtMs
                        ? formatLocalDateTimeShort(row.closedAtMs)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
