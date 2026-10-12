import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { BacktestRunRefresh } from "@/components/backtest-run-view";
import { BacktestRunsTable } from "@/components/backtest-runs-table";
import { getSessionMember } from "@/lib/auth/session";
import { memberIsAdmin } from "@/lib/admin/access";
import {
  backtestListEntryHref,
  backtestNewHref,
  backtestSavedListHref,
} from "@/lib/backtest/model";
import { listBacktestRuns } from "@/lib/backtest/store";
import { firstSearchValue } from "@/lib/paper/open";

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
  const entry = backtestListEntryHref(params);
  if (entry) {
    redirect(entry);
  }
  const isAdmin = memberIsAdmin(member);
  let runs: Awaited<ReturnType<typeof listBacktestRuns>> = [];
  try {
    runs = await listBacktestRuns({
      userId: member.id,
      standaloneOnly: true,
      primaryOnly: true,
      limit: 2000,
    });
  } catch {
    runs = [];
  }

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
      <BacktestRunsTable
        runs={runs}
        memberId={member.id}
        isAdmin={isAdmin}
        returnTo={backtestSavedListHref()}
        createHref={backtestNewHref()}
        empty="No backtests yet. Create one to replay a desk bot or a library template."
      />
    </main>
  );
}
