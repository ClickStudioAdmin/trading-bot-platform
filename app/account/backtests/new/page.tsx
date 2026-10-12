import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BacktestQueueForm } from "@/components/backtest-queue-form";
import { DeskBackLink } from "@/components/desk-back-link";
import { getSessionMember } from "@/lib/auth/session";
import { memberIsAdmin } from "@/lib/admin/access";
import { toBacktestLibraryItem } from "@/lib/backtest/library";
import {
  backtestQueueSeedFromRun,
  backtestSavedListHref,
} from "@/lib/backtest/model";
import {
  canReadBacktestRun,
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
  title: "New backtest",
  description: "Queue a paper replay from a desk bot or a library template.",
};

export const maxDuration = 60;

export default async function NewBacktestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const params = await searchParams;
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
  let templates: Awaited<ReturnType<typeof listApplyableTemplates>> = [];
  let folders: Awaited<ReturnType<typeof listApplyableSets>> = [];
  let deskBots: Awaited<ReturnType<typeof listDeskBacktestBots>> = [];
  try {
    [templates, folders, deskBots] = await Promise.all([
      listApplyableTemplates({ userId: member.id }),
      listApplyableSets({ userId: member.id }),
      listDeskBacktestBots(member.id),
    ]);
  } catch {
    templates = [];
    folders = [];
    deskBots = [];
  }
  let matchedDeskBot: Awaited<ReturnType<typeof matchDeskBacktestBot>> = null;
  if (seed?.recipe) {
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

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <div className="mb-6 flex min-w-0 items-center gap-3">
        <DeskBackLink href={backtestSavedListHref()} />
        <h2 className="min-w-0 text-lg font-semibold tracking-tight">
          New backtest
        </h2>
      </div>
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
        showTitle={false}
        defaultVenue={defaultVenue ?? seed?.venue ?? "bybit"}
        defaultVenueEnvironment={
          defaultEnv ?? seed?.venueEnvironment ?? null
        }
      />
    </main>
  );
}
