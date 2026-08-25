import Link from "next/link";
import type { ReactNode } from "react";
import { ColumnHint } from "@/components/column-hint";
import {
  ClosedPaperCarryRows,
  OpenPaperCarryRows,
} from "@/components/paper-carry-expand";
import { TokenIcon } from "@/components/token-icon";
import {
  formatPct,
  formatSignedUsd,
  formatUsd,
  signedTone,
} from "@/lib/opportunities/format";
import type { EventLogRow } from "@/lib/logs/list";
import type { PaperOrderRow } from "@/lib/paper/orders";
import type { PaperReturnPath } from "@/lib/paper/open";
import {
  openExposure,
  paperDeskStats,
  type MarkedPaperCarry,
  type PaperCarryRow,
} from "@/lib/paper/rows";

type OpenCarryView = MarkedPaperCarry & {
  orders: PaperOrderRow[];
  logs: EventLogRow[];
};
type ClosedCarryView = PaperCarryRow & {
  orders: PaperOrderRow[];
  logs: EventLogRow[];
};

const EXPOSURE_BARS = ["bg-accent", "bg-success", "bg-warning"] as const;

export function OpenPaperTrades({
  signedIn,
  open,
  next = "/strategies/cash-and-carry",
  showHeading = true,
  exchangeBook = false,
}: {
  signedIn: boolean;
  open: OpenCarryView[];
  next?: PaperReturnPath;
  showHeading?: boolean;
  exchangeBook?: boolean;
}) {
  return (
    <section>
      {showHeading ? (
        <div className="mb-3 flex items-end justify-between gap-3">
          <SectionHead
            title="Current Positions"
            subtitle={
              exchangeBook
                ? "Open cash-and-carry on the bound exchange. Close exits both Bybit legs."
                : "Open paper carries. Unrealized includes open and close fees on both legs. Close is paper only — no Bybit order."
            }
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
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Details"
                  hint={
                    exchangeBook
                      ? "Expand for orders and the event log for this position."
                      : "Expand for paper orders and the event log for this position."
                  }
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
                  label="DTE"
                  hint="Days until this future expires."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Notional"
                  hint={
                    exchangeBook
                      ? "Open size in USDT. P&L scales with this amount."
                      : "Paper size in USDT. P&L scales with this amount."
                  }
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Entry basis"
                  hint="Size-weighted average fill basis of the open clips. Connected Exchange: gross from fill prices. Paper: scan net (fill equals the scan)."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Mark basis"
                  hint="Current scan for this pair, not mid or last. Connected Exchange: scan basis (gross), same unit as fill. Paper: net basis after assumed fees."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Net APR"
                  hint="Scan net basis × 365 / DTE. After assumed fees and slip. Same figure as Opportunities — not computed from Entry or Mark fill. Used to rank pairs and for mark APR exits."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Unrealized"
                  hint="(entry − mark − 2 × assumed fees and slip) × notional. Cost model is VIP0 taker on both legs plus 5 bp slip, counted once to open and once to close — not Bybit’s invoice. Connected Exchange: entry is fill, mark is scan. Paper: both are net."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="P&L %"
                  hint="Unrealized ÷ notional. Same assumed fee model as Unrealized. Not annualized."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Actions"
                  hint={
                    exchangeBook
                      ? "Manual Close exits both Bybit legs at market. Auto Close uses that set’s exit order type. Unwind clips to usable book on the exchange."
                      : "Manual Close exits remaining size at the live scan. Auto Close uses only that set’s exit order type — Fixed closes remaining size, Dynamic clips to usable book. It does not wait for APR, DTE, take profit, or stop loss. Unwind is manual only. After an exit is submitted, Close is replaced by Closing. No Bybit order."
                  }
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
                    to open paper carries and see them here.
                  </>
                }
              />
            ) : open.length === 0 ? (
              <EmptyRow
                colSpan={10}
                message={
                  exchangeBook
                    ? "No open carries. Open one from Opportunities."
                    : "No open paper carries. Open one from the book above."
                }
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
                  hint="Expand for orders and the event log for this position."
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
                  hint="Local date this carry was closed. Hover for UTC."
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
                  hint="Size-weighted average fill basis of the open clips. Connected Exchange: gross from fill prices. Paper: scan net (fill equals the scan)."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Exit"
                  hint="Scan net basis at close (after assumed fees). Same net figure as the Opportunities book."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Realized"
                  hint="(entry − exit − 2 × assumed fees and slip) × notional. Same cost model as Unrealized. Exit is scan net. Not Bybit’s actual invoice."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="P&L %"
                  hint="Realized ÷ notional. Same assumed fee model as Realized."
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

export function PaperPerformanceStats({
  signedIn,
  closed,
}: {
  signedIn: boolean;
  closed: PaperCarryRow[];
}) {
  const stats = paperDeskStats([], closed);
  const winRate =
    stats.closedCount === 0
      ? "—"
      : `${Math.round((stats.greenCount / stats.closedCount) * 100)}%`;

  return (
    <section>
      <SectionHead
        title="Strategy statistics"
        subtitle={
          signedIn ? undefined : "Sign in to see your paper desk numbers."
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Realized P&L"
          value={
            signedIn
              ? stats.realizedPct === null
                ? formatSignedUsd(stats.realizedUsdt)
                : `${formatSignedUsd(stats.realizedUsdt)} (${formatPct(stats.realizedPct)})`
              : "—"
          }
          toneClass={signedTone(signedIn ? stats.realizedUsdt : null)}
        />
        <div className="grid grid-cols-2 gap-6 rounded-card border border-line bg-surface p-5">
          <StatBlock
            label="Completed Trades"
            value={signedIn ? String(stats.closedCount) : "—"}
          />
          <StatBlock
            label="Win Rate"
            value={signedIn ? winRate : "—"}
          />
        </div>
      </div>
    </section>
  );
}

export function PaperOpenStats({
  signedIn,
  open,
}: {
  signedIn: boolean;
  open: MarkedPaperCarry[];
}) {
  const stats = paperDeskStats(open, []);
  const exposure = openExposure(open);

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      <div className="rounded-card border border-line bg-surface p-5">
        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
          Open exposure
        </p>
        {signedIn && exposure.length > 0 ? (
          <>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface-raised">
              {exposure.map((slice, index) => (
                <span
                  key={slice.baseCoin}
                  className={EXPOSURE_BARS[index % EXPOSURE_BARS.length]}
                  style={{ width: `${slice.share * 100}%` }}
                />
              ))}
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
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
          <p className="mt-3 text-sm text-ink-muted">
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
      <StatBlock label={label} value={value} toneClass={toneClass} />
    </div>
  );
}

function StatBlock({
  label,
  value,
  toneClass,
}: {
  label: string;
  value: string;
  toneClass?: string;
}) {
  return (
    <div>
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
