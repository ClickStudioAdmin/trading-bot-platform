"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AutomationsColumnPicker,
  useAutomationsColumns,
} from "@/components/automations-column-picker";
import { useConfirmDialog } from "@/components/confirm-modal";
import {
  IconCopy,
  IconPencil,
  IconPerformance,
  IconPositions,
  IconTrash,
} from "@/components/icons";
import {
  StatusBadge,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TABLE_TITLE_CASE_TH_CLASS,
  TableActions,
  TableCard,
  TableFilterSession,
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
  canRemove?: boolean;
  removeBlocked?: string;
  onRemove?: () => void | Promise<void>;
};

export function AutomationsBotTable({
  rows,
  empty,
  toolbar,
}: {
  rows: readonly AutomationsBotRow[];
  empty: string;
  toolbar?: ReactNode;
}) {
  const { confirm, dialog } = useConfirmDialog();
  const { visible, setColumn } = useAutomationsColumns();

  async function removeRow(row: AutomationsBotRow) {
    if (!row.onRemove || row.canRemove === false) {
      return;
    }
    const ok = await confirm({
      title: "Remove this bot?",
      message: "This cannot be undone.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) {
      return;
    }
    await row.onRemove();
  }

  return (
    <>
    {dialog}
    <TableFilterSession
      toolbar={toolbar}
      actions={
        <AutomationsColumnPicker visible={visible} setColumn={setColumn} />
      }
    />
    {rows.length === 0 ? (
      <p className="rounded-card border border-line bg-canvas px-4 py-6 text-sm text-ink-muted">
        {empty}
      </p>
    ) : (
    <TableCard className="mt-0">
      <table className="min-w-full text-left text-sm text-ink">
        <thead className="border-b border-line bg-surface-raised text-hint text-ink-muted">
          <tr>
            <th className={`px-4 py-3 font-medium ${TABLE_TITLE_CASE_TH_CLASS}`}>
              Name
            </th>
            {visible.pair ? (
              <th className={`px-4 py-3 font-medium ${TABLE_TITLE_CASE_TH_CLASS}`}>
                Pair / Side
              </th>
            ) : null}
            {visible.recipe ? (
              <th className={`px-4 py-3 font-medium ${TABLE_TITLE_CASE_TH_CLASS}`}>
                Recipe
              </th>
            ) : null}
            {visible.status ? (
              <th className={`px-4 py-3 font-medium ${TABLE_TITLE_CASE_TH_CLASS}`}>
                Status
              </th>
            ) : null}
            {visible.positions ? (
              <th className={`px-4 py-3 font-medium ${TABLE_TITLE_CASE_TH_CLASS}`}>
                Positions
              </th>
            ) : null}
            {visible.performance ? (
              <th className={`px-4 py-3 font-medium ${TABLE_TITLE_CASE_TH_CLASS}`}>
                Performance
              </th>
            ) : null}
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
              {visible.pair ? (
                <td className="px-4 py-3 pr-8 align-top text-ink-muted">
                  {row.pair}
                </td>
              ) : null}
              {visible.recipe ? (
                <td className="px-4 py-3 pr-8 align-top text-ink-muted">
                  {row.summary}
                </td>
              ) : null}
              {visible.status ? (
                <td className="px-4 py-3 pr-8 align-top">
                  <StatusBadge
                    label={row.status}
                    tone={statusToneFor(row.statusKey ?? row.status)}
                  />
                </td>
              ) : null}
              {visible.positions ? (
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
              ) : null}
              {visible.performance ? (
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
              ) : null}
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
                  {row.onRemove ? (
                    <TableIconAction
                      danger
                      disabled={row.canRemove === false}
                      label="Remove"
                      detail={
                        row.canRemove === false
                          ? (row.removeBlocked ??
                            "This bot cannot be removed.")
                          : "Delete this bot."
                      }
                      onClick={() => void removeRow(row)}
                    >
                      <IconTrash {...TABLE_BTN_ICON} />
                    </TableIconAction>
                  ) : null}
                </TableActions>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
    )}
    </>
  );
}
