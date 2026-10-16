import type {
  BacktestProgress,
  BacktestProgressStage,
} from "@/lib/backtest/progress";

function StageMark({ state }: { state: BacktestProgressStage["state"] }) {
  if (state === "done") {
    return (
      <span
        className="flex size-4 shrink-0 items-center justify-center rounded-full bg-success text-canvas"
        aria-hidden
      >
        <svg viewBox="0 0 16 16" className="size-3" fill="none">
          <path
            d="M3.5 8.2 6.4 11.1 12.5 4.8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="relative flex size-4 shrink-0 items-center justify-center" aria-hidden>
        <span className="absolute size-2.5 animate-ping rounded-full bg-success opacity-60" />
        <span className="relative size-2.5 rounded-full bg-success" />
      </span>
    );
  }
  return (
    <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden>
      <span className="size-2.5 rounded-full border border-line-strong" />
    </span>
  );
}

function StageRow({ stage }: { stage: BacktestProgressStage }) {
  const waiting = stage.state === "waiting";
  const label = `${stage.label}. ${stage.detail} (${stage.percent}%).`;
  return (
    <li>
      <div className="flex items-center justify-between gap-3">
        <p
          className={`flex min-w-0 items-center gap-2 text-sm ${
            waiting ? "text-ink-faint" : "font-medium text-ink"
          }`}
        >
          <StageMark state={stage.state} />
          <span className="truncate">{stage.label}</span>
        </p>
        <p
          className={`shrink-0 text-sm tabular-nums ${
            waiting ? "text-ink-faint" : "text-ink"
          }`}
        >
          {waiting ? "—" : `${stage.percent}%`}
        </p>
      </div>
      <p className={`mt-1 pl-6 text-hint ${waiting ? "text-ink-faint" : "text-ink-muted"}`}>
        {stage.detail}
      </p>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={stage.percent}
        aria-valuetext={label}
        aria-label={stage.label}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${
            stage.state === "done" ? "bg-success" : "bg-accent"
          }`}
          style={{ width: `${stage.percent}%` }}
        />
      </div>
    </li>
  );
}

export function backtestRunningStatusText(
  progress: BacktestProgress | null,
): string {
  return progress ? progress.headline : "Running";
}

export function BacktestProgressBanner({
  progress,
}: {
  progress: BacktestProgress | null;
}) {
  if (!progress) {
    return (
      <div
        role="status"
        className="rounded-control border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
      >
        <p>Running. This page refreshes until it finishes.</p>
      </div>
    );
  }
  return (
    <div
      role="status"
      className="rounded-control border border-success/30 bg-success/10 px-3 py-3"
    >
      <ol className="space-y-3">
        {progress.stages.map((stage) => (
          <StageRow key={stage.id} stage={stage} />
        ))}
      </ol>
    </div>
  );
}
