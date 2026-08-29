import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import {
  memberListHref,
  toggleMemberSort,
  type MemberListQuery,
  type MemberSort,
} from "@/lib/members/query";
import type { MemberRow } from "@/lib/members/rows";

export function AdminMembersTable({
  rows,
  query,
}: {
  rows: MemberRow[];
  query: MemberListQuery;
}) {
  return (
    <div className="mt-6 overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
          <tr>
            <SortHeader query={query} sort="name" label="Name" />
            <SortHeader query={query} sort="email" label="Email" />
            <SortHeader query={query} sort="role" label="Role" />
            <SortHeader query={query} sort="status" label="Status" />
            <SortHeader query={query} sort="created" label="Created" />
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-sm text-ink-muted">
                No members match.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-b-0">
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3 text-ink-muted">{row.email}</td>
                <td className="px-4 py-3 text-ink-muted">{row.role}</td>
                <td
                  className={`px-4 py-3 ${
                    row.status === "disabled" ? "text-warning" : "text-success"
                  }`}
                >
                  {row.status}
                </td>
                <td className="px-4 py-3 tabular-nums text-ink-muted">
                  <LocalTime at={row.createdAt} mode="date" />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/members/${row.id}`}
                    className="rounded-control border border-line px-2 py-0.5 text-xs font-medium text-accent hover:text-accent-strong"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  query,
  sort,
  label,
}: {
  query: MemberListQuery;
  sort: MemberSort;
  label: string;
}) {
  const active = query.sort === sort;
  const next = toggleMemberSort(query, sort);
  const marker = active ? (query.dir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th className="px-4 py-3 font-medium">
      <Link
        href={memberListHref(next)}
        className={active ? "text-ink" : "text-ink-faint hover:text-ink"}
      >
        {label}
        {marker}
      </Link>
    </th>
  );
}
