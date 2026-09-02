"use client";

import {
  backtestChartFetchBounds,
  backtestChartIntervalChoices,
  backtestChartIntervalFits,
  type BacktestRun,
} from "@/lib/backtest/model";
import {
  DCA_INDICATOR_TIMEFRAME_LABELS,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";

export function BacktestChartIntervalBar({
  run,
  interval,
  onChange,
}: {
  run: BacktestRun;
  interval: DcaIndicatorTimeframe;
  onChange: (value: DcaIndicatorTimeframe) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Chart timeframe">
      {backtestChartIntervalChoices(run.interval).map((row) => {
        const bounds = backtestChartFetchBounds(run, row);
        const fits = backtestChartIntervalFits(
          bounds.fromMs,
          bounds.toMs,
          row,
        );
        const selected = interval === row;
        return (
          <button
            key={row}
            type="button"
            disabled={!fits}
            title={
              fits
                ? undefined
                : "That window is too long for this timeframe."
            }
            onClick={() => onChange(row)}
            className={`rounded-control px-2 py-1 text-xs ${
              selected
                ? "bg-accent-strong text-ink"
                : fits
                  ? "border border-line text-ink-muted hover:text-ink"
                  : "border border-line text-ink-faint opacity-40"
            }`}
          >
            {DCA_INDICATOR_TIMEFRAME_LABELS[row]}
          </button>
        );
      })}
    </div>
  );
}
