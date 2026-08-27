"use client";

import { useId, useMemo, useState } from "react";
import { ColumnHint } from "@/components/column-hint";
import { FuturesSymbolSelect } from "@/components/futures-symbol-select";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { TabButton } from "@/components/trade-expand";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  deleteDcaPlaybookAction,
  runDcaArmAction,
  runDcaArmLongAction,
  runDcaArmShortAction,
  runDcaClosePlaybookAction,
  runDcaDisarmAction,
  saveAndArmDcaPlaybookAction,
  saveDcaPlaybookAction,
} from "@/lib/dca/actions";
import {
  dcaClipsUntilMaxValue,
  dcaLadderLevels,
  dcaLadderLossRange,
  dcaLadderProfitRange,
  dcaLastClipDeviationPct,
  dcaMaxDropCoveredPct,
  dcaRequiredUsdt,
  type DcaLadderLevel,
} from "@/lib/dca/grid";
import {
  DEFAULT_DCA_NAME,
  dcaAveragingKind,
  dcaEnabledSides,
  dcaIntervalParts,
  dcaLegFor,
  dcaLegIsRunning,
  dcaMaxTypeFromCaps,
  dcaPlaybookIsRunning,
  dcaPlaybookStatusLabel,
  dcaStartListens,
  parseDcaExitBasis,
  parseDcaExitOrderType,
  type DcaAveragingKind,
  type DcaExitBasis,
  type DcaIntervalUnit,
  type DcaMaxType,
  type DcaPlaybook,
  type DcaStartKind,
} from "@/lib/dca/playbook";
import type { FuturesOrderType, FuturesSide } from "@/lib/futures/model";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import { perpTicketSizeError } from "@/lib/exchanges/bybit/ticket-size";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import Link from "next/link";

const fieldClass =
  "mt-0.5 w-full rounded-control border border-line bg-surface-raised px-2 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none";
const labelClass = "block text-xs text-ink-muted";
const sectionClass =
  "space-y-2 rounded-card border border-line px-3 py-2";
const rowClass = "grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-4";
const headerBtnClass = "rounded-control px-3 py-1.5 text-xs font-medium";
const headerPrimaryClass = `${headerBtnClass} bg-accent-strong text-ink hover:bg-accent`;
const headerSecondaryClass = `${headerBtnClass} border border-line bg-surface text-ink hover:bg-surface-raised`;
const headerLongClass =
  "rounded-control bg-success px-3 py-2 text-sm font-medium text-canvas";
const headerShortClass =
  "rounded-control bg-danger px-3 py-2 text-sm font-medium text-ink";
const headerDangerClass = `${headerBtnClass} bg-danger/15 text-danger hover:bg-danger/25`;
const headerRemoveClass =
  "shrink-0 rounded-control px-2 py-0.5 text-xs text-danger hover:bg-danger/10";

