import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  adminPlanSections,
  affiliateRateFieldName,
  PLAN_NAME_MAX,
  PLAN_VISIBILITIES,
  PLAN_VISIBILITY_LABELS,
  type MembershipPlan,
  type PlanCompareRow,
} from "@/lib/membership/catalog";
import {
  createMembershipPlanAction,
  updateMembershipPlanAction,
} from "@/lib/membership/actions";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function AdminPlanForm({
  plan,
}: {
  plan?: MembershipPlan;
}) {
  const action = plan ? updateMembershipPlanAction : createMembershipPlanAction;
  return (
    <form action={action} className="mt-6 space-y-6">
      {plan ? <input type="hidden" name="planId" value={plan.id} /> : null}
      {plan ? <input type="hidden" name="slug" value={plan.slug} /> : null}

      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Plan</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-ink">
            Name
            <input
              name="name"
              required
              maxLength={PLAN_NAME_MAX}
              defaultValue={plan?.name ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-ink">
            Sort order
            <input
              name="sortOrder"
              type="number"
              min={0}
              max={9999}
              step={1}
              required
              defaultValue={plan?.sortOrder ?? 0}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-ink">
            Monthly price (USD)
            <input
              name="priceUsd"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={plan?.priceUsd ?? 0}
              className={fieldClass}
            />
            <span className="mt-1 block text-xs text-ink-muted">
              0 is Free. Seed prices are placeholders until Stripe.
            </span>
          </label>
          <label className="block text-sm text-ink">
            Stripe price id
            <input
              name="stripePriceId"
              defaultValue={plan?.stripePriceId ?? ""}
              className={fieldClass}
              placeholder="price_…"
            />
          </label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-ink">
            Visibility
            <select
              name="visibility"
              defaultValue={plan?.visibility ?? "draft"}
              className={fieldClass}
            >
              {PLAN_VISIBILITIES.map((value) => (
                <option key={value} value={value}>
                  {PLAN_VISIBILITY_LABELS[value]}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-ink-muted">
              Public is on the Plans page. Private is assign-only. Draft is not
              published.
            </span>
          </label>
          <div className="space-y-3 self-end pb-1 text-sm text-ink">
            <label className="inline-flex items-start gap-2">
              <input
                type="checkbox"
                name="preview"
                value="1"
                defaultChecked={plan?.preview ?? false}
                className="mt-0.5"
              />
              <span>
                Show this draft on the Plans page for preview
                <span className="mt-1 block text-xs text-ink-muted">
                  Admins only. Ignored unless visibility is Draft.
                </span>
              </span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                name="isDefault"
                value="1"
                defaultChecked={plan?.isDefault ?? false}
              />
              Default for new members
            </label>
          </div>
        </div>
      </section>

      {adminPlanSections().map((section) => {
        const hasCaps = section.rows.some((row) => row.kind === "cap");
        const hasRates = section.rows.some((row) => row.kind === "rate");
        return (
          <section
            key={section.title}
            className="rounded-card border border-line bg-surface p-5"
          >
            <h2 className="text-lg font-semibold tracking-tight">
              {section.title}
            </h2>
            {hasCaps ? (
              <p className="mt-1 text-sm text-ink-muted">
                Empty means unlimited.
              </p>
            ) : null}
            {hasRates ? (
              <p className="mt-1 text-sm text-ink-muted">
                Percent of a referred member’s subscription invoice. L1 through
                L5 cannot exceed 100 combined.
              </p>
            ) : null}
            <div className="mt-4 space-y-4">
              {section.rows.map((row) => (
                <AdminPlanRow key={`${row.kind}-${row.key}`} row={row} plan={plan} />
              ))}
            </div>
          </section>
        );
      })}

      <PendingSubmitButton
        pendingLabel={plan ? "Saving…" : "Creating…"}
        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent"
      >
        {plan ? "Save plan" : "Create plan"}
      </PendingSubmitButton>
    </form>
  );
}

function AdminPlanRow({
  row,
  plan,
}: {
  row: PlanCompareRow;
  plan?: MembershipPlan;
}) {
  if (row.kind === "feature") {
    return (
      <label className="flex w-full items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name={`feature_${row.key}`}
          value="1"
          defaultChecked={plan?.features[row.key] ?? false}
          className="mt-0.5"
        />
        <span>{row.label}</span>
      </label>
    );
  }
  if (row.kind === "cap") {
    return (
      <label className="block max-w-md text-sm text-ink">
        {row.label}
        <input
          name={`cap_${row.key}`}
          type="number"
          min={0}
          step={1}
          defaultValue={plan?.caps[row.key] ?? ""}
          className={fieldClass}
        />
      </label>
    );
  }
  const field = affiliateRateFieldName(row.key);
  return (
    <label className="block max-w-xs text-sm text-ink">
      {row.label}
      <input
        name={field}
        type="number"
        min={0}
        max={100}
        step="0.01"
        required
        defaultValue={plan?.[field] ?? 0}
        className={fieldClass}
      />
    </label>
  );
}
