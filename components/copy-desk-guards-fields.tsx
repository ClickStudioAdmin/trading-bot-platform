"use client";

import { CopySizeFields } from "@/components/copy-size-fields";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import type { CopySizeMode } from "@/lib/copy/model";

export function CopyDeskGuardsFields({
  defaultSizeMode,
  defaultPercent,
  defaultBookUsdt,
  defaultReduceOnly = false,
  defaultMaxDailyLossUsdt,
  defaultMaxDrawdownPct,
  defaultMaxAdverseMovePct,
}: {
  defaultSizeMode?: CopySizeMode;
  defaultPercent?: string;
  defaultBookUsdt?: string;
  defaultReduceOnly?: boolean;
  defaultMaxDailyLossUsdt?: string;
  defaultMaxDrawdownPct?: string;
  defaultMaxAdverseMovePct?: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-ink">Guards</p>
        <p className="mt-1 text-xs text-ink-muted">
          Sizing follows the parent fill. Reduce-only blocks new entries. Max
          daily loss and max drawdown flatten and pause. Max adverse move skips
          a late entry. Position caps are parked until we design them.
        </p>
      </div>
      <CopySizeFields
        defaultMode={defaultSizeMode}
        defaultPercent={defaultPercent}
        defaultBookUsdt={defaultBookUsdt}
      />
      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="reduceOnly"
          defaultChecked={defaultReduceOnly}
          className="mt-0.5"
        />
        <span>
          Reduce only
          <span className="mt-1 block text-xs text-ink-muted">
            Blocks new copied entries. Close still works.
          </span>
        </span>
      </label>
      <label className="block text-sm text-ink">
        Max daily loss
        <span className="relative mt-1 block">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
            $
          </span>
          <GroupedNumberInput
            name="maxDailyLossUsdt"
            defaultValue={defaultMaxDailyLossUsdt ?? ""}
            allowDecimal
            placeholder="No cap"
            ariaLabel="Max daily loss"
            className="w-full rounded-control border border-line bg-surface-raised py-2 pr-3 pl-7 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
          />
        </span>
      </label>
      <label className="block text-sm text-ink">
        Max drawdown
        <span className="relative mt-1 block">
          <GroupedNumberInput
            name="maxDrawdownPct"
            defaultValue={defaultMaxDrawdownPct ?? ""}
            allowDecimal
            placeholder="Off"
            ariaLabel="Max drawdown percent"
            className="w-full rounded-control border border-line bg-surface-raised py-2 pr-8 pl-3 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-muted">
            %
          </span>
        </span>
        <span className="mt-1 block text-xs text-ink-muted">
          From the peak since you followed or last resumed. Uses this desk’s
          equity (available plus unrealized). Breach flattens and pauses.
        </span>
      </label>
      <label className="block text-sm text-ink">
        Max adverse move
        <span className="relative mt-1 block">
          <GroupedNumberInput
            name="maxAdverseMovePct"
            defaultValue={defaultMaxAdverseMovePct ?? ""}
            allowDecimal
            placeholder="Off"
            ariaLabel="Max adverse move percent"
            className="w-full rounded-control border border-line bg-surface-raised py-2 pr-8 pl-3 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-muted">
            %
          </span>
        </span>
        <span className="mt-1 block text-xs text-ink-muted">
          Skips a new entry when the mark has moved against the parent fill by
          more than this. Closes still copy.
        </span>
      </label>
    </div>
  );
}
