import type { Metadata } from "next";
import { EventLogs } from "@/components/event-logs";
import { PageHeading } from "@/components/page-heading";
import { listEventLogs, parseEventLogFilters } from "@/lib/logs/list";

export const metadata: Metadata = {
  title: "System logs",
  description: "System, strategy, and trade event logs.",
};

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseEventLogFilters(params);
  const rows = await listEventLogs(filters);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeading overline="Admin" title="System logs" />
      <EventLogs
        rows={rows}
        filters={filters}
        clearHref="/admin/logs"
        showUser
        scopes={["system", "strategy", "trade"]}
      />
    </main>
  );
}
