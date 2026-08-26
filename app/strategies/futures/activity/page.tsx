import type { Metadata } from "next";
import Link from "next/link";
import { EventLogs } from "@/components/event-logs";
import { PageHeading } from "@/components/page-heading";
import { getSessionContext } from "@/lib/auth/session";
import { listEventLogs, parseEventLogFilters } from "@/lib/logs/list";
import { FUTURES_PATHS, FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";

export const metadata: Metadata = {
  title: "Activity",
  description: "Your manual futures activity.",
};

export default async function FuturesActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  const filters = parseEventLogFilters(params);
  const rows = session
    ? (
        await listEventLogs(filters, { accountId: session.account.id })
      ).filter((row) => row.strategy === FUTURES_STRATEGY_ID)
    : [];

  return (
    <main className="mx-auto max-w-7xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Activity" />
      {session ? (
        <EventLogs
          rows={rows}
          filters={filters}
          clearHref={FUTURES_PATHS.activity}
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
