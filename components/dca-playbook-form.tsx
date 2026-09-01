"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ColumnHint } from "@/components/column-hint";
import { PanelCloseButton } from "@/components/panel-close-button";
import { FuturesSymbolSelect } from "@/components/futures-symbol-select";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  DeskFormFlash,
  StayOnPageForm,
} from "@/components/stay-on-page-form";
import { ChevronIcon, TabButton } from "@/components/trade-expand";
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
  type DcaDeskActionResult,
} from "@/lib/dca/actions";
import {
  dcaClipOrderType,
  dcaClipQtyAt,
  dcaClipsUntilMaxValue,
  dcaLadderLevels,
  dcaLadderLossRange,
  dcaLadderProfitRange,
  dcaClipFromBudget,
  dcaInitialMarginUsdt,
  dcaMaxDropCoveredPct,
  dcaRequiredUsdt,
  type DcaLadderLevel,
} from "@/lib/dca/grid";
import {
  DEFAULT_DCA_NAME,
  dcaAveragingKind,
  dcaCloneIdleDraft,
  dcaConfigMaxOrderError,
  dcaEnabledSides,
  dcaIntervalParts,
  dcaLegFor,
  dcaLegIsRunning,
  dcaPlaybookHasOpenCycle,
  dcaPlaybookIsRunning,
  dcaPlaybookStatusLabel,
  dcaStartListens,
  parseDcaExitBasis,
  parseDcaMaxValueKind,
  parseDcaPlaybookForm,
  dcaResolvedMaxValueUsdt,
  type DcaAveragingKind,
  type DcaExitBasis,
  type DcaIntervalUnit,
  type DcaMaxValueKind,
  type DcaPlaybook,
  type DcaStartKind,
} from "@/lib/dca/playbook";
import {
  DCA_INDICATOR_TIMEFRAMES,
  DCA_INDICATOR_TIMEFRAME_LABELS,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import type { FuturesOrderType, FuturesSide } from "@/lib/futures/model";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import { perpEffectiveMaxQty, perpTicketSizeError } from "@/lib/exchanges/bybit/ticket-size";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import Link from "next/link";
import {
  BacktestTemplateLink,
  type BacktestLibraryItem,
} from "@/components/backtest-dialog";
import { DeskTemplateBar, SaveAsTemplateButton } from "@/components/template-modals";
import type { AppliedDeskItem } from "@/lib/templates/apply";
import {
  dcaFormToSnapshotSource,
  readFormControl,
  snapshotDcaRecipe,
} from "@/lib/templates/recipe";
import type { AutomationTemplateSet, TemplateSummary } from "@/lib/templates/store";
import {
  BYBIT_DCA_UI,
  type DcaPlaybookUiPolicy,
} from "@/lib/dca/ui-policy";

const fieldClass =
  "mt-0.5 w-full rounded-control border border-line bg-surface-raised px-2 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none";
const labelClass = "block text-xs text-ink-muted";
const sectionClass =
  "space-y-2 rounded-card border border-line bg-canvas px-3 py-2";
const sectionTitleClass =
  "text-[11px] uppercase tracking-[0.08em] text-ink-faint";
const rowClass = "grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-4";
const headerBtnClass = "rounded-control px-3 py-1.5 text-xs font-medium";
const headerPrimaryClass = `${headerBtnClass} bg-accent-strong text-ink hover:bg-accent`;
const headerSecondaryClass = `${headerBtnClass} border border-line bg-surface text-ink hover:bg-surface-raised`;
const headerLongClass = `${headerBtnClass} bg-success text-canvas`;
const headerShortClass = `${headerBtnClass} bg-danger text-ink`;
const headerRemoveClass =
  "shrink-0 rounded-control border border-line px-2 py-0.5 text-xs text-danger hover:bg-danger/10";

function optional(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

function asNumber(text: string): number | null {
  const value = Number(text.replace(/,/g, "").trim());
  return value > 0 && Number.isFinite(value) ? value : null;
}

function formatDerivedClip(value: number, unit: "qty" | "usdt"): string {
  const places = unit === "usdt" ? 4 : 8;
  return value.toFixed(places).replace(/\.?0+$/, "");
}

function CycleLock({
  locked,
  children,
}: {
  locked: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      inert={locked ? true : undefined}
      className={locked ? "opacity-60" : undefined}
    >
      {children}
    </div>
  );
}

function SizeGuardNote({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p
      className="rounded-card border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
      role="status"
    >
      {message} Save is blocked so this bot is not lost.
    </p>
  );
}

function PercentInput({
  name,
  value,
  defaultValue,
  onChange,
  placeholder,
  ariaLabel,
}: {
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (next: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <span className="relative mt-0.5 block">
      <GroupedNumberInput
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        allowDecimal
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        className={`${fieldClass} mt-0 pr-7`}
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-muted">
        %
      </span>
    </span>
  );
}

type DcaSummaryPreview = {
  covered: number | null;
  required: number | null;
  initialMargin: number | null;
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
  takeProfitPct: string;
  takeProfitBasis: DcaExitBasis;
  stopLossPct: string;
  stopLossBasis: DcaExitBasis;
  leverage: number | null;
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
    orderCap !== null
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
    required,
    initialMargin: dcaInitialMarginUsdt(required, input.leverage),
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
  bookUsdt = null,
  leverage = null,
  lastPrices = {},
  reduceOnly = false,
  webhooksHref = FUTURES_PATHS.webhooks,
  isAdmin = false,
  accountId,
  templates = [],
  sets = [],
  policy = BYBIT_DCA_UI,
  venueEnvironment = null,
  backtestLibrary = [],
}: {
  playbooks: DcaPlaybook[];
  options: LinearPerp[];
  signalWebhooks: DcaSignalWebhookOption[];
  availableUsdt?: number | null;
  bookUsdt?: number | null;
  leverage?: number | null;
  lastPrices?: Record<string, number>;
  reduceOnly?: boolean;
  webhooksHref?: string;
  isAdmin?: boolean;
  accountId?: string;
  templates?: TemplateSummary[];
  sets?: AutomationTemplateSet[];
  policy?: DcaPlaybookUiPolicy;
  venueEnvironment?: string | null;
  backtestLibrary?: BacktestLibraryItem[];
}) {
  const [extraLibrary, setExtraLibrary] = useState<BacktestLibraryItem[]>([]);
  const library = [...backtestLibrary, ...extraLibrary];
  const [cards, setCards] = useState<
    { key: string; playbook: DcaPlaybook | null; seed?: DcaPlaybook }[]
  >(() => playbooks.map((playbook) => ({ key: playbook.id, playbook })));
  const [cloneMenu, setCloneMenu] = useState(0);
  const empty = cards.length === 0;
  const cloneSources = cards
    .map((card) => card.playbook)
    .filter((playbook): playbook is DcaPlaybook => Boolean(playbook));
  const addPlaybookClass =
    "rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong";

  function appendApplied(items: AppliedDeskItem[]) {
    const playbooks = items
      .filter(
        (item): item is Extract<AppliedDeskItem, { deskType: "dca" }> =>
          item.deskType === "dca",
      )
      .map((item) => item.playbook);
    if (playbooks.length === 0) {
      return;
    }
    setCards((current) => {
      const seen = new Set(
        current
          .map((card) => card.playbook?.id)
          .filter((id): id is string => Boolean(id)),
      );
      const fresh = playbooks.filter((playbook) => !seen.has(playbook.id));
      if (fresh.length === 0) {
        return current;
      }
      return [
        ...current,
        ...fresh.map((playbook) => ({ key: playbook.id, playbook })),
      ];
    });
  }

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
          No bots yet. Add a bot to own orders and exits on one
          contract. Leave this empty if you are not ready to arm.
        </p>
      ) : (
        cards.map((card, index) => (
          <DcaPlaybookForm
            key={card.key}
            playbook={card.playbook}
            seed={card.seed}
            options={options}
            signalWebhooks={signalWebhooks}
            availableUsdt={availableUsdt}
            bookUsdt={bookUsdt}
            leverage={leverage}
            lastPrices={lastPrices}
            webhooksHref={webhooksHref}
            isAdmin={isAdmin}
            folders={sets}
            policy={policy}
            venueEnvironment={venueEnvironment}
            backtestLibrary={library}
            onTemplateSaved={(item) =>
              setExtraLibrary((current) => [
                ...current.filter((row) => row.id !== item.id),
                item,
              ])
            }
            defaultName={
              card.playbook?.name ??
              card.seed?.name ??
              (index === 0 ? DEFAULT_DCA_NAME : `DCA ${index + 1}`)
            }
            onResult={(result) => {
              const next = result as DcaDeskActionResult;
              if (next.deletedId) {
                setCards((current) =>
                  current.filter((item) => item.key !== card.key),
                );
                return;
              }
              if (next.playbook) {
                setCards((current) =>
                  current.map((item) =>
                    item.key === card.key
                      ? { ...item, playbook: next.playbook ?? null, seed: undefined }
                      : item,
                  ),
                );
              }
            }}
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
          className={addPlaybookClass}
        >
          Create New Bot
        </button>
        {accountId ? (
          <DeskTemplateBar
            deskType="dca"
            accountId={accountId}
            templates={templates}
            sets={sets}
            onApplied={appendApplied}
          />
        ) : null}
        {cloneSources.length > 0 ? (
          <select
            key={cloneMenu}
            aria-label="Clone existing bot"
            defaultValue=""
            onChange={(event) => {
              const id = event.target.value;
              const source = cloneSources.find((item) => item.id === id);
              if (!source) {
                return;
              }
              const seed = dcaCloneIdleDraft(source);
              setCards((current) => [
                ...current,
                {
                  key: `clone-${source.id}-${Date.now()}`,
                  playbook: null,
                  seed,
                },
              ]);
              setCloneMenu((n) => n + 1);
            }}
            className="rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong"
          >
            <option value="">Clone existing bot</option>
            {cloneSources.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.symbol}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}

export function DcaPlaybookForm({
  playbook,
  seed = null,
  options,
  signalWebhooks,
  availableUsdt = null,
  bookUsdt = null,
  leverage = null,
  lastPrices = {},
  reduceOnly = false,
  defaultName,
  onRemoveDraft,
  onResult,
  webhooksHref = FUTURES_PATHS.webhooks,
  isAdmin = false,
  folders = [],
  policy = BYBIT_DCA_UI,
  venueEnvironment = null,
  backtestLibrary = [],
  onTemplateSaved,
}: {
  playbook: DcaPlaybook | null;
  seed?: DcaPlaybook | null;
  options: LinearPerp[];
  signalWebhooks: DcaSignalWebhookOption[];
  availableUsdt?: number | null;
  bookUsdt?: number | null;
  leverage?: number | null;
  lastPrices?: Record<string, number>;
  reduceOnly?: boolean;
  defaultName?: string;
  onRemoveDraft?: () => void;
  onResult?: (result: DcaDeskActionResult) => void;
  webhooksHref?: string;
  isAdmin?: boolean;
  folders?: AutomationTemplateSet[];
  policy?: DcaPlaybookUiPolicy;
  venueEnvironment?: string | null;
  backtestLibrary?: BacktestLibraryItem[];
  onTemplateSaved?: (item: BacktestLibraryItem) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const source = playbook ?? seed;
  const [direction, setDirection] = useState(
    source?.direction === "both" && !policy.includeBoth
      ? "long"
      : (source?.direction ?? "long"),
  );
  const [startKind, setStartKind] = useState<DcaStartKind>(
    source?.startKind ?? "immediate",
  );
  const [averaging, setAveraging] = useState<DcaAveragingKind>(() =>
    source ? dcaAveragingKind(source) : "dip",
  );
  const [restGrid, setRestGrid] = useState(
    source?.dcaMode === "order",
  );
  const [clipSize, setClipSize] = useState(
    source ? String(source.clipSize) : "",
  );
  const [sizeUnit, setSizeUnit] = useState(source?.sizeUnit ?? "usdt");
  const [maxClips, setMaxClips] = useState(optional(source?.maxClips));
  const [maxValueMode, setMaxValueMode] = useState<"none" | DcaMaxValueKind>(
    source?.maxValue != null
      ? (source.maxValueKind ?? "usdt")
      : "none",
  );
  const maxValueKind: DcaMaxValueKind =
    maxValueMode === "percent" ? "percent" : "usdt";
  const [maxValue, setMaxValue] = useState(
    source?.maxValue != null ? optional(source.maxValue) : "",
  );
  const [maxValueSettled, setMaxValueSettled] = useState(
    source?.maxValue != null ? optional(source.maxValue) : "",
  );
  const accountBookUsdt = bookUsdt ?? availableUsdt;
  useEffect(() => {
    const timer = window.setTimeout(() => setMaxValueSettled(maxValue), 600);
    return () => window.clearTimeout(timer);
  }, [maxValue]);
  const [dipPct, setDipPct] = useState(optional(source?.dipPct));
  const intervalParts = dcaIntervalParts(source?.intervalMinutes ?? null);
  const [intervalUnit, setIntervalUnit] = useState<DcaIntervalUnit>(
    intervalParts.unit,
  );
  const [sizeMultiplier, setSizeMultiplier] = useState(
    source ? String(source.sizeMultiplier) : "1",
  );
  const [deviationMultiplier, setDeviationMultiplier] = useState(
    source ? String(source.deviationMultiplier) : "1",
  );
  const [takeProfitPct, setTakeProfitPct] = useState(
    optional(source?.takeProfitPct),
  );
  const [takeProfitBasis, setTakeProfitBasis] = useState<DcaExitBasis>(
    source?.takeProfitBasis ?? "average",
  );
  const [stopLossPct, setStopLossPct] = useState(
    optional(source?.stopLossPct),
  );
  const [stopLossBasis, setStopLossBasis] = useState<DcaExitBasis>(
    source?.stopLossBasis ?? "average",
  );
  const [takeProfitOrderType, setTakeProfitOrderType] =
    useState<FuturesOrderType>(source?.takeProfitOrderType ?? "market");
  const [indicatorKind, setIndicatorKind] = useState(
    source?.indicatorKind ?? "rsi",
  );
  const [indicatorTimeframe, setIndicatorTimeframe] = useState(
    source?.indicatorTimeframe ?? "15",
  );
  const [indicatorLevel, setIndicatorLevel] = useState(
    optional(source?.indicatorLevel) ||
      ((source?.indicatorKind ?? "rsi") === "rsi" ? "30" : ""),
  );
  const [indicatorCompare, setIndicatorCompare] = useState(() => {
    const kind = source?.indicatorKind ?? "rsi";
    if (kind === "rsi") {
      return source?.indicatorCompare ?? "cross_lte";
    }
    if (kind === "macd") {
      if (
        source?.indicatorCompare === "cross_gte" ||
        source?.indicatorCompare === "cross_lte"
      ) {
        return "cross_gte";
      }
      if (source?.indicatorKind === "macd") {
        return "gte";
      }
      return "cross_gte";
    }
    if (
      source?.indicatorCompare === "cross_gte" ||
      source?.indicatorCompare === "cross_lte"
    ) {
      return source.indicatorCompare;
    }
    return "pair";
  });
  const defaultSymbol =
    source?.symbol ??
    options.find((row) => row.symbol === policy.defaultSymbol)?.symbol ??
    options[0]?.symbol ??
    policy.defaultSymbol;
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [ladderTab, setLadderTab] = useState<"long" | "short">("long");
  const [ladderOpen, setLadderOpen] = useState(false);
  const ladderPanelId = useId();
  const lastPrice = lastPrices[symbol] ?? null;
  const running = Boolean(playbook && dcaPlaybookIsRunning(playbook));
  const cycleLocked = Boolean(playbook && dcaPlaybookHasOpenCycle(playbook));
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
  const resolvedMaxValue = dcaResolvedMaxValueUsdt({
    kind: maxValueKind,
    maxValue: asNumber(maxValue),
    bookUsdt: accountBookUsdt,
  });
  const valueCapUsdt =
    maxValueMode === "none"
      ? null
      : maxValueKind === "percent"
        ? resolvedMaxValue
        : asNumber(maxValue);
  const budgetSizesClip =
    valueCapUsdt != null && asNumber(maxClips) != null;
  const sizeUnitForClip = budgetSizesClip ? "usdt" : sizeUnit;
  const derivedClip = dcaClipFromBudget({
    maxValue: valueCapUsdt,
    maxClips: asNumber(maxClips),
    sizeMultiplier: asNumber(sizeMultiplier) ?? 1,
    sizeUnit: sizeUnitForClip,
    mark: lastPrice,
  });
  const clipForSave = derivedClip != null
    ? formatDerivedClip(derivedClip, sizeUnitForClip)
    : clipSize;
  const sizeErrorLive = perpTicketSizeError({
    size: clipForSave,
    unit: sizeUnitForClip,
    minQty: selectedPair?.minQty ?? 0,
    minNotional: selectedPair?.minNotional ?? 0,
    lastPrice,
    baseCoin: selectedPair?.baseCoin ?? "Token",
  });
  const sizeCheckReady =
    maxValueMode !== "percent" || maxValue === maxValueSettled;
  const sizeError = sizeCheckReady ? sizeErrorLive : null;
  const ladderMaxErrorLive = dcaConfigMaxOrderError({
    config: {
      direction,
      dcaMode: averaging !== "interval" && restGrid ? "order" : "position",
      clipSize: asNumber(clipForSave) ?? 0,
      sizeUnit: sizeUnitForClip,
      maxClips: asNumber(maxClips),
      maxValue: maxValueMode === "none" ? null : asNumber(maxValue),
      maxValueKind,
      dipPct: averaging === "dip" ? asNumber(dipPct) : null,
      sizeMultiplier: asNumber(sizeMultiplier) ?? 1,
      deviationMultiplier: asNumber(deviationMultiplier) ?? 1,
    },
    lastPrice,
    maxQty: selectedPair?.maxQty ?? 0,
    maxMktQty: selectedPair?.maxMktQty ?? 0,
    baseCoin: selectedPair?.baseCoin ?? "Token",
    bookUsdt: accountBookUsdt,
  });
  const ladderMaxError = sizeCheckReady ? ladderMaxErrorLive : null;
  const maxValueMissing =
    maxValueMode !== "none" && asNumber(maxValue) == null
      ? "Enter a max value."
      : null;
  const saveError =
    maxValueMissing ??
    (asNumber(clipForSave) === null ? sizeError : (sizeError ?? ladderMaxError));
  const saveBlocked = cycleLocked ? null : saveError;
  const restGridEffective = averaging !== "interval" && restGrid;
  const summaryBySide = useMemo(() => {
    const input = {
      lastPrice,
      averaging,
      clipSize: clipForSave,
      sizeUnit: sizeUnitForClip,
      sizeMultiplier,
      deviationMultiplier,
      dipPct,
      maxClips,
      maxValue: valueCapUsdt == null ? "" : String(valueCapUsdt),
      takeProfitPct,
      takeProfitBasis,
      stopLossPct,
      stopLossBasis,
      leverage,
    };
    return {
      long: dcaSummaryPreview({ ...input, side: "long" }),
      short: dcaSummaryPreview({ ...input, side: "short" }),
    };
  }, [
    averaging,
    clipForSave,
    deviationMultiplier,
    dipPct,
    lastPrice,
    maxClips,
    maxValue,
    valueCapUsdt,
    sizeMultiplier,
    sizeUnit,
    sizeUnitForClip,
    stopLossBasis,
    stopLossPct,
    takeProfitBasis,
    takeProfitPct,
    leverage,
  ]);
  const showLadderTabs = direction === "both";
  const activeLadderSide: FuturesSide = showLadderTabs
    ? ladderTab
    : direction === "short"
      ? "short"
      : "long";
  const summary = summaryBySide[activeLadderSide];
  function snapshotOverlay() {
    return {
      name: source?.name || defaultName || DEFAULT_DCA_NAME,
      symbol,
      direction,
      startKind,
      averaging,
      restGrid: averaging === "dip" && restGrid,
      sizeUnit: sizeUnitForClip,
      clipSize: clipForSave,
      maxClips,
      maxValue: maxValueMode === "none" ? "" : maxValue,
      maxValueKind: maxValueMode,
      dipPct,
      intervalUnit,
      sizeMultiplier,
      deviationMultiplier,
      takeProfitPct,
      takeProfitBasis,
      takeProfitOrderType,
      stopLossPct,
      stopLossBasis,
      indicatorKind,
      indicatorTimeframe,
      indicatorCompare,
      indicatorLevel,
    };
  }
  function snapshotForm() {
    return dcaFormToSnapshotSource(formRef.current, {
      ...snapshotOverlay(),
      name:
        readFormControl(formRef.current, "name") ||
        snapshotOverlay().name,
    });
  }
  function liveRecipe() {
    const parsed = parseDcaPlaybookForm(snapshotForm(), policy.venueId);
    return parsed.ok ? snapshotDcaRecipe(parsed.config) : null;
  }
  function recipeForBacktest() {
    const parsed = parseDcaPlaybookForm(snapshotForm(), policy.venueId);
    if (!parsed.ok) {
      return parsed;
    }
    return { ok: true as const, recipe: snapshotDcaRecipe(parsed.config) };
  }
  const removeControl = playbook ? (
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
        deskAction="delete"
        pendingLabel="Removing…"
        className={headerRemoveClass}
        skipSizeGuard
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
  ) : null;

  return (
    <StayOnPageForm
      ref={formRef}
      action={saveDcaPlaybookAction}
      actions={{
        "save-arm": saveAndArmDcaPlaybookAction,
        "arm-long": runDcaArmLongAction,
        "arm-short": runDcaArmShortAction,
        arm: runDcaArmAction,
        disarm: runDcaDisarmAction,
        close: runDcaClosePlaybookAction,
        delete: deleteDcaPlaybookAction,
      }}
      onResult={(result) => onResult?.(result as DcaDeskActionResult)}
      guard={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter as
          | HTMLElement
          | null;
        const skip = submitter?.dataset.skipSizeGuard === "1";
        if (saveBlocked && !skip) {
          return false;
        }
        return true;
      }}
      className="space-y-3 rounded-card border border-line bg-surface px-4 py-3"
    >
      <input type="hidden" name="playbookId" value={playbook?.id ?? ""} />
      <input type="hidden" name="deskVenue" value={policy.venueId} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2">
          {showSaveAndArm ||
          showManualTriggers ||
          (playbook && showArmButton && !showStopAdding) ? (
            <p className="shrink-0 text-xs text-ink-muted">
              Initial Order Triggers
            </p>
          ) : null}
          {showSaveAndArm ? (
            <PendingSubmitButton
              deskAction="save-arm"
              pendingLabel="Arming…"
              className={headerLongClass}
              disabled={Boolean(saveBlocked)}
              title={saveBlocked ?? undefined}
            >
              Save and Arm
            </PendingSubmitButton>
          ) : null}
          {showManualTriggers
            ? (
                [
                  {
                    side: "long" as const,
                    deskAction: "arm-long",
                    label: "Save and Trigger Long",
                    className: headerLongClass,
                  },
                  {
                    side: "short" as const,
                    deskAction: "arm-short",
                    label: "Save and Trigger Short",
                    className: headerShortClass,
                  },
                ] as const
              ).map((item) => {
                const onDirection = dcaEnabledSides(direction).includes(
                  item.side,
                );
                const sideRunning = playbook
                  ? dcaLegIsRunning(dcaLegFor(playbook, item.side).status)
                  : false;
                const blockedReason = !onDirection
                  ? "Set Direction to include this side"
                  : sideRunning
                    ? `${item.side === "long" ? "Long" : "Short"} is already running`
                    : saveBlocked;
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
                    deskAction={item.deskAction}
                    pendingLabel="Triggering…"
                    className={item.className}
                  >
                    {item.label}
                  </PendingSubmitButton>
                );
              })
            : null}
          {playbook ? (
            <>
              {showArmButton && !showStopAdding ? (
                <PendingSubmitButton
                  deskAction="arm"
                  pendingLabel="Arming…"
                  className={headerSecondaryClass}
                  disabled={Boolean(saveBlocked)}
                  title={saveBlocked ?? undefined}
                >
                  Arm
                </PendingSubmitButton>
              ) : null}
            </>
          ) : null}
        </div>
        <DcaStatusLight playbook={playbook ?? null} reduceOnly={reduceOnly} />
      </div>
      <DeskFormFlash />
      {saveBlocked ? <SizeGuardNote message={saveBlocked} /> : null}
      {reduceOnly ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Reduce only is on. New orders stay blocked until you turn it off in
          Desk Settings. Take profit and stop still run.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-[11px] text-ink-muted">
          Name
          <input
            name="name"
            defaultValue={source?.name ?? defaultName ?? DEFAULT_DCA_NAME}
            maxLength={40}
            className="mt-0.5 w-full rounded-control border border-line bg-surface-raised px-1.5 py-1 text-sm font-semibold text-ink focus:border-line-strong focus:outline-none"
          />
        </label>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <PendingSubmitButton
            pendingLabel="Saving…"
            deskAction="default"
            className={headerPrimaryClass}
            disabled={Boolean(saveBlocked)}
            title={saveBlocked ?? undefined}
          >
            Save
          </PendingSubmitButton>
          {playbook && showStopAdding ? (
              <span
                className="inline-flex"
                title="Stop adding any new orders (also cancels any existing entry limit orders)"
              >
                <PendingSubmitButton
                  deskAction="disarm"
                  pendingLabel="Stopping…"
                  className={headerPrimaryClass}
                  skipSizeGuard
                >
                  Stop adding
                </PendingSubmitButton>
              </span>
            ) : null}
          {playbook && showClosePlaybook ? (
              <span
                className="inline-flex"
                title="Close all positions and place the bot in idle mode (no new entries)"
              >
                <PendingSubmitButton
                  deskAction="close"
                  pendingLabel="Closing…"
                  className={headerPrimaryClass}
                  skipSizeGuard
                >
                  Close bot
                </PendingSubmitButton>
              </span>
            ) : null}
        </div>
      </div>
      {cycleLocked ? (
        <p className="text-xs text-ink-muted">
          A position is open. Cycle settings are locked. Take profit and stops
          still save and update the resting orders.
        </p>
      ) : null}

      <CycleLock locked={cycleLocked}>
      <fieldset className={sectionClass}>
        <p className={sectionTitleClass}>
          Pair and Trigger
        </p>
        <div className={rowClass}>
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
              onChange={(event) => {
                const next = event.target.value as typeof direction;
                setDirection(next);
                setIndicatorCompare((current) =>
                  indicatorCompareForDirection(next, indicatorKind, current),
                );
              }}
              className={fieldClass}
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
              {policy.includeBoth ? (
                <option value="both">Both</option>
              ) : null}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Initial Order Trigger
            <select
              name="startKind"
              value={startKind}
              onChange={(event) =>
                setStartKind(event.target.value as DcaStartKind)
              }
              className={fieldClass}
            >
              <option value="immediate">Manual</option>
              <option value="indicator">Indicator</option>
              <option value="price">Price Cross</option>
              <option value="webhook">Signal Webhook</option>
            </select>
          </label>
        </div>
        {direction === "both" ? (
          <p className="text-xs text-ink-muted">
            Long and Short are independent positions and never flatten each other
          </p>
        ) : null}
      </fieldset>

      {startKind !== "immediate" ? (
      <fieldset className={sectionClass}>
        <p className={sectionTitleClass}>
          Initial Order Trigger Parameters
        </p>
        <div className={rowClass}>
          {startKind === "price" ? (
            <TriggerFields
              prefix="arm"
              triggerBy={source?.armTrigger?.triggerBy ?? "last"}
              compare={source?.armTrigger?.compare ?? "gte"}
              price={optional(source?.armTrigger?.price)}
            />
          ) : null}
          {startKind === "webhook" ? (
            signalWebhooks.length > 0 ? (
              <>
                <label className={`${labelClass} lg:col-span-2`}>
                  Signal Webhook
                  <select
                    name="webhookId"
                    defaultValue={source?.webhookId ?? signalWebhooks[0]?.id}
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
                <Link href={webhooksHref} className="text-accent">
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
                  onChange={(event) => {
                    const next = event.target.value as
                      | "rsi"
                      | "macd"
                      | "ema_cross";
                    setIndicatorKind(next);
                    setIndicatorCompare(
                      indicatorCompareForDirection(direction, next, ""),
                    );
                  }}
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
                  value={indicatorTimeframe}
                  onChange={(event) =>
                    setIndicatorTimeframe(
                      event.target.value as DcaIndicatorTimeframe,
                    )
                  }
                  className={fieldClass}
                >
                  {DCA_INDICATOR_TIMEFRAMES.map((interval) => (
                    <option key={interval} value={interval}>
                      {DCA_INDICATOR_TIMEFRAME_LABELS[interval]}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                When
                <select
                  name="indicatorCompare"
                  value={indicatorCompareForDirection(
                    direction,
                    indicatorKind,
                    indicatorCompare,
                  )}
                  onChange={(event) => setIndicatorCompare(event.target.value)}
                  className={fieldClass}
                >
                  {indicatorKind === "rsi" && direction === "both" ? (
                    <>
                      <option value="cross_lte">Crosses the level</option>
                      <option value="lte">At the level</option>
                    </>
                  ) : null}
                  {indicatorKind === "rsi" && direction === "long" ? (
                    <>
                      <option value="cross_lte">Crosses below</option>
                      <option value="lte">At or below</option>
                    </>
                  ) : null}
                  {indicatorKind === "rsi" && direction === "short" ? (
                    <>
                      <option value="cross_gte">Crosses above</option>
                      <option value="gte">At or above</option>
                    </>
                  ) : null}
                  {indicatorKind === "macd" ? (
                    <>
                      <option value="cross_gte">Crosses zero</option>
                      <option value="gte">Histogram sign</option>
                    </>
                  ) : null}
                  {indicatorKind === "ema_cross" ? (
                    <>
                      <option value="pair">EMA 9/21 cross</option>
                      <option value="cross_gte">EMA 21 crosses</option>
                    </>
                  ) : null}
                </select>
              </label>
              {indicatorKind === "rsi" ||
              (indicatorKind === "ema_cross" &&
                indicatorCompare !== "pair") ? (
                <label className={labelClass}>
                  {indicatorKind === "ema_cross" ? "Level (price)" : "Level"}
                  <GroupedNumberInput
                    name="indicatorLevel"
                    value={indicatorLevel}
                    onChange={setIndicatorLevel}
                    allowDecimal
                    className={fieldClass}
                  />
                </label>
              ) : null}
              {direction === "both" ? (
                <p className="text-xs text-ink-muted sm:col-span-2 lg:col-span-4">
                  {indicatorBothSidesHint(indicatorKind, indicatorCompare)}{" "}
                  <IndicatorBothDetails
                    kind={indicatorKind}
                    compare={indicatorCompare}
                  />
                </p>
              ) : (
                <>
                  {indicatorKind === "macd" ? (
                    <p className="self-end text-xs text-ink-muted sm:col-span-2">
                      {direction === "long"
                        ? indicatorCompare === "gte"
                          ? "Triggers Long while the histogram is positive."
                          : "Triggers Long when the histogram crosses above zero."
                        : indicatorCompare === "gte"
                          ? "Triggers Short while the histogram is negative."
                          : "Triggers Short when the histogram crosses below zero."}
                    </p>
                  ) : null}
                  {indicatorKind === "ema_cross" &&
                  indicatorCompare === "pair" ? (
                    <p className="self-end text-xs text-ink-muted sm:col-span-2">
                      {direction === "long"
                        ? "Triggers Long when EMA 9 crosses above EMA 21."
                        : "Triggers Short when EMA 9 crosses below EMA 21."}
                    </p>
                  ) : null}
                  {indicatorKind === "ema_cross" &&
                  indicatorCompare !== "pair" ? (
                    <p className="text-xs text-ink-muted sm:col-span-2">
                      {direction === "long"
                        ? "Triggers Long when EMA 21 crosses above the price level."
                        : "Triggers Short when EMA 21 crosses below the price level."}
                    </p>
                  ) : null}
                  {indicatorKind === "rsi" ? (
                    <p className="text-xs text-ink-muted sm:col-span-2">
                      {direction === "long"
                        ? indicatorCompare.startsWith("cross")
                          ? "Triggers Long when RSI crosses below the level."
                          : "Triggers Long while RSI is at or below the level."
                        : indicatorCompare.startsWith("cross")
                          ? "Triggers Short when RSI crosses above the level."
                          : "Triggers Short while RSI is at or above the level."}
                    </p>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </div>
      </fieldset>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset className={sectionClass}>
          <p className={sectionTitleClass}>
            Maximum Exposure
          </p>
          <div
            className={
              maxValueMode === "none"
                ? "grid grid-cols-2 gap-x-3 gap-y-2"
                : "grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)] gap-x-3 gap-y-2"
            }
          >
            <label className={`min-w-0 ${labelClass}`}>
              Max orders
              <GroupedNumberInput
                name="maxClips"
                value={maxClips}
                onChange={setMaxClips}
                className={fieldClass}
                placeholder="No cap"
              />
            </label>
            <label className={`min-w-0 ${labelClass}`}>
              Max value
              <select
                name="maxValueKind"
                value={maxValueMode}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === "none") {
                    setMaxValueMode("none");
                    setMaxValue("");
                    return;
                  }
                  const kind = parseDcaMaxValueKind(next);
                  setMaxValueMode(kind);
                  const amount = asNumber(maxValue);
                  if (kind === "percent" && amount != null && amount > 100) {
                    setMaxValue("");
                  }
                }}
                className={fieldClass}
              >
                <option value="usdt">Fixed {policy.quoteLabel}</option>
                <option value="percent">% of account</option>
                <option value="none">No max value</option>
              </select>
            </label>
            {maxValueMode !== "none" ? (
              <label className={`min-w-0 ${labelClass}`}>
                {maxValueMode === "percent" ? "Percent" : policy.quoteLabel}
                <GroupedNumberInput
                  name="maxValue"
                  value={maxValue}
                  onChange={setMaxValue}
                  allowDecimal
                  className={fieldClass}
                  placeholder={
                    maxValueMode === "percent" ? "e.g. 20" : "e.g. 700"
                  }
                />
                {maxValueMissing ? (
                  <p className="mt-1 text-xs text-danger">{maxValueMissing}</p>
                ) : null}
              </label>
            ) : null}
          </div>
          {accountBookUsdt != null ? (
            <input
              type="hidden"
              name="accountBookUsdt"
              value={String(accountBookUsdt)}
            />
          ) : null}
          {maxValueMode === "percent" ? (
            <p className="text-xs text-ink-muted">
              {resolvedMaxValue != null && accountBookUsdt != null
                ? `${asNumber(maxValue)}% of ${formatUsdAmount(accountBookUsdt)} = ${formatUsdAmount(resolvedMaxValue)}. Recalculates at the start of each cycle.`
                : "Recalculates from account balance at the start of each cycle."}
            </p>
          ) : null}
        </fieldset>
        <fieldset className={sectionClass}>
          <p className={sectionTitleClass}>
            Initial Order Size
          </p>
          <div
            className={
              budgetSizesClip
                ? "grid gap-x-3 gap-y-2"
                : "grid gap-x-3 gap-y-2 sm:grid-cols-2"
            }
          >
            {budgetSizesClip ? (
              <input type="hidden" name="sizeUnit" value="usdt" />
            ) : (
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
                  <option value="usdt">{policy.quoteLabel}</option>
                  <option value="qty">Token qty</option>
                </select>
              </label>
            )}
            <label className={labelClass}>
              {budgetSizesClip
                ? `Order size (${policy.quoteLabel})`
                : "Order size"}
              {derivedClip != null ? (
                <>
                  <input type="hidden" name="clipSize" value={clipForSave} />
                  <GroupedNumberInput
                    value={clipForSave}
                    onChange={() => undefined}
                    allowDecimal
                    className={`${fieldClass} cursor-default text-ink-muted`}
                    ariaLabel="Calculated order size"
                  />
                </>
              ) : (
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
              )}
              {sizeError ? (
                <p className="mt-1 text-xs text-danger">{sizeError}</p>
              ) : derivedClip != null ? (
                <p className="mt-1 text-xs text-ink-muted">
                  Calculated from max value and max orders at the start of each cycle
                </p>
              ) : budgetSizesClip ? (
                <p className="mt-1 text-xs text-ink-muted">
                  {maxValueKind === "percent" && accountBookUsdt == null
                    ? "Need an account balance to calculate from %."
                    : null}
                </p>
              ) : null}
            </label>
          </div>
        </fieldset>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset className={sectionClass}>
          <p className={sectionTitleClass}>
            Additional orders
          </p>
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
                <PercentInput
                  name="dipPct"
                  value={dipPct}
                  onChange={setDipPct}
                  placeholder="Off"
                  ariaLabel="Price deviation percent"
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
              <label className="flex items-start gap-2 py-2 text-xs text-ink sm:col-span-2">
                <input
                  type="checkbox"
                  name="restGrid"
                  value="1"
                  checked={restGrid}
                  onChange={(event) => {
                    setRestGrid(event.target.checked);
                  }}
                  className="mt-0.5"
                />
                Remaining orders placed as GTC limit (instead of market)
              </label>
            ) : null}
          </div>
        </fieldset>
        <fieldset className={sectionClass}>
          <p className={sectionTitleClass}>
            Additional order multipliers
          </p>
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
                className={`mt-0.5 w-full rounded-control border bg-surface-raised px-2 py-1.5 text-sm text-ink focus:outline-none ${
                  ladderMaxError
                    ? "border-warning focus:border-warning"
                    : "border-line focus:border-line-strong"
                }`}
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
          {ladderMaxError ? <SizeGuardNote message={ladderMaxError} /> : null}
        </fieldset>
      </div>
      </CycleLock>

      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset className={sectionClass}>
          <p className={sectionTitleClass}>Take profit</p>
          <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
          <label className={labelClass}>
            Take profit target
            <PercentInput
              name="takeProfitPct"
              value={takeProfitPct}
              onChange={setTakeProfitPct}
              placeholder="Off"
              ariaLabel="Take profit target percent"
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
        <label className="flex items-start gap-2 py-2 text-xs text-ink">
          <input
            type="hidden"
            name="takeProfitOrderType"
            value={takeProfitOrderType}
          />
          <input
            type="checkbox"
            checked={takeProfitOrderType === "limit"}
            onChange={(event) =>
              setTakeProfitOrderType(event.target.checked ? "limit" : "market")
            }
            className="mt-0.5"
          />
          Take profit placed as GTC limit (instead of market)
        </label>
        <p className={sectionTitleClass}>
          Trailing stop
        </p>
        <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
          <label className={labelClass}>
            <ColumnHint
              label="Trigger %"
              hint="The trailing stop will be triggered once the price moves by this %."
            />
            <PercentInput
              name="trailingTriggerPct"
              defaultValue={optional(source?.trailingTriggerPct)}
              placeholder="Off"
              ariaLabel="Trailing trigger percent"
            />
          </label>
          <label className={labelClass}>
            <ColumnHint
              label="Trailing %"
              hint="The % from the price where the stop will be placed."
            />
            <PercentInput
              name="trailingPct"
              defaultValue={optional(source?.trailingPct)}
              placeholder="Off"
              ariaLabel="Trailing percent"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className={sectionClass}>
        <p className={sectionTitleClass}>
          Stop loss
        </p>
        <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
          <label className={labelClass}>
            Stop loss %
            <PercentInput
              name="stopLossPct"
              value={stopLossPct}
              onChange={setStopLossPct}
              placeholder="Off"
              ariaLabel="Stop loss percent"
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
        </div>
        <p className={sectionTitleClass}>
          Move Breakeven
        </p>
        <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
          <label className={labelClass}>
            Move stop to breakeven at %
            <PercentInput
              name="breakevenActivationPct"
              defaultValue={optional(source?.breakevenActivationPct)}
              placeholder="Off"
              ariaLabel="Move stop to breakeven at percent"
            />
          </label>
          <label className={labelClass}>
            Breakeven offset %
            <PercentInput
              name="breakevenOffsetPct"
              defaultValue={optional(source?.breakevenOffsetPct)}
              placeholder="0"
              ariaLabel="Breakeven offset percent"
            />
          </label>
        </div>
      </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <div>
            {ladderMaxError && !ladderOpen ? (
              <SizeGuardNote message={ladderMaxError} />
            ) : null}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
              aria-expanded={ladderOpen}
              onClick={() => setLadderOpen((open) => !open)}
            >
              {ladderOpen ? "Hide Summary" : "Show Summary"}
              <ChevronIcon className={ladderOpen ? "rotate-90" : undefined} />
            </button>
          </div>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <BacktestTemplateLink
            current={liveRecipe()}
            getRecipe={recipeForBacktest}
            templates={backtestLibrary}
            venueId={policy.venueId}
            venueEnvironment={venueEnvironment}
          />
          <SaveAsTemplateButton
            isAdmin={isAdmin}
            defaultName={source?.name ?? defaultName ?? DEFAULT_DCA_NAME}
            kind="dca"
            folders={folders}
            buildForm={snapshotForm}
            onSaved={(templateId) => {
              const recipe = liveRecipe();
              if (recipe) {
                onTemplateSaved?.({
                  id: templateId,
                  name: recipe.name,
                  recipe,
                });
              }
            }}
          />
          {removeControl}
        </div>
      </div>
      {!running || ladderOpen ? (
      <fieldset className={sectionClass}>
        <p className={sectionTitleClass}>
          Summary
        </p>
        {ladderMaxError ? <SizeGuardNote message={ladderMaxError} /> : null}
        <div
          className={
            showLadderTabs
              ? "mb-3 flex items-end justify-between gap-3 border-b border-line"
              : "mb-2"
          }
        >
          {showLadderTabs ? (
            <div
              role="tablist"
              aria-label="Ladder side"
              className="flex gap-1"
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
          <p
            className={`text-xs text-ink-muted ${
              showLadderTabs ? "pb-2 text-right" : ""
            }`}
          >
            Summary is based on the current asset price and the parameters
            configured above
          </p>
        </div>
        <div
          role={showLadderTabs ? "tabpanel" : undefined}
          id={showLadderTabs ? ladderPanelId : undefined}
        >
        <div className="flex flex-wrap">
          <SummaryStat
            label="Covered Range"
            value={
              summary.covered === null ? "—" : `${trimPct(summary.covered)}%`
            }
            hint={
              summary.covered === null
                ? "Set max orders and price deviation %"
                : "First fill to last clip"
            }
          />
          <SummaryStat
            label="Max Exposure"
            value={
              summary.required === null
                ? "—"
                : formatUsdAmount(summary.required)
            }
            hint={
              summary.required === null
                ? sizeUnitForClip === "qty"
                  ? "Use USDT size to estimate"
                  : null
                : [
                    "Full ladder notional",
                    showLadderTabs ? "This side only" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
          <SummaryStat
            label="Initial Margin"
            value={
              summary.initialMargin === null
                ? "—"
                : formatUsdAmount(summary.initialMargin)
            }
            valueClass={
              availableUsdt !== null &&
              summary.initialMargin !== null &&
              summary.initialMargin > availableUsdt
                ? "text-warning"
                : "text-ink"
            }
            hint={
              summary.initialMargin === null
                ? leverage == null || !(leverage > 0)
                  ? "Max exposure ÷ leverage. Set leverage to estimate."
                  : null
                : [
                    `Max exposure ÷ ${leverage}×`,
                    availableUsdt !== null
                      ? summary.initialMargin > availableUsdt
                        ? `Available ${formatUsdAmount(availableUsdt)} — less than this margin`
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
        {summary.levels.length > 0 ? (
          <div className="thin-scroll mt-4 max-h-80 overflow-auto rounded-card border border-line">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Deviation</th>
                  <th className="px-3 py-2 font-medium">
                    {sizeUnitForClip === "qty" ? "Qty" : "Size"}
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
                {summary.levels.map((row) => {
                  const size = asNumber(clipForSave) ?? 0;
                  const sizeMult = asNumber(sizeMultiplier) ?? 1;
                  const qty = dcaClipQtyAt(
                    row.index - 1,
                    size,
                    sizeMult,
                    sizeUnitForClip,
                    row.price,
                  );
                  const cap = perpEffectiveMaxQty({
                    maxQty: selectedPair?.maxQty ?? 0,
                    maxMktQty: selectedPair?.maxMktQty ?? 0,
                    orderType: dcaClipOrderType(
                      row.index - 1,
                      restGridEffective,
                    ),
                  });
                  const overMax = cap > 0 && qty > cap;
                  return (
                <tr
                  key={row.index}
                  className={`border-t border-line${overMax ? " bg-warning/10" : ""}`}
                >
                    <td className="px-3 py-2 tabular-nums text-ink">{row.index}</td>
                    <td className="px-3 py-2 tabular-nums text-ink">
                      {formatLadderPrice(row.price)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-ink-muted">
                      {row.index === 1
                        ? "—"
                        : `${row.deviationPct > 0 ? "+" : ""}${trimPct(row.deviationPct)}%`}
                    </td>
                    <td
                      className={`px-3 py-2 tabular-nums ${
                        overMax ? "text-warning" : "text-ink"
                      }`}
                    >
                      {formatGroupedNumber(row.size)}
                    </td>
                    <td
                      className={`px-3 py-2 tabular-nums ${
                        overMax ? "text-warning" : "text-ink"
                      }`}
                    >
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
                  );
                })}
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
      ) : null}
    </StayOnPageForm>
  );
}

function indicatorCompareForDirection(
  direction: "long" | "short" | "both",
  kind: "rsi" | "macd" | "ema_cross",
  compare: string,
): string {
  if (kind === "macd") {
    return compare === "gte" ? "gte" : "cross_gte";
  }
  if (kind === "ema_cross") {
    return compare === "pair" || compare === "" ? "pair" : "cross_gte";
  }
  const isCross = compare.startsWith("cross") || compare === "";
  if (direction === "short") {
    return isCross ? "cross_gte" : "gte";
  }
  return isCross ? "cross_lte" : "lte";
}

function indicatorBothSidesHint(
  kind: "rsi" | "macd" | "ema_cross",
  compare: string,
): string {
  if (kind === "macd") {
    if (compare === "gte") {
      return "Triggers Long while the histogram is positive. Triggers Short while it is negative.";
    }
    return "Triggers Long when the histogram crosses above zero. Triggers Short when it crosses below zero.";
  }
  if (kind === "ema_cross") {
    if (compare === "pair") {
      return "Triggers Long when EMA 9 crosses above EMA 21. Triggers Short when EMA 9 crosses below EMA 21.";
    }
    return "Triggers Long when EMA 21 crosses above the price level. Triggers Short when EMA 21 crosses below the price level.";
  }
  if (compare === "lte" || compare === "gte") {
    return "Triggers Long while RSI is at or below the level. Triggers Short while RSI is at or above the level.";
  }
  return "Triggers Long when RSI crosses below the level. Triggers Short when RSI crosses above the level.";
}

const bothDetailsRows: {
  id: string;
  setting: string;
  long: string;
  short: string;
}[] = [
  {
    id: "macd-cross",
    setting: "MACD · Crosses zero",
    long: "Histogram crosses above 0",
    short: "Histogram crosses below 0",
  },
  {
    id: "macd-sign",
    setting: "MACD · Histogram sign",
    long: "Histogram is positive",
    short: "Histogram is negative",
  },
  {
    id: "ema-pair",
    setting: "EMA · 9/21 cross",
    long: "EMA 9 crosses above EMA 21",
    short: "EMA 9 crosses below EMA 21",
  },
  {
    id: "ema-price",
    setting: "EMA · 21 crosses",
    long: "EMA 21 crosses above the price",
    short: "EMA 21 crosses below the price",
  },
  {
    id: "rsi-cross",
    setting: "RSI · Crosses the level",
    long: "RSI crosses below the level",
    short: "RSI crosses above the level",
  },
  {
    id: "rsi-at",
    setting: "RSI · At the level",
    long: "RSI is at or below the level",
    short: "RSI is at or above the level",
  },
];

function indicatorBothDetailsRowId(
  kind: "rsi" | "macd" | "ema_cross",
  compare: string,
): string {
  if (kind === "macd") {
    return compare === "gte" ? "macd-sign" : "macd-cross";
  }
  if (kind === "ema_cross") {
    return compare === "pair" ? "ema-pair" : "ema-price";
  }
  return compare === "lte" || compare === "gte" ? "rsi-at" : "rsi-cross";
}

function IndicatorBothDetails({
  kind,
  compare,
}: {
  kind: "rsi" | "macd" | "ema_cross";
  compare: string;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const currentId = indicatorBothDetailsRowId(kind, compare);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="text-accent hover:text-accent-strong"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          setBox(
            next
              ? (buttonRef.current?.getBoundingClientRect() ?? null)
              : null,
          );
        }}
      >
        Show more details
      </button>
      {open && box && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="When Direction is Both"
              className="fixed z-50 w-[min(36rem,calc(100vw-1.5rem))] overflow-hidden rounded-card border border-line bg-surface-raised text-xs text-ink shadow-none"
              style={{
                top: box.bottom + 8,
                left: Math.max(
                  12,
                  Math.min(box.left, window.innerWidth - 36 * 16 - 12),
                ),
              }}
            >
              <p className="border-b border-line py-2 pr-9 pl-3 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                When Direction is Both
              </p>
              <PanelCloseButton
                onClick={() => {
                  setOpen(false);
                  setBox(null);
                }}
              />
              <table className="w-full text-left">
                <thead className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                  <tr className="border-b border-line">
                    <th className="px-3 py-2 font-medium">Setting</th>
                    <th className="px-3 py-2 font-medium text-success">Long</th>
                    <th className="px-3 py-2 font-medium text-danger">Short</th>
                  </tr>
                </thead>
                <tbody>
                  {bothDetailsRows.map((row) => {
                    const current = row.id === currentId;
                    return (
                      <tr
                        key={row.id}
                        className={
                          current
                            ? "bg-accent/10 text-ink"
                            : "text-ink-muted"
                        }
                      >
                        <td className="px-3 py-2 font-medium text-ink">
                          {row.setting}
                        </td>
                        <td className="px-3 py-2 text-ink">{row.long}</td>
                        <td className="px-3 py-2 text-ink">{row.short}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>,
            document.body,
          )
        : null}
    </>
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
