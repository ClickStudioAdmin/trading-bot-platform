import Link from "next/link";
import { RemoveBacktestButton } from "@/components/backtest-run-view";
import {
  backtestAprPct,
  backtestRoePct,
  backtestRunTitle,
  backtestWindowDays,
  formatBacktestReturnPct,
  type BacktestRun,
} from "@/lib/backtest/model";
import { canDeleteBacktestRun } from "@/lib/backtest/store";
import { formatCount, signedTone } from "@/lib/opportunities/format";

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function BacktestRunsTable({
  runs,
  memberId,
  isAdmin,
  primaryRunId,
  returnTo = "/account/backtests",
}: {
  runs: BacktestRun[];
  memberId: string;
  isAdmin: boolean;
  primaryRunId?: string;
  returnTo?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint [&_th]:whitespace-nowrap">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Contract</th>
            <th className="px-4 py-3 font-medium">Backtests</th>
            <th className="px-4 py-3 font-medium">Comps</th>
            <th className="px-4 py-3 font-medium">Days</th>
            <th className="px-4 py-3 font-medium">Win Rate</th>
            <th className="px-4 py-3 font-medium">ROE</th>
            <th className="px-4 py-3 font-medium">APR</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((row) => (
            <BacktestRunRow
              key={row.id}
              row={row}
              memberId={memberId}
              isAdmin={isAdmin}
              isPrimary={row.id === primaryRunId}
              returnTo={returnTo}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BacktestRunRow({
  row,
  memberId,
  isAdmin,
  isPrimary,
  returnTo,
}: {
  row: BacktestRun;
  memberId: string;
  isAdmin: boolean;
  isPrimary: boolean;
  returnTo: string;
}) {
  const href = `/account/backtests/${row.id}`;
  const title = backtestRunTitle(row);
  const days = backtestWindowDays(row.fromMs, row.toMs);
  const winRate =
    row.stats && row.stats.trades > 0
      ? `${Math.round(row.stats.winRate * 100)}%`
      : "—";
  const roe = row.stats
    ? backtestRoePct(row.stats.realizedUsdt, row.orders, row.leverage)
    : null;
  const apr = row.stats
    ? backtestAprPct(
        row.stats.realizedUsdt,
        row.stats.startingUsdt,
        row.fromMs,
        row.toMs,
      )
    : null;
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-4 py-3">
        <span className="inline-flex flex-wrap items-center gap-2">
          <Link href={href} className="text-accent hover:underline">
            {title}
          </Link>
          {isPrimary ? (
            <span className="rounded-control bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-accent">
              Primary Pair
            </span>
          ) : null}
          {row.userId == null ? (
            <span className="text-xs text-ink-faint">published</span>
          ) : null}
        </span>
      </td>
      <td className="px-4 py-3 text-ink-muted">
        {row.deskType === "dca" ? "DCA" : "Perps"}
      </td>
      <td className="px-4 py-3 font-medium tabular-nums">{row.symbol}</td>
      <td className="px-4 py-3">
        <Link
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          Open
        </Link>
      </td>
      <td className="px-4 py-3 text-ink-muted">
        {(row.comparableSymbols ?? []).length > 0
          ? `+${row.comparableSymbols.length}`
          : "—"}
      </td>
      <td className="px-4 py-3 tabular-nums text-ink-muted">
        {days != null ? formatCount(days) : "—"}
      </td>
      <td className="px-4 py-3 tabular-nums">{winRate}</td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(roe)}`}>
        {formatBacktestReturnPct(roe)}
      </td>
      <td className={`px-4 py-3 tabular-nums ${signedTone(apr)}`}>
        {formatBacktestReturnPct(apr)}
      </td>
      <td className="px-4 py-3">{statusLabel(row.status)}</td>
      <td className="px-4 py-3">
        <RemoveBacktestButton
          runId={row.id}
          canRemove={canDeleteBacktestRun(row, memberId, isAdmin)}
          returnTo={returnTo}
          compact
        />
      </td>
    </tr>
  );
}
