import type { ReactNode } from "react";
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

export function GroupedConditions<T extends { key: string; join: StrategyJoin }>({
  rows,
  lead,
  renderJoin,
  renderRemove,
  renderBody,
}: {
  rows: T[];
  lead?: ReactNode;
  renderJoin: (row: T) => ReactNode;
  renderRemove: (row: T) => ReactNode;
  renderBody: (row: T) => ReactNode;
}) {
  const groups = partitionByOr(rows);
  return (
    <div className="space-y-3">
      {groups.map((group, groupIndex) => {
        const opener = group[0];
        return (
          <div key={opener?.key ?? "group-1"} className="space-y-3">
            {groupIndex > 0 && opener ? (
              <div className="flex items-center gap-3">
                <span className="h-px min-w-0 flex-1 bg-line" aria-hidden />
                {renderJoin(opener)}
                <span className="h-px min-w-0 flex-1 bg-line" aria-hidden />
              </div>
            ) : null}
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
                  {row.join === "and" ? (
                    <div className="flex items-end justify-between gap-3">
                      {renderJoin(row)}
                      {renderRemove(row)}
                    </div>
                  ) : (
                    <div className="flex justify-end">{renderRemove(row)}</div>
                  )}
                  {renderBody(row)}
                </div>
              ))}
            </section>
          </div>
        );
      })}
    </div>
  );
}
