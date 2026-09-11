import {
  PLAN_CAP_GROUPS,
  PLAN_CAP_LABELS,
  PLAN_FEATURE_GROUPS,
  PLAN_FEATURE_LABELS,
  formatPlanCap,
  formatPlanPrice,
  type MembershipPlan,
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

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      {plans.map((plan) => {
        const current = plan.id === currentPlanId;
        return (
          <article
            key={plan.id}
            className={`flex flex-col rounded-card border bg-surface p-5 ${
              current ? "border-accent" : "border-line"
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
              {current ? "Your plan" : "Plan"}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              {plan.name}
            </h2>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatPlanPrice(plan.priceUsd)}
            </p>
            <ul className="mt-5 flex-1 space-y-4 text-sm">
              {PLAN_FEATURE_GROUPS.map((group) => {
                const on = group.keys.filter((key) => plan.features[key]);
                if (on.length === 0) {
                  return null;
                }
                return (
                  <li key={group.title}>
                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                      {group.title}
                    </p>
                    <p className="mt-1 text-ink">
                      {on.map((key) => PLAN_FEATURE_LABELS[key]).join(", ")}
                    </p>
                  </li>
                );
              })}
              {PLAN_CAP_GROUPS.map((group) => {
                const set = group.keys.filter(
                  (key) => plan.caps[key] !== null,
                );
                if (set.length === 0) {
                  return null;
                }
                return (
                  <li key={group.title}>
                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                      {group.title}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-ink">
                      {set.map((key) => (
                        <li key={key}>
                          {PLAN_CAP_LABELS[key]}: {formatPlanCap(plan.caps[key])}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
            {plan.features.affiliate_enroll ? (
              <p className="mt-4 text-sm text-ink-muted">
                Affiliate L1 {plan.affiliateL1Pct}% · L2 {plan.affiliateL2Pct}%
                {plan.affiliateL3Pct > 0
                  ? ` · L3 ${plan.affiliateL3Pct}%`
                  : ""}
              </p>
            ) : null}
            {current ? (
              <p className="mt-5 rounded-control bg-surface-raised px-3 py-2 text-center text-sm text-ink">
                Current plan
              </p>
            ) : (
              <p className="mt-5">
                <button
                  type="button"
                  disabled
                  className="w-full rounded-control bg-accent-strong/40 px-4 py-2 text-sm font-medium text-ink"
                >
                  Upgrade
                </button>
                <span className="mt-2 block text-center text-xs text-ink-faint">
                  Card checkout is the next step.
                </span>
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