function optional(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

function asNumber(text: string): number | null {
  const value = Number(text.replace(/,/g, "").trim());
  return value > 0 && Number.isFinite(value) ? value : null;
}

type DcaSummaryPreview = {
  covered: number | null;
  lastDev: number | null;
  required: number | null;
  levels: DcaLadderLevel[];
  priceFromLast: boolean;
  profitRange: { min: number; max: number } | null;
  lossRange: { min: number; max: number } | null;
  profitFromTp: boolean;
  lossFromSl: boolean;
};

function dcaSummaryPreview(input: {
  side: FuturesSide;
  lastPrice: number | null;
  averaging: DcaAveragingKind;
  clipSize: string;
  sizeUnit: "qty" | "usdt";
  sizeMultiplier: string;
  deviationMultiplier: string;
  dipPct: string;
  maxClips: string;
  maxValue: string;
  effectiveMaxType: DcaMaxType;
  takeProfitPct: string;
  takeProfitBasis: DcaExitBasis;
  stopLossPct: string;
  stopLossBasis: DcaExitBasis;
}): DcaSummaryPreview {
  const orderCap = asNumber(input.maxClips);
  const valueCap = asNumber(input.maxValue);
  const dip = input.averaging === "dip" ? asNumber(input.dipPct) : null;
  const size = asNumber(input.clipSize);
  const sizeMult = asNumber(input.sizeMultiplier) ?? 1;
  const devMult = asNumber(input.deviationMultiplier) ?? 1;
  const entryPrice =
    input.lastPrice !== null && input.lastPrice > 0 ? input.lastPrice : 100;
  const priceFromLast = input.lastPrice !== null && input.lastPrice > 0;
  const clips =
    input.effectiveMaxType === "orders"
      ? orderCap
      : valueCap !== null && size !== null
        ? dcaClipsUntilMaxValue({
            side: input.side,
            entryPrice,
            maxValue: valueCap,
            dipPct: dip,
            clipSize: size,
            sizeUnit: input.sizeUnit,
            sizeMultiplier: sizeMult,
            deviationMultiplier: devMult,
          })
        : null;
  const covered = dcaMaxDropCoveredPct({
    side: input.side,
    maxClips: clips,
    dipPct: dip,
    deviationMultiplier: devMult,
  });
  const lastDev = dcaLastClipDeviationPct({
    side: input.side,
    maxClips: clips,
    dipPct: dip,
    deviationMultiplier: devMult,
  });
  const tpPct = asNumber(input.takeProfitPct);
  const slPct = asNumber(input.stopLossPct);
  const levels = dcaLadderLevels({
    side: input.side,
    entryPrice,
    maxClips: clips,
    dipPct: dip,
    clipSize: size ?? 0,
    sizeUnit: input.sizeUnit,
    sizeMultiplier: sizeMult,
    deviationMultiplier: devMult,
    takeProfitPct: tpPct,
    takeProfitBasis: input.takeProfitBasis,
    stopLossPct: slPct,
    stopLossBasis: input.stopLossBasis,
  });
  const requiredFromLadder = levels[levels.length - 1]?.totalUsdt ?? null;
  const required =
    input.sizeUnit === "usdt" || priceFromLast
      ? requiredFromLadder ??
        dcaRequiredUsdt({
          clipSize: size ?? 0,
          sizeUnit: input.sizeUnit,
          maxClips: clips,
          sizeMultiplier: sizeMult,
          mark: input.lastPrice,
        })
      : dcaRequiredUsdt({
          clipSize: size ?? 0,
          sizeUnit: input.sizeUnit,
          maxClips: clips,
          sizeMultiplier: sizeMult,
          mark: null,
        });
  return {
    covered,
    lastDev,
    required,
    levels,
    priceFromLast,
    profitRange: dcaLadderProfitRange(levels),
    lossRange: dcaLadderLossRange(levels),
    profitFromTp: tpPct !== null,
    lossFromSl: slPct !== null,
  };
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
    <div className="min-w-0 flex-1 basis-36 text-center">
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

function DcaStatusLight({
  playbook,
  reduceOnly,
}: {
  playbook: DcaPlaybook | null;
  reduceOnly: boolean;
}) {
  const label = playbook ? dcaPlaybookStatusLabel(playbook) : "Idle";
  const sides = playbook ? dcaEnabledSides(playbook.direction) : [];
  const legs = playbook
    ? sides.map((side) => dcaLegFor(playbook, side))
    : [];
  const armed = legs.some((leg) => leg.status === "armed");
  const stopped = legs.some((leg) => leg.status === "stop_adding");
  const inUse = legs.some(
    (leg) => leg.clipsFilled > 0 || leg.status !== "idle",
  );
  const fill =
    reduceOnly && (armed || stopped)
      ? "bg-warning"
      : armed
        ? "bg-success"
        : stopped
          ? "bg-warning"
          : "bg-ink-faint";
  const title =
    reduceOnly && (armed || stopped)
      ? `${label} · book Reduce only has priority`
      : label;
  return (
    <span
      className="relative flex size-3.5 shrink-0"
      title={title}
      aria-label={title}
    >
      {inUse ? (
        <span
          className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${fill}`}
        />
      ) : null}
      <span className={`relative inline-flex size-3.5 rounded-full ${fill}`} />
    </span>
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
  const [maxValue, setMaxValue] = useState(optional(playbook?.maxValue));
  const [maxType, setMaxType] = useState<DcaMaxType>(() =>
    dcaMaxTypeFromCaps(playbook?.maxClips ?? null, playbook?.maxValue ?? null),
  );
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
  const [takeProfitPct, setTakeProfitPct] = useState(
    optional(playbook?.takeProfitPct),
  );
  const [takeProfitBasis, setTakeProfitBasis] = useState<DcaExitBasis>(
    playbook?.takeProfitBasis ?? "average",
  );
  const [stopLossPct, setStopLossPct] = useState(
    optional(playbook?.stopLossPct),
  );
  const [stopLossBasis, setStopLossBasis] = useState<DcaExitBasis>(
    playbook?.stopLossBasis ?? "average",
  );
  const [takeProfitOrderType, setTakeProfitOrderType] =
    useState<FuturesOrderType>(playbook?.takeProfitOrderType ?? "market");
  const [stopLossOrderType, setStopLossOrderType] = useState<FuturesOrderType>(
    playbook?.stopLossOrderType ?? "market",
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
  const [ladderTab, setLadderTab] = useState<"long" | "short">("long");
  const ladderPanelId = useId();
  const lastPrice = lastPrices[symbol] ?? null;
  const running = Boolean(playbook && dcaPlaybookIsRunning(playbook));
  const liveLegs = playbook
    ? dcaEnabledSides(playbook.direction).map((side) =>
        dcaLegFor(playbook, side),
      )
    : [];
  const showStopAdding = liveLegs.some((leg) => leg.status === "armed");
  const showClosePlaybook = liveLegs.some(
    (leg) => leg.clipsFilled > 0 || leg.status === "stop_adding",
  );
  const showManualTriggers = startKind === "immediate";
  const showSaveAndArm = dcaStartListens(startKind) && !running;
  const showArmButton =
    dcaStartListens(startKind) && Boolean(playbook) && running;
  const selectedPair = options.find((row) => row.symbol === symbol);
  const sizeError = perpTicketSizeError({
    size: clipSize,
    unit: sizeUnit,
    minQty: selectedPair?.minQty ?? 0,
    minNotional: selectedPair?.minNotional ?? 0,
    lastPrice,
    baseCoin: selectedPair?.baseCoin ?? "Token",
  });
  const effectiveMaxType: DcaMaxType = restGrid ? "orders" : maxType;
  const summaryBySide = useMemo(() => {
    const input = {
      lastPrice,
      averaging,
      clipSize,
      sizeUnit,
      sizeMultiplier,
      deviationMultiplier,
      dipPct,
      maxClips,
      maxValue,
      effectiveMaxType,
      takeProfitPct,
      takeProfitBasis,
      stopLossPct,
      stopLossBasis,
    };
    return {
      long: dcaSummaryPreview({ ...input, side: "long" }),
      short: dcaSummaryPreview({ ...input, side: "short" }),
    };
  }, [
    averaging,
    clipSize,
    deviationMultiplier,
    dipPct,
    lastPrice,
    maxClips,
    maxValue,
    sizeMultiplier,
    sizeUnit,
    stopLossBasis,
    stopLossPct,
    takeProfitBasis,
    takeProfitPct,
    effectiveMaxType,
  ]);
  const showLadderTabs = direction === "both";
  const activeLadderSide: FuturesSide = showLadderTabs
    ? ladderTab
    : direction === "short"
      ? "short"
      : "long";
  const summary = summaryBySide[activeLadderSide];

  return (
    <form
      action={saveDcaPlaybookAction}
      className="space-y-3 rounded-card border border-line bg-surface px-4 py-3"
    >
      <input type="hidden" name="playbookId" value={playbook?.id ?? ""} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex shrink-0 items-center gap-2">
          {playbook ? (
            running ? (
              <span
                className="inline-flex"
                title="Stop adding or close before removing."
              >
                <button
                  type="button"
                  disabled
                  className={`${headerRemoveClass} pointer-events-none opacity-40`}
                >
                  Remove
                </button>
              </span>
            ) : (
              <PendingSubmitButton
                formAction={deleteDcaPlaybookAction}
                pendingLabel="Removing…"
                successKey={`remove-dca-${playbook.id}`}
                className={headerRemoveClass}
              >
                Remove
              </PendingSubmitButton>
            )
          ) : onRemoveDraft ? (
            <button
              type="button"
              onClick={onRemoveDraft}
              className={headerRemoveClass}
            >
              Remove
            </button>
          ) : null}
        </div>
        <PendingSubmitButton
          pendingLabel="Saving…"
          successKey={`save-dca-playbook-${playbook?.id ?? "new"}`}
          className={headerPrimaryClass}
        >
          Save
        </PendingSubmitButton>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2">
          {showSaveAndArm ? (
            <PendingSubmitButton
              formAction={saveAndArmDcaPlaybookAction}
              pendingLabel="Arming…"
              successKey={`save-arm-dca-playbook-${playbook?.id ?? "new"}`}
              className={headerLongClass}
              disabled={Boolean(sizeError)}
              title={sizeError ?? undefined}
            >
              Save and Arm
            </PendingSubmitButton>
          ) : null}
          {playbook ? (
            <>
              {showManualTriggers ? (
                (
                  [
                    {
                      side: "long" as const,
                      action: runDcaArmLongAction,
                      label: "Save and Trigger Long",
                      className: headerLongClass,
                    },
                    {
                      side: "short" as const,
                      action: runDcaArmShortAction,
                      label: "Save and Trigger Short",
                      className: headerShortClass,
                    },
                  ] as const
                ).map((item) => {
                  const onDirection = dcaEnabledSides(direction).includes(
                    item.side,
                  );
                  const sideRunning = dcaLegIsRunning(
                    dcaLegFor(playbook, item.side).status,
                  );
                  const blockedReason = !onDirection
                    ? "Set Direction to include this side"
                    : sideRunning
                      ? `${item.side === "long" ? "Long" : "Short"} is already running`
                      : sizeError;
                  const blocked = Boolean(blockedReason);
                  return blocked ? (
                    <button
                      key={item.side}
                      type="button"
                      disabled
                      title={blockedReason ?? undefined}
                      className={`${item.className} opacity-40`}
                    >
                      {item.label}
                    </button>
                  ) : (
                    <PendingSubmitButton
                      key={item.side}
                      formAction={item.action}
                      pendingLabel="Triggering…"
                      successKey={`arm-dca-playbook-${playbook.id}-${item.side}`}
                      className={item.className}
                    >
                      {item.label}
                    </PendingSubmitButton>
                  );
                })
              ) : null}
              {showArmButton && !showStopAdding ? (
                <PendingSubmitButton
                  formAction={runDcaArmAction}
                  pendingLabel="Arming…"
                  successKey={`arm-dca-playbook-${playbook.id}`}
                  className={headerSecondaryClass}
                >
                  Arm
                </PendingSubmitButton>
              ) : null}
              {showStopAdding ? (
                <span
                  className="inline-flex"
                  title="Stop adding any new orders (also cancels any existing entry limit orders)"
                >
                  <PendingSubmitButton
                    formAction={runDcaDisarmAction}
                    pendingLabel="Stopping…"
                    successKey={`disarm-dca-playbook-${playbook.id}`}
                    className={headerDangerClass}
                  >
                    Stop adding
                  </PendingSubmitButton>
                </span>
              ) : null}
              {showClosePlaybook ? (
                <span
                  className="inline-flex"
                  title="Close all positions and place the playbook in idle mode (no new entries)"
                >
                  <PendingSubmitButton
                    formAction={runDcaClosePlaybookAction}
                    pendingLabel="Closing…"
                    successKey={`close-dca-playbook-${playbook.id}`}
                    className={headerDangerClass}
                  >
                    Close playbook
                  </PendingSubmitButton>
                </span>
              ) : null}
            </>
          ) : null}
        </div>
        <DcaStatusLight playbook={playbook ?? null} reduceOnly={reduceOnly} />
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
          <label className={`${labelClass} sm:col-span-2`}>
            First order
            <select
              name="startKind"
              value={startKind}
              onChange={(event) =>
                setStartKind(event.target.value as DcaStartKind)
              }
              className={fieldClass}
            >
              <option value="immediate">
                Manual - When you manually trigger the entry
              </option>
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
              <>
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
                <p className="self-end text-xs text-ink-muted sm:col-span-2">
                  Save and Arm first. Then the bound Signal starts the first
                  order.
                </p>
              </>
            ) : (
              <p className="self-end text-xs text-ink-muted lg:col-span-3">
                Create a Signal on{" "}
                <Link href={FUTURES_PATHS.webhooks} className="text-accent">
                  Webhooks
                </Link>{" "}
                first. Save and Arm, then buy / sell starts that side only.
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
                className={`mt-0.5 w-full rounded-control border bg-surface-raised px-2 py-1.5 text-sm text-ink focus:outline-none ${
                  sizeError
                    ? "border-danger focus:border-danger"
                    : "border-line focus:border-line-strong"
                }`}
              />
              {sizeError ? (
                <p className="mt-1 text-xs text-danger">{sizeError}</p>
              ) : null}
            </label>
          </div>
        </fieldset>
        <fieldset className={sectionClass}>
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
            Maximum Exposure
          </legend>
          <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
            <label className={labelClass}>
              Maximum type
              <select
                name="maxType"
                value={effectiveMaxType}
                onChange={(event) =>
                  setMaxType(
                    event.target.value === "value" ? "value" : "orders",
                  )
                }
                className={fieldClass}
              >
                <option value="orders">Orders</option>
                <option value="value" disabled={restGrid}>
                  Value
                </option>
              </select>
            </label>
            {effectiveMaxType === "orders" ? (
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
            ) : (
              <label className={labelClass}>
                Max position value (USDT)
                <GroupedNumberInput
                  name="maxValue"
                  value={maxValue}
                  onChange={setMaxValue}
                  allowDecimal
                  className={fieldClass}
                  placeholder="No cap"
                />
              </label>
            )}
          </div>
          {effectiveMaxType === "orders" ? (
            <input type="hidden" name="maxValue" value="" />
          ) : (
            <input type="hidden" name="maxClips" value="" />
          )}
          {restGrid ? (
            <p className="text-xs text-ink-muted">
              Remaining GTC limits use max orders.
            </p>
          ) : null}
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
                  onChange={(event) => {
                    const on = event.target.checked;
                    setRestGrid(on);
                    if (on) {
                      setMaxType("orders");
                    }
                  }}
                  className="mt-0.5"
                />
                Remaining orders placed as GTC limit (instead of market)
              </label>
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
                  value={takeProfitPct}
                  onChange={setTakeProfitPct}
                  allowDecimal
                  className={fieldClass}
                  placeholder="Off"
                />
              </label>
              <label className={labelClass}>
                Take profit type
                <select
                  name="takeProfitBasis"
                  value={takeProfitBasis}
                  onChange={(event) =>
                    setTakeProfitBasis(parseDcaExitBasis(event.target.value))
                  }
                  className={fieldClass}
                >
                  <option value="average">Average entry</option>
                  <option value="first_entry">First fill</option>
                </select>
              </label>
            </div>
            <label className={labelClass}>
              Take profit fill
              <select
                name="takeProfitOrderType"
                value={takeProfitOrderType}
                onChange={(event) =>
                  setTakeProfitOrderType(
                    parseDcaExitOrderType(event.target.value),
                  )
                }
                className={fieldClass}
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
              </select>
            </label>
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
                  value={stopLossPct}
                  onChange={setStopLossPct}
                  allowDecimal
                  className={fieldClass}
                  placeholder="Off"
                />
              </label>
              <label className={labelClass}>
                Stop loss type
                <select
                  name="stopLossBasis"
                  value={stopLossBasis}
                  onChange={(event) =>
                    setStopLossBasis(parseDcaExitBasis(event.target.value))
                  }
                  className={fieldClass}
                >
                  <option value="average">Average entry</option>
                  <option value="first_entry">First fill</option>
                </select>
              </label>
              <label className={labelClass}>
                Stop loss fill
                <select
                  name="stopLossOrderType"
                  value={stopLossOrderType}
                  onChange={(event) =>
                    setStopLossOrderType(
                      parseDcaExitOrderType(event.target.value),
                    )
                  }
                  className={fieldClass}
                >
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
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
        {showLadderTabs ? (
          <div
            role="tablist"
            aria-label="Ladder side"
            className="mb-3 flex gap-1 border-b border-line"
          >
            <TabButton
              selected={ladderTab === "long"}
              panelId={ladderPanelId}
              onClick={() => setLadderTab("long")}
            >
              Long ladder
            </TabButton>
            <TabButton
              selected={ladderTab === "short"}
              panelId={ladderPanelId}
              onClick={() => setLadderTab("short")}
            >
              Short ladder
            </TabButton>
          </div>
        ) : null}
        <div
          role={showLadderTabs ? "tabpanel" : undefined}
          id={showLadderTabs ? ladderPanelId : undefined}
        >
        <div className="flex flex-wrap">
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
                : formatUsdAmount(summary.required)
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
                : [
                    availableUsdt !== null
                      ? summary.required > availableUsdt
                        ? `Available ${formatUsdAmount(availableUsdt)} — less than the full grid`
                        : `Available ${formatUsdAmount(availableUsdt)}`
                      : null,
                    showLadderTabs ? "This side only" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || null
            }
          />
          <SummaryStat
            label="Profit range"
            value={
              summary.levels.length === 0
                ? "—"
                : summary.profitFromTp
                  ? summary.profitRange === null
                    ? "—"
                    : formatProfitRange(
                        summary.profitRange.min,
                        summary.profitRange.max,
                      )
                  : "∞"
            }
            valueClass={
              summary.levels.length === 0 ? "text-ink" : "text-success"
            }
            hint={
              summary.levels.length === 0
                ? "Enter order size and max orders"
                : summary.profitFromTp
                  ? "Does not consider trailing or breakeven stops"
                  : "No take profit — unlimited"
            }
          />
          <SummaryStat
            label="Loss range"
            value={
              summary.levels.length === 0
                ? "—"
                : summary.lossRange === null
                  ? "∞"
                  : formatProfitRange(
                      summary.lossRange.min,
                      summary.lossRange.max,
                    )
            }
            valueClass={
              summary.levels.length === 0 ? "text-ink" : "text-danger"
            }
            hint={
              summary.levels.length === 0
                ? "Enter order size and max orders"
                : summary.lossFromSl
                  ? "Does not consider trailing or breakeven stops"
                  : "No stop loss — unlimited"
            }
          />
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Summary is based on the current parameters above
        </p>
        {summary.levels.length > 0 ? (
          <div className="thin-scroll mt-4 max-h-80 overflow-auto rounded-card border border-line">
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
                  <th className="px-3 py-2 font-medium">
                    <ColumnHint
                      label="Profit"
                      hint={
                        summary.profitFromTp
                          ? "USDT if take profit hits after this order fills. Uses take profit type (average or first fill)."
                          : "No take profit. Theoretical profit is unlimited."
                      }
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">
                    <ColumnHint
                      label="Loss"
                      hint={
                        summary.lossFromSl
                          ? "USDT if stop loss hits after this order fills. Uses stop loss type (average or first fill)."
                          : "No stop loss. Theoretical loss is unlimited."
                      }
                    />
                  </th>
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
                      {formatGroupedNumber(row.size)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-ink">
                      {formatUsdAmount(row.orderUsdt)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-ink">
                      {formatUsdAmount(row.totalUsdt)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-ink-muted">
                      {formatLadderPrice(row.averagePrice)}
                    </td>
                    <td
                      className={`px-3 py-2 tabular-nums ${
                        !summary.profitFromTp || row.profitUsdt > 0
                          ? "text-success"
                          : "text-ink-muted"
                      }`}
                    >
                      {summary.profitFromTp
                        ? formatUsdAmount(row.profitUsdt)
                        : "∞"}
                    </td>
                    <td
                      className={`px-3 py-2 tabular-nums ${
                        row.lossUsdt === null || row.lossUsdt > 0
                          ? "text-danger"
                          : "text-ink-muted"
                      }`}
                    >
                      {row.lossUsdt === null
                        ? "∞"
                        : formatUsdAmount(row.lossUsdt)}
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
              {showLadderTabs
                ? " This ladder is one side. Long and short add independently."
                : ""}
              {summary.profitFromTp
                ? " Profit is take profit from that average."
                : " No take profit — profit is unlimited."}
              {summary.lossFromSl
                ? " Loss is stop loss from that average."
                : " No stop loss — loss is unlimited."}
            </p>
          </div>
        ) : (
          <p className="mt-3 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            Enter order size and max orders to preview price and value at each
            level.
            {averaging === "dip" ? " Price deviation % sets later prices." : ""}
          </p>
        )}
        </div>
      </fieldset>
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
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function formatGroupedNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const abs = Math.abs(value);
  const decimals = Number.isInteger(abs) ? 0 : 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  });
}

function formatUsdAmount(value: number): string {
  const formatted = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (value < 0) {
    return `-$${formatted}`;
  }
  return `$${formatted}`;
}

function formatProfitRange(min: number, max: number): string {
  if (Math.abs(max - min) < 0.005) {
    return formatUsdAmount(max);
  }
  return `${formatUsdAmount(min)} – ${formatUsdAmount(max)}`;
}

function trimPct(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2).replace(/\.?0+$/, "");
}
