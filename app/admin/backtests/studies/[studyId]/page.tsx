import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { RemoveBacktestStudyButton } from "@/components/backtest-run-view";
import { requireAdmin } from "@/lib/admin/access";
import { recipeParamRows } from "@/lib/backtest/study";
import { listBacktestRuns, loadBacktestStudy } from "@/lib/backtest/store";
import { DCA_INDICATOR_TIMEFRAME_LABELS } from "@/lib/dca/indicators";

export const metadata: Metadata = {
  title: "Backtest study",
  description: "Ranked scenarios from one admin study.",
};

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function AdminBacktestStudyPage({
  params,
}: {
  params: Promise<{ studyId: string }>;
}) {
  await requireAdmin();
  const { studyId } = await params;
  const study = await loadBacktestStudy(studyId);
  if (!study) {
    notFound();
  }
  const runs = await listBacktestRuns({ studyId, limit: 200 });
  const ranked = [...runs].sort((a, b) => {
    const left = a.stats?.realizedUsdt ?? Number.NEGATIVE_INFINITY;
    const right = b.stats?.realizedUsdt ?? Number.NEGATIVE_INFINITY;
    return right - left;
  });
  const seedParams = recipeParamRows(study.seedRecipe);

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading
        overline="Admin"
        title={study.name}
        actions={<RemoveBacktestStudyButton studyId={study.id} />}
      />
      <p className="-mt-4 mb-6 text-sm text-ink-muted">
        {study.deskType === "dca" ? "DCA" : "Perps"} · {study.symbol} ·{" "}
        {new Date(study.fromMs).toISOString().slice(0, 10)}–
        {new Date(study.toMs).toISOString().slice(0, 10)} · start{" "}
        {study.startingUsdt.toLocaleString()} · {study.scenarioCount} scenarios
        · {statusLabel(study.status)}
      </p>
      <p className="mb-6 text-sm">
        <Link href="/admin/backtests" className="text-accent hover:underline">
          All studies
        </Link>
      </p>
      {study.error ? (
        <p className="mb-6 text-sm text-danger">{study.error}</p>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Seed bot</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {seedParams.map((row) => (
            <div
              key={row.label}
              className="rounded-card border border-line bg-surface px-4 py-3"
            >
              <dt className="text-xs uppercase tracking-[0.16em] text-ink-muted">
                {row.label}
              </dt>
              <dd className="mt-1 text-sm font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Ranked scenarios</h2>
        {ranked.length === 0 ? (
          <p className="text-sm text-ink-muted">No scenarios saved yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-ink-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Scenario</th>
                  <th className="py-2 pr-4 font-medium">Timeframe</th>
                  <th className="py-2 pr-4 font-medium">Trades</th>
                  <th className="py-2 pr-4 font-medium">Win rate</th>
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
                    <td className="py-2 pr-4 text-ink-muted">
                      {DCA_INDICATOR_TIMEFRAME_LABELS[row.interval]}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {row.stats?.trades ?? "—"}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {row.stats
                        ? `${(row.stats.winRate * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {row.stats?.returnPct == null
                        ? "—"
                        : `${(row.stats.returnPct * 100).toFixed(1)}%`}
                    </td>
                    <td className="py-2 tabular-nums">
                      {row.stats
                        ? row.stats.realizedUsdt.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "—"}
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
