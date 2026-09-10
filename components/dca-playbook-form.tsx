"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AdditionalActions,
  BotField,
  BotFormGroup,
  BotStatusField,
  DirtySaveBanner,
  HintLabel,
  OptionalSection,
  OrderTypePill,
  botFieldClass,
  botHeaderPrimaryClass,
  botHeaderRemoveClass,
  botLabelClass,
  botRowClass,
  botRowClass5,
  botSectionTitleClass,
  deskActionBtnClass,
  deskActionSelectClass,
  triggerSectionTitle,
} from "@/components/bot-form-chrome";
import { ColumnHint } from "@/components/column-hint";
import { FuturesDeskRefresh } from "@/components/futures-desk-refresh";
import {
  IndicatorStartFields,
  TrendStartFields,
} from "@/components/bot-indicator-fields";
import { DcaFilterBlock } from "@/components/dca-filter-fields";
import { FuturesSymbolSelect } from "@/components/futures-symbol-select";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { useConfirmDialog } from "@/components/confirm-modal";
import {
  DeskFormFlash,
  StayOnPageForm,
} from "@/components/stay-on-page-form";
import { ChevronIcon, TabButton } from "@/components/trade-expand";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  dcaStatusFromLegs,
  disableConfirmMessage,
  disableConfirmTitle,
  disableNeedsConfirm,
  type DcaBotStatus,
} from "@/lib/bots/status";
import {
  deleteDcaPlaybookAction,
  runDcaArmAction,
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
  dcaAtrDistanceLabel,
  dcaCoveredRangePct,
  dcaMaxDropCoveredPct,
  dcaRequiredUsdt,
  DEFAULT_DCA_ATR_PERIOD,
  DEFAULT_DCA_ATR_SPACING_MULT,
  DEFAULT_DCA_TAKE_PROFIT_ATR_MULT,
  parseDcaAtrPeriod,
  parseDcaSpacingKind,
  parseDcaTakeProfitKind,
  type DcaLadderLevel,
  type DcaSpacingKind,
  type DcaTakeProfitKind,
} from "@/lib/dca/grid";
import {
  DEFAULT_DCA_NAME,
  dcaAveragingKind,
  dcaCloneIdleDraft,
  dcaConfigMaxOrderError,
  dcaEnabledSides,
  dcaIntervalParts,
  dcaLegFor,
  dcaCycleFieldsLocked,
  dcaPlaybookHasOpenCycle,
  dcaPlaybookHoldsCycle,
  dcaPlaybookIsRunning,
  dcaAtrTimeframe,
  parseDcaExitBasis,
  parseDcaMaxValueKind,
  parseDcaPlaybookForm,
  dcaMaxValueUsesBook,
  dcaResolvedMaxValueUsdt,
  type DcaAveragingKind,
  type DcaCycleOpen,
  type DcaExitBasis,
  type DcaIntervalUnit,
  type DcaMaxValueKind,
  type DcaPlaybook,
  type DcaStartKind,
} from "@/lib/dca/playbook";
import {
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DCA_INDICATOR_TIMEFRAME_LABELS,
  defaultDcaIndicatorLevel,
  defaultDcaIndicatorPeriod,
  defaultDcaIndicatorSlowPeriod,
  indicatorCompareForDirection,
  lastAtrValue,
  parseDcaIndicatorTimeframe,
  oppositeIndicatorCompare,
  oppositeRsiCompare,
  oppositeRsiLevel,
  type DcaIndicatorKind,
} from "@/lib/dca/indicators";
import {
  dcaFilterComplete,
  dcaFilterSpecForKind,
  type DcaFilterSpec,
} from "@/lib/dca/filters";
import { closedLiveIndicatorBars } from "@/lib/market/desk-klines";
import type { CandleBar } from "@/lib/market/candles";
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
  dcaFormMatchesPlaybook,
  dcaFormToSnapshotSource,
  readFormControl,
  snapshotDcaRecipe,
} from "@/lib/templates/recipe";
import type { AutomationTemplateSet, TemplateSummary } from "@/lib/templates/store";
import {
  BYBIT_DCA_UI,
  type DcaPlaybookUiPolicy,
} from "@/lib/dca/ui-policy";

const fieldClass = botFieldClass;
const labelClass = botLabelClass;
const sectionTitleClass = botSectionTitleClass;
const rowClass = botRowClass;
const headerPrimaryClass = botHeaderPrimaryClass;
const headerRemoveClass = botHeaderRemoveClass;

