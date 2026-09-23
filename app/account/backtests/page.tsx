import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { BacktestQueueForm } from "@/components/backtest-queue-form";
import { BacktestRunRefresh } from "@/components/backtest-run-view";
import { BacktestRunsTable } from "@/components/backtest-runs-table";
import { getSessionMember } from "@/lib/auth/session";
import { memberIsAdmin } from "@/lib/admin/access";
import { toBacktestLibraryItem } from "@/lib/backtest/library";
import {
  backtestQueueSeedFromRun,
  backtestSavedListHref,
} from "@/lib/backtest/model";
import {
  canReadBacktestRun,
  listBacktestRuns,
  loadBacktestRun,
} from "@/lib/backtest/store";
import { canBacktestDcaRecipe } from "@/lib/backtest/replay-dca";
import { canBacktestPerpsRecipe } from "@/lib/backtest/replay";
import { firstSearchValue } from "@/lib/paper/open";
import {
  listDeskBacktestBots,
  matchDeskBacktestBot,
} from "@/lib/backtest/desk-bots";
import {
  listApplyableSets,
  listApplyableTemplates,
} from "@/lib/templates/store";

export const metadata: Metadata = {
  title: "Backtesting Tool",
  description: "Queued and finished paper replays.",
};

export const maxDuration = 60;

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
  const wantsForm = Boolean(selectedTemplateId || draftId || rerunId);
  const tab =
    !wantsForm && firstSearchValue(params.tab) === "saved" ? "saved" : "new";
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
        limit: tab === "saved" ? 2000 : 80,
      }),
      listApplyableTemplates({ userId: member.id }),
      listApplyableSets({ userId: member.id }),
      tab === "new"
        ? listDeskBacktestBots(member.id)
        : Promise.resolve([]),
    ]);
  } catch {
    runs = [];
    templates = [];
    folders = [];
    deskBots = [];
  }
  let matchedDeskBot: Awaited<ReturnType<typeof matchDeskBacktestBot>> = null;
  if (tab === "new" && seed?.recipe) {
    try {
      matchedDeskBot = await matchDeskBacktestBot(
        member.id,
        seed.recipe,
        deskBots,
      );
    } catch {
      matchedDeskBot = null;
    }
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
      <nav
        aria-label="Backtesting"
        className="mb-6 flex border-b border-line"
      >
        <TabLink href="/account/backtests" selected={tab === "new"}>
          New Backtest
        </TabLink>
        <TabLink href={backtestSavedListHref()} selected={tab === "saved"}>
          Saved Backtests
        </TabLink>
      </nav>
      {tab === "saved" ? (
        <BacktestRunsTable
          runs={runs}
          memberId={member.id}
          isAdmin={isAdmin}
          returnTo={backtestSavedListHref()}
          empty={
            <>
              No runs yet. Queue one from{" "}
              <Link
                href="/account/backtests"
                className="text-accent hover:underline"
              >
                New Backtest
              </Link>
              .
            </>
          }
        />
      ) : (
        <BacktestQueueForm
          templates={library}
          folders={folders}
          deskBots={deskBots}
          matchedDeskBot={matchedDeskBot}
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
      )}
    </main>
  );
}

function TabLink({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        selected
          ? "border-accent text-ink"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
