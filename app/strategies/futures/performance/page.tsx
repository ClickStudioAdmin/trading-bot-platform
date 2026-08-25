import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { getSessionContext } from "@/lib/auth/session";
import { loadFuturesPositions } from "@/lib/futures/list";
import { futuresClosedStats } from "@/lib/futures/stats";
import {
  formatPct,
  formatSignedUsd,
  signedTone,
} from "@/lib/opportunities/format";
import { formatLocalDateTimeShort } from "@/lib/time/display";

export const metadata: Metadata = {
  title: "Futures performance",
  description: "Closed USDT perpetual positions and realized statistics.",
};

export default async function FuturesPerformancePage() {
  const session = await getSessionContext();
  const signedIn = Boolean(session);
  const closed = await loadFuturesPositions({ status: "closed" });
  const stats = futuresClosedStats(closed);
  const winRate =
    stats.closedCount === 0
      ? "—"
      : `${Math.round((stats.greenCount / stats.closedCount) * 100)}%`;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 pt-6 pb-8">
      <section>
        <PageHeading as="h2" title="Strategy statistics" className="mb-3" />
        {!signedIn ? (
          <p className="mb-3 text-sm text-ink-muted">
            Sign in to see this book’s realized numbers.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-card border border-line bg-surface p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
              Realized P&L
            </p>
            <p
              className={`mt-3 text-2xl font-semibold tracking-tight ${signedTone(signedIn ? stats.realizedUsdt : null)}`}
            >
              {signedIn
                ? stats.realizedPct === null
                  ? formatSignedUsd(stats.realizedUsdt)
                  : `${formatSignedUsd(stats.realizedUsdt)} (${formatPct(stats.realizedPct)})`
                : "—"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 rounded-card border border-line bg-surface p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                Completed trades
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-ink">
                {signedIn ? String(stats.closedCount) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                Win rate
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-ink">
                {signedIn ? winRate : "—"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight">Past positions</h2>
        <p className="text-sm text-ink-muted">
          Closed futures on this book. Realized is mark-to-market at flatten.
        </p>
        <div className="mt-3 overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Contract</th>
                <th className="px-4 py-3 font-medium">Side</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Realized</th>
                <th className="px-4 py-3 font-medium">P&L %</th>
                <th className="px-4 py-3 font-medium">Closed</th>
              </tr>
            </thead>
            <tbody>
              {!signedIn ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-sm text-ink-muted"
                  >
                    <Link href="/sign-in" className="text-accent">
                      Sign in
                    </Link>{" "}
                    to see closed futures.
                  </td>
                </tr>
              ) : closed.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-sm text-ink-muted"
                  >
                    No closed futures yet.
                  </td>
                </tr>
              ) : (
                closed.map((row) => {
                  const pct =
                    row.notionalUsdt > 0
                      ? row.realizedUsdt / row.notionalUsdt
                      : null;
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-line last:border-b-0"
                    >
                      <td className="px-4 py-3 font-medium">{row.symbol}</td>
                      <td className="px-4 py-3 capitalize text-ink-muted">
                        {row.side}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{row.qty}</td>
                      <td
                        className={`px-4 py-3 tabular-nums ${signedTone(row.realizedUsdt)}`}
                      >
                        {formatSignedUsd(row.realizedUsdt)}
                      </td>
                      <td
                        className={`px-4 py-3 tabular-nums ${signedTone(pct)}`}
                      >
                        {formatPct(pct)}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {row.closedAtMs
                          ? formatLocalDateTimeShort(row.closedAtMs)
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