function optional(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

function initialIndicatorCompare(
  kind: DcaIndicatorKind,
  stored: string | null | undefined,
  side: "long" | "short",
): string {
  if (kind === "rsi") {
    return stored ?? (side === "short" ? "cross_gte" : "cross_lte");
  }
  if (kind === "macd") {
    return indicatorCompareForDirection(side, kind, stored ?? "");
  }
  if (
    kind === "ema" ||
    kind === "sma" ||
    kind === "ema_cross" ||
    kind === "sma_cross" ||
    kind === "bb"
  ) {
    return indicatorCompareForDirection(side, kind, stored ?? "");
  }
  if (stored === "cross_gte" || stored === "cross_lte") {
    return stored;
  }
  return indicatorCompareForDirection(side, kind, stored ?? "");
}

function seedOppositeRsiLevel(level: string): string {
  const n = Number(level);
  return String(oppositeRsiLevel(Number.isFinite(n) && n > 0 ? n : null));
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
  if (!locked) {
    return children;
  }
  return (
    <span inert className="pointer-events-none opacity-40" aria-disabled>
      {children}
    </span>
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
      {message} Save is blocked.
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
  spacingHint: string | null;
  tpHint: string | null;
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
  spacingKind: DcaSpacingKind;
  atr: number | null;
  atrSpacingMult: string;
  maxClips: string;
  maxValue: string;
  takeProfitPct: string;
  takeProfitKind: DcaTakeProfitKind;
  takeProfitAtrMult: string;
  takeProfitBasis: DcaExitBasis;
  stopLossPct: string;
  stopLossBasis: DcaExitBasis;
  leverage: number | null;
}): DcaSummaryPreview {
  const orderCap = asNumber(input.maxClips);
  const valueCap = asNumber(input.maxValue);
  const dip =
    input.averaging === "dip" && input.spacingKind !== "atr"
      ? asNumber(input.dipPct)
      : null;
  const spacingKind =
    input.averaging === "dip" ? input.spacingKind : "percent";
  const atr = input.atr != null && input.atr > 0 ? input.atr : null;
  const atrSpacingMult = asNumber(input.atrSpacingMult);
  const tpKind = input.takeProfitKind;
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
            spacingKind,
            atr,
            atrSpacingMult,
          })
        : null;
  const tpPct = tpKind === "atr" ? null : asNumber(input.takeProfitPct);
  const tpAtrMult = tpKind === "atr" ? asNumber(input.takeProfitAtrMult) : null;
  const spacingHint =
    spacingKind === "atr"
      ? dcaAtrDistanceLabel({
          atr,
          multiple: atrSpacingMult,
          lastPrice: input.lastPrice,
        })
      : null;
  const tpHint =
    tpKind === "atr"
      ? dcaAtrDistanceLabel({
          atr,
          multiple: tpAtrMult,
          lastPrice: input.lastPrice,
        })
      : null;
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
    spacingKind,
    atr,
    atrSpacingMult,
    takeProfitPct: tpPct,
    takeProfitKind: tpKind,
    takeProfitAtrMult: tpAtrMult,
    takeProfitBasis: input.takeProfitBasis,
    stopLossPct: slPct,
    stopLossBasis: input.stopLossBasis,
  });
  const lastLevel = levels[levels.length - 1];
  const covered =
    spacingKind === "atr"
      ? levels.length >= 2 && lastLevel
        ? dcaCoveredRangePct(input.side, levels[0]!.price, lastLevel.price)
        : null
      : dcaMaxDropCoveredPct({
          side: input.side,
          maxClips: clips,
          dipPct: dip,
          deviationMultiplier: devMult,
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
    profitFromTp: tpPct !== null || tpAtrMult !== null,
    lossFromSl: slPct !== null,
    spacingHint,
    tpHint,
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
  openPositions = [],
  urgentRefresh = false,
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
  openPositions?: DcaCycleOpen[];
  urgentRefresh?: boolean;
}) {
  const router = useRouter();
  const [extraLibrary, setExtraLibrary] = useState<BacktestLibraryItem[]>([]);
  const library = [...backtestLibrary, ...extraLibrary];
  const [cards, setCards] = useState<
    { key: string; playbook: DcaPlaybook | null; seed?: DcaPlaybook }[]
  >(() =>
    [...playbooks]
      .reverse()
      .map((playbook) => ({ key: playbook.id, playbook })),
  );
  const [cloneMenu, setCloneMenu] = useState(0);
  const empty = cards.length === 0;
  const cloneSources = cards
    .map((card) => card.playbook)
    .filter((playbook): playbook is DcaPlaybook => Boolean(playbook));
  const addPlaybookClass = deskActionBtnClass;

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
        ...fresh.map((playbook) => ({ key: playbook.id, playbook })),
        ...current,
      ];
    });
  }

  return (
    <div className="space-y-3">
      <FuturesDeskRefresh urgent={urgentRefresh} />
      {reduceOnly ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Reduce only is on. New orders stay blocked until you turn it off in
          Desk Settings. Take profit and stop still run.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setCards((current) => [
              { key: `new-${current.length}-${Date.now()}`, playbook: null },
              ...current,
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
                {
                  key: `clone-${source.id}-${Date.now()}`,
                  playbook: null,
                  seed,
                },
                ...current,
              ]);
              setCloneMenu((n) => n + 1);
            }}
            className={deskActionSelectClass}
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
            openPositions={openPositions}
            onTemplateSaved={(item) =>
              setExtraLibrary((current) => [
                ...current.filter((row) => row.id !== item.id),
                item,
              ])
            }
            defaultName={
              card.playbook?.name ??
              card.seed?.name ??
              (cards.length === 1 ? DEFAULT_DCA_NAME : `DCA ${cards.length - index}`)
            }
            onResult={(result) => {
              const next = result as DcaDeskActionResult;
              if (next.deletedId) {
                setCards((current) =>
                  current.filter((item) => item.key !== card.key),
                );
                router.refresh();
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
              if (next.ok) {
                router.refresh();
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
  openPositions = [],
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
  openPositions?: DcaCycleOpen[];
  onTemplateSaved?: (item: BacktestLibraryItem) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const { confirm: askConfirm, dialog } = useConfirmDialog();
  const source = playbook ?? seed;
  const [direction, setDirection] = useState(
    source?.direction === "both" && !policy.includeBoth
      ? "long"
      : (source?.direction ?? "long"),
  );
  const [startKind, setStartKind] = useState<DcaStartKind>(
    source?.startKind && source.startKind !== "immediate"
      ? source.startKind
      : "indicator",
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
    maxValueMode === "none" ? "usdt" : maxValueMode;
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
  const [spacingKind, setSpacingKind] = useState<DcaSpacingKind>(
    source?.spacingKind ?? "percent",
  );
  const [atrPeriod, setAtrPeriod] = useState(
    optional(source?.atrPeriod) || String(DEFAULT_DCA_ATR_PERIOD),
  );
  const [atrSpacingMult, setAtrSpacingMult] = useState(
    optional(source?.atrSpacingMult) || String(DEFAULT_DCA_ATR_SPACING_MULT),
  );
  const [takeProfitKind, setTakeProfitKind] = useState<DcaTakeProfitKind>(
    source?.takeProfitKind ?? "percent",
  );
  const [takeProfitAtrMult, setTakeProfitAtrMult] = useState(
    optional(source?.takeProfitAtrMult) ||
      String(DEFAULT_DCA_TAKE_PROFIT_ATR_MULT),
  );
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
  const [tpOn, setTpOn] = useState(() =>
    source?.takeProfitKind === "atr"
      ? source.takeProfitAtrMult != null
      : source?.takeProfitPct != null,
  );
  const [trailingTriggerPct, setTrailingTriggerPct] = useState(
    optional(source?.trailingTriggerPct),
  );
  const [trailingPct, setTrailingPct] = useState(optional(source?.trailingPct));
  const [trailOn, setTrailOn] = useState(
    () => source?.trailingPct != null || source?.trailingTriggerPct != null,
  );
  const [breakevenActivationPct, setBreakevenActivationPct] = useState(
    optional(source?.breakevenActivationPct),
  );
  const [breakevenOffsetPct, setBreakevenOffsetPct] = useState(
    optional(source?.breakevenOffsetPct),
  );
  const [breakevenOn, setBreakevenOn] = useState(
    () => source?.breakevenActivationPct != null,
  );
  const [slOn, setSlOn] = useState(() => source?.stopLossPct != null);
  const [indicatorKind, setIndicatorKind] = useState<DcaIndicatorKind>(
    source?.indicatorKind ??
      (source?.startKind === "trend" ? "supertrend" : "rsi"),
  );
  const [indicatorTimeframe, setIndicatorTimeframe] = useState(
    source?.indicatorTimeframe ?? "15",
  );
  const [indicatorLevel, setIndicatorLevel] = useState(
    optional(source?.indicatorLevel) ||
      String(defaultDcaIndicatorLevel(source?.indicatorKind ?? "rsi") ?? ""),
  );
  const [indicatorPeriod, setIndicatorPeriod] = useState(
    optional(source?.indicatorPeriod) ||
      String(
        defaultDcaIndicatorPeriod(
          source?.indicatorKind ??
            (source?.startKind === "trend" ? "supertrend" : "rsi"),
        ),
      ),
  );
  const [indicatorSlowPeriod, setIndicatorSlowPeriod] = useState(
    optional(source?.indicatorSlowPeriod) ||
      String(
        defaultDcaIndicatorSlowPeriod(source?.indicatorKind ?? "rsi") ?? "",
      ),
  );
  const [indicatorMultiplier, setIndicatorMultiplier] = useState(
    optional(source?.indicatorMultiplier) ||
      String(DEFAULT_DCA_SUPERTREND_MULTIPLIER),
  );
  const [indicatorCompare, setIndicatorCompare] = useState(() =>
    initialIndicatorCompare(
      source?.indicatorKind ?? "rsi",
      source?.indicatorCompare,
      "long",
    ),
  );
  const [shortIndicatorKind, setShortIndicatorKind] = useState<DcaIndicatorKind>(
    source?.shortIndicatorKind ?? source?.indicatorKind ?? "rsi",
  );
  const [shortIndicatorTimeframe, setShortIndicatorTimeframe] = useState(
    source?.shortIndicatorTimeframe ?? source?.indicatorTimeframe ?? "15",
  );
  const [shortIndicatorLevel, setShortIndicatorLevel] = useState(() => {
    if (source?.shortIndicatorLevel != null) {
      return optional(source.shortIndicatorLevel);
    }
    const kind = source?.shortIndicatorKind ?? source?.indicatorKind ?? "rsi";
    if (kind !== "rsi") {
      return (
        optional(source?.indicatorLevel) ||
        String(defaultDcaIndicatorLevel(kind) ?? "")
      );
    }
    return source?.indicatorLevel != null
      ? String(oppositeRsiLevel(source.indicatorLevel))
      : "70";
  });
  const [shortIndicatorPeriod, setShortIndicatorPeriod] = useState(
    optional(source?.shortIndicatorPeriod) ||
      optional(source?.indicatorPeriod) ||
      String(
        defaultDcaIndicatorPeriod(
          source?.shortIndicatorKind ?? source?.indicatorKind ?? "rsi",
        ),
      ),
  );
  const [shortIndicatorSlowPeriod, setShortIndicatorSlowPeriod] = useState(
    optional(source?.shortIndicatorSlowPeriod) ||
      optional(source?.indicatorSlowPeriod) ||
      String(
        defaultDcaIndicatorSlowPeriod(
          source?.shortIndicatorKind ?? source?.indicatorKind ?? "rsi",
        ) ?? "",
      ),
  );
  const [shortIndicatorMultiplier, setShortIndicatorMultiplier] = useState(
    optional(source?.shortIndicatorMultiplier) ||
      optional(source?.indicatorMultiplier) ||
      String(DEFAULT_DCA_SUPERTREND_MULTIPLIER),
  );
  const [shortIndicatorCompare, setShortIndicatorCompare] = useState(() =>
    initialIndicatorCompare(
      source?.shortIndicatorKind ?? source?.indicatorKind ?? "rsi",
      source?.shortIndicatorCompare ??
        (source?.shortIndicatorKind
          ? source.shortIndicatorCompare
          : source?.indicatorKind === "rsi" || !source?.indicatorKind
            ? oppositeRsiCompare(source?.indicatorCompare ?? "cross_lte")
            : source?.indicatorCompare),
      "short",
    ),
  );
  const [confirm, setConfirm] = useState<DcaFilterSpec | null>(
    source?.confirm ?? null,
  );
  const [shortConfirm, setShortConfirm] = useState<DcaFilterSpec | null>(
    source?.shortConfirm ?? null,
  );
  const [exitIf, setExitIf] = useState<DcaFilterSpec | null>(
    source?.exitIf ?? null,
  );
  const [shortExitIf, setShortExitIf] = useState<DcaFilterSpec | null>(
    source?.shortExitIf ?? null,
  );
  const defaultSymbol =
    source?.symbol ??
    options.find((row) => row.symbol === policy.defaultSymbol)?.symbol ??
    options[0]?.symbol ??
    policy.defaultSymbol;
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [formTick, setFormTick] = useState(0);
  useEffect(() => {
    setFormTick(1);
  }, []);
  const [ladderTab, setLadderTab] = useState<"long" | "short">("long");
  const [ladderOpen, setLadderOpen] = useState(false);
  const ladderPanelId = useId();
  const lastPrice = lastPrices[symbol] ?? null;
  const running = Boolean(playbook && dcaPlaybookIsRunning(playbook));
  const liveLegs = playbook
    ? dcaEnabledSides(playbook.direction).map((side) =>
        dcaLegFor(playbook, side),
      )
    : [];
  const hasOpenPosition = Boolean(
    playbook?.id && dcaPlaybookHasOpenCycle(playbook, openPositions),
  );
  const armed = liveLegs.some(
    (leg) => leg.status === "armed" || leg.status === "closing",
  );
  const stopAdding = liveLegs.some((leg) => leg.status === "stop_adding");
  const currentStatus: DcaBotStatus = playbook
    ? dcaStatusFromLegs({ armed, stopAdding })
    : "disabled";
  const [status, setStatus] = useState<DcaBotStatus>(currentStatus);
  const statusDirty = status !== currentStatus;
  const cycleLocked = dcaCycleFieldsLocked({
    hasOpenCycle: hasOpenPosition,
    holdsCycle: Boolean(playbook && dcaPlaybookHoldsCycle(playbook)),
  });
  const selectedPair = options.find((row) => row.symbol === symbol);
  const resolvedMaxValue = dcaResolvedMaxValueUsdt({
    kind: maxValueKind,
    maxValue: asNumber(maxValue),
    bookUsdt: accountBookUsdt,
    leverage,
  });
  const valueCapUsdt =
    maxValueMode === "none"
      ? null
      : dcaMaxValueUsesBook(maxValueKind)
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
    maxQty: selectedPair?.maxQty ?? 0,
    minNotional: selectedPair?.minNotional ?? 0,
    lastPrice,
    baseCoin: selectedPair?.baseCoin ?? "Token",
  });
  const sizeCheckReady =
    !dcaMaxValueUsesBook(maxValueKind) || maxValue === maxValueSettled;
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
    minQty: selectedPair?.minQty ?? 0,
    minNotional: selectedPair?.minNotional ?? 0,
    minPrice: selectedPair?.minPrice,
    tickSize: selectedPair?.tickSize,
    baseCoin: selectedPair?.baseCoin ?? "Token",
    bookUsdt: accountBookUsdt,
    leverage,
    availableUsdt: accountBookUsdt,
  });
  const ladderMaxError = sizeCheckReady ? ladderMaxErrorLive : null;
  const maxValueOverCap =
    dcaMaxValueUsesBook(maxValueKind) &&
    asNumber(maxValue) != null &&
    (asNumber(maxValue) as number) > 100
      ? "Percent must be 100 or less."
      : null;
  const saveError =
    maxValueOverCap ??
    (asNumber(clipForSave) === null ? null : (sizeError ?? ladderMaxError));
  const saveBlocked = cycleLocked ? null : saveError;
  const restGridEffective = averaging !== "interval" && restGrid;
  const needsAtr =
    (averaging === "dip" && spacingKind === "atr") ||
    takeProfitKind === "atr";
  const atrPeriodNum = parseDcaAtrPeriod(atrPeriod) ?? DEFAULT_DCA_ATR_PERIOD;
  const atrTimeframe = dcaAtrTimeframe({
    indicatorTimeframe: parseDcaIndicatorTimeframe(indicatorTimeframe),
    shortIndicatorTimeframe: parseDcaIndicatorTimeframe(
      shortIndicatorTimeframe,
    ),
  });
  const [atrBars, setAtrBars] = useState<CandleBar[] | null>(null);
  const [atrFetch, setAtrFetch] = useState<"off" | "loading" | "ready" | "error">(
    "off",
  );
  useEffect(() => {
    if (!needsAtr || !symbol) {
      setAtrBars(null);
      setAtrFetch("off");
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({
      venue: policy.venueId,
      symbol,
      interval: atrTimeframe,
      limit: String(Math.min(500, Math.max(200, atrPeriodNum + 40))),
    });
    if (policy.venueId === "hyperliquid" && venueEnvironment) {
      params.set("env", venueEnvironment);
    }
    setAtrBars(null);
    setAtrFetch("loading");
    void fetch(`/api/market/candles?${params.toString()}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          candles?: CandleBar[];
          error?: string;
        };
        if (!cancelled && !response.ok) {
          throw new Error(body.error || "Could not read candles.");
        }
        return body.candles ?? [];
      })
      .then((rows) => {
        if (!cancelled) {
          setAtrBars(rows);
          setAtrFetch("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAtrBars(null);
          setAtrFetch("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    needsAtr,
    symbol,
    atrTimeframe,
    atrPeriodNum,
    policy.venueId,
    venueEnvironment,
  ]);
  const liveAtr = useMemo(() => {
    if (!needsAtr || atrBars == null) {
      return null;
    }
    return lastAtrValue(
      closedLiveIndicatorBars(atrBars, atrTimeframe),
      atrPeriodNum,
    );
  }, [needsAtr, atrBars, atrTimeframe, atrPeriodNum]);
  const summaryBySide = useMemo(() => {
    const input = {
      lastPrice,
      averaging,
      clipSize: clipForSave,
      sizeUnit: sizeUnitForClip,
      sizeMultiplier,
      deviationMultiplier,
      dipPct,
      spacingKind,
      atr: liveAtr,
      atrSpacingMult,
      maxClips,
      maxValue: valueCapUsdt == null ? "" : String(valueCapUsdt),
      takeProfitPct: tpOn ? takeProfitPct : "",
      takeProfitKind,
      takeProfitAtrMult: tpOn ? takeProfitAtrMult : "",
      takeProfitBasis,
      stopLossPct: slOn ? stopLossPct : "",
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
    spacingKind,
    liveAtr,
    atrSpacingMult,
    lastPrice,
    maxClips,
    maxValue,
    valueCapUsdt,
    sizeMultiplier,
    sizeUnit,
    sizeUnitForClip,
    slOn,
    stopLossBasis,
    stopLossPct,
    takeProfitBasis,
    takeProfitKind,
    takeProfitAtrMult,
    takeProfitPct,
    tpOn,
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
      spacingKind,
      atrPeriod,
      atrSpacingMult,
      takeProfitKind: tpOn ? takeProfitKind : "percent",
      takeProfitAtrMult: tpOn ? takeProfitAtrMult : "",
      takeProfitPct: tpOn ? takeProfitPct : "",
      takeProfitBasis,
      takeProfitOrderType,
      stopLossPct: slOn ? stopLossPct : "",
      stopLossBasis,
      trailingTriggerPct: trailOn ? trailingTriggerPct : "",
      trailingPct: trailOn ? trailingPct : "",
      breakevenActivationPct: breakevenOn ? breakevenActivationPct : "",
      breakevenOffsetPct: breakevenOn ? breakevenOffsetPct : "",
      indicatorKind,
      indicatorTimeframe,
      indicatorCompare,
      indicatorLevel,
      indicatorPeriod,
      indicatorSlowPeriod,
      indicatorMultiplier,
      shortIndicatorKind,
      shortIndicatorTimeframe,
      shortIndicatorCompare,
      shortIndicatorLevel,
      shortIndicatorPeriod,
      shortIndicatorSlowPeriod,
      shortIndicatorMultiplier,
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
  let parsedLive: ReturnType<typeof parseDcaPlaybookForm>;
  try {
    parsedLive = parseDcaPlaybookForm(snapshotForm(), policy.venueId);
  } catch {
    parsedLive = { ok: false, error: "Could not read the form." };
  }
  const liveConfig = parsedLive.ok ? parsedLive.config : null;
  const tpMissing =
    tpOn &&
    (takeProfitKind === "atr"
      ? asNumber(takeProfitAtrMult) == null
      : asNumber(takeProfitPct) == null);
  const trailMissing =
    trailOn &&
    (asNumber(trailingTriggerPct) == null || asNumber(trailingPct) == null);
  const slMissing = slOn && asNumber(stopLossPct) == null;
  const breakevenMissing =
    breakevenOn && asNumber(breakevenActivationPct) == null;
  const parseConstraint =
    !parsedLive.ok && parsedLive.error === "Percent must be 100 or less."
      ? parsedLive.error
      : null;
  const requiredMissing =
    Boolean(confirm && !dcaFilterComplete(confirm)) ||
    (direction === "both" &&
      Boolean(shortConfirm && !dcaFilterComplete(shortConfirm))) ||
    Boolean(exitIf && !dcaFilterComplete(exitIf)) ||
    (direction === "both" &&
      Boolean(shortExitIf && !dcaFilterComplete(shortExitIf))) ||
    tpMissing ||
    trailMissing ||
    slMissing ||
    breakevenMissing ||
    (!cycleLocked && !parsedLive.ok && !parseConstraint);
  const dirty =
    !playbook ||
    statusDirty ||
    requiredMissing ||
    (formTick > 0 && !dcaFormMatchesPlaybook(playbook, liveConfig));
  const constraintBlocked = cycleLocked
    ? null
    : (parseConstraint ?? saveBlocked);
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
    <>
    <StayOnPageForm
      id={playbook ? `bot-${playbook.id}` : undefined}
      ref={formRef}
      noValidate
      action={saveDcaPlaybookAction}
      actions={{
        "save-arm": saveAndArmDcaPlaybookAction,
        arm: runDcaArmAction,
        disarm: runDcaDisarmAction,
        close: runDcaClosePlaybookAction,
        delete: deleteDcaPlaybookAction,
      }}
      onResult={(result) => onResult?.(result as DcaDeskActionResult)}
      onChange={() => setFormTick((tick) => tick + 1)}
      guard={async (event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter as
          | HTMLElement
          | null;
        const skip = submitter?.dataset.skipSizeGuard === "1";
        if ((constraintBlocked || requiredMissing) && !skip) {
          return false;
        }
        if (status === "disabled" && disableNeedsConfirm(hasOpenPosition)) {
          return askConfirm({
            title: disableConfirmTitle(),
            message: disableConfirmMessage("dca"),
            confirmLabel: "Disable",
            danger: true,
          });
        }
        return true;
      }}
      className="flex flex-col scroll-mt-24 divide-y divide-line overflow-hidden rounded-card border border-line bg-canvas px-5"
    >
      <input type="hidden" name="playbookId" value={playbook?.id ?? ""} />
      <input type="hidden" name="deskVenue" value={policy.venueId} />
      <input type="hidden" name="botStatus" value={status} />
      <DirtySaveBanner
        dirty={dirty}
        error={
          requiredMissing
            ? "Fill required fields before saving."
            : constraintBlocked ?? undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <DeskFormFlash />
          <PendingSubmitButton
            pendingLabel="Saving…"
            deskAction="default"
            className={headerPrimaryClass}
            disabled={Boolean(constraintBlocked || requiredMissing)}
            title={
              constraintBlocked ??
              (requiredMissing
                ? "Fill required fields before saving."
                : undefined)
            }
          >
            Save
          </PendingSubmitButton>
        </div>
      </DirtySaveBanner>
      {reduceOnly ? (
        <p className="my-5 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Reduce only is on. New orders stay blocked until you turn it off in
          Desk Settings. Take profit and stop still run.
        </p>
      ) : null}
      <BotFormGroup title="Bot">
        <div className="grid items-start gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <BotField label="Name" required>
            <input
              name="name"
              defaultValue={source?.name ?? defaultName ?? DEFAULT_DCA_NAME}
              maxLength={40}
              onChange={() => setFormTick((tick) => tick + 1)}
              className={fieldClass}
            />
          </BotField>
          <BotStatusField
            desk="dca"
            name="botStatusControl"
            value={status}
            applied={currentStatus}
            onChange={(next) => {
              setStatus(next as DcaBotStatus);
              setFormTick((tick) => tick + 1);
            }}
            inUse={hasOpenPosition}
            accountReduceOnly={reduceOnly}
          />
        </div>
      </BotFormGroup>
      {cycleLocked ? (
        <p className="py-5 text-xs text-warning">
          {status === "disabled" && statusDirty
            ? "Save Disabled to close this position. Cycle settings stay locked until the close is accepted."
            : "A position is open. Cycle settings are locked. Take profit and stops still save."}
        </p>
      ) : hasOpenPosition && !running ? (
        <p className="py-5 text-xs text-warning">
          Closing this position. Cycle settings are unlocked for the next
          cycle.
        </p>
      ) : null}

      <BotFormGroup title="What & When" locked={cycleLocked}>
        <div className={rowClass}>
          <label className={labelClass}>
            <HintLabel text="Contract" required />
            <FuturesSymbolSelect
              options={options}
              defaultSymbol={defaultSymbol}
              value={symbol}
              onChange={setSymbol}
            />
          </label>
          <label className={labelClass}>
            <HintLabel
              text="Direction"
              hint="Long and Short are independent positions and never flatten each other."
              required
            />
            <select
              name="direction"
              value={direction}
              onChange={(event) => {
                const next = event.target.value as typeof direction;
                if (next === "both" && direction !== "both") {
                  if (direction === "short") {
                    setShortIndicatorKind(indicatorKind);
                    setShortIndicatorTimeframe(indicatorTimeframe);
                    setShortIndicatorCompare(indicatorCompare);
                    setShortIndicatorLevel(indicatorLevel);
                    setShortIndicatorPeriod(indicatorPeriod);
                    setShortIndicatorSlowPeriod(indicatorSlowPeriod);
                    setShortIndicatorMultiplier(indicatorMultiplier);
                    if (indicatorKind === "rsi") {
                      setIndicatorCompare(oppositeRsiCompare(indicatorCompare));
                      setIndicatorLevel(seedOppositeRsiLevel(indicatorLevel));
                    }
                  } else {
                    setShortIndicatorKind(indicatorKind);
                    setShortIndicatorTimeframe(indicatorTimeframe);
                    setShortIndicatorCompare(
                      oppositeIndicatorCompare(
                        indicatorKind,
                        indicatorCompare,
                      ),
                    );
                    setShortIndicatorLevel(
                      indicatorKind === "rsi"
                        ? seedOppositeRsiLevel(indicatorLevel)
                        : indicatorLevel,
                    );
                    setShortIndicatorPeriod(indicatorPeriod);
                    setShortIndicatorSlowPeriod(indicatorSlowPeriod);
                    setShortIndicatorMultiplier(indicatorMultiplier);
                  }
                } else if (direction === "both" && next === "short") {
                  setIndicatorKind(shortIndicatorKind);
                  setIndicatorTimeframe(shortIndicatorTimeframe);
                  setIndicatorCompare(shortIndicatorCompare);
                  setIndicatorLevel(shortIndicatorLevel);
                  setIndicatorPeriod(shortIndicatorPeriod);
                  setIndicatorSlowPeriod(shortIndicatorSlowPeriod);
                  setIndicatorMultiplier(shortIndicatorMultiplier);
                }
                setDirection(next);
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
          <label className={`${labelClass} lg:col-span-2`}>
            <HintLabel text="Initial Order Trigger" required />
            <select
              name="startKind"
              value={startKind}
              onChange={(event) => {
                const next = event.target.value as DcaStartKind;
                if (next === "trend") {
                  setIndicatorKind("supertrend");
                  setIndicatorPeriod(
                    String(defaultDcaIndicatorPeriod("supertrend")),
                  );
                  setIndicatorMultiplier(
                    String(DEFAULT_DCA_SUPERTREND_MULTIPLIER),
                  );
                  setIndicatorCompare(
                    indicatorCompareForDirection("long", "supertrend", ""),
                  );
                  setIndicatorLevel("");
                  setShortIndicatorKind("supertrend");
                  setShortIndicatorPeriod(
                    String(defaultDcaIndicatorPeriod("supertrend")),
                  );
                  setShortIndicatorMultiplier(
                    String(DEFAULT_DCA_SUPERTREND_MULTIPLIER),
                  );
                  setShortIndicatorCompare(
                    indicatorCompareForDirection("short", "supertrend", ""),
                  );
                  setShortIndicatorLevel("");
                } else if (startKind === "trend" && next === "indicator") {
                  setIndicatorKind("rsi");
                  setIndicatorPeriod(String(defaultDcaIndicatorPeriod("rsi")));
                  setIndicatorCompare(
                    indicatorCompareForDirection("long", "rsi", ""),
                  );
                  setIndicatorLevel("30");
                  setShortIndicatorKind("rsi");
                  setShortIndicatorPeriod(
                    String(defaultDcaIndicatorPeriod("rsi")),
                  );
                  setShortIndicatorCompare(
                    indicatorCompareForDirection("short", "rsi", ""),
                  );
                  setShortIndicatorLevel("70");
                }
                setStartKind(next);
              }}
              className={fieldClass}
            >
              <option value="indicator">Indicator</option>
              <option value="trend">Trend</option>
              <option value="price">Price Cross</option>
              <option value="webhook">Signal Webhook</option>
            </select>
          </label>
        </div>
      </BotFormGroup>

      <BotFormGroup title={triggerSectionTitle(startKind)} locked={cycleLocked}>
        <div className={rowClass}>
          {startKind === "price" && direction === "both" ? (
            <div className="space-y-4 sm:col-span-2 lg:col-span-4">
              <div className="space-y-2">
                <p className={sectionTitleClass}>Long</p>
                <div className={rowClass}>
                  <TriggerFields
                    prefix="arm"
                    triggerBy={source?.armTrigger?.triggerBy ?? "last"}
                    compare={source?.armTrigger?.compare ?? "gte"}
                    price={optional(source?.armTrigger?.price)}
                    quoteLabel={policy.quoteLabel}
                  />
                </div>
              </div>
              <div className="space-y-2 border-t border-line pt-3">
                <p className={sectionTitleClass}>Short</p>
                <div className={rowClass}>
                  <TriggerFields
                    prefix="shortArm"
                    triggerBy={
                      source?.shortArmTrigger?.triggerBy ??
                      source?.armTrigger?.triggerBy ??
                      "last"
                    }
                    compare={
                      source?.shortArmTrigger?.compare ??
                      ((source?.armTrigger?.compare ?? "gte") === "gte"
                        ? "lte"
                        : "gte")
                    }
                    price={optional(
                      source?.shortArmTrigger?.price ??
                        source?.armTrigger?.price,
                    )}
                    quoteLabel={policy.quoteLabel}
                  />
                </div>
              </div>
            </div>
          ) : null}
          {startKind === "price" && direction !== "both" ? (
            <>
              <TriggerFields
                prefix="arm"
                triggerBy={source?.armTrigger?.triggerBy ?? "last"}
                compare={source?.armTrigger?.compare ?? "gte"}
                price={optional(source?.armTrigger?.price)}
                quoteLabel={policy.quoteLabel}
              />
            </>
          ) : null}
          {startKind === "webhook" ? (
            signalWebhooks.length > 0 ? (
              <>
                <label className={`${labelClass} lg:col-span-2`}>
                  <HintLabel text="Signal Webhook" required />
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
              </>
            ) : (
              <p className="self-end text-xs text-ink-muted lg:col-span-3">
                Create a Signal on{" "}
                <Link href={webhooksHref} className="text-accent">
                  Webhooks
                </Link>{" "}
                first. Set Status to Active and Save, then buy / sell starts
                that side only.
              </p>
            )
          ) : null}
          {startKind === "indicator" && direction === "both" ? (
            <div className="space-y-4 sm:col-span-2 lg:col-span-4">
              <div className="space-y-2">
                <p className={sectionTitleClass}>Long</p>
                <div className={rowClass}>
                  <IndicatorStartFields
                    side="long"
                    prefix="indicator"
                    kind={indicatorKind}
                    timeframe={indicatorTimeframe}
                    compare={indicatorCompare}
                    level={indicatorLevel}
                    period={indicatorPeriod}
                    slowPeriod={indicatorSlowPeriod}
                    onKindChange={setIndicatorKind}
                    onTimeframeChange={setIndicatorTimeframe}
                    onCompareChange={setIndicatorCompare}
                    onLevelChange={setIndicatorLevel}
                    onPeriodChange={setIndicatorPeriod}
                    onSlowPeriodChange={setIndicatorSlowPeriod}
                  />
                </div>
              </div>
              <div className="space-y-2 border-t border-line pt-3">
                <p className={sectionTitleClass}>Short</p>
                <div className={rowClass}>
                  <IndicatorStartFields
                    side="short"
                    prefix="shortIndicator"
                    kind={shortIndicatorKind}
                    timeframe={shortIndicatorTimeframe}
                    compare={shortIndicatorCompare}
                    level={shortIndicatorLevel}
                    period={shortIndicatorPeriod}
                    slowPeriod={shortIndicatorSlowPeriod}
                    onKindChange={setShortIndicatorKind}
                    onTimeframeChange={setShortIndicatorTimeframe}
                    onCompareChange={setShortIndicatorCompare}
                    onLevelChange={setShortIndicatorLevel}
                    onPeriodChange={setShortIndicatorPeriod}
                    onSlowPeriodChange={setShortIndicatorSlowPeriod}
                  />
                </div>
              </div>
            </div>
          ) : null}
          {startKind === "indicator" && direction !== "both" ? (
            <>
              <IndicatorStartFields
                side={direction === "short" ? "short" : "long"}
                prefix="indicator"
                kind={indicatorKind}
                timeframe={indicatorTimeframe}
                compare={indicatorCompare}
                level={indicatorLevel}
                period={indicatorPeriod}
                slowPeriod={indicatorSlowPeriod}
                onKindChange={setIndicatorKind}
                onTimeframeChange={setIndicatorTimeframe}
                onCompareChange={setIndicatorCompare}
                onLevelChange={setIndicatorLevel}
                onPeriodChange={setIndicatorPeriod}
                onSlowPeriodChange={setIndicatorSlowPeriod}
              />
            </>
          ) : null}
          {startKind === "trend" && direction === "both" ? (
            <div className="space-y-4 sm:col-span-2 lg:col-span-4">
              <div className="space-y-2">
                <p className={sectionTitleClass}>Long</p>
                <div className={rowClass}>
                  <TrendStartFields
                    side="long"
                    prefix="indicator"
                    kind={indicatorKind}
                    timeframe={indicatorTimeframe}
                    compare={indicatorCompare}
                    period={indicatorPeriod}
                    multiplier={indicatorMultiplier}
                    onKindChange={setIndicatorKind}
                    onTimeframeChange={setIndicatorTimeframe}
                    onCompareChange={setIndicatorCompare}
                    onPeriodChange={setIndicatorPeriod}
                    onMultiplierChange={setIndicatorMultiplier}
                  />
                </div>
              </div>
              <div className="space-y-2 border-t border-line pt-3">
                <p className={sectionTitleClass}>Short</p>
                <div className={rowClass}>
                  <TrendStartFields
                    side="short"
                    prefix="shortIndicator"
                    kind={shortIndicatorKind}
                    timeframe={shortIndicatorTimeframe}
                    compare={shortIndicatorCompare}
                    period={shortIndicatorPeriod}
                    multiplier={shortIndicatorMultiplier}
                    onKindChange={setShortIndicatorKind}
                    onTimeframeChange={setShortIndicatorTimeframe}
                    onCompareChange={setShortIndicatorCompare}
                    onPeriodChange={setShortIndicatorPeriod}
                    onMultiplierChange={setShortIndicatorMultiplier}
                  />
                </div>
              </div>
            </div>
          ) : null}
          {startKind === "trend" && direction !== "both" ? (
            <>
              <TrendStartFields
                side={direction === "short" ? "short" : "long"}
                prefix="indicator"
                kind={indicatorKind}
                timeframe={indicatorTimeframe}
                compare={indicatorCompare}
                period={indicatorPeriod}
                multiplier={indicatorMultiplier}
                onKindChange={setIndicatorKind}
                onTimeframeChange={setIndicatorTimeframe}
                onCompareChange={setIndicatorCompare}
                onPeriodChange={setIndicatorPeriod}
                onMultiplierChange={setIndicatorMultiplier}
              />
            </>
          ) : null}
        </div>
      </BotFormGroup>

      {direction === "both" ? (
        <BotFormGroup
          title="Secondary Entry Condition"
          hint="Must be true for the entry trigger to execute."
          locked={cycleLocked}
        >
          <OptionalSection
            title="Long"
            nested
            enabled={Boolean(confirm)}
            onEnabled={(next) =>
              setConfirm(next ? (confirm ?? dcaFilterSpecForKind("rsi", "long")) : null)
            }
          >
            <DcaFilterBlock
              label="Kind"
              prefix="confirm"
              side="long"
              spec={confirm}
              onChange={setConfirm}
              named
              dense
              allowOff={false}
              gridClass={botRowClass5}
              whenClass=""
              fieldClass={fieldClass}
              labelClass={labelClass}
            />
          </OptionalSection>
          <OptionalSection
            title="Short"
            nested
            enabled={Boolean(shortConfirm)}
            onEnabled={(next) =>
              setShortConfirm(
                next
                  ? (shortConfirm ?? dcaFilterSpecForKind("rsi", "short"))
                  : null,
              )
            }
          >
            <DcaFilterBlock
              label="Kind"
              prefix="shortConfirm"
              side="short"
              spec={shortConfirm}
              onChange={setShortConfirm}
              named
              dense
              allowOff={false}
              gridClass={botRowClass5}
              whenClass=""
              fieldClass={fieldClass}
              labelClass={labelClass}
            />
          </OptionalSection>
        </BotFormGroup>
      ) : (
        <OptionalSection
          title="Secondary Entry Condition"
          hint="Must be true for the entry trigger to execute."
          locked={cycleLocked}
          enabled={Boolean(confirm)}
          onEnabled={(next) =>
            setConfirm(
              next
                ? (confirm ??
                  dcaFilterSpecForKind(
                    "rsi",
                    direction === "short" ? "short" : "long",
                  ))
                : null,
            )
          }
        >
          <DcaFilterBlock
            label="Kind"
            prefix="confirm"
            side={direction === "short" ? "short" : "long"}
            spec={confirm}
            onChange={setConfirm}
            named
            dense
            allowOff={false}
            gridClass={botRowClass5}
            whenClass=""
            fieldClass={fieldClass}
            labelClass={labelClass}
          />
        </OptionalSection>
      )}

      <BotFormGroup title="Maximum Exposure" locked={cycleLocked}>
          <div className={rowClass}>
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
                  if (
                    dcaMaxValueUsesBook(kind) &&
                    amount != null &&
                    amount > 100
                  ) {
                    setMaxValue("");
                  }
                }}
                className={fieldClass}
              >
                <option value="usdt">Fixed {policy.quoteLabel}</option>
                <option value="percent">% of account</option>
                <option value="margin">% of available margin</option>
                <option value="none">No max value</option>
              </select>
            </label>
            {maxValueMode !== "none" ? (
              <label className={`min-w-0 ${labelClass}`}>
                <HintLabel
                  text={
                    dcaMaxValueUsesBook(maxValueKind)
                      ? "Percent"
                      : policy.quoteLabel
                  }
                  required
                />
                <GroupedNumberInput
                  name="maxValue"
                  value={maxValue}
                  onChange={setMaxValue}
                  allowDecimal
                  className={fieldClass}
                  placeholder={
                    dcaMaxValueUsesBook(maxValueKind) ? "e.g. 20" : "e.g. 700"
                  }
                />
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
          {leverage != null && leverage > 0 ? (
            <input
              type="hidden"
              name="accountLeverage"
              value={String(leverage)}
            />
          ) : null}
        </BotFormGroup>
        <BotFormGroup title="Initial Order Size" locked={cycleLocked}>
          <div className={rowClass}>
            {budgetSizesClip ? (
              <input type="hidden" name="sizeUnit" value="usdt" />
            ) : (
              <label className={labelClass}>
                <HintLabel text="Size unit" required />
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
              <HintLabel
                text={
                  budgetSizesClip
                    ? `Order size (${policy.quoteLabel})`
                    : "Order size"
                }
                required
              />
              {derivedClip != null ? (
                <>
                  <input type="hidden" name="clipSize" value={clipForSave} />
                  <p
                    className={`${fieldClass} cursor-default text-ink-muted`}
                    aria-label="Calculated order size"
                  >
                    {clipForSave}
                  </p>
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
              ) : null}
            </label>
          </div>
        </BotFormGroup>

        <BotFormGroup
          title="Additional Order Types"
          hint="This method applies to every add after the first fill. The step next to Spacing is the first add; later adds use the same method."
          locked={cycleLocked}
        >
          <div className={botRowClass5}>
            <label className={`${labelClass} lg:col-span-2`}>
              <HintLabel text="Averaging" required />
              <select
                name="averaging"
                value={averaging}
                onChange={(event) =>
                  setAveraging(event.target.value as DcaAveragingKind)
                }
                className={fieldClass}
              >
                <option value="dip">Add on price deviation</option>
                <option value="interval">Add on interval</option>
              </select>
            </label>
            {averaging === "dip" ? (
              <label className={labelClass}>
                <HintLabel
                  text="Spacing"
                  hint="Percentage or ATR. Used for every add, not only the first."
                  required
                />
                <select
                  name="spacingKind"
                  value={spacingKind}
                  onChange={(event) =>
                    setSpacingKind(parseDcaSpacingKind(event.target.value))
                  }
                  className={fieldClass}
                >
                  <option value="percent">Percentage</option>
                  <option value="atr">ATR</option>
                </select>
              </label>
            ) : (
              <input type="hidden" name="spacingKind" value="percent" />
            )}
            {averaging === "dip" && spacingKind === "percent" ? (
              <label className={labelClass}>
                <HintLabel
                  text="Initial Price Deviation"
                  hint="Distance from the previous fill for the first add. Later adds use this times Price deviation multiplier."
                  required
                />
                <PercentInput
                  name="dipPct"
                  value={dipPct}
                  onChange={setDipPct}
                  ariaLabel="Price deviation percent"
                />
              </label>
            ) : null}
            {averaging === "dip" && spacingKind === "atr" ? (
              <>
                <label className={labelClass}>
                  <HintLabel text="ATR period" required />
                  <GroupedNumberInput
                    name="atrPeriod"
                    value={atrPeriod}
                    onChange={setAtrPeriod}
                    className={fieldClass}
                    ariaLabel="ATR period"
                  />
                </label>
                <label className={labelClass}>
                  <HintLabel
                    text="ATR spacing"
                    hint="First-add distance in ATR multiples. Later adds use this times Price deviation multiplier."
                    required
                  />
                  <GroupedNumberInput
                    name="atrSpacingMult"
                    value={atrSpacingMult}
                    onChange={setAtrSpacingMult}
                    allowDecimal
                    className={fieldClass}
                    ariaLabel="ATR spacing multiple"
                  />
                </label>
              </>
            ) : null}
            {averaging === "interval" ? (
              <div>
                <p className={labelClass}>
                  <HintLabel text="Add every" required />
                </p>
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
              <BotField
                label="Order"
                hint="Limit rests remaining adds as GTC. Market fills them when the add triggers."
                required
              >
                {restGrid ? (
                  <input type="hidden" name="restGrid" value="1" />
                ) : null}
                <OrderTypePill
                  value={restGrid ? "limit" : "market"}
                  onChange={(next) => setRestGrid(next === "limit")}
                />
              </BotField>
            ) : null}
          </div>
        </BotFormGroup>
        <BotFormGroup
          title="Additional Order Scaling"
          hint="How size and distance grow after the first add. 1 keeps later adds the same as the first add."
          locked={cycleLocked}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-2">
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
            <label className={`${labelClass} min-w-40 flex-1`}>
              <HintLabel
                text="Order size multiplier"
                hint="1 keeps every clip the same size. 1.5 means each later clip is 1.5× the last."
                required
              />
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
            <label className={`${labelClass} min-w-40 flex-1`}>
              <HintLabel
                text="Price deviation multiplier"
                hint="1 keeps every add the same distance. Above 1 widens each later step. Does not replace Initial Price Deviation or ATR spacing."
                required
              />
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
        </BotFormGroup>

      {!tpOn ? (
        <div hidden>
          <input type="hidden" name="takeProfitKind" value="percent" />
          <input type="hidden" name="takeProfitPct" value="" />
          <input type="hidden" name="takeProfitAtrMult" value="" />
          <input type="hidden" name="takeProfitBasis" value={takeProfitBasis} />
          <input type="hidden" name="takeProfitOrderType" value="market" />
        </div>
      ) : null}
      <OptionalSection
        title="Take profit"
        enabled={tpOn}
        onEnabled={(next) => {
          setTpOn(next);
          if (next && takeProfitKind === "percent" && !takeProfitPct) {
            setTakeProfitKind("percent");
          }
        }}
      >
          <div className={rowClass}>
          <label className={labelClass}>
            <HintLabel text="Basis" required />
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
          <label className={labelClass}>
            <HintLabel text="Method" required />
            <select
              name="takeProfitKind"
              value={takeProfitKind}
              onChange={(event) =>
                setTakeProfitKind(parseDcaTakeProfitKind(event.target.value))
              }
              className={fieldClass}
            >
              <option value="percent">Percentage</option>
              <option value="atr">ATR × multiplier</option>
            </select>
          </label>
          {takeProfitKind === "percent" ? (
          <BotField label="Target %" required>
            <PercentInput
              name="takeProfitPct"
              value={takeProfitPct}
              onChange={setTakeProfitPct}
              ariaLabel="Take profit target percent"
            />
          </BotField>
          ) : (
          <>
            <CycleLock
              locked={
                cycleLocked && averaging === "dip" && spacingKind === "atr"
              }
            >
              <label className={labelClass}>
                <HintLabel text="ATR period" required />
                <GroupedNumberInput
                  name={
                    averaging === "dip" && spacingKind === "atr"
                      ? undefined
                      : "atrPeriod"
                  }
                  value={atrPeriod}
                  onChange={setAtrPeriod}
                  className={fieldClass}
                  ariaLabel="ATR period"
                />
              </label>
            </CycleLock>
            <label className={labelClass}>
              <HintLabel text="ATR multiple" required />
              <GroupedNumberInput
                name="takeProfitAtrMult"
                value={takeProfitAtrMult}
                onChange={setTakeProfitAtrMult}
                allowDecimal
                className={fieldClass}
                ariaLabel="Take profit ATR multiple"
              />
            </label>
          </>
          )}
          <BotField label="Order type" required>
            <OrderTypePill
              name="takeProfitOrderType"
              value={takeProfitOrderType === "limit" ? "limit" : "market"}
              onChange={setTakeProfitOrderType}
            />
          </BotField>
        </div>
      </OptionalSection>

      {!trailOn ? (
        <div hidden>
          <input type="hidden" name="trailingTriggerPct" value="" />
          <input type="hidden" name="trailingPct" value="" />
        </div>
      ) : null}
      <OptionalSection
        title="Trailing stop"
        enabled={trailOn}
        onEnabled={setTrailOn}
      >
        <div className={rowClass}>
          <BotField
            label="Trigger %"
            hint="Trail starts after price moves this %."
            required
          >
            <PercentInput
              name="trailingTriggerPct"
              value={trailingTriggerPct}
              onChange={setTrailingTriggerPct}
              ariaLabel="Trailing trigger percent"
            />
          </BotField>
          <BotField label="Trailing %" required>
            <PercentInput
              name="trailingPct"
              value={trailingPct}
              onChange={setTrailingPct}
              ariaLabel="Trailing percent"
            />
          </BotField>
        </div>
      </OptionalSection>

      {!slOn ? (
        <div hidden>
          <input type="hidden" name="stopLossPct" value="" />
          <input type="hidden" name="stopLossBasis" value={stopLossBasis} />
        </div>
      ) : null}
      <OptionalSection
        title="Stop loss"
        enabled={slOn}
        onEnabled={setSlOn}
      >
        <div className={rowClass}>
          <label className={labelClass}>
            <HintLabel text="Basis" required />
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
          <BotField label="Stop loss %" required>
            <PercentInput
              name="stopLossPct"
              value={stopLossPct}
              onChange={setStopLossPct}
              ariaLabel="Stop loss percent"
            />
          </BotField>
        </div>
      </OptionalSection>

      {!breakevenOn ? (
        <div hidden>
          <input type="hidden" name="breakevenActivationPct" value="" />
          <input type="hidden" name="breakevenOffsetPct" value="" />
        </div>
      ) : null}
      <OptionalSection
        title="Move Breakeven"
        enabled={breakevenOn}
        onEnabled={setBreakevenOn}
      >
        <div className={rowClass}>
          <BotField label="Move stop to breakeven at %" required>
            <PercentInput
              name="breakevenActivationPct"
              value={breakevenActivationPct}
              onChange={setBreakevenActivationPct}
              ariaLabel="Move stop to breakeven at percent"
            />
          </BotField>
          <label className={labelClass}>
            Breakeven offset %
            <PercentInput
              name="breakevenOffsetPct"
              value={breakevenOffsetPct}
              onChange={setBreakevenOffsetPct}
              placeholder="0"
              ariaLabel="Breakeven offset percent"
            />
          </label>
        </div>
      </OptionalSection>

      {direction === "both" ? (
        <BotFormGroup title="Hard Exit Condition">
          <OptionalSection
            title="Long"
            nested
            enabled={Boolean(exitIf)}
            onEnabled={(next) =>
              setExitIf(next ? (exitIf ?? dcaFilterSpecForKind("rsi", "long")) : null)
            }
          >
            <DcaFilterBlock
              label="Kind"
              prefix="exitIf"
              side="long"
              spec={exitIf}
              onChange={setExitIf}
              named
              dense
              allowOff={false}
              gridClass={botRowClass5}
              whenClass=""
              fieldClass={fieldClass}
              labelClass={labelClass}
            />
          </OptionalSection>
          <OptionalSection
            title="Short"
            nested
            enabled={Boolean(shortExitIf)}
            onEnabled={(next) =>
              setShortExitIf(
                next
                  ? (shortExitIf ?? dcaFilterSpecForKind("rsi", "short"))
                  : null,
              )
            }
          >
            <DcaFilterBlock
              label="Kind"
              prefix="shortExitIf"
              side="short"
              spec={shortExitIf}
              onChange={setShortExitIf}
              named
              dense
              allowOff={false}
              gridClass={botRowClass5}
              whenClass=""
              fieldClass={fieldClass}
              labelClass={labelClass}
            />
          </OptionalSection>
        </BotFormGroup>
      ) : (
        <OptionalSection
          title="Hard Exit Condition"
          enabled={Boolean(exitIf)}
          onEnabled={(next) =>
            setExitIf(
              next
                ? (exitIf ??
                  dcaFilterSpecForKind(
                    "rsi",
                    direction === "short" ? "short" : "long",
                  ))
                : null,
            )
          }
        >
          <DcaFilterBlock
            label="Kind"
            prefix="exitIf"
            side={direction === "short" ? "short" : "long"}
            spec={exitIf}
            onChange={setExitIf}
            named
            dense
            allowOff={false}
            gridClass={botRowClass5}
            whenClass=""
            fieldClass={fieldClass}
            labelClass={labelClass}
          />
        </OptionalSection>
      )}

      <AdditionalActions>
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
          library={backtestLibrary}
          currentRecipe={liveRecipe()}
          buildForm={snapshotForm}
          onSaved={(saved) => {
            const recipe = liveRecipe();
            if (recipe) {
              onTemplateSaved?.({
                id: saved.id,
                name: saved.name,
                recipe,
                visibility: saved.visibility,
              });
            }
          }}
        />
        {removeControl}
      </AdditionalActions>
      {running ? (
        <div className="py-4">
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
      {!running || ladderOpen ? (
      <BotFormGroup
        title="Summary"
        className="-mx-5 w-[calc(100%+2.5rem)] rounded-b-card bg-surface px-5"
      >
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
              averaging === "dip" && spacingKind === "atr"
                ? atrFetch === "loading"
                  ? "Reading last ATR…"
                  : atrFetch === "error"
                    ? "Could not read last ATR"
                    : summary.spacingHint
                      ? `First add ${summary.spacingHint} from last clip`
                      : "First add 1 ATR from last clip"
                : summary.covered === null
                  ? "Set max orders and initial price deviation"
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
              accountBookUsdt !== null &&
              summary.initialMargin !== null &&
              summary.initialMargin > accountBookUsdt
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
                    accountBookUsdt !== null
                      ? summary.initialMargin > accountBookUsdt
                        ? `Available ${formatUsdAmount(accountBookUsdt)} — less than this margin`
                        : `Available ${formatUsdAmount(accountBookUsdt)}`
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
                : takeProfitKind === "atr" && liveAtr == null
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
                : takeProfitKind === "atr" && liveAtr == null
                  ? atrFetch === "error"
                    ? "Could not read last ATR"
                    : "Reading last ATR…"
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
          <div className="thin-scroll mt-4 max-h-80 overflow-auto rounded-card border border-line bg-canvas">
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
                        takeProfitKind === "atr" && liveAtr == null
                          ? "text-ink-muted"
                          : !summary.profitFromTp || row.profitUsdt > 0
                            ? "text-success"
                            : "text-ink-muted"
                      }`}
                    >
                      {summary.profitFromTp
                        ? takeProfitKind === "atr" && liveAtr == null
                          ? "—"
                          : formatUsdAmount(row.profitUsdt)
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
              {needsAtr
                ? atrFetch === "loading"
                  ? ` Reading last ATR on ${DCA_INDICATOR_TIMEFRAME_LABELS[atrTimeframe]}.`
                  : atrFetch === "error"
                    ? ` Could not read last ATR on ${DCA_INDICATOR_TIMEFRAME_LABELS[atrTimeframe]}.`
                    : liveAtr != null
                      ? ` Last ATR ${formatAtrPreview(liveAtr)} on ${DCA_INDICATOR_TIMEFRAME_LABELS[atrTimeframe]} (closed).${
                          averaging === "dip" && spacingKind === "atr"
                            ? " Ladder prices recast when ATR changes."
                            : ""
                        }`
                      : ` Waiting for last ATR on ${DCA_INDICATOR_TIMEFRAME_LABELS[atrTimeframe]}.`
                : ""}
              {averaging === "interval"
                ? " Interval adds use the same last as an estimate."
                : ""}
              {showLadderTabs
                ? " This ladder is one side. Long and short add independently."
                : ""}
              {summary.profitFromTp
                ? summary.tpHint
                  ? ` Profit is ${summary.tpHint} from that average.`
                  : " Profit is take profit from that average."
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
            {averaging === "dip"
              ? spacingKind === "atr"
                ? " ATR spacing sets later prices from last clip."
                : " Initial Price Deviation sets later prices."
              : ""}
          </p>
        )}
        </div>
      </BotFormGroup>
      ) : null}
    </StayOnPageForm>
    {dialog}
    </>
  );
}


function TriggerFields({
  prefix,
  triggerBy,
  compare,
  price,
  quoteLabel,
}: {
  prefix: "arm" | "disarm" | "shortArm";
  triggerBy: string;
  compare: string;
  price: string;
  quoteLabel: string;
}) {
  return (
    <>
      <label className={labelClass}>
        <HintLabel text="Price" required />
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
        <HintLabel text="When" required />
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
        <HintLabel text={`Level (${quoteLabel})`} required />
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

function formatAtrPreview(atr: number): string {
  if (atr >= 100) {
    return atr.toFixed(1);
  }
  if (atr >= 1) {
    return atr.toFixed(2);
  }
  return atr.toFixed(4).replace(/\.?0+$/, "");
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
