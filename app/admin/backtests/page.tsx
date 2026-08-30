import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import {
  BacktestChartButton,
  BacktestStatsGrid,
  RemoveBacktestButton,
} from "@/components/backtest-run-view";
import { requireAdmin } from "@/lib/admin/access";
import { sweepPerpsBacktestFormAction } from "@/lib/backtest/actions";
import { listAllBacktestRuns } from "@/lib/backtest/store";
import { listAllTemplates } from "@/lib/templates/store";
import {
  DEFAULT_STARTING_USDT,
  defaultBacktestDates,
} from "@/lib/backtest/model";
import { firstSearchValue } from "@/lib/paper/open";
import { canBacktestDcaRecipe } from "@/lib/backtest/replay-dca";
import { canBacktestPerpsRecipe } from "@/lib/backtest/replay";

export const metadata: Metadata = {
  title: "Backtests",
  description: "Admin sweeps and ranked paper replays.",
};

export const maxDuration = 60;

export default async function AdminBacktestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const dates = defaultBacktestDates();
  const params = await searchParams;
  const selectedId = firstSearchValue(params.run);
  const [templates, runs] = await Promise.all([
    listAllTemplates(),
    listAllBacktestRuns(200),
  ]);
  const sweepable = templates.filter((row) => {
    if (row.recipe.kind === "dca") {
      return canBacktestDcaRecipe(row.recipe).ok;
    }
    return (
      row.recipe.kind === "perps" && canBacktestPerpsRecipe(row.recipe).ok
    );
  });
  const ranked = [...runs]
    .filter((row) => row.status === "done" && row.stats)
    .sort(
      (a, b) => (b.stats?.realizedUsdt ?? 0) - (a.stats?.realizedUsdt ?? 0),
    );
  const selected = runs.find((row) => row.id === selectedId) ?? ranked[0] ?? null;

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading overline="Admin" title="Backtests" />
      <p className="mb-6 max-w-2xl text-sm text-ink-muted">
        Bounded sweep: one Perps bots or DCA template across up to 10
        contracts. Paper klines only. Rank default is realized.
      </p>

      <section className="mb-8 max-w-xl rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Sweep</h2>
        <form action={sweepPerpsBacktestFormAction} className="mt-4 space-y-3">
          <label className="block text-xs text-ink-muted">
            Template
            <select
              name="templateId"
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
              required
            >
              {sweepable.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.recipe.kind === "dca" ? "DCA" : "Perps"} ·{" "}
                  {row.visibility} · {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-ink-muted">
            Contracts (comma-separated, max 10)
            <input
              name="symbols"
              placeholder="BTCUSDT, ETHUSDT"
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
              required
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-ink-muted">
              Start date
              <input
                type="date"
                name="fromDate"
                required
                defaultValue={dates.from}
                className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="block text-xs text-ink-muted">
              End date
              <input
                type="date"
                name="toDate"
                required
                defaultValue={dates.to}
                className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
              />
            </label>
          </div>
          <label className="block text-xs text-ink-muted">
            Initial account balance
            <input
              name="startingBalance"
              required
              defaultValue={String(DEFAULT_STARTING_USDT)}
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm tabular-nums text-ink"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-ink-muted">
              Venue
              <select
                name="venue"
                className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
              >
                <option value="bybit">Bybit</option>
                <option value="hyperliquid">Hyperliquid</option>
              </select>
            </label>
            <label className="block text-xs text-ink-muted">
              Timeframe
              <select
                name="interval"
                defaultValue="60"
                className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
              >
                <option value="15">15m</option>
                <option value="60">1h</option>
                <option value="240">4h</option>
                <option value="D">Daily</option>
              </select>
            </label>
          </div>
          <input type="hidden" name="feePreset" value="vip0_taker" />
          <button
            type="submit"
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent"
          >
            Run sweep
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Ranked by realized</h2>
        {ranked.length === 0 ? (
          <p className="text-sm text-ink-muted">No finished runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-ink-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Bot</th>
                  <th className="py-2 pr-4 font-medium">Contract</th>
                  <th className="py-2 pr-4 font-medium">Trades</th>
                  <th className="py-2 font-medium">Realized</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/admin/backtests?run=${row.id}`}
                        className="text-accent hover:underline"
                      >
                        {row.recipe.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{row.symbol}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {row.stats?.trades ?? 0}
                    </td>
                    <td className="py-2 tabular-nums">
                      {row.stats?.realizedUsdt.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected ? (
        <section className="mt-8 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight">
              {selected.recipe.name} · {selected.symbol}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {selected.status === "done" ? (
                <BacktestChartButton run={selected} />
              ) : null}
              <RemoveBacktestButton
                runId={selected.id}
                canRemove
                returnTo="/admin/backtests"
              />
            </div>
          </div>
          <BacktestStatsGrid run={selected} />
        </section>
      ) : null}
    </main>
  );
}
