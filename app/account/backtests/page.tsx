import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { toBacktestLibraryItem } from "@/components/backtest-dialog";
import { BacktestQueueForm } from "@/components/backtest-queue-form";
import {
  ApplyBacktestButton,
  BacktestChartButton,
  BacktestOrdersTable,
  BacktestStatsGrid,
  PublishBacktestButton,
  RemoveBacktestButton,
} from "@/components/backtest-run-view";
import { listTradingAccounts } from "@/lib/accounts/store";
import { deskAllowsPerpsRecipes } from "@/lib/accounts/model";
import { getSessionMember } from "@/lib/auth/session";
import { memberIsAdmin } from "@/lib/admin/access";
import {
  canDeleteBacktestRun,
  canReadBacktestRun,
  listBacktestRuns,
  loadBacktestRun,
} from "@/lib/backtest/store";
import { BACKTEST_FEE_PRESETS } from "@/lib/backtest/model";
import { canBacktestDcaRecipe } from "@/lib/backtest/replay-dca";
import { canBacktestPerpsRecipe } from "@/lib/backtest/replay";
import { firstSearchValue } from "@/lib/paper/open";
import { DCA_INDICATOR_TIMEFRAME_LABELS } from "@/lib/dca/indicators";
import { listApplyableTemplates } from "@/lib/templates/store";

export const metadata: Metadata = {
  title: "Backtests",
  description: "Queued and finished paper replays.",
};

export const maxDuration = 60;

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function AccountBacktestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const params = await searchParams;
  const selectedId = firstSearchValue(params.run);
  const selectedTemplateId = firstSearchValue(params.template);
  const defaultVenue = firstSearchValue(params.venue);
  const defaultEnv = firstSearchValue(params.env);
  const [runs, desks, templates] = await Promise.all([
    listBacktestRuns({ userId: member.id }),
    listTradingAccounts(member.id),
    listApplyableTemplates({ userId: member.id }),
  ]);
  const library = templates.flatMap((row) => {
    const item = toBacktestLibraryItem(row);
    if (!item) {
      return [];
    }
    const allowed =
      item.recipe.kind === "dca"
        ? canBacktestDcaRecipe(item.recipe)
        : canBacktestPerpsRecipe(item.recipe);
    return allowed.ok ? [item] : [];
  });
  const selected = selectedId ? await loadBacktestRun(selectedId) : null;
  const isAdmin = memberIsAdmin(member);
  const run =
    selected && canReadBacktestRun(selected, member.id, isAdmin)
      ? selected
      : null;
  const applyDesks = desks
    .filter((desk) =>
      run?.deskType === "dca"
        ? desk.deskType === "dca"
        : deskAllowsPerpsRecipes(desk.deskType),
    )
    .map((desk) => ({ id: desk.id, name: desk.name }));

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading
        title="Backtests"
        actions={
          <Link
            href="/account/templates"
            className="text-sm text-accent hover:underline"
          >
            Bot Templates
          </Link>
        }
      />
      <p className="mb-6 max-w-2xl text-sm text-ink-muted">
        Paper replay of a saved Perps bots or DCA template. Fill the form
        below — start, end, and initial balance are required. Runs never
        write the live blotter.
      </p>
      <BacktestQueueForm
        templates={library}
        selectedTemplateId={selectedTemplateId ?? ""}
        defaultVenue={defaultVenue ?? "bybit"}
        defaultVenueEnvironment={defaultEnv ?? null}
      />
      {runs.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No runs yet. Save a bot as a template, then complete the form
          above.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-ink-muted">
              <tr>
                <th className="py-2 pr-4 font-medium">Bot</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Contract</th>
                <th className="py-2 pr-4 font-medium">Window</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Realized</th>
                <th className="py-2 font-medium">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="py-2 pr-4">
                    <Link
                      href={`/account/backtests?run=${row.id}`}
                      className="text-accent hover:underline"
                    >
                      {row.recipe.name}
                    </Link>
                    {row.userId == null ? (
                      <span className="ml-2 text-xs text-ink-faint">
                        published
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-4 text-ink-muted">
                    {row.deskType === "dca" ? "DCA" : "Perps"}
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{row.symbol}</td>
                  <td className="py-2 pr-4 text-ink-muted">
                    {DCA_INDICATOR_TIMEFRAME_LABELS[row.interval]}
                  </td>
                  <td className="py-2 pr-4">{statusLabel(row.status)}</td>
                  <td className="py-2 pr-4 tabular-nums">
                    {row.stats
                      ? row.stats.realizedUsdt.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "—"}
                  </td>
                  <td className="py-2">
                    <RemoveBacktestButton
                      runId={row.id}
                      canRemove={canDeleteBacktestRun(
                        row,
                        member.id,
                        isAdmin,
                      )}
                      compact
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {run ? (
        <section className="mt-8 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
                Run
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                {run.recipe.name} · {run.symbol}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {run.venue} · {DCA_INDICATOR_TIMEFRAME_LABELS[run.interval]} ·{" "}
                {new Date(run.fromMs).toISOString().slice(0, 10)}–
                {new Date(run.toMs).toISOString().slice(0, 10)} ·{" "}
                start {run.startingUsdt.toLocaleString()} ·{" "}
                {BACKTEST_FEE_PRESETS[run.feePreset].label}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {run.status === "done" ? <BacktestChartButton run={run} /> : null}
              {run.status === "done" ? (
                <ApplyBacktestButton
                  templateId={run.templateId}
                  desks={applyDesks}
                />
              ) : null}
              {run.status === "done" && run.userId === member.id ? (
                <PublishBacktestButton runId={run.id} canPublish />
              ) : null}
              <RemoveBacktestButton
                runId={run.id}
                canRemove={canDeleteBacktestRun(run, member.id, isAdmin)}
              />
            </div>
          </div>
          {run.error ? <p className="text-sm text-danger">{run.error}</p> : null}
          <BacktestStatsGrid run={run} />
          <div>
            <h3 className="mb-2 text-sm font-semibold">Simulated orders</h3>
            <BacktestOrdersTable run={run} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
