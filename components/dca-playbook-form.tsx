"use client";

import { useMemo, useState } from "react";
import { ColumnHint } from "@/components/column-hint";
import { FuturesSymbolSelect } from "@/components/futures-symbol-select";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  deleteDcaPlaybookAction,
  runDcaPlaybookVerb,
  saveDcaPlaybookAction,
} from "@/lib/dca/actions";
import {
  dcaLadderLevels,
  dcaLastClipDeviationPct,
  dcaMaxDropCoveredPct,
  dcaRequiredUsdt,
} from "@/lib/dca/grid";
import {
  DEFAULT_DCA_NAME,
  dcaAveragingKind,
  dcaIntervalParts,
  dcaPlaybookIsRunning,
  dcaPlaybookStatusLabel,
  type DcaAveragingKind,
  type DcaIntervalUnit,
  type DcaPlaybook,
  type DcaStartKind,
} from "@/lib/dca/playbook";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import Link from "next/link";

const fieldClass =
  "mt-0.5 w-full rounded-control border border-line bg-surface-raised px-2 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none";
const labelClass = "block text-xs text-ink-muted";
const sectionClass =
  "space-y-2 rounded-card border border-line px-3 py-2";
const rowClass = "grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-4";

function optional(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

function asNumber(text: string): number | null {
  const value = Number(text.replace(/,/g, "").trim());
  return value > 0 && Number.isFinite(value) ? value : null;
}

function SummaryStat({
  label,
  value,
  hint,
  valueClass = "text-ink",
}: {
  label: string;
  value: string;
  hint?: string | null;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
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
  lastPrices = {},
  reduceOnly = false,
}: {
  playbooks: DcaPlaybook[];
  options: LinearPerp[];
  signalWebhooks: DcaSignalWebhookOption[];
  availableUsdt?: number | null;
  lastPrices?: Record<string, number>;
  reduceOnly?: boolean;
}) {
  const [cards, setCards] = useState<
    { key: string; playbook: DcaPlaybook | null }[]
  >(() => playbooks.map((playbook) => ({ key: playbook.id, playbook })));
  const empty = cards.length === 0;

  return (
    <div className="space-y-3">
      {reduceOnly ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Reduce only is on. New orders stay blocked until you turn it off in
          Desk Settings. Take profit and stop still run.
        </p>
      ) : null}
      {empty ? (
        <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
          No playbooks yet. Add a playbook to own orders and exits on one
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
            lastPrices={lastPrices}
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
  lastPrices = {},
  reduceOnly = false,
  defaultName,
  onRemoveDraft,
}: {
  playbook: DcaPlaybook | null;
  options: LinearPerp[];
  signalWebhooks: DcaSignalWebhookOption[];
  availableUsdt?: number | null;
  lastPrices?: Record<string, number>;
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
  const [averaging, setAveraging] = useState<DcaAveragingKind>(() =>
    playbook ? dcaAveragingKind(playbook) : "dip",
  );
  const [restGrid, setRestGrid] = useState(
    playbook?.dcaMode === "order",
  );
  const [clipSize, setClipSize] = useState(
    playbook ? String(playbook.clipSize) : "",
  );
  const [sizeUnit, setSizeUnit] = useState(playbook?.sizeUnit ?? "usdt");
  const [maxClips, setMaxClips] = useState(optional(playbook?.maxClips));
  const [dipPct, setDipPct] = useState(optional(playbook?.dipPct));
  const intervalParts = dcaIntervalParts(playbook?.intervalMinutes ?? null);
  const [intervalUnit, setIntervalUnit] = useState<DcaIntervalUnit>(
    intervalParts.unit,
  );
  const [sizeMultiplier, setSizeMultiplier] = useState(
    playbook ? String(playbook.sizeMultiplier) : "1",
  );
  const [deviationMultiplier, setDeviationMultiplier] = useState(
    playbook ? String(playbook.deviationMultiplier) : "1",
  );
  const [indicatorKind, setIndicatorKind] = useState(
    playbook?.indicatorKind ?? "rsi",
  );
  const defaultSymbol =
    playbook?.symbol ??
    options.find((row) => row.symbol === "BTCUSDT")?.symbol ??
    options[0]?.symbol ??
    "BTCUSDT";
  const [symbol, setSymbol] = useState(defaultSymbol);
  const lastPrice = lastPrices[symbol] ?? null;
  const running = Boolean(playbook && dcaPlaybookIsRunning(playbook));
  const summary = useMemo(() => {
    const clips = asNumber(maxClips);
    const dip = averaging === "dip" ? asNumber(dipPct) : null;
    const size = asNumber(clipSize);
    const sizeMult = asNumber(sizeMultiplier) ?? 1;
    const devMult = asNumber(deviationMultiplier) ?? 1;
    const side = direction === "short" ? "short" : "long";
    const entryPrice = lastPrice !== null && lastPrice > 0 ? lastPrice : 100;
    const priceFromLast = lastPrice !== null && lastPrice > 0;
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
    const levels = dcaLadderLevels({
      side,
      entryPrice,
      maxClips: clips,
      dipPct: dip,
      clipSize: size ?? 0,
      sizeUnit,
      sizeMultiplier: sizeMult,
      deviationMultiplier: devMult,
    });
    const requiredFromLadder = levels[levels.length - 1]?.totalUsdt ?? null;
    const required =
      sizeUnit === "usdt" || priceFromLast
        ? requiredFromLadder ??
          dcaRequiredUsdt({
            clipSize: size ?? 0,
            sizeUnit,
            maxClips: clips,
            sizeMultiplier: sizeMult,
            mark: lastPrice,
          })
        : dcaRequiredUsdt({
            clipSize: size ?? 0,
            sizeUnit,
            maxClips: clips,
            sizeMultiplier: sizeMult,
            mark: null,
          });
    return { covered, lastDev, required, levels, priceFromLast };
  }, [
    averaging,
    clipSize,
    deviationMultiplier,
    direction,
    dipPct,
    lastPrice,
    maxClips,
    sizeMultiplier,
    sizeUnit,
  ]);

  return (
    <form
      action={saveDcaPlaybookAction}
      className="space-y-3 rounded-card border border-line bg-surface px-4 py-3"
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
          Reduce only is on. New orders stay blocked until you turn it off in
          Desk Settings. Take profit and stop still run.
        </p>
      ) : null}

      <fieldset className={sectionClass}>
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
          General
        </legend>
        <div className={rowClass}>
          <label className={labelClass}>
            Name
            <input
              name="name"
              defaultValue={playbook?.name ?? defaultName ?? DEFAULT_DCA_NAME}
              maxLength={40}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Contract
            <FuturesSymbolSelect
              options={options}
              defaultSymbol={defaultSymbol}
              value={symbol}
              onChange={setSymbol}
            />
          </label>
          <label className={labelClass}>
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
        </div>
        {direction === "both" ? (
          <p className="text-xs text-ink-muted">
            Long and short add independently and never flatten each other.
          </p>
        ) : null}
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Start
        </legend>
        <div className={rowClass}>
          <label className={labelClass}>
            First order
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
              <label className={`${labelClass} lg:col-span-2`}>
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
              <p className="self-end text-xs text-ink-muted lg:col-span-3">
                Create a Signal on{" "}
                <Link href={FUTURES_PATHS.webhooks} className="text-accent">
                  Webhooks
                </Link>{" "}
                first. Buy / sell arms that side only.
              </p>
            )
          ) : null}
          {startKind === "indicator" ? (
            <>
              <label className={labelClass}>
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
              <label className={labelClass}>
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
                  <label className={labelClass}>
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
                  <label className={labelClass}>
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
                <p className="self-end text-xs text-ink-muted">
                  {indicatorKind === "macd"
                    ? "Long when histogram is positive. Short when negative."
                    : "Long on a bullish EMA cross. Short on a bearish cross."}
                </p>
              )}
            </>
          ) : null}
          {startKind === "immediate" ? (
            <p className="self-end text-xs text-ink-muted lg:col-span-3">
              Arm places the first order{direction === "both" ? "s" : ""} now.
            </p>
          ) : null}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset className={sectionClass}>
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
            Initial order
          </legend>
          <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
            <label className={labelClass}>
              Size unit
              <select
                name="sizeUnit"
                value={sizeUnit}
                onChange={(event) =>
                  setSizeUnit(event.target.value as "qty" | "usdt")
                }
                className={fieldClass}
              >
                <option value="usdt">USDT</option>
                <option value="qty">Token qty</option>
              </select>
            </label>
            <label className={labelClass}>
              Order size
              <GroupedNumberInput
                name="clipSize"
                value={clipSize}
                onChange={setClipSize}
                allowDecimal
                className={fieldClass}
              />
            </label>
          </div>
        </fieldset>
        <fieldset className={sectionClass}>
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
            Maximums
          </legend>
          <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
            <label className={labelClass}>
              Max orders
              <GroupedNumberInput
                name="maxClips"
                value={maxClips}
                onChange={setMaxClips}
                className={fieldClass}
                placeholder="No cap"
              />
            </label>
            <label className={labelClass}>
              Max position value (USDT)
              <GroupedNumberInput
                name="maxValue"
                defaultValue={optional(playbook?.maxValue)}
                allowDecimal
                className={fieldClass}
                placeholder="No cap"
              />
            </label>
          </div>
        </fieldset>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset className={sectionClass}>
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
            Additional orders
          </legend>
          <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
            <label className={labelClass}>
              Averaging
              <select
                name="averaging"
                value={averaging}
                onChange={(event) =>
                  setAveraging(event.target.value as DcaAveragingKind)
                }
                className={fieldClass}
              >
                <option value="dip">Position — add on price deviation</option>
                <option value="interval">Position — add on interval</option>
              </select>
            </label>
            {averaging === "dip" ? (
              <label className={labelClass}>
                Price deviation %
                <GroupedNumberInput
                  name="dipPct"
                  value={dipPct}
                  onChange={setDipPct}
                  allowDecimal
                  className={fieldClass}
                  placeholder="Off"
                />
              </label>
            ) : null}
            {averaging === "interval" ? (
              <div>
                <p className={labelClass}>Add every</p>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    name="intervalUnit"
                    value={intervalUnit}
                    onChange={(event) =>
                      setIntervalUnit(event.target.value as DcaIntervalUnit)
                    }
                    className={fieldClass}
                    aria-label="Interval unit"
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                  <GroupedNumberInput
                    name="intervalValue"
                    defaultValue={intervalParts.value}
                    className={fieldClass}
                    placeholder={
                      intervalUnit === "minutes"
                        ? "15"
                        : "1"
                    }
                    ariaLabel="Interval"
                  />
                </div>
              </div>
            ) : null}
            {averaging === "dip" ? (
              <label className="flex items-start gap-2 text-xs text-ink sm:col-span-2">
                <input
                  type="checkbox"
                  name="restGrid"
                  value="1"
                  checked={restGrid}
                  onChange={(event) => setRestGrid(event.target.checked)}
                  className="mt-0.5"
                />
                Remaining orders placed as GTC limit (instead of market)
              </label>
            ) : null}
            {averaging === "dip" && restGrid ? (
              <p className="text-xs text-ink-muted sm:col-span-2">
                After the first market order, later adds use the
                price-deviation ladder. Needs max orders.
              </p>
            ) : null}
          </div>
        </fieldset>
        <fieldset className={sectionClass}>
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
            Additional order multipliers
          </legend>
          <div className="flex flex-wrap gap-2 pb-2">
            <button
              type="button"
              onClick={() => {
                setSizeMultiplier("1");
                setDeviationMultiplier("1");
              }}
              className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs text-ink"
            >
              Equal orders
            </button>
            <button
              type="button"
              onClick={() => {
                setSizeMultiplier("2");
                setDeviationMultiplier("1.5");
              }}
              className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs text-ink"
            >
              Martingale
            </button>
          </div>
          <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
            <label className={labelClass}>
              Order size multiplier
              <GroupedNumberInput
                name="sizeMultiplier"
                value={sizeMultiplier}
                onChange={setSizeMultiplier}
                allowDecimal
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
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
      </div>

      <fieldset className={sectionClass}>
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Exit
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-card border border-line px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Take profit
            </p>
            <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
              <label className={labelClass}>
                Take profit target
                <GroupedNumberInput
                  name="takeProfitPct"
                  defaultValue={optional(playbook?.takeProfitPct)}
                  allowDecimal
                  className={fieldClass}
                  placeholder="Off"
                />
              </label>
              <label className={labelClass}>
                Take profit type
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
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Trailing stop
            </p>
            <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
              <label className={labelClass}>
                <ColumnHint
                  label="Trigger %"
                  hint="The trailing stop will be triggered once the price moves by this %."
                />
                <GroupedNumberInput
                  name="trailingTriggerPct"
                  defaultValue={optional(playbook?.trailingTriggerPct)}
                  allowDecimal
                  className={fieldClass}
                  placeholder="Off"
                />
              </label>
              <label className={labelClass}>
                <ColumnHint
                  label="Trailing %"
                  hint="The % from the price where the stop will be placed."
                />
                <GroupedNumberInput
                  name="trailingPct"
                  defaultValue={optional(playbook?.trailingPct)}
                  allowDecimal
                  className={fieldClass}
                  placeholder="Off"
                />
              </label>
            </div>
          </div>
          <div className="space-y-2 rounded-card border border-line px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Stop loss
            </p>
            <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
              <label className={labelClass}>
                Stop loss %
                <GroupedNumberInput
                  name="stopLossPct"
                  defaultValue={optional(playbook?.stopLossPct)}
                  allowDecimal
                  className={fieldClass}
                  placeholder="Off"
                />
              </label>
              <label className={labelClass}>
                Stop loss type
                <select
                  name="stopLossBasis"
                  defaultValue={playbook?.stopLossBasis ?? "average"}
                  className={fieldClass}
                >
                  <option value="average">Average entry</option>
                  <option value="first_entry">First fill</option>
                </select>
              </label>
              <label className={labelClass}>
                Move stop to breakeven at %
                <GroupedNumberInput
                  name="breakevenActivationPct"
                  defaultValue={optional(playbook?.breakevenActivationPct)}
                  allowDecimal
                  className={fieldClass}
                  placeholder="Off"
                />
              </label>
              <label className={labelClass}>
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
          </div>
        </div>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Summary
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryStat
            label="Covered"
            value={
              summary.covered === null ? "—" : `${trimPct(summary.covered)}%`
            }
            hint={
              summary.covered === null
                ? "Set max orders and price deviation %"
                : null
            }
          />
          <SummaryStat
            label="Last order"
            value={
              summary.lastDev === null ? "—" : `${trimPct(summary.lastDev)}%`
            }
          />
          <SummaryStat
            label="Required"
            value={
              summary.required === null
                ? "—"
                : `$${trimPct(summary.required)}`
            }
            valueClass={
              availableUsdt !== null &&
              summary.required !== null &&
              summary.required > availableUsdt
                ? "text-warning"
                : "text-ink"
            }
            hint={
              summary.required === null
                ? sizeUnit === "qty"
                  ? "Use USDT size to estimate"
                  : null
                : availableUsdt !== null
                  ? summary.required > availableUsdt
                    ? `Available $${trimPct(availableUsdt)} — less than the full grid`
                    : `Available $${trimPct(availableUsdt)}`
                  : null
            }
          />
        </div>
        {summary.levels.length > 0 ? (
          <div className="mt-4 max-h-80 overflow-auto rounded-card border border-line">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Deviation</th>
                  <th className="px-3 py-2 font-medium">
                    {sizeUnit === "qty" ? "Qty" : "Size"}
                  </th>
                  <th className="px-3 py-2 font-medium">Order value</th>
                  <th className="px-3 py-2 font-medium">Total value</th>
                  <th className="px-3 py-2 font-medium">Avg entry</th>
                </tr>
              </thead>
              <tbody>
                {summary.levels.map((row) => (
                  <tr key={row.index} className="border-t border-line">
                    <td className="px-3 py-2 tabular-nums text-ink">{row.index}</td>
                    <td className="px-3 py-2 tabular-nums text-ink">
                      {formatLadderPrice(row.price)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-ink-muted">
                      {row.index === 1
                        ? "—"
                        : `${row.deviationPct > 0 ? "+" : ""}${trimPct(row.deviationPct)}%`}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-ink">
                      {trimPct(row.size)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-ink">
                      ${trimPct(row.orderUsdt)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-ink">
                      ${trimPct(row.totalUsdt)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-ink-muted">
                      {formatLadderPrice(row.averagePrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-line px-3 py-2 text-xs text-ink-muted">
              {summary.priceFromLast
                ? `Prices from last on ${symbol}.`
                : "Prices indexed from 100 until last is available."}
              {averaging === "interval"
                ? " Interval adds use the same last as an estimate."
                : ""}
              {direction === "both" ? " Long ladder shown. Short is the inverse." : ""}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">
            Enter order size and max orders to preview price and value at each
            level.
            {averaging === "dip" ? " Price deviation % sets later prices." : ""}
          </p>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <PendingSubmitButton
          pendingLabel="Saving…"
          successKey={`save-dca-playbook-${playbook?.id ?? "new"}`}
          className="rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink"
        >
          Save playbook
        </PendingSubmitButton>
        {playbook ? (
          <>
            <PendingSubmitButton
              formAction={runDcaPlaybookVerb}
              name="verb"
              value="arm"
              pendingLabel="Arming…"
              successKey={`arm-dca-playbook-${playbook.id}`}
              className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink"
            >
              Arm
            </PendingSubmitButton>
            <PendingSubmitButton
              formAction={runDcaPlaybookVerb}
              name="verb"
              value="disarm"
              pendingLabel="Stopping…"
              successKey={`disarm-dca-playbook-${playbook.id}`}
              className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink"
            >
              Stop adding
            </PendingSubmitButton>
            <PendingSubmitButton
              formAction={runDcaPlaybookVerb}
              name="verb"
              value="close-playbook"
              pendingLabel="Closing…"
              successKey={`close-dca-playbook-${playbook.id}`}
              className="rounded-control border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger"
            >
              Close playbook
            </PendingSubmitButton>
          </>
        ) : null}
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
    <>
      <label className={labelClass}>
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
      <label className={labelClass}>
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
      <label className={labelClass}>
        Level
        <GroupedNumberInput
          name={`${prefix}Price`}
          defaultValue={price}
          allowDecimal
          className={fieldClass}
        />
      </label>
    </>
  );
}

function formatLadderPrice(value: number): string {
  if (!(value > 0) || !Number.isFinite(value)) {
    return "—";
  }
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : 6;
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function trimPct(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2).replace(/\.?0+$/, "");
}
