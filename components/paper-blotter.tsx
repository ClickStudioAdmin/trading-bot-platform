import Link from "next/link";
import type { ReactNode } from "react";
import { ColumnHint } from "@/components/column-hint";
import {
  ClosedPaperCarryRows,
  OpenPaperCarryRows,
} from "@/components/paper-carry-expand";
import { TokenIcon } from "@/components/token-icon";
import {
  formatSignedUsd,
  formatUsd,
  signedTone,
} from "@/lib/opportunities/format";
import type { PaperOrderRow } from "@/lib/paper/orders";
import type { PaperReturnPath } from "@/lib/paper/open";
import {
  openExposure,
  paperDeskStats,
  type MarkedPaperCarry,
  type PaperCarryRow,
} from "@/lib/paper/rows";

type OpenCarryView = MarkedPaperCarry & { orders: PaperOrderRow[] };
type ClosedCarryView = PaperCarryRow & { orders: PaperOrderRow[] };

const EXPOSURE_BARS = ["bg-accent", "bg-success", "bg-warning"] as const;

export function OpenPaperTrades({
  signedIn,
  open,
  next = "/strategies/cash-and-carry",
  showHeading = true,
}: {
  signedIn: boolean;
  open: OpenCarryView[];
  next?: PaperReturnPath;
  showHeading?: boolean;
}) {
  return (
    <section>
      {showHeading ? (
        <div className="mb-3 flex items-end justify-between gap-3">
          <SectionHead
            title="Current Positions"
            subtitle="Open paper carries. Unrealized includes open and close fees on both legs. Close is paper only — no Bybit order."
            className=""
          />
          <Link
            href="/strategies/cash-and-carry/positions"
            className="shrink-0 text-sm text-accent hover:text-accent-strong"
          >
            All positions
          </Link>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Details"
                  hint="Paper orders for this carry. Expand to see fills, scan values, and why it opened or closed."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Pair"
                  hint="Long USDT spot and short this dated future. The badge is Manual or Auto. Closing means Unwind or a dynamic exit is still clipping to usable book."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="DTE"
                  hint="Days until this future expires."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Notional"
                  hint="Paper size in USDT. P&L scales with this amount."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Entry basis"
                  hint="Net basis when opened: executable minus VIP0 taker on both legs, 5 bp slip, and delivery (0 on USDT expiry)."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Mark basis"
                  hint="Live scan net basis now. Same formula as the book. Not mid or last."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Unrealized"
                  hint="Dollar P&L after open and close costs: (entry net − mark net − 2 × fees and slip) × notional. The fee model is VIP0 taker on both legs plus 5 bp slip, charged once to open and once to close. Delivery is 0."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="P&L %"
                  hint="Unrealized ÷ notional. All-in percentage of paper size. Not annualized — that is APR on past trades."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Actions"
                  hint="Close flattens the remaining size at the live scan. Unwind (manual only) clips to usable book and stays Closing until flat. No Bybit order."
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {!signedIn ? (
              <EmptyRow
                colSpan={9}
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
                colSpan={9}
                message="No open paper carries. Open one from the book above."
              />
            ) : (
              open.map((trade) => (
                <OpenPaperCarryRows
                  key={trade.id}
                  trade={trade}
                  next={next}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ClosedPaperTrades({
  signedIn,
  closed,
}: {
  signedIn: boolean;
  closed: ClosedCarryView[];
}) {
  return (
    <section>
      <SectionHead
        title="Past Positions"
        subtitle="Closed paper carries. Realized P&L uses the same all-in fee model as unrealized."
      />
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Details"
                  hint="Paper orders for this carry. Expand to see fills, scan values, and why it opened or closed."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Pair"
                  hint="Long USDT spot and short this dated future. The badge is Manual or Auto."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Closed"
                  hint="UTC date this paper carry was closed."
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
                  hint="Net basis when opened, after open fees and slip."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Exit"
                  hint="Live scan net basis at close. Same formula as the book."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Realized"
                  hint="Locked dollar P&L after open and close costs: (entry net − exit net − 2 × fees and slip) × notional."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="P&L %"
                  hint="Realized ÷ notional. All-in percentage of paper size. Same formula as open P&L %."
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {!signedIn ? (
              <EmptyRow
                colSpan={8}
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
                colSpan={8}
                message="No closed paper carries yet."
              />
            ) : (
              closed.map((trade) => (
                <ClosedPaperCarryRows key={trade.id} trade={trade} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PaperDeskStats({
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
          signedIn ? undefined : "Sign in to see your paper desk numbers."
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
