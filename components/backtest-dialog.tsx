"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/template-modals";
import {
  queueDcaBacktestAction,
  queuePerpsBacktestAction,
} from "@/lib/backtest/actions";
import { BACKTEST_FEE_PRESETS } from "@/lib/backtest/model";
import {
  DCA_INDICATOR_TIMEFRAME_LABELS,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import type { FuturesAutomationFormValues } from "@/lib/futures/automation";
import { perpsFormToSnapshotSource } from "@/lib/templates/recipe";

const INTERVALS: DcaIndicatorTimeframe[] = ["15", "60", "240", "D"];

function BacktestQueueModal({
  title,
  hint,
  pending,
  error,
  windowDays,
  interval,
  onWindowDays,
  onInterval,
  onClose,
  onSubmit,
}: {
  title: string;
  hint: string;
  pending: boolean;
  error: string | null;
  windowDays: string;
  interval: DcaIndicatorTimeframe;
  onWindowDays: (value: string) => void;
  onInterval: (value: DcaIndicatorTimeframe) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="mt-1 text-sm text-ink-muted">
        Paper replay on venue history. This does not touch the live blotter or
        place venue orders.
      </p>
      <label className="mt-4 block text-xs text-ink-muted">
        Window
        <select
          value={windowDays}
          onChange={(event) => onWindowDays(event.target.value)}
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
            onInterval(event.target.value as DcaIndicatorTimeframe)
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
        Fee: {BACKTEST_FEE_PRESETS.vip0_taker.label}. {hint}
      </p>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent disabled:opacity-50"
        >
          {pending ? "Running…" : "Queue backtest"}
        </button>
      </div>
    </Modal>
  );
}

function DisabledBacktest({ title }: { title: string }) {
  return (
    <span className="inline-flex" title={title}>
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

function useBacktestDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState("30");
  const [interval, setInterval] = useState<DcaIndicatorTimeframe>("60");
  return {
    router,
    open,
    setOpen,
    pending,
    setPending,
    error,
    setError,
    windowDays,
    setWindowDays,
    interval,
    setInterval,
  };
}

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
  const dialog = useBacktestDialog();

  async function submit() {
    dialog.setPending(true);
    dialog.setError(null);
    const data = perpsFormToSnapshotSource(layer, venueId);
    data.set("ruleId", layer.id);
    data.set("r0_id", layer.id);
    data.set("venue", venueId);
    if (venueEnvironment) {
      data.set("venueEnvironment", venueEnvironment);
    }
    data.set("symbol", layer.symbol);
    data.set("windowDays", dialog.windowDays);
    data.set("interval", dialog.interval);
    data.set("feePreset", "vip0_taker");
    const result = await queuePerpsBacktestAction(data);
    dialog.setPending(false);
    if (!result.ok) {
      dialog.setError(result.error ?? "Could not run that backtest.");
      return;
    }
    dialog.setOpen(false);
    dialog.router.push(
      result.runId
        ? `/account/backtests?run=${result.runId}`
        : "/account/backtests",
    );
  }

  if (!saved) {
    return <DisabledBacktest title="Save this bot first, then Backtest." />;
  }
  if (webhookEntry) {
    return (
      <DisabledBacktest title="Webhook-entry bots cannot be backtested." />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          dialog.setError(null);
          dialog.setOpen(true);
        }}
        className="shrink-0 rounded-control px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink"
      >
        Backtest
      </button>
      {dialog.open ? (
        <BacktestQueueModal
          title="Backtest this bot"
          hint="Entries fill at bar close. Take profit, stop, and trailing use the bar wick (stop first if both)."
          pending={dialog.pending}
          error={dialog.error}
          windowDays={dialog.windowDays}
          interval={dialog.interval}
          onWindowDays={dialog.setWindowDays}
          onInterval={dialog.setInterval}
          onClose={() => dialog.setOpen(false)}
          onSubmit={() => void submit()}
        />
      ) : null}
    </>
  );
}

export function BacktestDcaButton({
  saved,
  webhookStart,
  venueId,
  venueEnvironment = null,
  playbookId,
  buildForm,
}: {
  saved: boolean;
  webhookStart: boolean;
  venueId: string;
  venueEnvironment?: string | null;
  playbookId: string;
  buildForm: () => FormData;
}) {
  const dialog = useBacktestDialog();

  async function submit() {
    dialog.setPending(true);
    dialog.setError(null);
    const data = buildForm();
    data.set("playbookId", playbookId);
    data.set("venue", venueId);
    data.set("deskVenue", venueId);
    if (venueEnvironment) {
      data.set("venueEnvironment", venueEnvironment);
    }
    data.set("windowDays", dialog.windowDays);
    data.set("interval", dialog.interval);
    data.set("feePreset", "vip0_taker");
    const result = await queueDcaBacktestAction(data);
    dialog.setPending(false);
    if (!result.ok) {
      dialog.setError(result.error ?? "Could not run that backtest.");
      return;
    }
    dialog.setOpen(false);
    dialog.router.push(
      result.runId
        ? `/account/backtests?run=${result.runId}`
        : "/account/backtests",
    );
  }

  if (!saved) {
    return <DisabledBacktest title="Save this bot first, then Backtest." />;
  }
  if (webhookStart) {
    return (
      <DisabledBacktest title="Webhook-start DCA cannot be backtested." />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          dialog.setError(null);
          dialog.setOpen(true);
        }}
        className="shrink-0 rounded-control px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink"
      >
        Backtest
      </button>
      {dialog.open ? (
        <BacktestQueueModal
          title="Backtest this DCA"
          hint="Starts armed. Clips and percent exits decide on close. Stops and trailing use the adverse wick."
          pending={dialog.pending}
          error={dialog.error}
          windowDays={dialog.windowDays}
          interval={dialog.interval}
          onWindowDays={dialog.setWindowDays}
          onInterval={dialog.setInterval}
          onClose={() => dialog.setOpen(false)}
          onSubmit={() => void submit()}
        />
      ) : null}
    </>
  );
}
