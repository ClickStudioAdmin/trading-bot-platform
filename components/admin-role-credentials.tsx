import { TableCard } from "@/components/table-chrome";
import { MEMBER_ROLE_CREDENTIALS } from "@/lib/members/roles";

export function AdminRoleCredentials() {
  return (
    <TableCard>
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
          <tr>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Credentials</th>
          </tr>
        </thead>
        <tbody>
          {MEMBER_ROLE_CREDENTIALS.map((row) => (
            <tr key={row.role} className="border-b border-line last:border-b-0">
              <td className="px-4 py-3 align-top font-medium text-ink">
                {row.label}
              </td>
              <td className="px-4 py-3 text-ink-muted">
                <ul className="space-y-1">
                  {row.credentials.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}
