import Link from "next/link";
import type { EventLogFilters, EventLogRow } from "@/lib/logs/list";

export function EventLogs({
  rows,
  filters,
  clearHref,
  showUser,
  scopes,
}: {
  rows: EventLogRow[];
  filters: EventLogFilters;
  clearHref: string;
  showUser: boolean;
  scopes: Array<"system" | "strategy" | "trade">;
}) {
  const columns = showUser ? 6 : 5;

  return (
    <>
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
              {scopes.map((scope) => (
                <option key={scope} value={scope}>
                  {scope === "system"
                    ? "System"
                    : scope === "strategy"
                      ? "Strategy"
                      : "Trade"}
                </option>
              ))}
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
            href={clearHref}
            className="rounded-control border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
          >
            Clear
          </Link>
        </div>
      </form>

      <div className="mt-6 overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Time (UTC)</th>
              <th className="px-4 py-3 font-medium">Level</th>
              <th className="px-4 py-3 font-medium">Scope</th>
              <th className="px-4 py-3 font-medium">Event</th>
              {showUser ? (
                <th className="px-4 py-3 font-medium">User</th>
              ) : null}
              <th className="px-4 py-3 font-medium">Message</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns}
                  className="px-4 py-6 text-sm text-ink-muted"
                >
                  No events match.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="px-4 py-3 align-top tabular-nums text-ink-muted">
                    {row.createdAt.slice(0, 19).replace("T", " ")}
                  </td>
                  <td className={`px-4 py-3 align-top ${levelTone(row.level)}`}>
                    {row.level}
                  </td>
                  <td className="px-4 py-3 align-top text-ink-muted">
                    {row.scope}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div>{row.event}</div>
                    {row.strategy ? (
                      <div className="text-xs text-ink-faint">{row.strategy}</div>
                    ) : null}
                  </td>
                  {showUser ? (
                    <td className="px-4 py-3 align-top font-mono text-xs text-ink-muted">
                      {row.userId ? row.userId.slice(0, 8) : "—"}
                    </td>
                  ) : null}
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
    </>
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
