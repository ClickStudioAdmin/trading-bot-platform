import { LocalTime } from "@/components/local-time";
import { IconPencil } from "@/components/icons";
import {
  SortTh,
  StatusBadge,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TableActions,
  TableIconAction,
} from "@/components/table-chrome";
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
    <table className="w-full min-w-[48rem] text-left text-sm">
        <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
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
            <th className={TABLE_ACTIONS_TH_CLASS}>Actions</th>
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
                <td className={TABLE_ACTIONS_TD_CLASS}>
                  <TableActions>
                    <TableIconAction
                      href={`/admin/members/${row.id}`}
                      label="Edit"
                      detail="Change this member's settings."
                    >
                      <IconPencil {...TABLE_BTN_ICON} />
                    </TableIconAction>
                  </TableActions>
                </td>
              </tr>
            ))
          )}
        </tbody>
    </table>
  );
}
