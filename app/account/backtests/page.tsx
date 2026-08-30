import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { BacktestQueueForm } from "@/components/backtest-queue-form";
import { RemoveBacktestButton } from "@/components/backtest-run-view";
import { getSessionMember } from "@/lib/auth/session";
import { memberIsAdmin } from "@/lib/admin/access";
import { toBacktestLibraryItem } from "@/lib/backtest/library";
import {
  backtestQueueSeedFromRun,
  formatBacktestReturnPct,
  realizedReturnPct,
} from "@/lib/backtest/model";
import {
  canDeleteBacktestRun,
  canReadBacktestRun,
  listBacktestRuns,
  loadBacktestRun,
} from "@/lib/backtest/store";
import { canBacktestDcaRecipe } from "@/lib/backtest/replay-dca";
import { canBacktestPerpsRecipe } from "@/lib/backtest/replay";
import { firstSearchValue } from "@/lib/paper/open";
import { DCA_INDICATOR_TIMEFRAME_LABELS } from "@/lib/dca/indicators";
import { listDeskBacktestBots } from "@/lib/backtest/desk-bots";
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
  if (selectedId) {
    redirect(`/account/backtests/${selectedId}`);
  }
  const selectedTemplateId = firstSearchValue(params.template);
  const draftId = firstSearchValue(params.draft);
  const rerunId = firstSearchValue(params.rerun);
  const defaultVenue = firstSearchValue(params.venue);
  const defaultEnv = firstSearchValue(params.env);
  const isAdmin = memberIsAdmin(member);
  const draft = draftId ? await loadBacktestRun(draftId) : null;
  const rerun = rerunId ? await loadBacktestRun(rerunId) : null;
  const usableRerun =
    rerun &&
    rerun.status !== "draft" &&
    canReadBacktestRun(rerun, member.id, isAdmin)
      ? rerun
      : null;
  const usableDraft =
    !usableRerun &&
    draft &&
    draft.status === "draft" &&
    (draft.userId === member.id || isAdmin)
      ? draft
      : null;
  const seedSource = usableRerun ?? usableDraft;
  const seed = seedSource ? backtestQueueSeedFromRun(seedSource) : null;
  let runs: Awaited<ReturnType<typeof listBacktestRuns>> = [];
  let templates: Awaited<ReturnType<typeof listApplyableTemplates>> = [];
  let deskBots: Awaited<ReturnType<typeof listDeskBacktestBots>> = [];
  try {
    [runs, templates, deskBots] = await Promise.all([
      listBacktestRuns({
        userId: member.id,
        standaloneOnly: true,
        primaryOnly: true,
      }),
      listApplyableTemplates({ userId: member.id }),
      listDeskBacktestBots(member.id),
    ]);
  } catch {
    runs = [];
    templates = [];
    deskBots = [];
  }
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
        Paper replay of a desk bot or a library template. Edit the replay
        fields, then queue. Long history goes to the worker. Open a row for
        the full picture.
      </p>
      {runs.length === 0 ? (
        <p className="mb-8 text-sm text-ink-muted">
          No runs yet. Open Backtest from a bot, or pick a template below.
        </p>
      ) : (
        <div className="mb-8 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-ink-muted">
              <tr>
                <th className="py-2 pr-4 font-medium">Bot</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Contract</th>
                <th className="py-2 pr-4 font-medium">Comparables</th>
                <th className="py-2 pr-4 font-medium">Window</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Return</th>
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
                      href={`/account/backtests/${row.id}`}
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
                    {(row.comparableSymbols ?? []).length > 0
                      ? `+${row.comparableSymbols.length}`
                      : "—"}
                  </td>
                  <td className="py-2 pr-4 text-ink-muted">
                    {DCA_INDICATOR_TIMEFRAME_LABELS[row.interval]}
                  </td>
                  <td className="py-2 pr-4">{statusLabel(row.status)}</td>
                  <td className="py-2 pr-4 tabular-nums">
                    {formatBacktestReturnPct(
                      row.stats ? realizedReturnPct(row.stats) : null,
                    )}
                  </td>
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
      <BacktestQueueForm
        templates={library}
        deskBots={deskBots}
        selectedTemplateId={
          selectedTemplateId || seed?.sourceTemplateId || ""
        }
        draftId={usableDraft?.id ?? ""}
        seed={seed}
        loadedFromRun={Boolean(usableRerun)}
        defaultVenue={
          defaultVenue ?? seed?.venue ?? "bybit"
        }
        defaultVenueEnvironment={
          defaultEnv ?? seed?.venueEnvironment ?? null
        }
      />
    </main>
  );
}
