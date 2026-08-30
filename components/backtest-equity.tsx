import type { BacktestRun } from "@/lib/backtest/model";
import { buildEquityTimeline } from "@/lib/backtest/study";

export function BacktestEquityPanel({ run }: { run: BacktestRun }) {
  const points = buildEquityTimeline(run);
  if (points.length === 0) {
    return (
      <p className="text-sm text-ink-muted">No account timeline yet.</p>
    );
  }
  const values = points.map((row) => row.equityUsdt);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const width = 640;
  const height = 160;
  const pad = 8;
  const coords = points.map((row, index) => {
    const x =
      points.length === 1
        ? width / 2
        : pad + ((width - pad * 2) * index) / (points.length - 1);
    const y = pad + ((max - row.equityUsdt) / span) * (height - pad * 2);
    return `${x},${y}`;
  });
  const up = (points.at(-1)?.equityUsdt ?? 0) >= run.startingUsdt;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-40 w-full rounded-card border border-line bg-surface"
      role="img"
      aria-label="Account equity over the run"
    >
      <polyline
        fill="none"
        className={up ? "stroke-success" : "stroke-danger"}
        strokeWidth="2"
        points={coords.join(" ")}
      />
    </svg>
  );
}
