import {
  comparePlanCell,
  compareUpgradeBands,
  formatPlanPrice,
  type MembershipPlan,
  type PlanCompareCell,
  type PlanCompareRow,
} from "@/lib/membership/catalog";

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

  const bands = compareUpgradeBands(plans);

  return (
    <div className="mt-6 overflow-x-auto rounded-card border border-line bg-surface">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="sticky left-0 z-10 min-w-52 bg-surface px-4 py-4 text-left font-medium text-ink-muted">
              <span className="sr-only">Feature</span>
            </th>
            {plans.map((plan) => {
              const current = plan.id === currentPlanId;
              return (
                <th
                  key={plan.id}
                  className={`min-w-36 px-4 py-4 text-center ${
                    current ? "bg-surface-raised" : "bg-surface"
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
                  <p className="mt-2 text-lg font-semibold tabular-nums text-ink">
                    {formatPlanPrice(plan.priceUsd)}
                  </p>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {bands.map((band) => (
            <CompareBand
              key={band.title}
              title={band.title}
              sections={band.sections}
              plans={plans}
              currentPlanId={currentPlanId}
            />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line">
            <td className="sticky left-0 z-10 bg-surface px-4 py-4" />
            {plans.map((plan) => {
              const current = plan.id === currentPlanId;
              return (
                <td
                  key={plan.id}
                  className={`px-4 py-4 text-center ${
                    current ? "bg-surface-raised" : "bg-surface"
                  }`}
                >
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
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function CompareBand({
  title,
  sections,
  plans,
  currentPlanId,
}: {
  title: string;
  sections: readonly { title: string; rows: readonly PlanCompareRow[] }[];
  plans: MembershipPlan[];
  currentPlanId: string | null;
}) {
  return (
    <>
      <tr className="border-t border-line bg-canvas">
        <th
          colSpan={plans.length + 1}
          scope="colgroup"
          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-accent"
        >
          {title}
        </th>
      </tr>
      {sections.map((section) => (
        <CompareSection
          key={`${title}-${section.title}`}
          title={section.title}
          rows={section.rows}
          plans={plans}
          currentPlanId={currentPlanId}
        />
      ))}
    </>
  );
}

function CompareSection({
  title,
  rows,
  plans,
  currentPlanId,
}: {
  title: string;
  rows: readonly PlanCompareRow[];
  plans: MembershipPlan[];
  currentPlanId: string | null;
}) {
  return (
    <>
      <tr className="border-t border-line bg-surface-raised">
        <th
          colSpan={plans.length + 1}
          scope="colgroup"
          className="px-4 py-2 text-left text-xs font-medium uppercase tracking-[0.16em] text-ink-muted"
        >
          {title}
        </th>
      </tr>
      {rows.map((row) => (
        <tr key={`${row.kind}-${row.key}`} className="border-t border-line">
          <th
            scope="row"
            className="sticky left-0 bg-surface px-4 py-2.5 text-left font-normal text-ink"
          >
            {row.label}
          </th>
          {plans.map((plan) => {
            const current = plan.id === currentPlanId;
            const cell = comparePlanCell(plan, row);
            return (
              <td
                key={plan.id}
                className={`px-4 py-2.5 text-center ${
                  current ? "bg-surface-raised" : "bg-surface"
                }`}
              >
                <CompareMark cell={cell} />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function CompareMark({ cell }: { cell: PlanCompareCell }) {
  if (cell.kind === "tick") {
    return (
      <span className="inline-flex text-success" aria-label="Included">
        <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
          <path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (cell.kind === "cross") {
    return (
      <span className="text-ink-faint" aria-label="Not included">
        ×
      </span>
    );
  }
  return <span className="tabular-nums text-ink">{cell.text}</span>;
}
