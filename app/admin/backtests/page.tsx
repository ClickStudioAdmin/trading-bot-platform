import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { BacktestStudyForm } from "@/components/backtest-study-form";
import { requireAdmin } from "@/lib/admin/access";
import { listAllBacktestRuns, listBacktestStudies } from "@/lib/backtest/store";
import { listStudySeedOptions } from "@/lib/backtest/study-seeds";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "Backtests",
  description: "Admin studies and ranked paper replays.",
};

export const maxDuration = 60;

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function AdminBacktestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const selectedId = firstSearchValue(params.run);
  if (selectedId) {
    redirect(`/admin/backtests/${selectedId}`);
  }
  const [seeds, studies, runs] = await Promise.all([
    listStudySeedOptions(),
    listBacktestStudies(80),
    listAllBacktestRuns(200),
  ]);
  const ranked = [...runs]
    .filter((row) => row.status === "done" && row.stats)
    .sort(
      (a, b) => (b.stats?.realizedUsdt ?? 0) - (a.stats?.realizedUsdt ?? 0),
    );

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading overline="Admin" title="Backtests" />
      <p className="mb-6 max-w-2xl text-sm text-ink-muted">
        A study expands a desk bot into every discrete entry trigger,
        timeframe, take profit, and stop on the locked grid. Results are
        grouped so you can rank setups. Single user tests stay on{" "}
        <Link href="/account/backtests" className="text-accent hover:underline">
          account backtests
        </Link>
        .
      </p>

      <section className="mb-8 max-w-xl rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">New study</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Seed from a live desk playbook or Perps bot. Clip size, averaging,
          and contract stay fixed. The search varies starts, timeframes, and
          exits.
        </p>
        <div className="mt-4">
          <BacktestStudyForm seeds={seeds} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Studies</h2>
        {studies.length === 0 ? (
          <p className="text-sm text-ink-muted">No studies yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-ink-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Study</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Contract</th>
                  <th className="py-2 pr-4 font-medium">Scenarios</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {studies.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/admin/backtests/studies/${row.id}`}
                        className="text-accent hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-ink-muted">
                      {row.deskType === "dca" ? "DCA" : "Perps"}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{row.symbol}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {row.scenarioCount}
                    </td>
                    <td className="py-2">{statusLabel(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                  <th className="py-2 pr-4 font-medium">Return</th>
                  <th className="py-2 font-medium">Realized</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/admin/backtests/${row.id}`}
                        className="text-accent hover:underline"
                      >
                        {row.recipe.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{row.symbol}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {row.stats?.trades ?? 0}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {row.stats?.returnPct == null
                        ? "—"
                        : `${(row.stats.returnPct * 100).toFixed(1)}%`}
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
    </main>
  );
}
