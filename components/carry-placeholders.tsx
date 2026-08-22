import type { ReactNode } from "react";
import { TokenIcon } from "@/components/token-icon";
import {
  formatPct,
  formatSignedUsd,
  formatUsd,
  signedTone,
} from "@/lib/opportunities/format";

const OPEN_TRADES = [
  {
    baseCoin: "BTC",
    futureSymbol: "BTCUSDT-26DEC25",
    notionalUsdt: 50_000,
    entryBasis: 0.0182,
    markBasis: 0.0164,
    unrealizedUsdt: 412,
    daysToExpiry: 126.4,
  },
  {
    baseCoin: "ETH",
    futureSymbol: "ETHUSDT-26SEP25",
    notionalUsdt: 25_000,
    entryBasis: 0.0091,
    markBasis: 0.0105,
    unrealizedUsdt: -87,
    daysToExpiry: 34.2,
  },
  {
    baseCoin: "SOL",
    futureSymbol: "SOLUSDT-27MAR26",
    notionalUsdt: 12_000,
    entryBasis: 0.021,
    markBasis: 0.0188,
    unrealizedUsdt: 156,
    daysToExpiry: 216.1,
  },
] as const;

const CLOSED_TRADES = [
  {
    baseCoin: "XRP",
    futureSymbol: "XRPUSDT-25JUL26",
    closedOn: "12 Aug 2026",
    heldDays: 21,
    entryBasis: 0.0044,
    exitBasis: 0.0012,
    realizedUsdt: 186,
    realizedApr: 0.128,
  },
  {
    baseCoin: "DOGE",
    futureSymbol: "DOGEUSDT-25JUL26",
    closedOn: "3 Aug 2026",
    heldDays: 14,
    entryBasis: 0.0061,
    exitBasis: 0.0055,
    realizedUsdt: 42,
    realizedApr: 0.081,
  },
  {
    baseCoin: "BTC",
    futureSymbol: "BTCUSDT-26JUN26",
    closedOn: "28 Jul 2026",
    heldDays: 45,
    entryBasis: 0.012,
    exitBasis: -0.001,
    realizedUsdt: 890,
    realizedApr: 0.144,
  },
  {
    baseCoin: "ETH",
    futureSymbol: "ETHUSDT-26JUN26",
    closedOn: "11 Jul 2026",
    heldDays: 8,
    entryBasis: 0.0022,
    exitBasis: 0.0041,
    realizedUsdt: -64,
    realizedApr: -0.292,
  },
] as const;

const EXPOSURE = [
  { baseCoin: "BTC", share: 0.57, barClass: "bg-accent" },
  { baseCoin: "ETH", share: 0.29, barClass: "bg-success" },
  { baseCoin: "SOL", share: 0.14, barClass: "bg-warning" },
] as const;

const OPEN_NOTIONAL = OPEN_TRADES.reduce(
  (sum, trade) => sum + trade.notionalUsdt,
  0,
);
const UNREALIZED = OPEN_TRADES.reduce(
  (sum, trade) => sum + trade.unrealizedUsdt,
  0,
);
const REALIZED_30D = CLOSED_TRADES.reduce(
  (sum, trade) => sum + trade.realizedUsdt,
  0,
);

export function PlaceholderBadge() {
  return (
    <span className="rounded-control border border-line bg-surface-raised px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-ink-faint">
      Placeholder
    </span>
  );
}

export function PlaceholderTradeStats() {
  return (
    <section>
      <SectionHead
        title="Strategy statistics"
        subtitle="Sample desk numbers so the layout is visible. Not live P&L."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open notional" value={formatUsd(OPEN_NOTIONAL)} />
        <StatCard
          label="Unrealized P&L"
          value={formatSignedUsd(UNREALIZED)}
          toneClass={signedTone(UNREALIZED)}
        />
        <StatCard
          label="Realized (sample)"
          value={formatSignedUsd(REALIZED_30D)}
          toneClass={signedTone(REALIZED_30D)}
        />
        <StatCard label="Closed trades" value="4 · 75% green" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                Realized P&L
              </p>
              <p className={`mt-2 text-2xl font-semibold ${signedTone(REALIZED_30D)}`}>
                {formatSignedUsd(REALIZED_30D)}
              </p>
            </div>
            <PlaceholderBadge />
          </div>
          <svg
            viewBox="0 0 400 120"
            className="mt-6 h-28 w-full"
            role="img"
            aria-label="Placeholder realized P and L chart"
          >
            <defs>
              <linearGradient id="carry-pnl" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-success)"
                  stopOpacity="0.35"
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-success)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            <path
              d="M0 88 L40 84 L80 90 L120 70 L160 74 L200 52 L240 58 L280 40 L320 46 L360 28 L400 32 L400 120 L0 120 Z"
              fill="url(#carry-pnl)"
            />
            <path
              d="M0 88 L40 84 L80 90 L120 70 L160 74 L200 52 L240 58 L280 40 L320 46 L360 28 L400 32"
              fill="none"
              stroke="var(--color-success)"
              strokeWidth="2"
            />
          </svg>
        </div>
        <div className="rounded-card border border-line bg-surface p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
              Open exposure
            </p>
            <PlaceholderBadge />
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight">
            {formatUsd(OPEN_NOTIONAL)}
          </p>
          <div className="mt-6 flex h-2 overflow-hidden rounded-full bg-surface-raised">
            {EXPOSURE.map((slice) => (
              <span
                key={slice.baseCoin}
                className={slice.barClass}
                style={{ width: `${slice.share * 100}%` }}
              />
            ))}
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {EXPOSURE.map((slice) => (
              <li
                key={slice.baseCoin}
                className="flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <TokenIcon symbol={slice.baseCoin} />
                  {slice.baseCoin}
                </span>
                <span className="tabular-nums text-ink-muted">
                  {(slice.share * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function PlaceholderOpenTrades() {
  return (
    <section>
      <SectionHead
        title="Current trades"
        subtitle="Open cash-and-carry legs. Sample rows for layout only."
        extra={<PlaceholderBadge />}
      />
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[52rem] text-left text-sm">
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
            {OPEN_TRADES.map((trade) => (
              <tr
                key={trade.futureSymbol}
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
                  {formatSignedUsd(trade.unrealizedUsdt)}
                </td>
                <td className="px-4 py-3 tabular-nums text-ink-muted">
                  {trade.daysToExpiry.toFixed(1)}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-control bg-success/15 px-2 py-0.5 text-xs text-success">
                    Open
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PlaceholderClosedTrades() {
  return (
    <section>
      <SectionHead
        title="Past trades"
        subtitle="Closed carries and realized basis. Sample rows for layout only."
        extra={<PlaceholderBadge />}
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
            {CLOSED_TRADES.map((trade) => (
              <tr
                key={`${trade.futureSymbol}-${trade.closedOn}`}
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
                <td className="px-4 py-3 text-ink-muted">{trade.closedOn}</td>
                <td className="px-4 py-3 tabular-nums text-ink-muted">
                  {trade.heldDays}
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
                  {formatSignedUsd(trade.realizedUsdt)}
                </td>
                <td
                  className={`px-4 py-3 tabular-nums ${signedTone(trade.realizedApr)}`}
                >
                  {formatPct(trade.realizedApr)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SectionHead({
  title,
  subtitle,
  extra,
}: {
  title: string;
  subtitle: string;
  extra?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-ink-muted">{subtitle}</p>
      </div>
      {extra}
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
