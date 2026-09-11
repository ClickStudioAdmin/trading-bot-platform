import {
  PLAN_COMPARE_SECTIONS,
  comparePlanCell,
  formatPlanPrice,
  planIsArchived,
  sortCompareSectionRows,
  type MembershipPlan,
  type PlanCompareCell,
  type PlanCompareRow,
} from "@/lib/membership/catalog";

type CompareBlock =
  | { type: "header" }
  | { type: "section"; title: string; first: boolean }
  | { type: "row"; row: PlanCompareRow }
  | { type: "footer" };

function compareBlocks(plans: MembershipPlan[]): CompareBlock[] {
  const blocks: CompareBlock[] = [{ type: "header" }];
  PLAN_COMPARE_SECTIONS.forEach((section, index) => {
    blocks.push({ type: "section", title: section.title, first: index === 0 });
    const rows = section.fixedOrder
      ? section.rows
      : sortCompareSectionRows(plans, section.rows);
    for (const row of rows) {
      blocks.push({ type: "row", row });
    }
  });
  blocks.push({ type: "footer" });
  return blocks;
}

export function MembershipPlanCards({
  plans,
  currentPlanId,
}: {
  plans: MembershipPlan[];
  currentPlanId: string | null;
}) {
  if (plans.length === 0) {
    return (
      <p className="mt-6 text-sm text-ink-muted">
        No public plans are listed yet.
      </p>
    );
  }

  const blocks = compareBlocks(plans);

  return (
    <div className="mt-6 overflow-x-auto">
      <div
        className="grid w-max max-w-full"
        style={{
          gridTemplateColumns: `18rem repeat(${plans.length}, 12rem)`,
          gridTemplateRows: `repeat(${blocks.length}, auto)`,
          columnGap: "0.75rem",
        }}
      >
        <div
          className="grid grid-rows-subgrid"
          style={{ gridColumn: 1, gridRow: "1 / -1" }}
        >
          {blocks.map((block, index) => (
            <LabelCell key={labelKey(block, index)} block={block} />
          ))}
        </div>
        {plans.map((plan, planIndex) => {
          const current = plan.id === currentPlanId;
          return (
            <div
              key={plan.id}
              className={`grid grid-rows-subgrid overflow-hidden rounded-card border ${
                current
                  ? "border-accent bg-surface"
                  : "border-line bg-surface"
              }`}
              style={{ gridColumn: planIndex + 2, gridRow: "1 / -1" }}
            >
              {blocks.map((block, index) => (
                <PlanCell
                  key={labelKey(block, index)}
                  block={block}
                  plan={plan}
                  current={current}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function labelKey(block: CompareBlock, index: number): string {
  if (block.type === "section") {
    return `section-${block.title}`;
  }
  if (block.type === "row") {
    return `${block.row.kind}-${block.row.key}`;
  }
  return `${block.type}-${index}`;
}

function LabelCell({ block }: { block: CompareBlock }) {
  if (block.type === "header" || block.type === "footer") {
    return <div />;
  }
  if (block.type === "section") {
    return (
      <div
        className={`px-1 text-xs font-medium uppercase tracking-[0.16em] text-accent ${
          block.first ? "pb-2 pt-5" : "pb-2 pt-8"
        }`}
      >
        {block.title}
      </div>
    );
  }
  return (
    <div className="px-1 py-2 text-sm text-ink">{block.row.label}</div>
  );
}

function PlanCell({
  block,
  plan,
  current,
}: {
  block: CompareBlock;
  plan: MembershipPlan;
  current: boolean;
}) {
  if (block.type === "header") {
    return (
      <div
        className={`border-b border-line px-3 pb-4 pt-5 text-center ${
          current ? "bg-surface-raised" : "bg-canvas"
        }`}
      >
        {current ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
            Your plan
          </p>
        ) : null}
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink">
          {plan.name}
        </p>
        {planIsArchived(plan) ? (
          <span className="mt-1 inline-flex items-center justify-center rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning">
            Legacy
          </span>
        ) : plan.visibility !== "public" ? (
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">
            {plan.visibility === "draft" ? "Draft preview" : "Private"}
          </p>
        ) : null}
        <p className="mt-2 text-lg font-semibold tabular-nums text-ink">
          {formatPlanPrice(plan.priceUsd)}
        </p>
      </div>
    );
  }
  if (block.type === "section") {
    return <div className={block.first ? "pt-5" : "pt-8"} />;
  }
  if (block.type === "footer") {
    return (
      <div className="px-4 pb-5 pt-6 text-center">
        {current ? (
          <p className="rounded-control bg-canvas px-3 py-2 text-sm text-ink">
            Current plan
          </p>
        ) : (
          <div>
            <button
              type="button"
              disabled
              className="w-full rounded-control bg-accent-strong/40 px-4 py-2 text-sm font-medium text-ink"
            >
              Upgrade
            </button>
            <p className="mt-2 text-xs text-ink-faint">
              Card checkout is the next step.
            </p>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center px-3 py-2">
      <CompareMark cell={comparePlanCell(plan, block.row)} />
    </div>
  );
}

function CompareMark({ cell }: { cell: PlanCompareCell }) {
  if (cell.kind === "tick") {
    return (
      <span className="inline-flex text-success" aria-label="Included">
        <svg viewBox="0 0 16 16" fill="none" className="size-5" aria-hidden>
          <path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (cell.kind === "cross") {
    return null;
  }
  return (
    <span className="text-base font-semibold tabular-nums text-ink">
      {cell.text}
    </span>
  );
}
