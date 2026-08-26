"use client";

import { useState } from "react";
import { FuturesSymbolSelect } from "@/components/futures-symbol-select";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  runDcaPlaybookVerb,
  saveDcaPlaybookAction,
} from "@/lib/dca/actions";
import {
  DEFAULT_DCA_NAME,
  type DcaPlaybook,
} from "@/lib/dca/playbook";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

function optional(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

export function DcaPlaybookForm({
  playbook,
  options,
  reduceOnly = false,
}: {
  playbook: DcaPlaybook | null;
  options: LinearPerp[];
  reduceOnly?: boolean;
}) {
  const [armEnabled, setArmEnabled] = useState(Boolean(playbook?.armTrigger));
  const [disarmEnabled, setDisarmEnabled] = useState(
    Boolean(playbook?.disarmTrigger),
  );
  const defaultSymbol =
    playbook?.symbol ??
    options.find((row) => row.symbol === "BTCUSDT")?.symbol ??
    options[0]?.symbol ??
    "BTCUSDT";
  const status = playbook?.status ?? "idle";
  const statusLabel =
    status === "armed"
      ? "Armed"
      : status === "stop_adding"
        ? "Stopped adding"
        : "Idle";

  return (
    <form action={saveDcaPlaybookAction} className="max-w-lg space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink">
          Status{" "}
          <span className="text-ink-muted">· {statusLabel}</span>
          {playbook ? ` · ${playbook.clipsFilled} clips` : null}
        </p>
      </div>
      {reduceOnly ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Reduce only is on. New clips stay blocked until you turn it off in
          Desk Settings. Take profit and stop still run.
        </p>
      ) : null}
      <label className="block text-sm text-ink">
        Name
        <input
          name="name"
          defaultValue={playbook?.name ?? DEFAULT_DCA_NAME}
          maxLength={40}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm text-ink">
        Contract
        <div className="mt-1">
          <FuturesSymbolSelect
            options={options}
            defaultSymbol={defaultSymbol}
          />
        </div>
      </label>
      <label className="block text-sm text-ink">
        Side
        <select
          name="side"
          defaultValue={playbook?.side ?? "long"}
          className={fieldClass}
        >
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-ink">
          Clip size
          <GroupedNumberInput
            name="clipSize"
            defaultValue={playbook ? String(playbook.clipSize) : ""}
            allowDecimal
            className={fieldClass}
          />
        </label>
        <label className="block text-sm text-ink">
          Size unit
          <select
            name="sizeUnit"
            defaultValue={playbook?.sizeUnit ?? "qty"}
            className={fieldClass}
          >
            <option value="qty">Token qty</option>
            <option value="usdt">USDT</option>
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-ink">
          Max clips
          <GroupedNumberInput
            name="maxClips"
            defaultValue={optional(playbook?.maxClips)}
            className={fieldClass}
            placeholder="No cap"
          />
        </label>
        <label className="block text-sm text-ink">
          Max value
          <GroupedNumberInput
            name="maxValue"
            defaultValue={optional(playbook?.maxValue)}
            allowDecimal
            className={fieldClass}
            placeholder="No cap"
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-ink">
          Add on dip %
          <GroupedNumberInput
            name="dipPct"
            defaultValue={optional(playbook?.dipPct)}
            allowDecimal
            className={fieldClass}
            placeholder="Off"
          />
        </label>
        <label className="block text-sm text-ink">
          Add every (minutes)
          <GroupedNumberInput
            name="intervalMinutes"
            defaultValue={optional(playbook?.intervalMinutes)}
            className={fieldClass}
            placeholder="Off"
          />
        </label>
      </div>
      <p className="text-xs text-ink-muted">
        First clip places on Arm. Later clips fire when last moves the dip
        from the last clip, or when the interval elapses, whichever comes
        first. Empty dip and interval means one clip, then wait for TP/SL.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-ink">
          Take profit %
          <GroupedNumberInput
            name="takeProfitPct"
            defaultValue={optional(playbook?.takeProfitPct)}
            allowDecimal
            className={fieldClass}
            placeholder="Off"
          />
        </label>
        <label className="block text-sm text-ink">
          Stop loss %
          <GroupedNumberInput
            name="stopLossPct"
            defaultValue={optional(playbook?.stopLossPct)}
            allowDecimal
            className={fieldClass}
            placeholder="Off"
          />
        </label>
      </div>
      <fieldset className="space-y-3 rounded-card border border-line p-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="armEnabled"
            value="1"
            checked={armEnabled}
            onChange={(event) => setArmEnabled(event.target.checked)}
          />
          Arm when price crosses
        </label>
        {armEnabled ? (
          <TriggerFields
            prefix="arm"
            triggerBy={playbook?.armTrigger?.triggerBy ?? "last"}
            compare={playbook?.armTrigger?.compare ?? "gte"}
            price={optional(playbook?.armTrigger?.price)}
          />
        ) : null}
      </fieldset>
      <fieldset className="space-y-3 rounded-card border border-line p-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="disarmEnabled"
            value="1"
            checked={disarmEnabled}
            onChange={(event) => setDisarmEnabled(event.target.checked)}
          />
          Disarm when price crosses
        </label>
        {disarmEnabled ? (
          <TriggerFields
            prefix="disarm"
            triggerBy={playbook?.disarmTrigger?.triggerBy ?? "last"}
            compare={playbook?.disarmTrigger?.compare ?? "lte"}
            price={optional(playbook?.disarmTrigger?.price)}
          />
        ) : null}
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <PendingSubmitButton
          pendingLabel="Saving…"
          successKey="save-dca-playbook"
          className="rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink"
        >
          Save playbook
        </PendingSubmitButton>
        <PendingSubmitButton
          formAction={runDcaPlaybookVerb}
          name="verb"
          value="arm"
          pendingLabel="Arming…"
          successKey="arm-dca-playbook"
          className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink"
        >
          Arm
        </PendingSubmitButton>
        <PendingSubmitButton
          formAction={runDcaPlaybookVerb}
          name="verb"
          value="disarm"
          pendingLabel="Stopping…"
          successKey="disarm-dca-playbook"
          className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink"
        >
          Stop adding
        </PendingSubmitButton>
        <PendingSubmitButton
          formAction={runDcaPlaybookVerb}
          name="verb"
          value="close-playbook"
          pendingLabel="Closing…"
          successKey="close-dca-playbook"
          className="rounded-control border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger"
        >
          Close playbook
        </PendingSubmitButton>
      </div>
    </form>
  );
}

function TriggerFields({
  prefix,
  triggerBy,
  compare,
  price,
}: {
  prefix: "arm" | "disarm";
  triggerBy: string;
  compare: string;
  price: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="block text-xs text-ink-muted">
        Price
        <select
          name={`${prefix}TriggerBy`}
          defaultValue={triggerBy}
          className={fieldClass}
        >
          <option value="last">Last</option>
          <option value="mark">Mark</option>
          <option value="index">Index</option>
        </select>
      </label>
      <label className="block text-xs text-ink-muted">
        When
        <select
          name={`${prefix}Compare`}
          defaultValue={compare}
          className={fieldClass}
        >
          <option value="gte">At or above</option>
          <option value="lte">At or below</option>
        </select>
      </label>
      <label className="block text-xs text-ink-muted">
        Level
        <GroupedNumberInput
          name={`${prefix}Price`}
          defaultValue={price}
          allowDecimal
          className={fieldClass}
        />
      </label>
    </div>
  );
}
