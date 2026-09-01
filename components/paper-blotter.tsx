"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ColumnHint } from "@/components/column-hint";
import {
  PaperOpenColumnPicker,
  usePaperOpenColumns,
} from "@/components/paper-column-picker";
import {
  ClosedPaperCarryRows,
  OpenPaperCarryRows,
} from "@/components/paper-carry-expand";
import { OpenStats } from "@/components/open-stats";
import {
  formatPct,
  formatSignedUsd,
  formatUsd,
  signedTone,
} from "@/lib/opportunities/format";
import type { EventLogRow } from "@/lib/logs/list";
import type { PaperOrderRow } from "@/lib/paper/orders";
import { paperOpenColumnCount } from "@/lib/paper/columns";
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

export function OpenPaperTrades({
  signedIn,
  open,
  next = "/strategies/cash-and-carry",
  showHeading = true,
  exchangeBook = false,
  positionsHref = "/strategies/cash-and-carry/positions",
  opportunitiesHref = "/strategies/cash-and-carry/opportunities",
}: {
  signedIn: boolean;
  open: OpenCarryView[];
  next?: string;
  showHeading?: boolean;
  exchangeBook?: boolean;
  positionsHref?: string;
  opportunitiesHref?: string;
}) {
  const { visible, setColumn } = usePaperOpenColumns();
  const colSpan = paperOpenColumnCount(visible);

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
            href={positionsHref}
            className="shrink-0 text-sm text-accent hover:text-accent-strong"
          >
            All positions
          </Link>
        </div>
      ) : null}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <PaperOpenColumnPicker visible={visible} setColumn={setColumn} />
      </div>
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
                  hint="Long USDT spot and short this dated future."
                />
              </th>
              <th className="w-28 px-4 py-3 font-medium">
                <ColumnHint
                  label="Source"
                  hint="Manual is a desk click. Auto is a bot. The name is the bot that opened this row. Click the name on an open Auto row to see copied rules and edit that trade’s exits."
                />
              </th>
              {visible.dte ? (
                <th className="px-4 py-3 font-medium">
                  <ColumnHint
                    label="DTE"
                    hint="Days until this future expires."
                  />
                </th>
              ) : null}
              {visible.value ? (
                <th className="px-4 py-3 font-medium">
                  <ColumnHint
                    label="Order Value"
                    hint={
                      exchangeBook
                        ? "Open size in USDT. P&L scales with this amount."
                        : "Paper size in USDT. P&L scales with this amount."
                    }
                  />
                </th>
              ) : null}
              {visible.entry ? (
                <th className="px-4 py-3 font-medium">
                  <ColumnHint
                    label="Entry basis"
                    hint="Size-weighted average fill basis of the open clips. Connected Exchange: gross from fill prices. Paper: scan net (fill equals the scan)."
                  />
                </th>
              ) : null}
              {visible.mark ? (
                <th className="px-4 py-3 font-medium">
                  <ColumnHint
                    label="Mark basis"
                    hint="Current scan for this pair, not mid or last. Connected Exchange: scan basis (gross), same unit as fill. Paper: net basis after assumed fees."
                  />
                </th>
              ) : null}
              {visible.apr ? (
                <th className="px-4 py-3 font-medium">
                  <ColumnHint
                    label="Net APR"
                    hint="Scan net basis × 365 / DTE. After assumed fees and slip. Same figure as Opportunities — not computed from Entry or Mark fill. Used to rank pairs and for mark APR exits."
                  />
                </th>
              ) : null}
              {visible.unrealized ? (
                <th className="px-4 py-3 font-medium">
                  <ColumnHint
                    label="Unrealized"
                    hint="(entry − mark − 2 × assumed fees and slip) × value. Cost model is VIP0 taker on both legs plus 5 bp slip, counted once to open and once to close — not Bybit’s invoice. Connected Exchange: entry is fill, mark is scan. Paper: both are net."
                  />
                </th>
              ) : null}
              {visible.pnl ? (
                <th className="px-4 py-3 font-medium">
                  <ColumnHint
                    label="P&L %"
                    hint="Unrealized ÷ value. Same assumed fee model as Unrealized. Not annualized."
                  />
                </th>
              ) : null}
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="Close By"
                  hint={
                    exchangeBook
                      ? "Manual Close exits both Bybit legs at market. Auto Close uses that bot’s exit order type. Unwind clips to usable book on the exchange."
                      : "Manual Close exits remaining size at the live scan. Auto Close uses only that bot’s exit order type — Fixed closes remaining size, Dynamic clips to usable book. It does not wait for APR, DTE, take profit, or stop loss. Unwind is manual only. After an exit is submitted, Close is replaced by Closing. No Bybit order."
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
                    to open paper carries and see them here.
                  </>
                }
              />
            ) : open.length === 0 ? (
              <EmptyRow
                colSpan={colSpan}
                message={
                  <>
                    {exchangeBook
                      ? "No open carries. Open one from "
                      : "No open paper carries. Open one from "}
                    <Link href={opportunitiesHref} className="text-accent">
                      Opportunities
                    </Link>
                    .
                  </>
                }
              />
            ) : (
              open.map((trade) => (
                <OpenPaperCarryRows
                  key={trade.id}
                  trade={trade}
                  next={next}
                  visible={visible}
                  colSpan={colSpan}
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
                  hint="Long USDT spot and short this dated future."
                />
              </th>
              <th className="w-28 px-4 py-3 font-medium">
                <ColumnHint
                  label="Source"
                  hint="Manual is a desk click. Auto is a bot. The name is the bot that opened this row. In / Out is whether the open and close were Manual or System."
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
                  hint="(entry − exit − 2 × assumed fees and slip) × value. Same cost model as Unrealized. Exit is scan net. Not Bybit’s actual invoice."
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <ColumnHint
                  label="P&L %"
                  hint="Realized ÷ position value. Same assumed fee model as Realized."
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
                    to see closed paper carries.
                  </>
                }
              />
            ) : closed.length === 0 ? (
              <EmptyRow
                colSpan={9}
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
        title="Desk Statistics"
        subtitle={
          signedIn ? undefined : "Sign in to see your paper desk numbers."
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Completed Trades"
          value={signedIn ? String(stats.closedCount) : "—"}
        />
        <StatCard
          label="Win Rate"
          value={signedIn ? winRate : "—"}
        />
        <StatCard
          label="Realized Profit"
          value={signedIn ? formatSignedUsd(stats.realizedUsdt) : "—"}
          toneClass={signedTone(signedIn ? stats.realizedUsdt : null)}
          hint="Closed-carry dollars."
        />
        <StatCard
          label="P&L"
          value={
            signedIn && stats.realizedPct != null
              ? formatPct(stats.realizedPct)
              : "—"
          }
          toneClass={signedTone(signedIn ? stats.realizedUsdt : null)}
          hint="Realized profit ÷ sum of closed carry value."
          note="Based on position value"
        />
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
  return (
    <OpenStats
      signedIn={signedIn}
      notional={stats.openNotionalUsdt}
      unrealized={stats.unrealizedUsdt}
      exposure={openExposure(open)}
    />
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
    <div className="rounded-card border border-line bg-surface p-5">
      <StatBlock
        label={label}
        value={value}
        toneClass={toneClass}
        hint={hint}
        note={note}
      />
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
        className={`mt-3 text-2xl font-semibold tracking-tight ${toneClass ?? "text-ink"}`}
      >
        {value}
      </p>
      {note ? <p className="mt-2 text-xs text-ink-faint">{note}</p> : null}
    </div>
  );
}
