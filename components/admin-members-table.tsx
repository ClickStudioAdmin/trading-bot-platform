import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import { SortTh, StatusBadge } from "@/components/table-chrome";
import {
  memberListHref,
  toggleMemberSort,
  type MemberListQuery,
} from "@/lib/members/query";
import type { MemberRow } from "@/lib/members/rows";

export function AdminMembersTable({
  rows,
  query,
  planNames,
}: {
  rows: MemberRow[];
  query: MemberListQuery;
  planNames: Record<string, string>;
}) {
  return (
    <div className="mt-6 overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
          <tr>
            <SortTh
              label="Name"
              active={query.sort === "name"}
              dir={query.dir}
              href={memberListHref(toggleMemberSort(query, "name"))}
            />
            <SortTh
              label="Email"
              active={query.sort === "email"}
              dir={query.dir}
              href={memberListHref(toggleMemberSort(query, "email"))}
            />
            <SortTh
              label="Role"
              active={query.sort === "role"}
              dir={query.dir}
              href={memberListHref(toggleMemberSort(query, "role"))}
            />
            <SortTh
              label="Status"
              active={query.sort === "status"}
              dir={query.dir}
              href={memberListHref(toggleMemberSort(query, "status"))}
            />
            <th className="px-4 py-3 font-medium">Plan</th>
            <SortTh
              label="Created"
              active={query.sort === "created"}
              dir={query.dir}
              href={memberListHref(toggleMemberSort(query, "created"))}
            />
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-sm text-ink-muted">
                No members match.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-b-0">
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3 text-ink-muted">{row.email}</td>
                <td className="px-4 py-3 text-ink-muted">{row.role}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    label={row.status === "disabled" ? "Disabled" : "Active"}
                    status={row.status}
                  />
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {planNames[row.planId] ?? "—"}
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
