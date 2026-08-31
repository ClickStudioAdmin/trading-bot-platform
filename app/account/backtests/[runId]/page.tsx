import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BacktestRunDetail } from "@/components/backtest-run-detail";
import { deskAllowsPerpsRecipes, deskIsCopy } from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import { memberIsAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import { decideBacktestTemplateActions } from "@/lib/backtest/library";
import type { BacktestRecipe } from "@/lib/backtest/model";
import {
  canDeleteBacktestRun,
  canReadBacktestRun,
  listBacktestRuns,
  loadBacktestRun,
} from "@/lib/backtest/store";
import { loadTemplateById } from "@/lib/templates/store";

export const metadata: Metadata = {
  title: "Backtest",
  description: "Parameters, trades, account impact, and chart for one run.",
};

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
  const [source, linked] = await Promise.all([
    run.sourceTemplateId ? loadTemplateById(run.sourceTemplateId) : null,
    run.templateId ? loadTemplateById(run.templateId) : null,
  ]);
  const templateActions = decideBacktestTemplateActions({
    status: run.status,
    ownerUserId: run.userId,
    memberId: member.id,
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
        sourceTemplateName={templateActions.sourceName}
        linkedTemplateName={templateActions.linkedName}
        returnTo="/account/backtests"
        comparables={comparables}
        parentHref={
          run.parentRunId ? `/account/backtests/${run.parentRunId}` : null
        }
      />
    </main>
  );
}
