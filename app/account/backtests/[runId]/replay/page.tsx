import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ReplayPlayer } from "@/components/replay-player";
import { deskAllowsPerpsRecipes, deskIsCopy } from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import { memberIsAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import {
  backtestRunTitle,
  backtestSavedListHref,
  type BacktestRun,
} from "@/lib/backtest/model";
import {
  loadReplayRunIndicators,
  loadReplayViewPreferences,
} from "@/lib/backtest/replay-preferences-store";
import {
  canReadBacktestRun,
  listBacktestRuns,
  loadBacktestRun,
} from "@/lib/backtest/store";
import { listApplyableSets } from "@/lib/templates/store";

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
  const family = await loadReplayFamily(run, member.id, isAdmin);
  return (
    <div>
      <Breadcrumbs
        items={[
          { href: listHref, label: "Backtesting Tool" },
          { href: `/account/backtests/${run.id}`, label: backtestRunTitle(run) },
          { label: "Replay" },
        ]}
      />
      <ReplayPlayer
        key={run.id}
        run={run}
        preferences={await loadReplayViewPreferences(member.id)}
        runIndicators={await loadReplayRunIndicators(member.id, run.id)}
        family={family.rows}
        rootId={family.rootId}
        allowKeep={run.userId === member.id}
        allowKeepPlatform={isAdmin}
        folders={await listApplyableSets({ userId: run.userId ?? member.id })}
        applyDesks={await loadReplayDesks(member.id, run)}
      />
    </div>
  );
}

async function loadReplayFamily(
  run: BacktestRun,
  userId: string,
  isAdmin: boolean,
): Promise<{ rootId: string; rows: BacktestRun[] }> {
  const parent = run.parentRunId ? await loadBacktestRun(run.parentRunId) : null;
  const root =
    parent && canReadBacktestRun(parent, userId, isAdmin) ? parent : run;
  const children = await listBacktestRuns({
    parentRunId: root.id,
    limit: 40,
  });
  const rows = [root];
  for (const child of children) {
    if (child.id !== root.id && canReadBacktestRun(child, userId, isAdmin)) {
      rows.push(child);
    }
  }
  if (!rows.some((row) => row.id === run.id)) {
    rows.push(run);
  }
  return { rootId: root.id, rows };
}

async function loadReplayDesks(userId: string, run: BacktestRun) {
  const desks = await listTradingAccounts(userId);
  return desks
    .filter((desk) =>
      deskIsCopy(desk)
        ? false
        : run.deskType === "dca"
          ? desk.deskType === "dca"
          : deskAllowsPerpsRecipes(desk),
    )
    .map((desk) => ({ id: desk.id, name: desk.name }));
}
