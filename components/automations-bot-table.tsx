import Link from "next/link";
import {
  IconCopy,
  IconPencil,
  IconPerformance,
  IconPositions,
} from "@/components/icons";
import {
  StatusBadge,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TABLE_TITLE_CASE_TH_CLASS,
  TableActions,
  TableCard,
  TableIconAction,
} from "@/components/table-chrome";
import { formatCount, formatPct, signedTone } from "@/lib/opportunities/format";
import { statusToneFor } from "@/lib/table-chrome";

export type AutomationsBotRow = {
  id: string;
  name: string;
  pair: string;
  status: string;
  statusKey?: string;
  summary: string;
  positionCount: number;
  roePct: number | null;
  positionsHref: string;
  performanceHref: string;
  editHref: string;
  cloneHref?: string;
};

export function AutomationsBotTable({
  rows,
  empty,
}: {
  rows: readonly AutomationsBotRow[];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-line bg-canvas px-4 py-6 text-sm text-ink-muted">
        {empty}
      </p>
    );
  }

  return (
    <TableCard className="mt-0">
      <table className="min-w-full text-left text-sm text-ink">
        <thead className="border-b border-line bg-surface-raised text-hint text-ink-muted">
          <tr>
            <th className={`px-4 py-3 font-medium ${TABLE_TITLE_CASE_TH_CLASS}`}>
              Name
            </th>
            <th className={`px-4 py-3 font-medium ${TABLE_TITLE_CASE_TH_CLASS}`}>
              Pair / Side
            </th>
            <th className={`px-4 py-3 font-medium ${TABLE_TITLE_CASE_TH_CLASS}`}>
              Status
            </th>
            <th className={`px-4 py-3 font-medium ${TABLE_TITLE_CASE_TH_CLASS}`}>
              Recipe
            </th>
            <th className={`px-4 py-3 font-medium ${TABLE_TITLE_CASE_TH_CLASS}`}>
              Positions
            </th>
            <th className={`px-4 py-3 font-medium ${TABLE_TITLE_CASE_TH_CLASS}`}>
              Performance
            </th>
            <th className={TABLE_ACTIONS_TH_CLASS}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-b-0">
              <td className="px-4 py-3 pr-8 align-top">
                <Link
                  href={row.editHref}
                  className="text-ink hover:underline"
                >
                  {row.name || "Bot"}
                </Link>
              </td>
              <td className="px-4 py-3 pr-8 align-top text-ink-muted">
                {row.pair}
              </td>
              <td className="px-4 py-3 pr-8 align-top">
                <StatusBadge
                  label={row.status}
                  tone={statusToneFor(row.statusKey ?? row.status)}
                />
              </td>
              <td className="px-4 py-3 pr-8 align-top text-ink-muted">
                {row.summary}
              </td>
              <td className="px-4 py-3 pr-8 align-top">
                <div className="flex items-center gap-1.5">
                  <span className="tabular-nums">
                    {formatCount(row.positionCount)}
                  </span>
                  <TableIconAction
                    href={row.positionsHref}
                    label="Positions"
                    detail="Open this bot’s positions."
                  >
                    <IconPositions {...TABLE_BTN_ICON} />
                  </TableIconAction>
                </div>
              </td>
              <td className="px-4 py-3 pr-8 align-top">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`tabular-nums ${signedTone(row.roePct)}`}
                  >
                    {row.roePct == null ? "—" : formatPct(row.roePct)}
                  </span>
                  <TableIconAction
                    href={row.performanceHref}
                    label="Performance"
                    detail="Open this bot’s realized ROE."
                  >
                    <IconPerformance {...TABLE_BTN_ICON} />
                  </TableIconAction>
                </div>
              </td>
              <td className={`${TABLE_ACTIONS_TD_CLASS} align-top`}>
                <TableActions>
                  <TableIconAction
                    href={row.editHref}
                    label="View / Edit"
                    detail="Open this bot’s form."
                  >
                    <IconPencil {...TABLE_BTN_ICON} />
                  </TableIconAction>
                  {row.cloneHref ? (
                    <TableIconAction
                      href={row.cloneHref}
                      label="Clone"
                      detail="Create a new bot from this one."
                    >
                      <IconCopy {...TABLE_BTN_ICON} />
                    </TableIconAction>
                  ) : null}
                </TableActions>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}
