import type { ReactNode } from "react";
import { IconPlus } from "@/components/icons";
import type { StrategyJoin } from "@/lib/strategy/expr";

export function partitionByOr<T extends { join: StrategyJoin }>(rows: T[]): T[][] {
  const groups: T[][] = [[]];
  for (const row of rows) {
    if (row.join === "or") {
      groups.push([row]);
    } else {
      groups[groups.length - 1]?.push(row);
    }
  }
  return groups;
}

/** Where an And row belongs: after the last row of that group. */
export function andInsertIndex<T extends { join: StrategyJoin }>(
  rows: readonly T[],
  groupIndex: number,
): number {
  const groups = partitionByOr(rows as T[]);
  const group = groups[groupIndex] ?? [];
  if (group.length === 0) {
    return 0;
  }
  const last = group[group.length - 1];
  const index = last ? rows.indexOf(last) : -1;
  return index < 0 ? rows.length : index + 1;
}

export function insertAt<T>(rows: readonly T[], index: number, row: T): T[] {
  return [...rows.slice(0, index), row, ...rows.slice(index)];
}

export function AddConditionButton({
  onClick,
  centered = false,
}: {
  onClick: () => void;
  centered?: boolean;
}) {
  const button = (
    <button
      type="button"
      className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
      onClick={onClick}
    >
      <IconPlus size={14} className="size-3.5" />
      Add condition
    </button>
  );
  if (!centered) {
    return button;
  }
  return (
    <div className="flex items-center gap-3">
      <span className="h-px min-w-0 flex-1 bg-line" aria-hidden />
      {button}
      <span className="h-px min-w-0 flex-1 bg-line" aria-hidden />
    </div>
  );
}

function OrSeam() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px min-w-0 flex-1 bg-line" aria-hidden />
      <span className="text-sm text-ink">Or</span>
      <span className="h-px min-w-0 flex-1 bg-line" aria-hidden />
    </div>
  );
}

export function GroupedConditions<T extends { key: string; join: StrategyJoin }>({
  rows,
  lead,
  renderRemove,
  renderBody,
  renderAddInGroup,
  addGroup,
}: {
  rows: T[];
  lead?: ReactNode;
  renderRemove: (row: T) => ReactNode;
  renderBody: (row: T) => ReactNode;
  renderAddInGroup?: (groupIndex: number) => ReactNode;
  addGroup?: ReactNode;
}) {
  const groups = partitionByOr(rows);
  return (
    <div className="space-y-3">
      {groups.map((group, groupIndex) => {
        const opener = group[0];
        return (
          <div key={opener?.key ?? "group-1"} className="space-y-3">
            {groupIndex > 0 ? <OrSeam /> : null}
            <section className="space-y-4 rounded-card border border-line bg-canvas px-4 py-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-ink">
                  Group {groupIndex + 1}
                </h3>
                <p className="text-hint text-ink-muted">
                  Every condition in this group must be true.
                </p>
              </div>
              {groupIndex === 0 ? lead : null}
              {group.map((row) => (
                <div key={row.key} className="space-y-3">
                  <div className="flex justify-end">{renderRemove(row)}</div>
                  {renderBody(row)}
                </div>
              ))}
              {renderAddInGroup?.(groupIndex)}
            </section>
          </div>
        );
      })}
      {addGroup}
    </div>
  );
}
