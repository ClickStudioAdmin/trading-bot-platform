import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BacktestRunDetail } from "@/components/backtest-run-detail";
import { requireAdmin } from "@/lib/admin/access";
import { listBacktestRuns, loadBacktestRun } from "@/lib/backtest/store";

export const metadata: Metadata = {
  title: "Backtest",
  description: "Admin view of one paper replay.",
};

export default async function AdminBacktestDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const member = await requireAdmin();
  const { runId } = await params;
  const run = await loadBacktestRun(runId);
  if (!run) {
    notFound();
  }
  const comparables = run.parentRunId
    ? []
    : await listBacktestRuns({ parentRunId: run.id, limit: 20 });

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <BacktestRunDetail
        run={run}
        listHref="/admin/backtests"
        studyHref={
          run.studyId ? `/admin/backtests/studies/${run.studyId}` : null
        }
        canPublish={run.userId === member.id}
        canRemove
        returnTo={
          run.studyId
            ? `/admin/backtests/studies/${run.studyId}`
            : "/admin/backtests"
        }
        comparables={comparables}
        parentHref={
          run.parentRunId ? `/admin/backtests/${run.parentRunId}` : null
        }
      />
    </main>
  );
}
