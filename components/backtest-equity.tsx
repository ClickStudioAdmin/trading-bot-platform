import type { BacktestRun } from "@/lib/backtest/model";
import { buildEquityTimeline } from "@/lib/backtest/study";

function money(value: number): string {
  const abs = Math.abs(value);
  const text = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-$${text}` : `$${text}`;
}

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
    <div className="space-y-4">
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
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.16em] text-ink-muted">
            <tr>
              <th className="py-2 pr-3 font-medium">Time</th>
              <th className="py-2 pr-3 font-medium">Event</th>
              <th className="py-2 pr-3 font-medium">Equity</th>
              <th className="py-2 font-medium">Realized</th>
            </tr>
          </thead>
          <tbody>
            {points.map((row, index) => (
              <tr key={`${row.atMs}-${index}`} className="border-t border-line">
                <td className="py-2 pr-3 text-ink-muted">
                  {new Date(row.atMs).toLocaleString()}
                </td>
                <td className="py-2 pr-3">{row.label}</td>
                <td className="py-2 pr-3 tabular-nums">{money(row.equityUsdt)}</td>
                <td className="py-2 tabular-nums">{money(row.realizedUsdt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
