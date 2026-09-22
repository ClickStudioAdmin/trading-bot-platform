"use client";

import Link from "next/link";
import { useCallback, type ReactNode } from "react";
import { AdminPlanRowActions } from "@/components/admin-plan-row-actions";
import { IconFilterClear, IconPencil } from "@/components/icons";
import {
  LiveGetForm,
  SortTh,
  StatusBadge,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TABLE_FILTER_FIELD_CLASS,
  TableActions,
  TableCard,
  TableFilterField,
  TableFilterSession,
  TableIconAction,
  TableLabelButton,
  TablePager,
  useClientTable,
} from "@/components/table-chrome";
import { formatCount } from "@/lib/membership/billing";
import {
  formatPlanPrice,
  PLAN_VISIBILITY_LABELS,
  planIsArchived,
  planIsDraft,
  type MembershipPlan,
} from "@/lib/membership/catalog";
import { compareTableNum, compareTableText, type TableSortDir } from "@/lib/table-chrome";
import { AppSelect } from "@/components/app-select";

function planStatusLabel(plan: MembershipPlan): string {
  if (planIsArchived(plan)) {
    return "Archived";
  }
  return planIsDraft(plan) ? "Draft" : "Live";
}

function comparePlans(
  left: MembershipPlan,
  right: MembershipPlan,
  key: string,
  dir: TableSortDir,
): number {
  if (key === "price") {
    return compareTableNum(left.priceUsd, right.priceUsd, dir);
  }
  if (key === "members") {
    return compareTableNum(left.memberCount, right.memberCount, dir);
  }
  if (key === "priceId") {
    return compareTableText(left.stripePriceId ?? "", right.stripePriceId ?? "", dir);
  }
  if (key === "visibility") {
    return compareTableText(
      PLAN_VISIBILITY_LABELS[left.visibility],
      PLAN_VISIBILITY_LABELS[right.visibility],
      dir,
    );
  }
  if (key === "status") {
    return compareTableText(planStatusLabel(left), planStatusLabel(right), dir);
  }
  return compareTableText(left.name, right.name, dir);
}

export function AdminPlansTable({
  plans,
  status,
  actions,
}: {
  plans: MembershipPlan[];
  status: string;
  actions?: ReactNode;
}) {
  const compare = useCallback(comparePlans, []);
  const table = useClientTable(plans, compare, {
    defaultKey: "plan",
    defaultDir: "asc",
  });

  return (
    <>
      <TableFilterSession defaultOpen={Boolean(status)} actions={actions}>
          <LiveGetForm>
            <input type="hidden" name="page" value="1" />
            <TableFilterField label="Status">
              <AppSelect
                name="status"
                defaultValue={status}
                className={TABLE_FILTER_FIELD_CLASS}
              >
                <option value="">All</option>
                <option value="live">Live</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </AppSelect>
            </TableFilterField>
            <TableLabelButton
              href="/admin/plans"
              variant="filter"
              icon={<IconFilterClear {...TABLE_BTN_ICON} />}
            >
              Clear
            </TableLabelButton>
          </LiveGetForm>
      </TableFilterSession>
      <TableCard
        pager={
          <TablePager
            window={table.window}
            onPrev={() => table.setPage(table.window.page - 1)}
            onNext={() => table.setPage(table.window.page + 1)}
            emptyLabel="No plans."
          />
        }
      >
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.12em] text-ink-muted">
            <tr>
              <SortTh
                label="Plan"
                active={table.sortKey === "plan"}
                dir={table.sortDir}
                onSort={() => table.onSort("plan")}
              />
              <SortTh
                label="Price"
                active={table.sortKey === "price"}
                dir={table.sortDir}
                onSort={() => table.onSort("price")}
              />
              <SortTh
                label="Members"
                active={table.sortKey === "members"}
                dir={table.sortDir}
                onSort={() => table.onSort("members")}
              />
              <SortTh
                label="Price ID"
                active={table.sortKey === "priceId"}
                dir={table.sortDir}
                onSort={() => table.onSort("priceId")}
              />
              <SortTh
                label="Visibility"
                active={table.sortKey === "visibility"}
                dir={table.sortDir}
                onSort={() => table.onSort("visibility")}
              />
              <SortTh
                label="Status"
                active={table.sortKey === "status"}
                dir={table.sortDir}
                onSort={() => table.onSort("status")}
              />
              <th className={`${TABLE_ACTIONS_TH_CLASS} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {table.pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-ink-muted">
                  {status ? "No plans match." : "No plans yet."}
                </td>
              </tr>
            ) : (
              table.pageRows.map((plan) => (
                <tr key={plan.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/plans/${plan.id}`}
                      className="font-medium text-ink hover:text-accent"
                    >
                      {plan.name}
                    </Link>
                    <p className="mt-0.5 text-hint text-ink-muted">
                      {plan.isDefault ? "Default · " : ""}
                      {`L1 ${plan.affiliateL1Pct}%`}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink">{formatPlanPrice(plan.priceUsd)}</td>
                  <td className="px-4 py-3 tabular-nums text-ink">
                    {formatCount(plan.memberCount)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink">
                    {plan.stripePriceId || (
                      <span className="font-sans text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {PLAN_VISIBILITY_LABELS[plan.visibility]}
                    {plan.visibility === "draft" && plan.preview
                      ? " · Preview"
                      : ""}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={planStatusLabel(plan)}
                      status={planStatusLabel(plan)}
                    />
                  </td>
                  <td className={`${TABLE_ACTIONS_TD_CLASS} text-right`}>
                    <TableActions className="justify-end">
                      <TableIconAction
                        href={`/admin/plans/${plan.id}`}
                        label="Edit"
                        detail="Change this plan's settings."
                      >
                        <IconPencil {...TABLE_BTN_ICON} />
                      </TableIconAction>
                      <AdminPlanRowActions plan={plan} />
                    </TableActions>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
