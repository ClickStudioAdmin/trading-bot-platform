import type { Metadata } from "next";
import Link from "next/link";
import { EventLogs } from "@/components/event-logs";
import { PageHeading } from "@/components/page-heading";
import { deskHref, deskIsCopy } from "@/lib/accounts/model";
import { getSessionContext } from "@/lib/auth/session";
import { listEventLogs, parseEventLogFilters } from "@/lib/logs/list";
import { FUTURES_PATHS, FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";

export const metadata: Metadata = {
  title: "Activity",
  description: "Your manual and automated futures activity.",
};

export default async function FuturesActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  const copyDesk = session ? deskIsCopy(session.account) : false;
  const filters = parseEventLogFilters(params);
  const rows = session
    ? (
        await listEventLogs(filters, { accountId: session.account.id })
      ).filter((row) => row.strategy === FUTURES_STRATEGY_ID)
    : [];

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Activity" />
      {copyDesk ? (
        <p className="mb-4 text-sm text-ink-muted">
          Parent and copy events for this desk: followed, paused, resumed,
          copied fills and limits, amends and cancels to match the parent, and
          skipped trades (parent already in that trade, book too small, paused,
          reduce-only, adverse move, and the rest).
        </p>
      ) : null}
      {session ? (
        <EventLogs
          rows={rows}
          filters={filters}
          clearHref={deskHref(FUTURES_PATHS.activity, session.account.id)}
          showUser={false}
          scopes={["strategy", "trade"]}
        />
      ) : (
        <p className="text-sm text-ink-muted">
          <Link href="/sign-in" className="text-accent">
            Sign in
          </Link>{" "}
          to see your futures activity.
        </p>
      )}
    </main>
  );
}
