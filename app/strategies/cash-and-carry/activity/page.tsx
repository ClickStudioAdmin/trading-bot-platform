import type { Metadata } from "next";
import Link from "next/link";
import { EventLogs } from "@/components/event-logs";
import { PageHeading } from "@/components/page-heading";
import { getSessionMember } from "@/lib/auth/session";
import { listEventLogs, parseEventLogFilters } from "@/lib/logs/list";

export const metadata: Metadata = {
  title: "Activity",
  description: "Your manual and automated paper activity.",
};

export default async function CashAndCarryActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getSessionMember();
  const filters = parseEventLogFilters(params);
  const rows = user
    ? await listEventLogs(filters, { userId: user.id })
    : [];

  return (
    <main className="mx-auto max-w-6xl px-6 pt-6 pb-8">
      <PageHeading as="h2" title="Activity" />
      {user ? (
        <EventLogs
          rows={rows}
          filters={filters}
          clearHref="/strategies/cash-and-carry/activity"
          showUser={false}
          scopes={["strategy", "trade"]}
        />
      ) : (
        <p className="text-sm text-ink-muted">
          <Link href="/sign-in" className="text-accent">
            Sign in
          </Link>{" "}
          to see your manual and automated activity.
        </p>
      )}
    </main>
  );
}
