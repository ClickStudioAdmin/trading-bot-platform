import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  PLAN_CAP_GROUPS,
  PLAN_CAP_LABELS,
  PLAN_FEATURE_GROUPS,
  PLAN_FEATURE_LABELS,
  PLAN_NAME_MAX,
  type MembershipPlan,
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
        <div className="mt-4 flex flex-wrap gap-6 text-sm text-ink">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="public"
              value="1"
              defaultChecked={plan?.public ?? true}
            />
            Public (upgrade catalog)
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
      </section>

      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">
          Affiliate rates
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Percent of a referred member’s subscription invoice. L1 + L2 + L3
          cannot exceed 100.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <PctField
            name="affiliateL1Pct"
            label="L1 %"
            defaultValue={plan?.affiliateL1Pct ?? 0}
          />
          <PctField
            name="affiliateL2Pct"
            label="L2 %"
            defaultValue={plan?.affiliateL2Pct ?? 0}
          />
          <PctField
            name="affiliateL3Pct"
            label="L3 %"
            defaultValue={plan?.affiliateL3Pct ?? 0}
          />
        </div>
      </section>

      {PLAN_FEATURE_GROUPS.map((group) => (
        <section
          key={group.title}
          className="rounded-card border border-line bg-surface p-5"
        >
          <h2 className="text-lg font-semibold tracking-tight">{group.title}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {group.keys.map((key) => (
              <label
                key={key}
                className="inline-flex items-start gap-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  name={`feature_${key}`}
                  value="1"
                  defaultChecked={plan?.features[key] ?? false}
                  className="mt-0.5"
                />
                <span>{PLAN_FEATURE_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </section>
      ))}

      {PLAN_CAP_GROUPS.map((group) => (
        <section
          key={group.title}
          className="rounded-card border border-line bg-surface p-5"
        >
          <h2 className="text-lg font-semibold tracking-tight">{group.title}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Empty means unlimited.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {group.keys.map((key) => (
              <label key={key} className="block text-sm text-ink">
                {PLAN_CAP_LABELS[key]}
                <input
                  name={`cap_${key}`}
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={plan?.caps[key] ?? ""}
                  className={fieldClass}
                />
              </label>
            ))}
          </div>
        </section>
      ))}

      <PendingSubmitButton
        pendingLabel={plan ? "Saving…" : "Creating…"}
        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent"
      >
        {plan ? "Save plan" : "Create plan"}
      </PendingSubmitButton>
    </form>
  );
}

function PctField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: number;
}) {
  return (
    <label className="block text-sm text-ink">
      {label}
      <input
        name={name}
        type="number"
        min={0}
        max={100}
        step="0.01"
        required
        defaultValue={defaultValue}
        className={fieldClass}
      />
    </label>
  );
}
