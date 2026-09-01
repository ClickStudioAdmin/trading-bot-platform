"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  formatBacktestReturnPct,
  type BacktestLinkHighlight,
} from "@/lib/backtest/model";
import { DCA_INDICATOR_TIMEFRAME_LABELS } from "@/lib/dca/indicators";
import { signedTone } from "@/lib/opportunities/format";
import { formatAuDateUtc } from "@/lib/time/display";

export function BacktestHighlightHover({
  highlight,
  children,
}: {
  highlight: BacktestLinkHighlight;
  children: ReactNode;
}) {
  const [box, setBox] = useState<DOMRect | null>(null);

  return (
    <>
      <span
        onMouseEnter={(event) =>
          setBox(event.currentTarget.getBoundingClientRect())
        }
        onMouseLeave={() => setBox(null)}
      >
        {children}
      </span>
      {box && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-50 w-72 rounded-control border border-line bg-surface-raised px-3 py-2 text-left text-xs font-normal normal-case tracking-normal"
              style={{
                top: box.bottom + 8,
                left: Math.max(12, Math.min(box.left, window.innerWidth - 300)),
              }}
            >
              <BacktestHighlightBody highlight={highlight} />
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

function BacktestHighlightBody({
  highlight,
}: {
  highlight: BacktestLinkHighlight;
}) {
  const winRate =
    highlight.trades > 0 && Number.isFinite(highlight.winRate)
      ? `${(highlight.winRate * 100).toFixed(1)}%`
      : "—";
  return (
    <dl className="space-y-1">
      <HighlightRow
        label="Window"
        value={`${formatAuDateUtc(highlight.fromMs)} – ${formatAuDateUtc(highlight.toMs)}`}
      />
      <HighlightRow
        label="Pair"
        value={`${highlight.symbol} · ${DCA_INDICATOR_TIMEFRAME_LABELS[highlight.interval]}`}
      />
      <HighlightRow
        label="Trades"
        value={String(highlight.trades)}
      />
      <HighlightRow label="Win rate" value={winRate} />
      <HighlightRow
        label="Realized P&L"
        value={signedMoney(highlight.realizedUsdt)}
        toneClass={signedTone(highlight.realizedUsdt)}
      />
      <HighlightRow
        label="P&L"
        value={formatBacktestReturnPct(highlight.onNotionalPct)}
        toneClass={signedTone(highlight.onNotionalPct)}
      />
      <HighlightRow
        label="ROE"
        value={formatBacktestReturnPct(highlight.roePct)}
        toneClass={signedTone(highlight.roePct)}
      />
      <HighlightRow
        label="APR"
        value={formatBacktestReturnPct(highlight.aprPct)}
        toneClass={signedTone(highlight.aprPct)}
      />
    </dl>
  );
}

function HighlightRow({
  label,
  value,
  toneClass,
}: {
  label: string;
  value: string;
  toneClass?: string;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`tabular-nums text-ink ${toneClass ?? ""}`}>{value}</dd>
    </div>
  );
}

function signedMoney(value: number): string {
  const text = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (value > 0) {
    return `+$${text}`;
  }
  if (value < 0) {
    return `−$${text}`;
  }
  return `$${text}`;
}
