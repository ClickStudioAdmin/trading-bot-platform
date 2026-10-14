"use client";

import {
  formatBacktestReturnPct,
  type BacktestLinkHighlight,
} from "@/lib/backtest/model";
import { DCA_INDICATOR_TIMEFRAME_LABELS } from "@/lib/dca/indicators";
import { signedTone } from "@/lib/opportunities/format";
import { formatAuDateUtc } from "@/lib/time/display";

export function BacktestHighlightBody({
  highlight,
}: {
  highlight: BacktestLinkHighlight;
}) {
  const winRate =
    highlight.trades > 0 && Number.isFinite(highlight.winRate)
      ? `${(highlight.winRate * 100).toFixed(1)}%`
      : "—";
  return (
    <dl className="space-y-1 text-sm">
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
        value={formatBacktestReturnPct(highlight.returnPct)}
        toneClass={signedTone(highlight.returnPct)}
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
      <dt className="text-xs uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </dt>
      <dd className={`text-sm tabular-nums text-ink ${toneClass ?? ""}`}>{value}</dd>
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
