"use client";

import { useMemo, useState } from "react";
import { FuturesSymbolSelect } from "@/components/futures-symbol-select";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  deleteDcaPlaybookAction,
  runDcaPlaybookVerb,
  saveDcaPlaybookAction,
} from "@/lib/dca/actions";
import {
  dcaLastClipDeviationPct,
  dcaMaxDropCoveredPct,
  dcaRequiredUsdt,
} from "@/lib/dca/grid";
import {
  DEFAULT_DCA_NAME,
  dcaPlaybookIsRunning,
  dcaPlaybookStatusLabel,
  type DcaPlaybook,
  type DcaStartKind,
} from "@/lib/dca/playbook";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import Link from "next/link";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

function optional(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

function asNumber(text: string): number | null {
  const value = Number(text.replace(/,/g, "").trim());
  return value > 0 && Number.isFinite(value) ? value : null;
}

export type DcaSignalWebhookOption = {
  id: string;
  name: string;
};

export function DcaPlaybooksDesk({
  playbooks,
  options,
  signalWebhooks,
  availableUsdt = null,
  reduceOnly = false,
}: {
  playbooks: DcaPlaybook[];
  options: LinearPerp[];
  signalWebhooks: DcaSignalWebhookOption[];
  availableUsdt?: number | null;
  reduceOnly?: boolean;
}) {
  const [cards, setCards] = useState<
    { key: string; playbook: DcaPlaybook | null }[]
  >(() => playbooks.map((playbook) => ({ key: playbook.id, playbook })));
  const empty = cards.length === 0;

  return (
    <div className="space-y-4">
      {reduceOnly ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Reduce only is on. New clips stay blocked until you turn it off in
          Desk Settings. Take profit and stop still run.
        </p>
      ) : null}
      {empty ? (
        <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
          No playbooks yet. Add a playbook to own clips and exits on one
          contract. Leave this empty if you are not ready to arm.
        </p>
      ) : (
        cards.map((card, index) => (
          <DcaPlaybookForm
            key={card.key}
            playbook={card.playbook}
            options={options}
            signalWebhooks={signalWebhooks}
            availableUsdt={availableUsdt}
            defaultName={
              card.playbook?.name ??
              (index === 0 ? DEFAULT_DCA_NAME : `DCA ${index + 1}`)
            }
            onRemoveDraft={
              card.playbook
                ? undefined
                : () =>
                    setCards((current) =>
                      current.filter((item) => item.key !== card.key),
                    )
            }
          />
        ))
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setCards((current) => [
              ...current,
              { key: `new-${current.length}-${Date.now()}`, playbook: null },
            ])
          }
          className={
            empty
              ? "rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
              : "rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong"
          }
        >
          Add playbook
        </button>
      </div>
    </div>
  );
}

export function DcaPlaybookForm({
  playbook,
  options,
  signalWebhooks,
  availableUsdt = null,
  reduceOnly = false,
  defaultName,
  onRemoveDraft,
}: {
  playbook: DcaPlaybook | null;
  options: LinearPerp[];
  signalWebhooks: DcaSignalWebhookOption[];
  availableUsdt?: number | null;
  reduceOnly?: boolean;
  defaultName?: string;
  onRemoveDraft?: () => void;
}) {
  const [direction, setDirection] = useState(
    playbook?.direction ?? "long",
  );
  const [startKind, setStartKind] = useState<DcaStartKind>(
    playbook?.startKind ?? "immediate",
  );
  const [dcaMode, setDcaMode] = useState(playbook?.dcaMode ?? "position");
  const [clipSize, setClipSize] = useState(
    playbook ? String(playbook.clipSize) : "",
  );
  const [sizeUnit, setSizeUnit] = useState(playbook?.sizeUnit ?? "qty");
  const [maxClips, setMaxClips] = useState(optional(playbook?.maxClips));
  const [dipPct, setDipPct] = useState(optional(playbook?.dipPct));
  const [sizeMultiplier, setSizeMultiplier] = useState(
    playbook ? String(playbook.sizeMultiplier) : "1",
  );
  const [deviationMultiplier, setDeviationMultiplier] = useState(
    playbook ? String(playbook.deviationMultiplier) : "1",
  );
  const [indicatorKind, setIndicatorKind] = useState(
    playbook?.indicatorKind ?? "rsi",
  );
  const [disarmEnabled, setDisarmEnabled] = useState(
    Boolean(playbook?.disarmTrigger),
  );
  const defaultSymbol =
    playbook?.symbol ??
    options.find((row) => row.symbol === "BTCUSDT")?.symbol ??
    options[0]?.symbol ??
    "BTCUSDT";
  const running = Boolean(playbook && dcaPlaybookIsRunning(playbook));
  const summary = useMemo(() => {
    const clips = asNumber(maxClips);
    const dip = asNumber(dipPct);
    const size = asNumber(clipSize);
    const sizeMult = asNumber(sizeMultiplier) ?? 1;
    const devMult = asNumber(deviationMultiplier) ?? 1;
    const side = direction === "short" ? "short" : "long";
    const covered = dcaMaxDropCoveredPct({
      side,
      maxClips: clips,
      dipPct: dip,
      deviationMultiplier: devMult,
    });
    const lastDev = dcaLastClipDeviationPct({
      side,
      maxClips: clips,
      dipPct: dip,
      deviationMultiplier: devMult,
    });
    const required = dcaRequiredUsdt({
      clipSize: size ?? 0,
      sizeUnit,
      maxClips: clips,
      sizeMultiplier: sizeMult,
      mark: null,
    });
    return { covered, lastDev, required };
  }, [
    clipSize,
    deviationMultiplier,
    direction,
    dipPct,
    maxClips,
    sizeMultiplier,
    sizeUnit,
  ]);

  return (
    <form
      action={saveDcaPlaybookAction}
      className="space-y-4 rounded-card border border-line bg-surface px-4 py-4"
    >
      <input type="hidden" name="playbookId" value={playbook?.id ?? ""} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink">
          Status{" "}
          <span className="text-ink-muted">
            · {playbook ? dcaPlaybookStatusLabel(playbook) : "Idle"}
          </span>
        </p>
        {playbook ? (
          running ? (
            <p className="text-xs text-ink-muted">
              Stop adding or close before removing.
            </p>
          ) : (
            <PendingSubmitButton
              formAction={deleteDcaPlaybookAction}
              pendingLabel="Removing…"
              successKey={`remove-dca-${playbook.id}`}
              className="text-xs text-ink-muted hover:text-danger"
            >
              Remove
            </PendingSubmitButton>
          )
        ) : onRemoveDraft ? (
          <button
            type="button"
            onClick={onRemoveDraft}
            className="text-xs text-ink-muted hover:text-danger"
          >
            Remove
          </button>
        ) : null}
      </div>
      {reduceOnly ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Reduce only is on. New clips stay blocked until you turn it off in
          Desk Settings. Take profit and stop still run.
        </p>
      ) : null}

      <fieldset className="space-y-3 rounded-card border border-line p-4">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
          General
        </legend>
        <label className="block text-sm text-ink">
          Name
          <input
            name="name"
            defaultValue={playbook?.name ?? defaultName ?? DEFAULT_DCA_NAME}
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
          Direction
          <select
            name="direction"
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value as typeof direction)
            }
            className={fieldClass}
          >
            <option value="long">Long</option>
            <option value="short">Short</option>
            <option value="both">Both</option>
          </select>
        </label>
        {direction === "both" ? (
          <p className="text-xs text-ink-muted">
            Long and short clip independently and never flatten each other.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSizeMultiplier("1");
              setDeviationMultiplier("1");
              setDcaMode("position");
            }}
            className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs text-ink"
          >
            Equal clips
          </button>
          <button
            type="button"
            onClick={() => {
              setSizeMultiplier("2");
              setDeviationMultiplier("1.5");
              setDcaMode("position");
            }}
            className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs text-ink"
          >
            Martingale
          </button>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-card border border-line p-4">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Start
        </legend>
        <label className="block text-sm text-ink">
          When to place the first clip
          <select
            name="startKind"
            value={startKind}
            onChange={(event) =>
              setStartKind(event.target.value as DcaStartKind)
            }
            className={fieldClass}
          >
            <option value="immediate">Immediate — Arm places now</option>
            <option value="price">Price cross</option>
            <option value="webhook">Signal webhook</option>
            <option value="indicator">Indicator</option>
          </select>
        </label>
        {startKind === "immediate" ? (
          <p className="text-xs text-ink-muted">
            Arm places the first clip{direction === "both" ? "s" : ""} now.
          </p>
        ) : null}
        {startKind === "price" ? (
          <TriggerFields
            prefix="arm"
            triggerBy={playbook?.armTrigger?.triggerBy ?? "last"}
            compare={playbook?.armTrigger?.compare ?? "gte"}
            price={optional(playbook?.armTrigger?.price)}
          />
        ) : null}
        {startKind === "webhook" ? (
          signalWebhooks.length > 0 ? (
            <label className="block text-sm text-ink">
              Signal
              <select
                name="webhookId"
                defaultValue={playbook?.webhookId ?? signalWebhooks[0]?.id}
                className={fieldClass}
              >
                {signalWebhooks.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-ink-muted">
              Create a Signal on{" "}
              <Link href={FUTURES_PATHS.webhooks} className="text-accent">
                Webhooks
              </Link>{" "}
              first. Arm / disarm / close-playbook still work. Buy / sell arms
              that side only.
            </p>
          )
        ) : null}
        {startKind === "indicator" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-ink">
              Indicator
              <select
                name="indicatorKind"
                value={indicatorKind}
                onChange={(event) =>
              setIndicatorKind(
                event.target.value as "rsi" | "macd" | "ema_cross",
              )
            }
                className={fieldClass}
              >
                <option value="rsi">RSI 14</option>
                <option value="macd">MACD histogram</option>
                <option value="ema_cross">EMA 9/21 cross</option>
              </select>
            </label>
            <label className="block text-sm text-ink">
              Timeframe
              <select
                name="indicatorTimeframe"
                defaultValue={playbook?.indicatorTimeframe ?? "15"}
                className={fieldClass}
              >
                <option value="5">5m</option>
                <option value="15">15m</option>
                <option value="60">1h</option>
              </select>
            </label>
            {indicatorKind === "rsi" ? (
              <>
                <label className="block text-sm text-ink">
                  When
                  <select
                    name="indicatorCompare"
                    defaultValue={playbook?.indicatorCompare ?? "lte"}
                    className={fieldClass}
                  >
                    <option value="lte">At or below</option>
                    <option value="gte">At or above</option>
                  </select>
                </label>
                <label className="block text-sm text-ink">
                  Level
                  <GroupedNumberInput
                    name="indicatorLevel"
                    defaultValue={optional(playbook?.indicatorLevel) || "30"}
                    allowDecimal
                    className={fieldClass}
                  />
                </label>
              </>
            ) : (
              <p className="sm:col-span-2 text-xs text-ink-muted">
                {indicatorKind === "macd"
                  ? "Long starts when the histogram turns positive. Short starts when it turns negative."
                  : "Long starts on a bullish EMA cross. Short starts on a bearish cross."}
              </p>
            )}
          </div>
        ) : null}
      </fieldset>

      <fieldset className="space-y-3 rounded-card border border-line p-4">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Adds
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-ink">
            Clip size
            <GroupedNumberInput
              name="clipSize"
              value={clipSize}
              onChange={setClipSize}
              allowDecimal
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-ink">
            Size unit
            <select
              name="sizeUnit"
              value={sizeUnit}
              onChange={(event) =>
                setSizeUnit(event.target.value as "qty" | "usdt")
              }
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
              value={maxClips}
              onChange={setMaxClips}
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
        <label className="block text-sm text-ink">
          Averaging
          <select
            name="dcaMode"
            value={dcaMode}
            onChange={(event) =>
              setDcaMode(event.target.value as "position" | "order")
            }
            className={fieldClass}
          >
            <option value="position">Position — add when price dips</option>
            <option value="order">Order — rest a safety-order grid</option>
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-ink">
            Add on dip %
            <GroupedNumberInput
              name="dipPct"
              value={dipPct}
              onChange={setDipPct}
              allowDecimal
              className={fieldClass}
              placeholder="Off"
            />
          </label>
          {dcaMode === "position" ? (
            <label className="block text-sm text-ink">
              Add every (minutes)
              <GroupedNumberInput
                name="intervalMinutes"
                defaultValue={optional(playbook?.intervalMinutes)}
                className={fieldClass}
                placeholder="Off"
              />
            </label>
          ) : (
            <p className="self-end text-xs text-ink-muted">
              After the first market clip, remaining clips rest as GTC limits.
              Needs max clips and a dip %.
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-ink">
            Order size multiplier
            <GroupedNumberInput
              name="sizeMultiplier"
              value={sizeMultiplier}
              onChange={setSizeMultiplier}
              allowDecimal
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-ink">
            Price deviation multiplier
            <GroupedNumberInput
              name="deviationMultiplier"
              value={deviationMultiplier}
              onChange={setDeviationMultiplier}
              allowDecimal
              className={fieldClass}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-card border border-line p-4">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Exit
        </legend>
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
            vs
            <select
              name="takeProfitBasis"
              defaultValue={playbook?.takeProfitBasis ?? "average"}
              className={fieldClass}
            >
              <option value="average">Average entry</option>
              <option value="first_entry">First fill</option>
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
          <label className="block text-sm text-ink">
            vs
            <select
              name="stopLossBasis"
              defaultValue={playbook?.stopLossBasis ?? "average"}
              className={fieldClass}
            >
              <option value="average">Average entry</option>
              <option value="first_entry">First fill</option>
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-ink">
            Move stop to breakeven at %
            <GroupedNumberInput
              name="breakevenActivationPct"
              defaultValue={optional(playbook?.breakevenActivationPct)}
              allowDecimal
              className={fieldClass}
              placeholder="Off"
            />
          </label>
          <label className="block text-sm text-ink">
            Breakeven offset %
            <GroupedNumberInput
              name="breakevenOffsetPct"
              defaultValue={optional(playbook?.breakevenOffsetPct)}
              allowDecimal
              className={fieldClass}
              placeholder="0"
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-ink">
            Trail after profit %
            <GroupedNumberInput
              name="trailingTriggerPct"
              defaultValue={optional(playbook?.trailingTriggerPct)}
              allowDecimal
              className={fieldClass}
              placeholder="Off"
            />
          </label>
          <label className="block text-sm text-ink">
            Trail %
            <GroupedNumberInput
              name="trailingPct"
              defaultValue={optional(playbook?.trailingPct)}
              allowDecimal
              className={fieldClass}
              placeholder="Off"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="disarmEnabled"
            value="1"
            checked={disarmEnabled}
            onChange={(event) => setDisarmEnabled(event.target.checked)}
          />
          Stop adding when price crosses
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

      <fieldset className="space-y-2 rounded-card border border-line p-4">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Summary
        </legend>
        <p className="text-sm text-ink">
          Max price move covered{" "}
          <span className="text-ink-muted">
            ·{" "}
            {summary.covered === null
              ? "Set max clips and dip %"
              : `${trimPct(summary.covered)}%`}
          </span>
        </p>
        <p className="text-sm text-ink">
          Last-clip deviation{" "}
          <span className="text-ink-muted">
            ·{" "}
            {summary.lastDev === null
              ? "—"
              : `${trimPct(summary.lastDev)}%`}
          </span>
        </p>
        <p className="text-sm text-ink">
          Required if all clips fill{" "}
          <span className="text-ink-muted">
            ·{" "}
            {summary.required === null
              ? sizeUnit === "qty"
                ? "Use USDT size to estimate"
                : "—"
              : `$${trimPct(summary.required)}`}
          </span>
        </p>
        {availableUsdt !== null && summary.required !== null ? (
          <p
            className={`text-sm ${
              summary.required > availableUsdt ? "text-warning" : "text-ink-muted"
            }`}
          >
            Available {`$${trimPct(availableUsdt)}`}
            {summary.required > availableUsdt
              ? " — less than the full grid."
              : "."}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <PendingSubmitButton
          pendingLabel="Saving…"
          successKey={`save-dca-playbook-${playbook?.id ?? "new"}`}
          className="rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink"
        >
          Save playbook
        </PendingSubmitButton>
        <PendingSubmitButton
          formAction={runDcaPlaybookVerb}
          name="verb"
          value="arm"
          pendingLabel="Arming…"
          successKey={`arm-dca-playbook-${playbook?.id ?? "new"}`}
          className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink"
        >
          Arm
        </PendingSubmitButton>
        <PendingSubmitButton
          formAction={runDcaPlaybookVerb}
          name="verb"
          value="disarm"
          pendingLabel="Stopping…"
          successKey={`disarm-dca-playbook-${playbook?.id ?? "new"}`}
          className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink"
        >
          Stop adding
        </PendingSubmitButton>
        <PendingSubmitButton
          formAction={runDcaPlaybookVerb}
          name="verb"
          value="close-playbook"
          pendingLabel="Closing…"
          successKey={`close-dca-playbook-${playbook?.id ?? "new"}`}
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

function trimPct(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2).replace(/\.?0+$/, "");
}
