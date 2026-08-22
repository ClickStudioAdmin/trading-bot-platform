import type { OpportunityFilterInputs } from "@/lib/opportunities/filter";

export function OpportunityFiltersForm({
  values,
}: {
  values: OpportunityFilterInputs;
}) {
  return (
    <form
      method="get"
      className="rounded-card border border-line bg-surface p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          id="minApr"
          name="minApr"
          label="Min net APR %"
          defaultValue={values.minApr}
        />
        <Field
          id="minDte"
          name="minDte"
          label="Min DTE"
          defaultValue={values.minDte}
        />
        <Field
          id="maxDte"
          name="maxDte"
          label="Max DTE"
          defaultValue={values.maxDte}
        />
        <Field
          id="minCapacity"
          name="minCapacity"
          label="Min usable book value"
          defaultValue={values.minCapacity}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          Apply filters
        </button>
        <a
          href="/strategies/cash-and-carry/opportunities"
          className="rounded-control border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
        >
          Clear
        </a>
      </div>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <label htmlFor={id} className="block text-xs text-ink-muted">
      {label}
      <input
        id={id}
        name={name}
        type="number"
        step="any"
        inputMode="decimal"
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
      />
    </label>
  );
}
