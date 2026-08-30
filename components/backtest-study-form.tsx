"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { startBacktestStudyAction } from "@/lib/backtest/actions";
import {
  DEFAULT_STARTING_USDT,
  defaultBacktestDates,
  parseBacktestDateRange,
} from "@/lib/backtest/model";
import { expandStudyScenarios } from "@/lib/backtest/study";
import type { StudySeedOption } from "@/lib/backtest/study-seeds";

export function BacktestStudyForm({ seeds }: { seeds: StudySeedOption[] }) {
  const router = useRouter();
  const dates = defaultBacktestDates();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedKey, setSeedKey] = useState(seeds[0]?.key ?? "");
  const [fromDate, setFromDate] = useState(dates.from);
  const [toDate, setToDate] = useState(dates.to);

  const preview = useMemo(() => {
    const seed = seeds.find((row) => row.key === seedKey);
    const range = parseBacktestDateRange(fromDate, toDate, "D");
    if (!seed || !range.ok) {
      return { count: 0, truncated: false };
    }
    const expanded = expandStudyScenarios(
      seed.recipe,
      range.fromMs,
      range.toMs,
    );
    return {
      count: expanded.scenarios.length,
      truncated: expanded.truncated,
    };
  }, [fromDate, seedKey, seeds, toDate]);

  if (seeds.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No Perps bots or DCA playbooks on any desk. Add a bot on a desk first.
      </p>
    );
  }

  return (
    <form
      className="space-y-3"
      action={async (formData) => {
        setPending(true);
        setError(null);
        const result = await startBacktestStudyAction(formData);
        setPending(false);
        if (!result.ok) {
          setError(result.error ?? "Could not run that study.");
          return;
        }
        router.push(
          result.studyId
            ? `/admin/backtests/studies/${result.studyId}`
            : "/admin/backtests",
        );
        router.refresh();
      }}
    >
      <label className="block text-xs text-ink-muted">
        Desk bot
        <select
          name="seedKey"
          value={seedKey}
          onChange={(event) => setSeedKey(event.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
          required
        >
          {seeds.map((row) => (
            <option key={row.key} value={row.key}>
              {row.label}
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
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="block text-xs text-ink-muted">
          End date
          <input
            type="date"
            name="toDate"
            required
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
          />
        </label>
      </div>
      <label className="block text-xs text-ink-muted">
        Initial account balance
        <input
          name="startingBalance"
          required
          defaultValue={String(DEFAULT_STARTING_USDT)}
          className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm tabular-nums text-ink"
        />
      </label>
      <input
        type="hidden"
        name="venueEnvironment"
        value={seeds.find((row) => row.key === seedKey)?.venueEnvironment ?? ""}
      />
      <label className="block text-xs text-ink-muted">
        Venue
        <select
          key={seedKey}
          name="venue"
          defaultValue={seeds.find((row) => row.key === seedKey)?.venue ?? "bybit"}
          className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
        >
          <option value="bybit">Bybit</option>
          <option value="hyperliquid">Hyperliquid</option>
        </select>
      </label>
      <p className="text-sm text-ink-muted">
        {preview.count === 0
          ? "Pick dates that fit at least one timeframe."
          : preview.truncated
            ? `This will run ${preview.count} scenarios (capped). Entry triggers, timeframes, take profits, and stops are combined from the locked study grid.`
            : `This will run ${preview.count} scenarios — every discrete entry, timeframe, take profit, and stop from the study grid.`}
      </p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={pending || preview.count === 0}
        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent disabled:opacity-50"
      >
        {pending ? "Running study…" : "Run study"}
      </button>
    </form>
  );
}
