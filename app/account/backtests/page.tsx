import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { BacktestQueueForm } from "@/components/backtest-queue-form";
import {
  BacktestRunRefresh,
  RemoveBacktestButton,
} from "@/components/backtest-run-view";
import { getSessionMember } from "@/lib/auth/session";
import { memberIsAdmin } from "@/lib/admin/access";
import { toBacktestLibraryItem } from "@/lib/backtest/library";
import {
  backtestQueueSeedFromRun,
  backtestRoePct,
  backtestWindowDays,
  formatBacktestReturnPct,
} from "@/lib/backtest/model";
import { formatCount } from "@/lib/opportunities/format";
import {
  canDeleteBacktestRun,
  canReadBacktestRun,
  listBacktestRuns,
  loadBacktestRun,
} from "@/lib/backtest/store";
import { canBacktestDcaRecipe } from "@/lib/backtest/replay-dca";
import { canBacktestPerpsRecipe } from "@/lib/backtest/replay";
import { signedTone } from "@/lib/opportunities/format";
import { firstSearchValue } from "@/lib/paper/open";
import { listDeskBacktestBots } from "@/lib/backtest/desk-bots";
import {
  listApplyableSets,
  listApplyableTemplates,
} from "@/lib/templates/store";

export const metadata: Metadata = {
  title: "Backtesting Tool",
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
  let folders: Awaited<ReturnType<typeof listApplyableSets>> = [];
  let deskBots: Awaited<ReturnType<typeof listDeskBacktestBots>> = [];
  try {
    [runs, templates, folders, deskBots] = await Promise.all([
      listBacktestRuns({
        userId: member.id,
        standaloneOnly: true,
        primaryOnly: true,
      }),
      listApplyableTemplates({ userId: member.id }),
      listApplyableSets({ userId: member.id }),
      listDeskBacktestBots(member.id),
    ]);
  } catch {
    runs = [];
    templates = [];
    folders = [];
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

  const pendingRun =
    runs.find((row) => row.status === "queued") ??
    runs.find((row) => row.status === "running");

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      {pendingRun ? (
        <BacktestRunRefresh active runId={pendingRun.id} />
      ) : null}
      <PageHeading
        title="Backtesting Tool"
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
        <div className="mb-8 overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint [&_th]:whitespace-nowrap">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Contract</th>
                <th className="px-4 py-3 font-medium">Comparables</th>
                <th className="px-4 py-3 font-medium">Days</th>
                <th className="px-4 py-3 font-medium">Win Rate</th>
                <th className="px-4 py-3 font-medium">ROE</th>
                <th className="px-4 py-3 font-medium">Realized</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((row) => {
                const days = backtestWindowDays(row.fromMs, row.toMs);
                const winRate =
                  row.stats && row.stats.trades > 0
                    ? `${Math.round(row.stats.winRate * 100)}%`
                    : "—";
                const roe = row.stats
                  ? backtestRoePct(
                      row.stats.realizedUsdt,
                      row.orders,
                      row.leverage,
                    )
                  : null;
                return (
                  <tr
                    key={row.id}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-ink-muted">
                      {row.deskType === "dca" ? "DCA" : "Perps"}
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {row.symbol}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {(row.comparableSymbols ?? []).length > 0
                        ? `+${row.comparableSymbols.length}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-muted">
                      {days != null ? formatCount(days) : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{winRate}</td>
                    <td className={`px-4 py-3 tabular-nums ${signedTone(roe)}`}>
                      {formatBacktestReturnPct(roe)}
                    </td>
                    <td
                      className={`px-4 py-3 tabular-nums ${
                        row.stats
                          ? signedTone(row.stats.realizedUsdt)
                          : "text-ink-faint"
                      }`}
                    >
                      {row.stats
                        ? row.stats.realizedUsdt.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">{statusLabel(row.status)}</td>
                    <td className="px-4 py-3">
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <BacktestQueueForm
        templates={library}
        folders={folders}
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
