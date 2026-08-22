import type { Metadata } from "next";
import Link from "next/link";
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
      <PageHeading overline="Admin" title="Logs" />
      <p className="-mt-4 text-sm text-ink-muted">
        Append-only events. Newest first. Secrets are redacted at write time.
      </p>

      <form
        method="get"
        className="mt-6 rounded-card border border-line bg-surface p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs text-ink-muted">
            Scope
            <select
              name="scope"
              defaultValue={filters.scope}
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
            >
              <option value="">All</option>
              <option value="system">System</option>
              <option value="strategy">Strategy</option>
              <option value="trade">Trade</option>
            </select>
          </label>
          <label className="block text-xs text-ink-muted">
            Level
            <select
              name="level"
              defaultValue={filters.level}
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
            >
              <option value="">All</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </label>
          <label className="block text-xs text-ink-muted">
            Event
            <input
              name="event"
              defaultValue={filters.event}
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            Apply filters
          </button>
          <Link
            href="/admin/logs"
            className="rounded-control border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
          >
            Clear
          </Link>
        </div>
      </form>

      <div className="mt-6 overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Time (UTC)</th>
              <th className="px-4 py-3 font-medium">Level</th>
              <th className="px-4 py-3 font-medium">Scope</th>
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Message</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-sm text-ink-muted">
                  No events match.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3 align-top tabular-nums text-ink-muted">
                    {row.createdAt.slice(0, 19).replace("T", " ")}
                  </td>
                  <td className={`px-4 py-3 align-top ${levelTone(row.level)}`}>
                    {row.level}
                  </td>
                  <td className="px-4 py-3 align-top text-ink-muted">{row.scope}</td>
                  <td className="px-4 py-3 align-top">
                    <div>{row.event}</div>
                    {row.strategy ? (
                      <div className="text-xs text-ink-faint">{row.strategy}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-ink-muted">
                    {row.userId ? row.userId.slice(0, 8) : "—"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div>{row.message}</div>
                    {Object.keys(row.data).length > 0 ? (
                      <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-ink-faint">
                        {JSON.stringify(row.data, null, 2)}
                      </pre>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-faint">Showing up to 100 events.</p>
    </main>
  );
}

function levelTone(level: string): string {
  if (level === "error") {
    return "text-danger";
  }
  if (level === "warning") {
    return "text-warning";
  }
  return "text-ink-muted";
}
