import Link from "next/link";
import type { ReactNode } from "react";
import { TokenIcon } from "@/components/token-icon";
import {
  formatPct,
  formatSignedUsd,
  formatUsd,
  signedTone,
} from "@/lib/opportunities/format";
import { closeOpenPaperCarry } from "@/lib/paper/actions";
import {
  formatDeskDate,
  openExposure,
  paperDeskStats,
  type MarkedPaperCarry,
  type PaperCarryRow,
} from "@/lib/paper/rows";

const EXPOSURE_BARS = ["bg-accent", "bg-success", "bg-warning"] as const;

export function PaperBlotter({
  signedIn,
  open,
  closed,
}: {
  signedIn: boolean;
  open: MarkedPaperCarry[];
  closed: PaperCarryRow[];
}) {
  return (
    <>
      <OpenPaperTrades signedIn={signedIn} open={open} />
      <ClosedPaperTrades signedIn={signedIn} closed={closed} />
      <PaperDeskStats signedIn={signedIn} open={open} closed={closed} />
    </>
  );
}

function OpenPaperTrades({
  signedIn,
  open,
}: {
  signedIn: boolean;
  open: MarkedPaperCarry[];
}) {
  return (
    <section>
      <SectionHead
        title="Current trades"
        subtitle="Open paper carries. Marks are the live scan net basis. Close is paper only — no Bybit order."
      />
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Pair</th>
              <th className="px-4 py-3 font-medium">Notional</th>
              <th className="px-4 py-3 font-medium">Entry basis</th>
              <th className="px-4 py-3 font-medium">Mark basis</th>
              <th className="px-4 py-3 font-medium">Unrealized</th>
              <th className="px-4 py-3 font-medium">DTE</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {!signedIn ? (
              <EmptyRow
                colSpan={7}
                message={
                  <>
                    <Link href="/sign-in" className="text-accent">
                      Sign in
                    </Link>{" "}
                    to open paper carries and see them here.
                  </>
                }
              />
            ) : open.length === 0 ? (
              <EmptyRow
                colSpan={7}
                message="No open paper carries. Open one from the book above."
              />
            ) : (
              open.map((trade) => (
                <tr
                  key={trade.id}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 font-medium">
                      <TokenIcon symbol={trade.baseCoin} />
                      {trade.baseCoin}
                    </span>
                    <span className="mt-0.5 block pl-7 text-xs text-ink-faint">
                      Long spot · short {trade.futureSymbol}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-muted">
                    {formatUsd(trade.notionalUsdt)}
                  </td>
                  <td
                    className={`px-4 py-3 tabular-nums ${signedTone(trade.entryBasis)}`}
                  >
                    {formatPct(trade.entryBasis)}
                  </td>
                  <td
                    className={`px-4 py-3 tabular-nums ${signedTone(trade.markBasis)}`}
                  >
                    {formatPct(trade.markBasis)}
                  </td>
                  <td
                    className={`px-4 py-3 tabular-nums ${signedTone(trade.unrealizedUsdt)}`}
                  >
                    {trade.unrealizedUsdt === null
                      ? "—"
                      : formatSignedUsd(trade.unrealizedUsdt)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-muted">
                    {trade.daysToExpiry === null
                      ? "—"
                      : trade.daysToExpiry.toFixed(1)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-control bg-success/15 px-2 py-0.5 text-xs text-success">
                        Open
                      </span>
                      <ClosePaperButton trade={trade} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ClosedPaperTrades({
  signedIn,
  closed,
}: {
  signedIn: boolean;
  closed: PaperCarryRow[];
}) {
  return (
    <section>
      <SectionHead
        title="Past trades"
        subtitle="Closed paper carries. Realized P&L is the change in net basis."
      />
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Pair</th>
              <th className="px-4 py-3 font-medium">Closed</th>
              <th className="px-4 py-3 font-medium">Days held</th>
              <th className="px-4 py-3 font-medium">Entry</th>
              <th className="px-4 py-3 font-medium">Exit</th>
              <th className="px-4 py-3 font-medium">Realized</th>
              <th className="px-4 py-3 font-medium">APR</th>
            </tr>
          </thead>
          <tbody>
            {!signedIn ? (
              <EmptyRow
                colSpan={7}
                message={
                  <>
                    <Link href="/sign-in" className="text-accent">
                      Sign in
                    </Link>{" "}
                    to see closed paper carries.
                  </>
                }
              />
            ) : closed.length === 0 ? (
              <EmptyRow
                colSpan={7}
                message="No closed paper carries yet."
              />
            ) : (
              closed.map((trade) => (
                <tr
                  key={trade.id}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 font-medium">
                      <TokenIcon symbol={trade.baseCoin} />
                      {trade.baseCoin}
                    </span>
                    <span className="mt-0.5 block pl-7 text-xs text-ink-faint">
                      {trade.futureSymbol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {formatDeskDate(trade.closedAtMs)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-muted">
                    {trade.daysHeld === null ? "—" : trade.daysHeld.toFixed(1)}
                  </td>
                  <td
                    className={`px-4 py-3 tabular-nums ${signedTone(trade.entryBasis)}`}
                  >
                    {formatPct(trade.entryBasis)}
                  </td>
                  <td
                    className={`px-4 py-3 tabular-nums ${signedTone(trade.exitBasis)}`}
                  >
                    {formatPct(trade.exitBasis)}
                  </td>
                  <td
                    className={`px-4 py-3 tabular-nums ${signedTone(trade.realizedUsdt)}`}
                  >
                    {trade.realizedUsdt === null
                      ? "—"
                      : formatSignedUsd(trade.realizedUsdt)}
                  </td>
                  <td
                    className={`px-4 py-3 tabular-nums ${signedTone(trade.realizedApr)}`}
                  >
                    {formatPct(trade.realizedApr)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PaperDeskStats({
  signedIn,
  open,
  closed,
}: {
  signedIn: boolean;
  open: MarkedPaperCarry[];
  closed: PaperCarryRow[];
}) {
  const stats = paperDeskStats(open, closed);
  const exposure = openExposure(open);
  const closedMix =
    stats.closedCount === 0
      ? "0"
      : `${stats.closedCount} · ${Math.round((stats.greenCount / stats.closedCount) * 100)}% green`;

  return (
    <section>
      <SectionHead
        title="Strategy statistics"
        subtitle={
          signedIn
            ? "Your paper desk. Marks from the live scan."
            : "Sign in to see your paper desk numbers."
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open notional"
          value={
            signedIn && stats.openNotionalUsdt > 0
              ? formatUsd(stats.openNotionalUsdt)
              : "—"
          }
        />
        <StatCard
          label="Unrealized P&L"
          value={
            signedIn && stats.unrealizedUsdt !== null
              ? formatSignedUsd(stats.unrealizedUsdt)
              : "—"
          }
          toneClass={signedTone(signedIn ? stats.unrealizedUsdt : null)}
        />
        <StatCard
          label="Realized P&L"
          value={signedIn ? formatSignedUsd(stats.realizedUsdt) : "—"}
          toneClass={signedTone(signedIn ? stats.realizedUsdt : null)}
        />
        <StatCard label="Closed trades" value={signedIn ? closedMix : "—"} />
      </div>
      <div className="mt-4 rounded-card border border-line bg-surface p-6">
        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
          Open exposure
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">
          {signedIn && stats.openNotionalUsdt > 0
            ? formatUsd(stats.openNotionalUsdt)
            : "—"}
        </p>
        {signedIn && exposure.length > 0 ? (
          <>
            <div className="mt-6 flex h-2 overflow-hidden rounded-full bg-surface-raised">
              {exposure.map((slice, index) => (
                <span
                  key={slice.baseCoin}
                  className={EXPOSURE_BARS[index % EXPOSURE_BARS.length]}
                  style={{ width: `${slice.share * 100}%` }}
                />
              ))}
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {exposure.map((slice) => (
                <li
                  key={slice.baseCoin}
                  className="flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <TokenIcon symbol={slice.baseCoin} />
                    {slice.baseCoin}
                  </span>
                  <span className="tabular-nums text-ink-muted">
                    {formatUsd(slice.notionalUsdt)} ·{" "}
                    {(slice.share * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">
            {signedIn ? "No open exposure." : "Sign in to see exposure."}
          </p>
        )}
      </div>
    </section>
  );
}

function ClosePaperButton({ trade }: { trade: MarkedPaperCarry }) {
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
      <input type="hidden" name="next" value="/strategies/cash-and-carry" />
      <button
        type="submit"
        className="rounded-control border border-line bg-surface-raised px-2.5 py-1 text-xs font-medium text-ink"
      >
        Close
      </button>
    </form>
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
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-ink-muted">{subtitle}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  toneClass,
}: {
  label: string;
  value: string;
  toneClass?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <p
        className={`mt-3 text-2xl font-semibold tracking-tight ${toneClass ?? "text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}
