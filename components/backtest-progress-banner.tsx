import {
  backtestProgressLabel,
  type BacktestProgress,
} from "@/lib/backtest/progress";

function StatusDot({ pulse }: { pulse: boolean }) {
  return (
    <span className="relative flex size-2.5 shrink-0" aria-hidden>
      {pulse ? (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
      ) : null}
      <span className="relative inline-flex size-2.5 rounded-full bg-success" />
    </span>
  );
}

export function backtestRunningStatusText(
  progress: BacktestProgress | null,
): string {
  return progress ? `Running · ${progress.percent}%` : "Running";
}

export function BacktestProgressBanner({
  progress,
}: {
  progress: BacktestProgress | null;
}) {
  const label = progress ? backtestProgressLabel(progress) : null;
  return (
    <div
      role="status"
      className="rounded-control border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
    >
      <p className="flex items-center gap-2">
        <StatusDot pulse />
        {label ?? "Running. This page refreshes until it finishes."}
      </p>
      {progress && label ? (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          aria-valuetext={label}
          aria-label={label}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
