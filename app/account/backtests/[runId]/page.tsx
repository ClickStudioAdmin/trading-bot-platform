import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BacktestRunDetail } from "@/components/backtest-run-detail";
import { deskAllowsPerpsRecipes, deskIsCopy } from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import { memberIsAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import { listDeskBacktestBots } from "@/lib/backtest/desk-bots";
import {
  decideBacktestTemplateActions,
  findMatchingBacktestDeskBot,
  findMatchingBacktestTemplate,
  toBacktestLibraryItem,
} from "@/lib/backtest/library";
import type { BacktestRecipe } from "@/lib/backtest/model";
import {
  canDeleteBacktestRun,
  canReadBacktestRun,
  listBacktestRuns,
  loadBacktestRun,
} from "@/lib/backtest/store";
import {
  listApplyableSets,
  listApplyableTemplates,
  loadTemplateById,
} from "@/lib/templates/store";

export const metadata: Metadata = {
  title: "Backtest",
  description: "Parameters, trades, account impact, and chart for one run.",
};

export const maxDuration = 60;

export default async function AccountBacktestDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const { runId } = await params;
  const run = await loadBacktestRun(runId);
  const isAdmin = memberIsAdmin(member);
  if (!run || !canReadBacktestRun(run, member.id, isAdmin)) {
    notFound();
  }
  if (run.status === "draft") {
    const draftParams = new URLSearchParams({
      draft: run.id,
      venue: run.venue,
    });
    if (run.venueEnvironment) {
      draftParams.set("env", run.venueEnvironment);
    }
    redirect(`/account/backtests?${draftParams.toString()}`);
  }
  const ownerId = run.userId ?? member.id;
  const [source, linked, templates, deskBots, folders] = await Promise.all([
    run.sourceTemplateId ? loadTemplateById(run.sourceTemplateId) : null,
    run.templateId ? loadTemplateById(run.templateId) : null,
    listApplyableTemplates({ userId: ownerId }),
    run.userId ? listDeskBacktestBots(run.userId) : Promise.resolve([]),
    listApplyableSets({ userId: ownerId }),
  ]);
  const library = templates.flatMap((row) => {
    const item = toBacktestLibraryItem(row);
    return item ? [{ ...item, visibility: row.visibility }] : [];
  });
  const matchingTemplate = findMatchingBacktestTemplate(
    run.recipe,
    library,
    run.sourceTemplateId,
  );
  const matchingDeskBot = findMatchingBacktestDeskBot(run.recipe, deskBots);
  const templateActions = decideBacktestTemplateActions({
    status: run.status,
    ownerUserId: run.userId,
    memberId: member.id,
    isAdmin,
    recipe: run.recipe,
    source:
      source &&
      (source.recipe.kind === "dca" || source.recipe.kind === "perps")
        ? {
            id: source.id,
            name: source.name,
            recipe: source.recipe as BacktestRecipe,
          }
        : null,
    linked: linked
      ? { id: linked.id, name: linked.name, visibility: linked.visibility }
      : null,
    matchingTemplate: matchingTemplate
      ? {
          id: matchingTemplate.id,
          name: matchingTemplate.name,
          visibility: matchingTemplate.visibility,
        }
      : null,
    matchingDeskBot,
  });
  const desks = await listTradingAccounts(member.id);
  const applyDesks = desks
    .filter((desk) =>
      deskIsCopy(desk)
        ? false
        : run.deskType === "dca"
          ? desk.deskType === "dca"
          : deskAllowsPerpsRecipes(desk),
    )
    .map((desk) => ({ id: desk.id, name: desk.name }));
  const comparables = run.parentRunId
    ? []
    : await listBacktestRuns({ parentRunId: run.id, limit: 20 });

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <BacktestRunDetail
        run={run}
        listHref="/account/backtests"
        applyDesks={applyDesks}
        applyTemplateId={templateActions.applyTemplateId}
        canPublish={run.userId === member.id}
        canRemove={canDeleteBacktestRun(run, member.id, isAdmin)}
        canAttach={templateActions.canAttach}
        canSaveAs={templateActions.canSaveAs}
        canSaveAsPlatform={templateActions.canSaveAsPlatform}
        sourceTemplateName={templateActions.sourceName}
        attachTemplateId={templateActions.matchingTemplateId}
        matchingTemplateName={templateActions.matchingTemplateName}
        matchingDeskLabel={templateActions.matchingDeskLabel}
        linkedTemplateName={templateActions.linkedName}
        isAdmin={isAdmin}
        folders={folders}
        returnTo="/account/backtests"
        comparables={comparables}
        parentHref={
          run.parentRunId ? `/account/backtests/${run.parentRunId}` : null
        }
      />
    </main>
  );
}
