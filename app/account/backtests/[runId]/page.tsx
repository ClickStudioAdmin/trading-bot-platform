import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BacktestRunDetail } from "@/components/backtest-run-detail";
import { deskAllowsPerpsRecipes } from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import { memberIsAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import {
  canDeleteBacktestRun,
  canReadBacktestRun,
  listBacktestRuns,
  loadBacktestRun,
} from "@/lib/backtest/store";

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
  const desks = await listTradingAccounts(member.id);
  const applyDesks = desks
    .filter((desk) =>
      run.deskType === "dca"
        ? desk.deskType === "dca"
        : deskAllowsPerpsRecipes(desk.deskType),
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
        studyHref={
          run.studyId && isAdmin
            ? `/admin/backtests/studies/${run.studyId}`
            : null
        }
        applyDesks={applyDesks}
        canPublish={run.userId === member.id}
        canRemove={canDeleteBacktestRun(run, member.id, isAdmin)}
        returnTo="/account/backtests"
        comparables={comparables}
        parentHref={
          run.parentRunId ? `/account/backtests/${run.parentRunId}` : null
        }
      />
    </main>
  );
}
