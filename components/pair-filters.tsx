import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import type { PairFilterInputs } from "@/lib/pairs/filter";
import { DESK_QUERY } from "@/lib/accounts/model";

const FILTER_INPUT_CLASS =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none";

export function PairFiltersForm({
  clearHref,
  values,
  bases,
  showDte = false,
  deskId,
}: {
  clearHref: string;
  values: PairFilterInputs;
  bases?: readonly string[];
  showDte?: boolean;
  deskId?: string | null;
}) {
  return (
    <form
      method="get"
      className="rounded-card border border-line bg-surface p-4"
    >
      {deskId ? (
        <input type="hidden" name={DESK_QUERY} value={deskId} />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs text-ink-muted">
          Search
          <input
            name="q"
            type="search"
            defaultValue={values.q}
            placeholder="Base or contract"
            autoComplete="off"
            className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          />
        </label>
        {bases ? (
          <label className="block text-xs text-ink-muted">
            Base
            <select
              name="base"
              defaultValue={values.base}
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
            >
              <option value="">All</option>
              {bases.map((base) => (
                <option key={base} value={base}>
                  {base}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block text-xs text-ink-muted">
            Base
            <input
              name="base"
              defaultValue={values.base}
              placeholder="BTC"
              autoComplete="off"
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
            />
          </label>
        )}
        {showDte ? (
          <>
            <label className="block text-xs text-ink-muted">
              Min DTE
              <GroupedNumberInput
                name="minDte"
                defaultValue={values.minDte}
                allowDecimal
                className={FILTER_INPUT_CLASS}
              />
            </label>
            <label className="block text-xs text-ink-muted">
              Max DTE
              <GroupedNumberInput
                name="maxDte"
                defaultValue={values.maxDte}
                allowDecimal
                className={FILTER_INPUT_CLASS}
              />
            </label>
          </>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <PendingSubmitButton
          pendingLabel="Applying…"
          className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          Apply filters
        </PendingSubmitButton>
        <Link
          href={clearHref}
          className="rounded-control border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
        >
          Clear
        </Link>
      </div>
    </form>
  );
}
