"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { queueTemplateBacktestAction } from "@/lib/backtest/actions";
import {
  BACKTEST_FEE_PRESETS,
  DEFAULT_STARTING_USDT,
  defaultBacktestDates,
} from "@/lib/backtest/model";
import type { BacktestLibraryItem } from "@/components/backtest-dialog";
import {
  DCA_INDICATOR_TIMEFRAME_LABELS,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";

const INTERVALS: DcaIndicatorTimeframe[] = ["15", "60", "240", "D"];

export function BacktestQueueForm({
  templates,
  selectedTemplateId = "",
  defaultVenue = "bybit",
  defaultVenueEnvironment = null,
}: {
  templates: BacktestLibraryItem[];
  selectedTemplateId?: string;
  defaultVenue?: string;
  defaultVenueEnvironment?: string | null;
}) {
  const router = useRouter();
  const dates = defaultBacktestDates();
  const initial =
    templates.find((row) => row.id === selectedTemplateId) ?? templates[0];
  const [templateId, setTemplateId] = useState(initial?.id ?? "");
  const [symbol, setSymbol] = useState(initial?.recipe.symbol ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => templates.find((row) => row.id === templateId) ?? null,
    [templateId, templates],
  );

  if (templates.length === 0) {
    return (
      <section className="mb-8 max-w-xl rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">New backtest</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Save a Perps bots or DCA configuration as a template first, then
          queue it here.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8 max-w-xl rounded-card border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">New backtest</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Paper replay on venue history. Start and end dates and an initial
        balance are required. This does not touch the live blotter.
      </p>
      <form
        className="mt-4 space-y-3"
        action={async (formData) => {
          setPending(true);
          setError(null);
          const result = await queueTemplateBacktestAction(formData);
          setPending(false);
          if (!result.ok) {
            setError(result.error ?? "Could not run that backtest.");
            return;
          }
          router.push(
            result.runId
              ? `/account/backtests?run=${result.runId}`
              : "/account/backtests",
          );
          router.refresh();
        }}
      >
        <label className="block text-xs text-ink-muted">
          Template
          <select
            name="templateId"
            required
            value={templateId}
            onChange={(event) => {
              const next = templates.find((row) => row.id === event.target.value);
              setTemplateId(event.target.value);
              if (next) {
                setSymbol(next.recipe.symbol);
              }
            }}
            className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
          >
            {templates.map((row) => (
              <option key={row.id} value={row.id}>
                {row.recipe.kind === "dca" ? "DCA" : "Perps"} · {row.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-ink-muted">
            Start date
            <input
              type="date"
              name="fromDate"
              required
              defaultValue={dates.from}
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="block text-xs text-ink-muted">
            End date
            <input
              type="date"
              name="toDate"
              required
              defaultValue={dates.to}
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
            />
          </label>
        </div>
        <label className="block text-xs text-ink-muted">
          Initial account balance
          <input
            name="startingBalance"
            required
            inputMode="decimal"
            defaultValue={String(DEFAULT_STARTING_USDT)}
            className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm tabular-nums text-ink"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-ink-muted">
            Timeframe
            <select
              name="interval"
              defaultValue="60"
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
            >
              {INTERVALS.map((row) => (
                <option key={row} value={row}>
                  {DCA_INDICATOR_TIMEFRAME_LABELS[row]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-ink-muted">
            Venue
            <select
              name="venue"
              defaultValue={defaultVenue === "hyperliquid" ? "hyperliquid" : "bybit"}
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
            >
              <option value="bybit">Bybit</option>
              <option value="hyperliquid">Hyperliquid</option>
            </select>
          </label>
        </div>
        <label className="block text-xs text-ink-muted">
          Contract
          <input
            name="symbol"
            required
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
          />
        </label>
        {selected ? (
          <p className="text-xs text-ink-muted">
            {selected.recipe.kind === "dca"
              ? "DCA starts armed. Clips and percent exits decide on close."
              : "Entries fill at bar close. Stops use the adverse wick."}{" "}
            Fee: {BACKTEST_FEE_PRESETS.vip0_taker.label}.
          </p>
        ) : null}
        {defaultVenueEnvironment ? (
          <input
            type="hidden"
            name="venueEnvironment"
            value={defaultVenueEnvironment}
          />
        ) : null}
        <input type="hidden" name="feePreset" value="vip0_taker" />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent disabled:opacity-50"
        >
          {pending ? "Running…" : "Run backtest"}
        </button>
      </form>
    </section>
  );
}
