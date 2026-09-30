import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ReplayPlayer } from "@/components/replay-player";
import { memberIsAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import { backtestRunTitle, backtestSavedListHref } from "@/lib/backtest/model";
import { canReadBacktestRun, loadBacktestRun } from "@/lib/backtest/store";

export const metadata: Metadata = {
  title: "Replay",
  description: "Play a finished backtest on the chart, with the reason for each event.",
};

export default async function AccountBacktestReplayPage({
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
    redirect(`/account/backtests?draft=${run.id}`);
  }
  const listHref = backtestSavedListHref();
  if (run.status !== "done") {
    return (
      <div>
        <Breadcrumbs
          items={[
            { href: listHref, label: "Backtesting Tool" },
            { href: `/account/backtests/${run.id}`, label: backtestRunTitle(run) },
            { label: "Replay" },
          ]}
        />
        <h1 className="text-2xl font-semibold tracking-tight">Replay</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Replay opens once the run has finished.
        </p>
        <Link
          href={`/account/backtests/${run.id}`}
          className="mt-4 inline-block text-sm text-accent hover:underline"
        >
          Back to the report
        </Link>
      </div>
    );
  }
  return (
    <div>
      <Breadcrumbs
        items={[
          { href: listHref, label: "Backtesting Tool" },
          { href: `/account/backtests/${run.id}`, label: backtestRunTitle(run) },
          { label: "Replay" },
        ]}
      />
      <ReplayPlayer run={run} />
    </div>
  );
}
