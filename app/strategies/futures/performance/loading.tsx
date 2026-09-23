import { ContainerLoading } from "@/components/container-loading";
import { TableCard } from "@/components/table-chrome";

const STATS = [
  "Days Trading",
  "Completed Trades",
  "Win Rate",
  "Max Drawdown",
  "Realized Profit",
  "P&L",
  "ROE",
  "APR",
];

export default function FuturesPerformanceLoading() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 pt-6 pb-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Desk Statistics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STATS.map((label) => (
            <div
              key={label}
              className="rounded-card border border-line bg-surface p-5"
            >
              <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                {label}
              </p>
              <div className="mt-3 flex h-8 items-center">
                <ContainerLoading />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Past Positions
        </h2>
        <TableCard className="mt-0">
          <div className="px-5 py-8">
            <ContainerLoading label="Loading positions" />
          </div>
        </TableCard>
      </section>
    </main>
  );
}
