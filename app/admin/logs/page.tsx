import type { Metadata } from "next";
import { EventLogs } from "@/components/event-logs";
import { PageHeading } from "@/components/page-heading";
import { formatAccountMode } from "@/lib/accounts/model";
import { listAllTradingAccounts } from "@/lib/accounts/store";
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
  const books = await listAllTradingAccounts();
  const accounts = books.map((account) => ({
    id: account.id,
    label: `${account.name} · ${formatAccountMode(account.mode)} · ${account.ownerName}`,
  }));
  const accountId = accounts.some((account) => account.id === filters.account)
    ? filters.account
    : undefined;
  const rows = await listEventLogs(filters, { accountId });

  return (
    <div>
      <PageHeading overline="Admin" title="System logs" />
      <EventLogs
        rows={rows}
        filters={filters}
        clearHref="/admin/logs"
        showUser
        scopes={["system", "strategy", "trade"]}
        accounts={accounts}
      />
    </div>
  );
}
