import { savePaperRules } from "@/lib/engine/actions";
import type { PaperRulesFormValues } from "@/lib/engine/rules";
import { UsdtSizeInput } from "@/components/usdt-size-input";

export function PaperRulesForm({ values }: { values: PaperRulesFormValues }) {
  return (
    <form action={savePaperRules} className="space-y-8">
      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Engine</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Off means the tick neither opens nor closes. Manual Open and Close
          still work.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={values.enabled}
            className="size-4"
          />
          Enable paper engine
        </label>
        <label className="mt-4 block text-xs text-ink-muted">
          Size USDT
          <div className="mt-1">
            <UsdtSizeInput
              name="notionalUsdt"
              defaultValue={values.notionalUsdt}
              ariaLabel="Paper size in USDT for engine opens"
            />
          </div>
        </label>
      </section>

      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Entry</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Same meaning as the book filters. Empty means no bound. The engine
          skips a pair you already have open.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            id="minApr"
            name="minApr"
            label="Min net APR %"
            placeholder="10"
            defaultValue={values.minApr}
          />
          <Field
            id="minDte"
            name="minDte"
            label="Min DTE"
            placeholder="7"
            defaultValue={values.minDte}
          />
          <Field
            id="maxDte"
            name="maxDte"
            label="Max DTE"
            placeholder="90"
            defaultValue={values.maxDte}
          />
          <Field
            id="minCapacity"
            name="minCapacity"
            label="Min capacity USDT"
            placeholder="5000"
            defaultValue={values.minCapacity}
          />
          <Field
            id="maxOpenCount"
            name="maxOpenCount"
            label="Max open trades"
            placeholder="4"
            defaultValue={values.maxOpenCount}
          />
          <Field
            id="maxOpenNotional"
            name="maxOpenNotional"
            label="Max open notional USDT"
            placeholder="50000"
            defaultValue={values.maxOpenNotional}
          />
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Exit</h2>
        <p className="mt-1 text-sm text-ink-muted">
          First match wins: DTE, then mark APR, then take profit, then stop
          loss. No live mark means no auto-close.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            id="closeMaxDte"
            name="closeMaxDte"
            label="Close when DTE ≤"
            placeholder="3"
            defaultValue={values.closeMaxDte}
          />
          <Field
            id="closeMinApr"
            name="closeMinApr"
            label="Close when mark APR % below"
            placeholder="5"
            defaultValue={values.closeMinApr}
          />
          <Field
            id="takeProfit"
            name="takeProfit"
            label="Take profit %"
            placeholder="1"
            defaultValue={values.takeProfit}
          />
          <Field
            id="stopLoss"
            name="stopLoss"
            label="Stop loss %"
            placeholder="2"
            defaultValue={values.stopLoss}
          />
        </div>
      </section>

      <button
        type="submit"
        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
      >
        Save rules
      </button>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  placeholder,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
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
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
      />
    </label>
  );
}
