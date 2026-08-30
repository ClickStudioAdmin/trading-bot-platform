"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/template-modals";
import { queuePerpsBacktestAction } from "@/lib/backtest/actions";
import { BACKTEST_FEE_PRESETS } from "@/lib/backtest/model";
import {
  DCA_INDICATOR_TIMEFRAME_LABELS,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import type { FuturesAutomationFormValues } from "@/lib/futures/automation";
import { perpsFormToSnapshotSource } from "@/lib/templates/recipe";

const INTERVALS: DcaIndicatorTimeframe[] = ["15", "60", "240", "D"];

export function BacktestBotButton({
  saved,
  webhookEntry,
  layer,
  venueId,
  venueEnvironment = null,
}: {
  saved: boolean;
  webhookEntry: boolean;
  layer: FuturesAutomationFormValues;
  venueId: string;
  venueEnvironment?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState("30");
  const [interval, setInterval] = useState<DcaIndicatorTimeframe>("60");

  async function submit() {
    setPending(true);
    setError(null);
    const data = perpsFormToSnapshotSource(layer, venueId);
    data.set("ruleId", layer.id);
    data.set("r0_id", layer.id);
    data.set("venue", venueId);
    if (venueEnvironment) {
      data.set("venueEnvironment", venueEnvironment);
    }
    data.set("symbol", layer.symbol);
    data.set("windowDays", windowDays);
    data.set("interval", interval);
    data.set("feePreset", "vip0_taker");
    const result = await queuePerpsBacktestAction(data);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not run that backtest.");
      return;
    }
    setOpen(false);
    router.push(
      result.runId
        ? `/account/backtests?run=${result.runId}`
        : "/account/backtests",
    );
  }

  if (!saved) {
    return (
      <span
        className="inline-flex"
        title="Save this bot first, then Backtest."
      >
        <button
          type="button"
          disabled
          className="pointer-events-none shrink-0 rounded-control px-2 py-0.5 text-xs text-ink-muted opacity-40"
        >
          Backtest
        </button>
      </span>
    );
  }
  if (webhookEntry) {
    return (
      <span
        className="inline-flex"
        title="Webhook-entry bots cannot be backtested."
      >
        <button
          type="button"
          disabled
          className="pointer-events-none shrink-0 rounded-control px-2 py-0.5 text-xs text-ink-muted opacity-40"
        >
          Backtest
        </button>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="shrink-0 rounded-control px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink"
      >
        Backtest
      </button>
      {open ? (
        <Modal title="Backtest this bot" onClose={() => setOpen(false)}>
          <p className="mt-1 text-sm text-ink-muted">
            Paper replay on venue history. This does not touch the live blotter
            or place venue orders.
          </p>
          <label className="mt-4 block text-xs text-ink-muted">
            Window
            <select
              value={windowDays}
              onChange={(event) => setWindowDays(event.target.value)}
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
            >
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </label>
          <label className="mt-3 block text-xs text-ink-muted">
            Timeframe
            <select
              value={interval}
              onChange={(event) =>
                setInterval(event.target.value as DcaIndicatorTimeframe)
              }
              className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
            >
              {INTERVALS.map((row) => (
                <option key={row} value={row}>
                  {DCA_INDICATOR_TIMEFRAME_LABELS[row]}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-xs text-ink-muted">
            Fee: {BACKTEST_FEE_PRESETS.vip0_taker.label}. Decide on bar close,
            fill at close.
          </p>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={pending}
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent disabled:opacity-50"
            >
              {pending ? "Running…" : "Queue backtest"}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
