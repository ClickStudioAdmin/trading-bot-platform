"use client";

import Link from "next/link";
import { NewBotLink } from "@/components/quota-access";
import { useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AutomationsBotTable } from "@/components/automations-bot-table";
import {
  BotField,
  BotColumnLayout,
  BotFormCard,
  BotFormColumns,
  BotFormGroup,
  BotFormStep,
  BotFormSidebar,
  BotFormSidebarSection,
  completeRequiredNotice,
  BotFormSummaryCard,
  BotButtonLead,
  botBtnIcon,
  BotStatusField,
  HintLabel,
  OptionalSection,
  OrderTypePill,
  botCompactRowClass,
  botFieldClass,
  conditionFieldClass,
  useBotColumnLayout,
  botFieldInvalidClass,
  botLabelClass,
  botRowClass,
  botRowClass5,
  botSectionTitleClass,
  botSidebarActionClass,
  botSidebarRemoveClass,
  botSidebarSaveClass,
  deskActionBtnClass,
} from "@/components/bot-form-chrome";
import { ColumnHint } from "@/components/column-hint";
import {
  IndicatorStartFields,
  TrendStartFields,
} from "@/components/bot-indicator-fields";
import { ExitSideBuilder } from "@/components/exit-side-builder";
import {
  exitRowsFromStack,
  type ExitStackRow,
} from "@/components/exit-condition-stack";
import {
  blankExitClauses,
  customStackFromClauses,
  classicExitFlags,
  exitClauseListMissing,
  exitClausesFromSaved,
  type ExitBuilderClause,
} from "@/lib/strategy/exit-clauses";
import {
  EntryConditionStack,
  entryConflictSlots,
  entryDraftComplete,
  entryRowsFromSources,
  type EntryStackRow,
} from "@/components/entry-condition-stack";
import {
  DcaGroupSizeFields,
  entryExtraOrdersMissing,
  entryGroupOrderKey,
  entryGroupShowsSizing,
  GroupPositionSizing,
  useExtraGroupOrders,
} from "@/components/entry-group-order";
import { positiveSizingText } from "@/lib/futures/perps-add-condition";
import { indicatorClaim, priceClaim, type ConflictClaim } from "@/lib/strategy/conflicts";
import {
  entryKindDisabled,
  entryWebhookIdDisabled,
  priceChoiceConflicts,
  type EntryConflictSlot,
  type StrategyTriggerKind,
} from "@/lib/strategy/expr";
import { FuturesSymbolSelect } from "@/components/futures-symbol-select";
import {
  BYBIT_AGREEMENT_NOTE,
  CLOSED_AGREEMENT_GATE,
  firstOpenPerp,
  symbolNeedsBybitAgreement,
  type BybitAgreementGate,
} from "@/lib/exchanges/agreement";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { useConfirmDialog } from "@/components/confirm-modal";
import {
  DeskFormFlash,
  StayOnPageForm,
} from "@/components/stay-on-page-form";
import { ChevronIcon, TabButton } from "@/components/trade-expand";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  botDeleteAllowed,
  dcaStatusFromLegs,
  disableConfirmMessage,
  disableConfirmTitle,
  disableNeedsConfirm,
  type DcaBotStatus,
} from "@/lib/bots/status";
import {
  automationsBotBlotterCells,
  botModeLabel,
  botPairBaseCoin,
  dcaBotPair,
  dcaBotSummary,
  dcaListStatus,
  deskBotRows,
  type AutomationsBotBlotter,
} from "@/lib/bots/automations-list";
import { withRemovedIds } from "@/lib/table-chrome";
import { dcaBotConfig } from "@/lib/bots/bot-config";
import {
  AUTOMATIONS_NEW,
  automationsEditHref,
  automationsNewHref,
} from "@/lib/bots/automations-path";
import { mergeSavedPlaybookCard } from "@/lib/bots/automations-saved-edit";
import {
  rememberSavedBotEdit,
  useShownAutomationsEdit,
} from "@/components/automations-saved-edit";
import {
  deleteDcaPlaybookAction,
  setDcaBotModesAction,
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
  indicatorDraftMissing,
  lastAtrValue,
  parseDcaIndicatorTimeframe,
  type DcaIndicatorKind,
} from "@/lib/dca/indicators";
import {
  hardExitComplete,
  hardExitDraftFromStored,
  writeHardExitFormFields,
  type HardExitDraft,
} from "@/lib/dca/hard-exit";
import { closedLiveIndicatorBars } from "@/lib/market/desk-klines";
import type { CandleBar } from "@/lib/market/candles";
import type { FuturesOrderType, FuturesSide } from "@/lib/futures/model";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import { perpEffectiveMaxQty, perpTicketSizeError } from "@/lib/exchanges/bybit/ticket-size";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import {
  BacktestTemplateLink,
  type BacktestLibraryItem,
  type SavedBacktestMatch,
} from "@/components/backtest-dialog";
import { BacktestingTrialMark } from "@/components/research-gate-access";
import { IconPlus, IconSave } from "@/components/icons";
import { DeskTemplateBar, SaveAsTemplateButton } from "@/components/template-modals";
import type { AppliedDeskItem } from "@/lib/templates/apply";
import {
  dcaFormToSnapshotSource,
  readFormControl,
  snapshotDcaRecipe,
  type DcaTemplateRecipe,
} from "@/lib/templates/recipe";
import type { AutomationTemplateSet, TemplateSummary } from "@/lib/templates/store";
import {
  BYBIT_DCA_UI,
  type DcaPlaybookUiPolicy,
} from "@/lib/dca/ui-policy";
import { AppSelect } from "@/components/app-select";

const fieldClass = botFieldClass;
const labelClass = botLabelClass;
const sectionTitleClass = botSectionTitleClass;
const rowClass = botRowClass;
const headerRemoveClass = botSidebarRemoveClass;

function optional(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

type DcaClassicDraft = {
  takeProfitKind: DcaTakeProfitKind;
  takeProfitAtrMult: string;
  takeProfitPct: string;
  takeProfitBasis: DcaExitBasis;
  takeProfitOrderType: FuturesOrderType;
  atrPeriod: string;
  stopLossPct: string;
  stopLossBasis: DcaExitBasis;
  trailingTriggerPct: string;
  trailingPct: string;
  breakevenActivationPct: string;
  breakevenOffsetPct: string;
  breakevenOn: boolean;
};

function blankClassicDraft(): DcaClassicDraft {
  return {
    takeProfitKind: "percent",
    takeProfitAtrMult: "",
    takeProfitPct: "",
    takeProfitBasis: "average",
    takeProfitOrderType: "market",
    atrPeriod: "",
    stopLossPct: "",
    stopLossBasis: "average",
    trailingTriggerPct: "",
    trailingPct: "",
    breakevenActivationPct: "",
    breakevenOffsetPct: "",
    breakevenOn: false,
  };
}

function classicDraftFromLeg(leg: {
  takeProfitKind?: DcaTakeProfitKind | null;
  takeProfitAtrMult?: number | null;
  takeProfitPct: number | null;
  takeProfitBasis?: DcaExitBasis | null;
  takeProfitOrderType?: FuturesOrderType | null;
  atrPeriod?: number | null;
  stopLossPct: number | null;
  stopLossBasis?: DcaExitBasis | null;
  trailingTriggerPct: number | null;
  trailingPct: number | null;
  breakevenActivationPct: number | null;
  breakevenOffsetPct: number | null;
} | null): DcaClassicDraft {
  if (!leg) {
    return blankClassicDraft();
  }
  return {
    takeProfitKind: leg.takeProfitKind ?? "percent",
    takeProfitAtrMult: optional(leg.takeProfitAtrMult),
    takeProfitPct: optional(leg.takeProfitPct),
    takeProfitBasis: leg.takeProfitBasis ?? "average",
    takeProfitOrderType: leg.takeProfitOrderType ?? "market",
    atrPeriod: optional(leg.atrPeriod),
    stopLossPct: optional(leg.stopLossPct),
    stopLossBasis: leg.stopLossBasis ?? "average",
    trailingTriggerPct: optional(leg.trailingTriggerPct),
    trailingPct: optional(leg.trailingPct),
    breakevenActivationPct: optional(leg.breakevenActivationPct),
    breakevenOffsetPct: optional(leg.breakevenOffsetPct),
    breakevenOn: leg.breakevenActivationPct != null,
  };
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

function copyEntryRows(rows: EntryStackRow[]): EntryStackRow[] {
  return rows.map((row) => ({ ...row, draft: { ...row.draft } }));
}

function asNumber(text: string): number | null {
  const value = Number(text.replace(/,/g, "").trim());
  return value > 0 && Number.isFinite(value) ? value : null;
}

function dcaStartDraftMissing(input: {
  kind: string;
  indicatorKind: string;
  compare: string;
  level: string;
  period: string;
  slowPeriod: string;
  multiplier: string;
  armPrice: string;
  webhookId: string;
}): boolean {
  if (input.kind === "") {
    return true;
  }
  if (input.kind === "price") {
    return asNumber(input.armPrice) == null;
  }
  if (input.kind === "webhook") {
    return input.webhookId.trim() === "";
  }
  if (input.kind === "indicator" || input.kind === "trend") {
    return indicatorDraftMissing({
      family: input.kind,
      kind: input.indicatorKind,
      compare: input.compare,
      level: input.level,
      period: input.period,
      slowPeriod: input.slowPeriod,
      multiplier: input.multiplier,
    });
  }
  return false;
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
  invalid = false,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (next: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  invalid?: boolean;
}) {
  return (
    <span className="relative mt-1 block">
      <GroupedNumberInput
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        allowDecimal
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        className={`${invalid ? botFieldInvalidClass : fieldClass} !mt-0 pr-7`}
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
      {hint ? <p className="mt-1 text-hint text-ink-muted">{hint}</p> : null}
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
  savedBacktests = [],
  openPositions = [],
  agreementGate = CLOSED_AGREEMENT_GATE,
  edit = null,
  clone = null,
  listHref,
  blotter,
  revealId = null,
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
  savedBacktests?: readonly SavedBacktestMatch[];
  openPositions?: DcaCycleOpen[];
  agreementGate?: BybitAgreementGate;
  edit?: string | null;
  clone?: string | null;
  listHref: string;
  blotter?: Record<string, AutomationsBotBlotter>;
  revealId?: string | null;
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
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [deskId, setDeskId] = useState(accountId ?? "");
  const deskChanged = (accountId ?? "") !== deskId;
  const incomingCards = [...playbooks]
    .reverse()
    .map((playbook) => ({ key: playbook.id, playbook }));
  const botList = deskBotRows({
    deskChanged,
    current: cards,
    incoming: incomingCards,
    removedIds,
    id: (card) => card.playbook?.id,
  });
  const visibleCards = botList.rows;
  if (deskChanged) {
    setDeskId(accountId ?? "");
    setCards([...visibleCards]);
    setExtraLibrary([]);
    if (botList.removedIds !== removedIds) {
      setRemovedIds(botList.removedIds);
    }
  } else {
    if (botList.removedIds !== removedIds) {
      setRemovedIds(botList.removedIds);
    }
    if (visibleCards !== cards) {
      setCards([...visibleCards]);
    }
  }
  const savedPlaybooks = visibleCards
    .map((card) => card.playbook)
    .filter((playbook): playbook is DcaPlaybook => Boolean(playbook?.id));
  const addPlaybookClass = deskActionBtnClass;
  const [draft, setDraft] = useState(() =>
    edit === AUTOMATIONS_NEW ? resolveDcaDraft(playbooks, clone) : null,
  );
  const [draftEdit, setDraftEdit] = useState(edit);
  const [draftClone, setDraftClone] = useState(clone);
  const [shownEdit, setShownEdit] = useShownAutomationsEdit(edit);
  const nextDraft =
    edit !== draftEdit || clone !== draftClone
      ? edit === AUTOMATIONS_NEW
        ? resolveDcaDraft(playbooks, clone)
        : null
      : draft;
  if (edit !== draftEdit || clone !== draftClone) {
    setDraftEdit(edit);
    setDraftClone(clone);
    setDraft(nextDraft);
  }
  const formCard =
    shownEdit === AUTOMATIONS_NEW
      ? nextDraft
      : shownEdit
        ? visibleCards.find((card) => card.playbook?.id === shownEdit) ?? null
        : null;
  const showForm = Boolean(formCard);

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
    router.refresh();
  }

  function leaveToList() {
    router.push(listHref);
    router.refresh();
  }

  function stayOnSaved(
    botId: string | null | undefined,
    name?: string | null,
  ) {
    const id = String(botId ?? "").trim();
    if (!id) {
      return;
    }
    setShownEdit(id);
    rememberSavedBotEdit(listHref, id, name);
  }

  return (
    <div className="space-y-3">
      {reduceOnly ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Reduce only is on. New orders stay blocked until you turn it off in
          Desk Settings. Take profit and stop still run.
        </p>
      ) : null}
      {showForm && formCard ? (
        <DcaPlaybookForm
          key={formCard.key}
          playbook={formCard.playbook}
          seed={formCard.seed}
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
          savedBacktests={savedBacktests}
          openPositions={openPositions}
          agreementGate={agreementGate}
          onTemplateSaved={(item) =>
            setExtraLibrary((current) => [
              ...current.filter((row) => row.id !== item.id),
              item,
            ])
          }
          defaultName={
            formCard.playbook?.name ?? formCard.seed?.name ?? DEFAULT_DCA_NAME
          }
          onResult={(result) => {
            const next = result as DcaDeskActionResult;
            if (next.deletedId) {
              setCards((current) =>
                current.filter((item) => item.key !== formCard.key),
              );
              leaveToList();
              return;
            }
            if (next.playbook) {
              const playbook = next.playbook;
              setCards((current) =>
                mergeSavedPlaybookCard(
                  current,
                  playbook,
                  formCard.playbook ? null : formCard.key,
                ),
              );
            }
            if (next.ok) {
              stayOnSaved(next.playbook?.id, next.playbook?.name);
            }
          }}
          onRemoveDraft={
            formCard.playbook
              ? undefined
              : () => leaveToList()
          }
        />
      ) : (
        <>
          <AutomationsBotTable
            desk="dca"
            revealId={revealId}
            toolbar={
              <>
                <NewBotLink
                  href={automationsNewHref(listHref)}
                  className={`inline-flex items-center ${addPlaybookClass}`}
                >
                  <BotButtonLead icon={<IconPlus {...botBtnIcon} />}>
                    Create New Bot
                  </BotButtonLead>
                </NewBotLink>
                {accountId ? (
                  <DeskTemplateBar
                    deskType="dca"
                    accountId={accountId}
                    templates={templates}
                    sets={sets}
                    onApplied={appendApplied}
                  />
                ) : null}
              </>
            }
            empty="No bots yet. Create a bot to own orders and exits on one contract. Leave this empty if you are not ready to arm."
            onBulkStatus={async (ids, action) => {
              const data = new FormData();
              data.set("bulk", action);
              for (const id of ids) {
                data.append("id", id);
              }
              const result = await setDcaBotModesAction(data);
              if (result.ok) {
                if (action === "delete") {
                  const drop = new Set(ids);
                  setRemovedIds((current) => withRemovedIds(current, ids));
                  setCards((current) =>
                    current.filter(
                      (card) => !drop.has(card.playbook?.id ?? ""),
                    ),
                  );
                } else {
                  for (const playbook of result.playbooks ?? []) {
                    setCards((current) => upsertDcaCard(current, playbook));
                  }
                }
              }
              return result.ok
                ? { ok: true }
                : { ok: false, error: result.error };
            }}
            rows={savedPlaybooks.map((playbook) => {
              const needsAgreement = symbolNeedsBybitAgreement(
                agreementGate.symbols,
                playbook.symbol,
              );
              const ownsOpen = dcaPlaybookHasOpenCycle(playbook, openPositions);
              const flat = !ownsOpen;
              const agreementOff = needsAgreement && flat;
              const statusKey = agreementOff
                ? "disabled"
                : dcaStatusFromLegs({
                    armed:
                      playbook.long.status === "armed" ||
                      playbook.short.status === "armed",
                    stopAdding:
                      playbook.long.status === "stop_adding" ||
                      playbook.short.status === "stop_adding",
                  });
              return {
              id: playbook.id,
              name: playbook.name || "Bot",
              pair: dcaBotPair(playbook),
              baseCoin: botPairBaseCoin(playbook.symbol),
              pairNote: needsAgreement ? BYBIT_AGREEMENT_NOTE : undefined,
              status: agreementOff
                ? botModeLabel("dca", "disabled")
                : dcaListStatus(playbook),
              statusKey,
              summary: dcaBotSummary(playbook),
              config: dcaBotConfig(playbook),
              canRemove:
                botDeleteAllowed(statusKey) && !dcaPlaybookIsRunning(playbook),
              ownsOpen,
              removeBlocked: botDeleteAllowed(statusKey)
                ? "Stop adding or close before removing."
                : "Disable this bot before deleting it.",
              onRemove: async () => {
                const data = new FormData();
                data.set("playbookId", playbook.id);
                const result = (await deleteDcaPlaybookAction(
                  data,
                )) as DcaDeskActionResult;
                if (result.deletedId) {
                  setRemovedIds((current) =>
                    withRemovedIds(current, [playbook.id]),
                  );
                  setCards((current) =>
                    current.filter((item) => item.key !== playbook.id),
                  );
                }
              },
              ...automationsBotBlotterCells(
                playbook.id,
                blotter,
                FUTURES_PATHS.positions,
                FUTURES_PATHS.performance,
                FUTURES_PATHS.activity,
                accountId,
              ),
              editHref: automationsEditHref(listHref, playbook.id),
              cloneHref: automationsNewHref(listHref, playbook.id),
            };
            })}
          />
        </>
      )}
    </div>
  );
}

function upsertDcaCard(
  cards: { key: string; playbook: DcaPlaybook | null; seed?: DcaPlaybook }[],
  playbook: DcaPlaybook,
) {
  const next = { key: playbook.id, playbook };
  const index = cards.findIndex((item) => item.playbook?.id === playbook.id);
  if (index < 0) {
    return [next, ...cards];
  }
  return cards.map((item, itemIndex) => (itemIndex === index ? next : item));
}

/** Posted exit fields follow the draft. Unset matches an empty Trigger input. */
function writeLiveHardExit(
  form: FormData,
  prefix: string,
  draft: HardExitDraft | null,
) {
  if (!draft || draft.trigger === "unset") {
    writeHardExitFormFields(form, prefix, null);
    return;
  }
  writeHardExitFormFields(form, prefix, draft);
}

function writeLiveExitSide(
  form: FormData,
  prefix: string,
  anchor: HardExitDraft | null,
  rows: readonly ExitStackRow[],
) {
  if (anchor == null && rows.length === 0) {
    writeLiveHardExit(form, prefix, null);
    form.delete(`${prefix}StackCount`);
    return;
  }
  writeLiveHardExit(form, prefix, anchor);
  form.set(`${prefix}StackCount`, String(rows.length));
  rows.forEach((row, index) => {
    form.set(`${prefix}Stack${index}Join`, row.join === "or" ? "or" : "and");
    writeLiveHardExit(form, `${prefix}Stack${index}`, row.draft);
  });
}

function resolveDcaDraft(
  playbooks: DcaPlaybook[],
  clone: string | null,
): { key: string; playbook: DcaPlaybook | null; seed?: DcaPlaybook } {
  if (clone) {
    const source = playbooks.find((playbook) => playbook.id === clone);
    if (source) {
      return {
        key: `clone-${source.id}-${Date.now()}`,
        playbook: null,
        seed: dcaCloneIdleDraft(source),
      };
    }
  }
  return { key: `new-${Date.now()}`, playbook: null };
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
  savedBacktests = [],
  openPositions = [],
  agreementGate = CLOSED_AGREEMENT_GATE,
  onTemplateSaved,
  embedded = false,
  onRecipeChange,
  controlledSymbol,
  onSymbolChange,
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
  savedBacktests?: readonly SavedBacktestMatch[];
  openPositions?: DcaCycleOpen[];
  agreementGate?: BybitAgreementGate;
  onTemplateSaved?: (item: BacktestLibraryItem) => void;
  /** Replay and New Backtest. Hides desk save and publishes the recipe. */
  embedded?: boolean;
  onRecipeChange?: (result: {
    recipe: DcaTemplateRecipe | null;
    error: string | null;
    fromUser: boolean;
  }) => void;
  controlledSymbol?: string;
  onSymbolChange?: (symbol: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const column = useBotColumnLayout();
  const { confirm: askConfirm, dialog } = useConfirmDialog();
  const source = playbook ?? seed;
  const [direction, setDirection] = useState(
    source?.direction === "both" && !policy.includeBoth
      ? "long"
      : (source?.direction ?? "long"),
  );
  const [startKind, setStartKind] = useState<DcaStartKind | "">(
    source?.startKind ?? "",
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
  const [dipPct, setDipPct] = useState(optional(source?.dipPct) || "1");
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
  const [intervalValue, setIntervalValue] = useState(intervalParts.value);
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
  const [tpOn] = useState(() =>
    source?.takeProfitKind === "atr"
      ? source.takeProfitAtrMult != null
      : source?.takeProfitPct != null,
  );
  const [trailingTriggerPct, setTrailingTriggerPct] = useState(
    optional(source?.trailingTriggerPct),
  );
  const [trailingPct, setTrailingPct] = useState(optional(source?.trailingPct));
  const [trailOn] = useState(
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
  const [slOn] = useState(
    () =>
      source?.stopLossPct != null || source?.breakevenActivationPct != null,
  );
  const [shortClassic, setShortClassic] = useState<DcaClassicDraft>(() => {
    if (source?.direction !== "both") {
      return blankClassicDraft();
    }
    if (source.shortClassic) {
      return classicDraftFromLeg(source.shortClassic);
    }
    return classicDraftFromLeg(source);
  });
  const [indicatorKind, setIndicatorKind] = useState<DcaIndicatorKind | "">(
    source
      ? (source.indicatorKind ??
        (source.startKind === "trend" ? "supertrend" : "rsi"))
      : "",
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
  const [shortIndicatorKind, setShortIndicatorKind] = useState<
    DcaIndicatorKind | ""
  >(source?.shortIndicatorKind ?? "");
  const [shortIndicatorTimeframe, setShortIndicatorTimeframe] = useState(
    source?.shortIndicatorTimeframe ?? "15",
  );
  const [shortIndicatorLevel, setShortIndicatorLevel] = useState(() => {
    if (source?.shortIndicatorLevel != null) {
      return optional(source.shortIndicatorLevel);
    }
    const kind = source?.shortIndicatorKind;
    if (!kind || kind === "rsi") {
      return "70";
    }
    return String(defaultDcaIndicatorLevel(kind) ?? "");
  });
  const [shortIndicatorPeriod, setShortIndicatorPeriod] = useState(
    optional(source?.shortIndicatorPeriod) ||
      String(defaultDcaIndicatorPeriod(source?.shortIndicatorKind ?? "rsi")),
  );
  const [shortIndicatorSlowPeriod, setShortIndicatorSlowPeriod] = useState(
    optional(source?.shortIndicatorSlowPeriod) ||
      String(defaultDcaIndicatorSlowPeriod(source?.shortIndicatorKind ?? "rsi") ?? ""),
  );
  const [shortIndicatorMultiplier, setShortIndicatorMultiplier] = useState(
    optional(source?.shortIndicatorMultiplier) ||
      String(DEFAULT_DCA_SUPERTREND_MULTIPLIER),
  );
  const [shortIndicatorCompare, setShortIndicatorCompare] = useState(() =>
    initialIndicatorCompare(
      source?.shortIndicatorKind ?? "rsi",
      source?.shortIndicatorCompare,
      "short",
    ),
  );
  const [webhookId, setWebhookId] = useState(
    source?.webhookId ?? signalWebhooks[0]?.id ?? "",
  );
  const [shortStartKind, setShortStartKind] = useState<DcaStartKind | "">(
    source?.shortStartKind ?? "",
  );
  const [shortWebhookId, setShortWebhookId] = useState(
    () => source?.shortWebhookId ?? signalWebhooks[0]?.id ?? "",
  );
  const [armTriggerBy, setArmTriggerBy] = useState(
    source?.armTrigger?.triggerBy ?? "last",
  );
  const [armCompare, setArmCompare] = useState(
    source?.armTrigger?.compare ?? "gte",
  );
  const [armPrice, setArmPrice] = useState(optional(source?.armTrigger?.price));
  const [shortArmTriggerBy, setShortArmTriggerBy] = useState(
    source?.shortArmTrigger?.triggerBy ?? "last",
  );
  const [shortArmCompare, setShortArmCompare] = useState(
    source?.shortArmTrigger?.compare ?? "lte",
  );
  const [shortArmPrice, setShortArmPrice] = useState(
    optional(source?.shortArmTrigger?.price),
  );
  const [entryRows, setEntryRows] = useState<EntryStackRow[]>(() =>
    entryRowsFromSources(source?.entryStack, source?.confirm),
  );
  const [shortEntryRows, setShortEntryRows] = useState<EntryStackRow[]>(() =>
    entryRowsFromSources(source?.shortEntryStack, source?.shortConfirm),
  );
  const [exitIf, setExitIf] = useState<HardExitDraft | null>(() =>
    hardExitDraftFromStored(source?.exitIf, source?.exitHard),
  );
  const [exitRows, setExitRows] = useState<ExitStackRow[]>(() =>
    exitRowsFromStack(source?.exitStack),
  );
  const [shortExitIf, setShortExitIf] = useState<HardExitDraft | null>(() =>
    hardExitDraftFromStored(source?.shortExitIf, source?.shortExitHard),
  );
  const [shortExitRows, setShortExitRows] = useState<ExitStackRow[]>(() =>
    exitRowsFromStack(source?.shortExitStack),
  );
  const [exitClauses, setExitClauses] = useState(() =>
    exitClausesFromSaved({
      takeProfit: tpOn,
      trailing: trailOn,
      stopLoss: slOn,
      anchor: exitIf,
      rows: exitRows,
    }),
  );
  const [shortClauses, setShortClauses] = useState(() => {
    const saved =
      source?.direction === "both" ? (source.shortClassic ?? null) : null;
    const legacy = source?.direction === "both" && saved == null;
    return exitClausesFromSaved({
      takeProfit: saved
        ? saved.takeProfitKind === "atr"
          ? saved.takeProfitAtrMult != null
          : saved.takeProfitPct != null
        : legacy && tpOn,
      trailing: saved
        ? saved.trailingPct != null || saved.trailingTriggerPct != null
        : legacy && trailOn,
      stopLoss: saved
        ? saved.stopLossPct != null || saved.breakevenActivationPct != null
        : legacy && slOn,
      anchor: shortExitIf,
      rows: shortExitRows,
    });
  });
  function applyClassicFlags(
    primary: readonly ExitBuilderClause[],
    short: readonly ExitBuilderClause[] | null,
  ) {
    if (!primary.some((clause) => clause.kind === "stop_loss")) {
      setBreakevenOn(false);
    }
    if (short && !short.some((clause) => clause.kind === "stop_loss")) {
      setShortClassic((draft) =>
        draft.breakevenOn ? { ...draft, breakevenOn: false } : draft,
      );
    }
  }
  function copyPrimaryClassicToShort() {
    setShortClassic({
      takeProfitKind,
      takeProfitAtrMult,
      takeProfitPct,
      takeProfitBasis,
      takeProfitOrderType,
      atrPeriod,
      stopLossPct,
      stopLossBasis,
      trailingTriggerPct,
      trailingPct,
      breakevenActivationPct,
      breakevenOffsetPct,
      breakevenOn,
    });
  }
  function blankPrimaryClassic() {
    setTakeProfitKind("percent");
    setTakeProfitAtrMult("");
    setTakeProfitPct("");
    setTakeProfitBasis("average");
    setTakeProfitOrderType("market");
    setStopLossPct("");
    setStopLossBasis("average");
    setTrailingTriggerPct("");
    setTrailingPct("");
    setBreakevenActivationPct("");
    setBreakevenOffsetPct("");
    setBreakevenOn(false);
  }
  function copyShortClassicToPrimary() {
    setTakeProfitKind(shortClassic.takeProfitKind);
    setTakeProfitAtrMult(shortClassic.takeProfitAtrMult);
    setTakeProfitPct(shortClassic.takeProfitPct);
    setTakeProfitBasis(shortClassic.takeProfitBasis);
    setTakeProfitOrderType(shortClassic.takeProfitOrderType);
    if (spacingKind !== "atr" && shortClassic.takeProfitKind === "atr") {
      setAtrPeriod(shortClassic.atrPeriod || atrPeriod);
    }
    setStopLossPct(shortClassic.stopLossPct);
    setStopLossBasis(shortClassic.stopLossBasis);
    setTrailingTriggerPct(shortClassic.trailingTriggerPct);
    setTrailingPct(shortClassic.trailingPct);
    setBreakevenActivationPct(shortClassic.breakevenActivationPct);
    setBreakevenOffsetPct(shortClassic.breakevenOffsetPct);
    setBreakevenOn(shortClassic.breakevenOn);
  }
  function commitExitClauses(
    next: ExitBuilderClause[],
    which: "primary" | "short",
  ) {
    const custom = customStackFromClauses(next);
    if (which === "short") {
      setShortClauses(next);
      setShortExitIf(custom.anchor);
      setShortExitRows(custom.rows);
      applyClassicFlags(exitClauses, next);
    } else {
      setExitClauses(next);
      setExitIf(custom.anchor);
      setExitRows(custom.rows);
      applyClassicFlags(next, direction === "both" ? shortClauses : null);
    }
    setTouched(true);
    setFormTick((tick) => tick + 1);
  }
  function blankDcaLongEntry() {
    setStartKind("");
    setEntryRows([]);
    setWebhookId(signalWebhooks[0]?.id ?? "");
    setIndicatorKind("");
    setIndicatorTimeframe("15");
    setIndicatorCompare(initialIndicatorCompare("rsi", null, "long"));
    setIndicatorLevel(String(defaultDcaIndicatorLevel("rsi") ?? ""));
    setIndicatorPeriod(String(defaultDcaIndicatorPeriod("rsi")));
    setIndicatorSlowPeriod(String(defaultDcaIndicatorSlowPeriod("rsi") ?? ""));
    setIndicatorMultiplier(String(DEFAULT_DCA_SUPERTREND_MULTIPLIER));
    setArmTriggerBy("last");
    setArmCompare("gte");
    setArmPrice("");
  }
  function copyDcaPrimaryEntryToShort() {
    setShortStartKind(startKind);
    setShortWebhookId(webhookId);
    setShortEntryRows(copyEntryRows(entryRows));
    setShortIndicatorKind(indicatorKind);
    setShortIndicatorTimeframe(indicatorTimeframe);
    setShortIndicatorCompare(indicatorCompare);
    setShortIndicatorLevel(indicatorLevel);
    setShortIndicatorPeriod(indicatorPeriod);
    setShortIndicatorSlowPeriod(indicatorSlowPeriod);
    setShortIndicatorMultiplier(indicatorMultiplier);
    setShortArmTriggerBy(armTriggerBy);
    setShortArmCompare(armCompare);
    setShortArmPrice(armPrice);
  }
  function copyDcaShortEntryToPrimary() {
    setStartKind(shortStartKind);
    setWebhookId(shortWebhookId);
    setEntryRows(shortEntryRows);
    setIndicatorKind(shortIndicatorKind);
    setIndicatorTimeframe(shortIndicatorTimeframe);
    setIndicatorCompare(shortIndicatorCompare);
    setIndicatorLevel(shortIndicatorLevel);
    setIndicatorPeriod(shortIndicatorPeriod);
    setIndicatorSlowPeriod(shortIndicatorSlowPeriod);
    setIndicatorMultiplier(shortIndicatorMultiplier);
    setArmTriggerBy(shortArmTriggerBy);
    setArmCompare(shortArmCompare);
    setArmPrice(shortArmPrice);
  }
  const defaultSymbol =
    source?.symbol ??
    options.find((row) => row.symbol === policy.defaultSymbol)?.symbol ??
    options[0]?.symbol ??
    policy.defaultSymbol;
  const [symbolState, setSymbolState] = useState(() =>
    source
      ? defaultSymbol
      : firstOpenPerp(options, agreementGate, defaultSymbol),
  );
  const symbol = controlledSymbol?.trim() ? controlledSymbol : symbolState;
  function setSymbol(next: string) {
    setSymbolState(next);
    if (next !== symbol) {
      onSymbolChange?.(next);
    }
  }
  const [formTick, setFormTick] = useState(0);
  const [touched, setTouched] = useState(false);
  const longExtraOrders = useExtraGroupOrders();
  const shortExtraOrders = useExtraGroupOrders();
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
  const agreementDisables =
    Boolean(playbook) &&
    !hasOpenPosition &&
    symbolNeedsBybitAgreement(agreementGate.symbols, playbook?.symbol ?? "");
  const currentStatus: DcaBotStatus = !playbook
    ? "disabled"
    : agreementDisables
      ? "disabled"
      : dcaStatusFromLegs({ armed, stopAdding });
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
    qtyStep: selectedPair?.qtyStep,
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
    qtyStep: selectedPair?.qtyStep,
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
  const marginLeverageError =
    maxValueKind === "margin" &&
    asNumber(maxValue) != null &&
    !(leverage != null && leverage > 0)
      ? "Set leverage before using % of available margin."
      : null;
  const saveError =
    maxValueOverCap ??
    marginLeverageError ??
    (asNumber(clipForSave) === null ? null : (sizeError ?? ladderMaxError));
  const saveBlocked = cycleLocked ? null : saveError;
  const restGridEffective = averaging !== "interval" && restGrid;
  const primaryFlags = classicExitFlags(exitClauses);
  const shortFlags = classicExitFlags(shortClauses);
  const needsAtr =
    (averaging === "dip" && spacingKind === "atr") ||
    takeProfitKind === "atr" ||
    (direction === "both" && shortClassic.takeProfitKind === "atr");
  const atrPeriodNum = parseDcaAtrPeriod(atrPeriod) ?? DEFAULT_DCA_ATR_PERIOD;
  const shortAtrPeriodNum =
    parseDcaAtrPeriod(shortClassic.atrPeriod) ?? atrPeriodNum;
  const atrFetchPeriod = Math.max(atrPeriodNum, shortAtrPeriodNum);
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
      limit: String(Math.min(500, Math.max(200, atrFetchPeriod + 40))),
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
    atrFetchPeriod,
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
  const shortLiveAtr = useMemo(() => {
    if (!needsAtr || atrBars == null) {
      return null;
    }
    return lastAtrValue(
      closedLiveIndicatorBars(atrBars, atrTimeframe),
      shortAtrPeriodNum,
    );
  }, [needsAtr, atrBars, atrTimeframe, shortAtrPeriodNum]);
  const summaryBySide = useMemo(() => {
    function preview(side: FuturesSide) {
      const useShort = direction === "both" && side === "short";
      const flags = useShort ? shortFlags : primaryFlags;
      return dcaSummaryPreview({
        side,
        lastPrice,
        averaging,
        clipSize: clipForSave,
        sizeUnit: sizeUnitForClip,
        sizeMultiplier,
        deviationMultiplier,
        dipPct,
        spacingKind,
        atr: useShort ? shortLiveAtr : liveAtr,
        atrSpacingMult,
        maxClips,
        maxValue: valueCapUsdt == null ? "" : String(valueCapUsdt),
        takeProfitPct: flags.takeProfit
          ? useShort
            ? shortClassic.takeProfitPct
            : takeProfitPct
          : "",
        takeProfitKind: useShort ? shortClassic.takeProfitKind : takeProfitKind,
        takeProfitAtrMult: flags.takeProfit
          ? useShort
            ? shortClassic.takeProfitAtrMult
            : takeProfitAtrMult
          : "",
        takeProfitBasis: useShort
          ? shortClassic.takeProfitBasis
          : takeProfitBasis,
        stopLossPct: flags.stopLoss
          ? useShort
            ? shortClassic.stopLossPct
            : stopLossPct
          : "",
        stopLossBasis: useShort ? shortClassic.stopLossBasis : stopLossBasis,
        leverage,
      });
    }
    return { long: preview("long"), short: preview("short") };
  }, [
    averaging,
    clipForSave,
    deviationMultiplier,
    dipPct,
    direction,
    spacingKind,
    liveAtr,
    shortLiveAtr,
    atrSpacingMult,
    lastPrice,
    maxClips,
    maxValue,
    valueCapUsdt,
    sizeMultiplier,
    sizeUnit,
    sizeUnitForClip,
    primaryFlags,
    shortFlags,
    shortClassic,
    stopLossBasis,
    stopLossPct,
    takeProfitBasis,
    takeProfitKind,
    takeProfitAtrMult,
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
  const tpLive = primaryFlags.takeProfit;
  const slLive = primaryFlags.stopLoss;
  const trailLive = primaryFlags.trailing;
  const shortTpLive = direction === "both" && shortFlags.takeProfit;
  const shortSlLive = direction === "both" && shortFlags.stopLoss;
  const shortTrailLive = direction === "both" && shortFlags.trailing;
  function snapshotOverlay() {
    return {
      name: source?.name || defaultName || DEFAULT_DCA_NAME,
      symbol,
      direction,
      startKind,
      ...(direction === "both"
        ? {
            shortStartKind,
            shortWebhookId: shortStartKind === "webhook" ? shortWebhookId : "",
          }
        : {}),
      averaging,
      restGrid: averaging === "dip" && restGrid,
      sizeUnit: sizeUnitForClip,
      clipSize: clipForSave,
      maxClips,
      maxValue: maxValueMode === "none" ? "" : maxValue,
      maxValueKind: maxValueMode,
      dipPct,
      intervalUnit,
      intervalValue,
      sizeMultiplier,
      deviationMultiplier,
      spacingKind,
      atrPeriod,
      atrSpacingMult,
      takeProfitKind: tpLive ? takeProfitKind : "percent",
      takeProfitAtrMult: tpLive ? takeProfitAtrMult : "",
      takeProfitPct: tpLive ? takeProfitPct : "",
      takeProfitBasis,
      takeProfitOrderType,
      stopLossPct: slLive ? stopLossPct : "",
      stopLossBasis,
      trailingTriggerPct: trailLive ? trailingTriggerPct : "",
      trailingPct: trailLive ? trailingPct : "",
      breakevenActivationPct:
        slLive && breakevenOn ? breakevenActivationPct : "",
      breakevenOffsetPct: slLive && breakevenOn ? breakevenOffsetPct : "",
      tpOn: tpLive ? "on" : "",
      slOn: slLive ? "on" : "",
      trailOn: trailLive ? "on" : "",
      breakeven: slLive && breakevenOn ? "on" : "",
      ...(direction === "both"
        ? {
            shortClassic: "on",
            shortTakeProfitKind: shortTpLive
              ? shortClassic.takeProfitKind
              : "percent",
            shortTakeProfitAtrMult:
              shortTpLive && shortClassic.takeProfitKind === "atr"
                ? shortClassic.takeProfitAtrMult
                : "",
            shortTakeProfitPct:
              shortTpLive && shortClassic.takeProfitKind !== "atr"
                ? shortClassic.takeProfitPct
                : "",
            shortTakeProfitBasis: shortClassic.takeProfitBasis,
            shortTakeProfitOrderType: shortClassic.takeProfitOrderType,
            shortAtrPeriod: shortClassic.atrPeriod,
            shortStopLossPct: shortSlLive ? shortClassic.stopLossPct : "",
            shortStopLossBasis: shortClassic.stopLossBasis,
            shortTrailingTriggerPct: shortTrailLive
              ? shortClassic.trailingTriggerPct
              : "",
            shortTrailingPct: shortTrailLive ? shortClassic.trailingPct : "",
            shortBreakevenActivationPct:
              shortSlLive && shortClassic.breakevenOn
                ? shortClassic.breakevenActivationPct
                : "",
            shortBreakevenOffsetPct:
              shortSlLive && shortClassic.breakevenOn
                ? shortClassic.breakevenOffsetPct
                : "",
            shortTpOn: shortTpLive ? "on" : "",
            shortSlOn: shortSlLive ? "on" : "",
            shortTrailOn: shortTrailLive ? "on" : "",
            shortBreakeven:
              shortSlLive && shortClassic.breakevenOn ? "on" : "",
          }
        : {}),
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
    const data = dcaFormToSnapshotSource(formRef.current, {
      ...snapshotOverlay(),
      name:
        readFormControl(formRef.current, "name") ||
        snapshotOverlay().name,
    });
    // Exit rows are written from state. A render still sees the previous
    // inputs, so the new timeframe and kind would be missing and a finished
    // short exit would be rejected.
    writeLiveExitSide(data, "exitIf", exitIf, exitRows);
    writeLiveExitSide(
      data,
      "shortExitIf",
      direction === "both" ? shortExitIf : null,
      direction === "both" ? shortExitRows : [],
    );
    return data;
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
    tpLive &&
    (takeProfitKind === "atr"
      ? asNumber(takeProfitAtrMult) == null
      : asNumber(takeProfitPct) == null);
  const trailMissing =
    trailLive &&
    (asNumber(trailingTriggerPct) == null || asNumber(trailingPct) == null);
  const slMissing = slLive && asNumber(stopLossPct) == null;
  const breakevenMissing =
    slLive && breakevenOn && asNumber(breakevenActivationPct) == null;
  const shortTpMissing =
    shortTpLive &&
    (shortClassic.takeProfitKind === "atr"
      ? asNumber(shortClassic.takeProfitAtrMult) == null ||
        asNumber(shortClassic.atrPeriod) == null
      : asNumber(shortClassic.takeProfitPct) == null);
  const shortTrailMissing =
    shortTrailLive &&
    (asNumber(shortClassic.trailingTriggerPct) == null ||
      asNumber(shortClassic.trailingPct) == null);
  const shortSlMissing = shortSlLive && asNumber(shortClassic.stopLossPct) == null;
  const shortBreakevenMissing =
    shortSlLive &&
    shortClassic.breakevenOn &&
    asNumber(shortClassic.breakevenActivationPct) == null;
  const parseConstraint =
    !parsedLive.ok && parsedLive.error === "Percent must be 100 or less."
      ? parsedLive.error
      : null;
  const triggerMissing =
    dcaStartDraftMissing({
      kind: startKind,
      indicatorKind,
      compare: indicatorCompare,
      level: indicatorLevel,
      period: indicatorPeriod,
      slowPeriod: indicatorSlowPeriod,
      multiplier: indicatorMultiplier,
      armPrice,
      webhookId,
    }) ||
    (direction === "both" &&
      dcaStartDraftMissing({
        kind: shortStartKind,
        indicatorKind: shortIndicatorKind,
        compare: shortIndicatorCompare,
        level: shortIndicatorLevel,
        period: shortIndicatorPeriod,
        slowPeriod: shortIndicatorSlowPeriod,
        multiplier: shortIndicatorMultiplier,
        armPrice: shortArmPrice,
        webhookId: shortWebhookId,
      }));
  const exitKindMissing =
    exitClauseListMissing(exitClauses) ||
    (direction === "both" && exitClauseListMissing(shortClauses));
  const groupSizingMissing =
    entryExtraOrdersMissing(
      startKind !== "",
      entryRows,
      longExtraOrders.orders,
      longExtraOrders.sameAsLead,
    ) ||
    (direction === "both" &&
      entryExtraOrdersMissing(
        shortStartKind !== "",
        shortEntryRows,
        shortExtraOrders.orders,
        shortExtraOrders.sameAsLead,
      ));
  const requiredMissing =
    triggerMissing ||
    groupSizingMissing ||
    entryRows.some((row) => !entryDraftComplete(row.draft)) ||
    (direction === "both" &&
      shortEntryRows.some((row) => !entryDraftComplete(row.draft))) ||
    Boolean(
      exitIf &&
        (!hardExitComplete(exitIf) ||
          exitRows.some((row) => !hardExitComplete(row.draft))),
    ) ||
    (direction === "both" &&
      Boolean(
        shortExitIf &&
          (!hardExitComplete(shortExitIf) ||
            shortExitRows.some((row) => !hardExitComplete(row.draft))),
      )) ||
    tpMissing ||
    trailMissing ||
    slMissing ||
    breakevenMissing ||
    shortTpMissing ||
    shortTrailMissing ||
    shortSlMissing ||
    shortBreakevenMissing ||
    exitKindMissing ||
    (!cycleLocked && !parsedLive.ok && !parseConstraint);
  const liveRecipeKey =
    liveConfig == null ? null : JSON.stringify(snapshotDcaRecipe(liveConfig));
  const onRecipeChangeRef = useRef(onRecipeChange);
  useEffect(() => {
    onRecipeChangeRef.current = onRecipeChange;
    if (!embedded || formTick < 1 || !onRecipeChangeRef.current) {
      return;
    }
    const parsed = parseDcaPlaybookForm(snapshotForm(), policy.venueId);
    if (!parsed.ok) {
      onRecipeChangeRef.current({
        recipe: null,
        error: parsed.error,
        fromUser: touched,
      });
      return;
    }
    const missing =
      triggerMissing ||
      groupSizingMissing ||
      tpMissing ||
      trailMissing ||
      slMissing ||
      breakevenMissing ||
      exitKindMissing ||
      entryRows.some((row) => !entryDraftComplete(row.draft)) ||
      (direction === "both" &&
        shortEntryRows.some((row) => !entryDraftComplete(row.draft))) ||
      Boolean(
        exitIf &&
          (!hardExitComplete(exitIf) ||
            exitRows.some((row) => !hardExitComplete(row.draft))),
      ) ||
      (direction === "both" &&
        Boolean(
          shortExitIf &&
            (!hardExitComplete(shortExitIf) ||
              shortExitRows.some((row) => !hardExitComplete(row.draft))),
        ));
    onRecipeChangeRef.current({
      recipe: snapshotDcaRecipe(parsed.config),
      error: missing ? "Fill required fields before saving." : null,
      fromUser: touched,
    });
  }, [embedded, formTick, liveRecipeKey, onRecipeChange]);
  const [loadedRecipe, setLoadedRecipe] = useState<string | null>(null);
  const loadedRecipeSet = useRef(false);
  useLayoutEffect(() => {
    if (!playbook || formTick < 1 || loadedRecipeSet.current || liveRecipeKey == null) {
      return;
    }
    loadedRecipeSet.current = true;
    setLoadedRecipe(liveRecipeKey);
  }, [formTick, liveRecipeKey, playbook]);
  const dirty =
    statusDirty ||
    (playbook
      ? loadedRecipe != null && liveRecipeKey !== loadedRecipe
      : touched);
  const showSaveNotes = Boolean(playbook) && dirty;
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
  const removeControl = playbook ? null : onRemoveDraft ? (
    <button
      type="button"
      onClick={onRemoveDraft}
      className={headerRemoveClass}
    >
      Remove
    </button>
  ) : null;
  const fieldRowClass = embedded ? botCompactRowClass : rowClass;
  const fieldRowClass5 = embedded ? botCompactRowClass : botRowClass5;
  const nameSpan = embedded ? "col-span-full" : "col-span-2";
  const pairSpan = embedded ? "col-span-full" : "lg:col-span-2";
  const lockClass = cycleLocked ? " pointer-events-none opacity-40" : "";

  function applyDcaStartKind(side: "long" | "short", next: DcaStartKind | "") {
    const shortState = direction === "both" && side === "short";
    const current = shortState ? shortStartKind : startKind;
    const fieldSide: "long" | "short" =
      shortState || direction === "short" ? "short" : "long";
    if (next === "") {
      if (shortState) {
        setShortStartKind("");
      } else {
        setStartKind("");
      }
      return;
    }
    if (next === "trend") {
      if (shortState) {
        setShortIndicatorKind("supertrend");
        setShortIndicatorPeriod(String(defaultDcaIndicatorPeriod("supertrend")));
        setShortIndicatorMultiplier(String(DEFAULT_DCA_SUPERTREND_MULTIPLIER));
        setShortIndicatorCompare(
          indicatorCompareForDirection("short", "supertrend", ""),
        );
        setShortIndicatorLevel("");
      } else {
        setIndicatorKind("supertrend");
        setIndicatorPeriod(String(defaultDcaIndicatorPeriod("supertrend")));
        setIndicatorMultiplier(String(DEFAULT_DCA_SUPERTREND_MULTIPLIER));
        setIndicatorCompare(
          indicatorCompareForDirection(fieldSide, "supertrend", ""),
        );
        setIndicatorLevel("");
      }
    } else if (next === "indicator" && current !== "indicator") {
      if (shortState) {
        setShortIndicatorKind("");
      } else {
        setIndicatorKind("");
      }
    }
    if (shortState) {
      setShortStartKind(next);
    } else {
      setStartKind(next);
    }
  }

  function sideStartKind(side: "long" | "short"): DcaStartKind | "" {
    return direction === "both" && side === "short" ? shortStartKind : startKind;
  }
  function sideWebhook(side: "long" | "short"): string {
    return direction === "both" && side === "short" ? shortWebhookId : webhookId;
  }
  function dcaStackAnchor(side: "long" | "short"): {
    kind: StrategyTriggerKind;
    webhookId: string | null;
    claim: ConflictClaim | null;
  } {
    const kind = sideStartKind(side);
    const shortLeg = direction === "both" && side === "short";
    const claim =
      kind === "price"
        ? priceClaim({
            source: shortLeg ? shortArmTriggerBy : armTriggerBy,
            compare: shortLeg ? shortArmCompare : armCompare,
            price: shortLeg ? shortArmPrice : armPrice,
          })
        : kind === "indicator" || kind === "trend"
          ? indicatorClaim({
              surface: "entry",
              kind: shortLeg ? shortIndicatorKind : indicatorKind,
              timeframe: shortLeg ? shortIndicatorTimeframe : indicatorTimeframe,
              compare: shortLeg ? shortIndicatorCompare : indicatorCompare,
              level: shortLeg ? shortIndicatorLevel : indicatorLevel,
              period: shortLeg ? shortIndicatorPeriod : indicatorPeriod,
              slowPeriod: shortLeg
                ? shortIndicatorSlowPeriod
                : indicatorSlowPeriod,
              multiplier: shortLeg
                ? shortIndicatorMultiplier
                : indicatorMultiplier,
            })
          : null;
    if (
      kind === "price" ||
      kind === "indicator" ||
      kind === "trend" ||
      kind === "webhook"
    ) {
      return {
        kind,
        webhookId: kind === "webhook" ? sideWebhook(side) : null,
        claim,
      };
    }
    return { kind: "indicator", webhookId: null, claim: null };
  }
  function dcaStartDisabled(
    side: "long" | "short",
    kind: StrategyTriggerKind,
  ): boolean {
    const rows =
      direction === "both" && side === "short" ? shortEntryRows : entryRows;
    return entryKindDisabled({
      slots: entryConflictSlots(dcaStackAnchor(side), rows),
      index: 0,
      kind,
      webhookIds: signalWebhooks.map((row) => row.id),
    });
  }
  function dcaTriggerSelect(side: "long" | "short") {
    const shortState = direction === "both" && side === "short";
    const value = sideStartKind(side);
    return (
      <BotFormGroup locked={cycleLocked}>
        <div className={fieldRowClass}>
          <label
            className={`${labelClass}${lockClass}`}
            inert={cycleLocked || undefined}
            aria-disabled={cycleLocked || undefined}
          >
            <HintLabel text="Condition Type" required />
            <AppSelect
              name={shortState ? "shortStartKind" : "startKind"}
              value={value}
              onChange={(event) =>
                applyDcaStartKind(side, event.target.value as DcaStartKind)
              }
              className={
                value === ""
                  ? conditionFieldClass(botFieldInvalidClass, column)
                  : conditionFieldClass(fieldClass, column)
              }
            >
              {value === "immediate" ? (
                <option value="immediate">Immediate</option>
              ) : null}
              <option value="">Select Condition Type</option>
              <option value="indicator">Indicator</option>
              <option value="trend">Trend</option>
              <option
                value="price"
                disabled={dcaStartDisabled(side, "price")}
              >
                Price Cross
              </option>
              <option
                value="webhook"
                disabled={dcaStartDisabled(side, "webhook")}
              >
                Signal Webhook
              </option>
            </AppSelect>
          </label>
        </div>
      </BotFormGroup>
    );
  }

  function dcaEntryFields(side: "long" | "short") {
    const shortLeg = direction === "both" && side === "short";
    const fieldSide: "long" | "short" =
      shortLeg || direction === "short" ? "short" : "long";
    const rows = shortLeg ? shortEntryRows : entryRows;
    const setRows = shortLeg ? setShortEntryRows : setEntryRows;
    const kind = sideStartKind(side);
    const hookId = sideWebhook(side);
    return (
      <EntryConditionStack
        grouped
        lead={
          <>
            {dcaTriggerSelect(side)}
            {kind === "price" ? (
          <BotFormGroup locked={cycleLocked}>
            <div className={fieldRowClass}>
              <TriggerFields
                prefix={shortLeg ? "shortArm" : "arm"}
                triggerBy={shortLeg ? shortArmTriggerBy : armTriggerBy}
                compare={shortLeg ? shortArmCompare : armCompare}
                price={shortLeg ? shortArmPrice : armPrice}
                onTriggerBy={(next) =>
                  (shortLeg ? setShortArmTriggerBy : setArmTriggerBy)(
                    next === "mark" || next === "index" ? next : "last",
                  )
                }
                onCompare={(next) =>
                  (shortLeg ? setShortArmCompare : setArmCompare)(
                    next === "lte" ? "lte" : "gte",
                  )
                }
                onPrice={shortLeg ? setShortArmPrice : setArmPrice}
                quoteLabel={policy.quoteLabel}
                seriesSlots={entryConflictSlots(dcaStackAnchor(side), rows)}
                seriesIndex={0}
                priceInvalid={dirty && asNumber(shortLeg ? shortArmPrice : armPrice) == null}
              />
            </div>
          </BotFormGroup>
        ) : null}
        {kind === "webhook" ? (
          <BotFormGroup locked={cycleLocked}>
            <div className={fieldRowClass}>
              {signalWebhooks.length > 0 ? (
                <label className={`${labelClass} ${pairSpan}${lockClass}`}>
                  <HintLabel text="Signal Webhook" required />
                  <AppSelect
                    name={shortLeg ? "shortWebhookId" : "webhookId"}
                    value={hookId}
                    onChange={(event) =>
                      shortLeg
                        ? setShortWebhookId(event.target.value)
                        : setWebhookId(event.target.value)
                    }
                    className={
                      dirty && hookId.trim() === ""
                        ? botFieldInvalidClass
                        : fieldClass
                    }
                  >
                    {signalWebhooks.map((row) => (
                      <option
                        key={row.id}
                        value={row.id}
                        disabled={entryWebhookIdDisabled({
                          slots: entryConflictSlots(dcaStackAnchor(side), rows),
                          index: 0,
                          webhookId: row.id,
                        })}
                      >
                        {row.name}
                      </option>
                    ))}
                  </AppSelect>
                </label>
              ) : (
                <p
                  className={`self-end text-hint text-ink-muted ${
                    embedded ? "col-span-full" : "lg:col-span-3"
                  }`}
                >
                  Create a Signal on{" "}
                  <Link href={webhooksHref} className="text-accent">
                    Webhooks
                  </Link>{" "}
                  first. Set Status to Active and Save, then buy / sell starts
                  that side only.
                </p>
              )}
            </div>
          </BotFormGroup>
        ) : null}
        {kind === "indicator" ? (
          <BotFormGroup locked={cycleLocked}>
            <div className={fieldRowClass}>
              <IndicatorStartFields
                side={fieldSide}
                prefix={shortLeg ? "shortIndicator" : "indicator"}
                kind={shortLeg ? shortIndicatorKind : indicatorKind}
                timeframe={shortLeg ? shortIndicatorTimeframe : indicatorTimeframe}
                compare={shortLeg ? shortIndicatorCompare : indicatorCompare}
                level={shortLeg ? shortIndicatorLevel : indicatorLevel}
                period={shortLeg ? shortIndicatorPeriod : indicatorPeriod}
                slowPeriod={
                  shortLeg ? shortIndicatorSlowPeriod : indicatorSlowPeriod
                }
                multiplier={
                  shortLeg ? shortIndicatorMultiplier : indicatorMultiplier
                }
                onKindChange={shortLeg ? setShortIndicatorKind : setIndicatorKind}
                onTimeframeChange={
                  shortLeg ? setShortIndicatorTimeframe : setIndicatorTimeframe
                }
                onCompareChange={
                  shortLeg ? setShortIndicatorCompare : setIndicatorCompare
                }
                onLevelChange={shortLeg ? setShortIndicatorLevel : setIndicatorLevel}
                onPeriodChange={
                  shortLeg ? setShortIndicatorPeriod : setIndicatorPeriod
                }
                onSlowPeriodChange={
                  shortLeg
                    ? setShortIndicatorSlowPeriod
                    : setIndicatorSlowPeriod
                }
                onMultiplierChange={
                  shortLeg
                    ? setShortIndicatorMultiplier
                    : setIndicatorMultiplier
                }
                seriesSlots={entryConflictSlots(dcaStackAnchor(side), rows)}
                seriesIndex={0}
                showErrors={dirty}
              />
            </div>
          </BotFormGroup>
        ) : null}
        {kind === "trend" ? (
          <BotFormGroup locked={cycleLocked}>
            <div className={fieldRowClass}>
              <TrendStartFields
                side={fieldSide}
                prefix={shortLeg ? "shortIndicator" : "indicator"}
                kind={
                  (shortLeg ? shortIndicatorKind : indicatorKind) || "supertrend"
                }
                timeframe={shortLeg ? shortIndicatorTimeframe : indicatorTimeframe}
                compare={shortLeg ? shortIndicatorCompare : indicatorCompare}
                period={shortLeg ? shortIndicatorPeriod : indicatorPeriod}
                multiplier={
                  shortLeg ? shortIndicatorMultiplier : indicatorMultiplier
                }
                onKindChange={shortLeg ? setShortIndicatorKind : setIndicatorKind}
                onTimeframeChange={
                  shortLeg ? setShortIndicatorTimeframe : setIndicatorTimeframe
                }
                onCompareChange={
                  shortLeg ? setShortIndicatorCompare : setIndicatorCompare
                }
                onPeriodChange={
                  shortLeg ? setShortIndicatorPeriod : setIndicatorPeriod
                }
                onMultiplierChange={
                  shortLeg
                    ? setShortIndicatorMultiplier
                    : setIndicatorMultiplier
                }
                seriesSlots={entryConflictSlots(dcaStackAnchor(side), rows)}
                seriesIndex={0}
                showErrors={dirty}
              />
            </div>
          </BotFormGroup>
        ) : null}
          </>
        }
        prefix={shortLeg ? "short_entry" : "entry"}
          side={fieldSide}
          rows={rows}
          onChange={(next) => {
            setRows(next);
            setTouched(true);
            setFormTick((tick) => tick + 1);
          }}
          anchor={dcaStackAnchor(side)}
          webhooks={signalWebhooks}
          triggerTimeframe={
            kind === "indicator" || kind === "trend"
              ? parseDcaIndicatorTimeframe(
                  shortLeg ? shortIndicatorTimeframe : indicatorTimeframe,
                )
              : null
          }
          gridClass={fieldRowClass5}
          fieldClass={fieldClass}
          labelClass={labelClass}
          showErrors={dirty}
          groupFooter={(groupIndex) => {
            const key = entryGroupOrderKey(rows, groupIndex);
            const extra = shortLeg ? shortExtraOrders : longExtraOrders;
            const quote = policy.quoteLabel;
            const base = selectedPair?.baseCoin ?? "Token";
            const showSizing = entryGroupShowsSizing(
              groupIndex,
              kind !== "",
              rows,
            );
            if (key === "lead") {
              return (
                <GroupPositionSizing groupIndex={groupIndex} show={showSizing}>
                  <DcaGroupSizeFields
                    size={clipSize}
                    sizeUnit={sizeUnit}
                    onSize={setClipSize}
                    onUnit={setSizeUnit}
                    quoteLabel={quote}
                    baseCoin={base}
                    fieldClass={sizeError ? botFieldInvalidClass : fieldClass}
                    sizeInputClass={
                      sizeError ||
                      (dirty &&
                        derivedClip == null &&
                        asNumber(clipSize) == null)
                        ? botFieldInvalidClass
                        : fieldClass
                    }
                    gridClass={fieldRowClass}
                    named={!shortLeg}
                    required
                    calculated={derivedClip != null ? clipForSave : null}
                    sizeError={sizeError}
                  />
                </GroupPositionSizing>
              );
            }
            const values = extra.orderFor(key);
            return (
              <GroupPositionSizing
                groupIndex={groupIndex}
                show={showSizing}
                sameAsGroup1={extra.sharesLead(key)}
                onSameAsGroup1={(same) =>
                  extra.setShares(key, same, {
                    size: derivedClip != null ? clipForSave : clipSize,
                    sizeUnit: derivedClip != null ? "usdt" : sizeUnit,
                    orderType: "market",
                    limitPrice: "",
                  })
                }
              >
                <DcaGroupSizeFields
                  size={values.size}
                  sizeUnit={values.sizeUnit}
                  onSize={(size) => extra.patch(key, { size })}
                  onUnit={(unit) => extra.patch(key, { sizeUnit: unit, size: "" })}
                  quoteLabel={quote}
                  baseCoin={base}
                  fieldClass={fieldClass}
                  sizeInputClass={
                    dirty && !positiveSizingText(values.size)
                      ? botFieldInvalidClass
                      : fieldClass
                  }
                  gridClass={fieldRowClass}
                  required
                />
              </GroupPositionSizing>
            );
          }}
      />
    );
  }


  function usesShortExit(leg: "primary" | "short") {
    return leg === "short" && direction === "both";
  }
  function classicField(leg: "primary" | "short", field: string) {
    return usesShortExit(leg)
      ? `short${field.charAt(0).toUpperCase()}${field.slice(1)}`
      : field;
  }
  function patchShort<K extends keyof DcaClassicDraft>(
    key: K,
    value: DcaClassicDraft[K],
  ) {
    setShortClassic((draft) => ({ ...draft, [key]: value }));
  }
  function dcaTakeProfitFields(leg: "primary" | "short") {
    const shortLeg = usesShortExit(leg);
    const kind = shortLeg ? shortClassic.takeProfitKind : takeProfitKind;
    const basis = shortLeg ? shortClassic.takeProfitBasis : takeProfitBasis;
    const pct = shortLeg ? shortClassic.takeProfitPct : takeProfitPct;
    const atrMult = shortLeg ? shortClassic.takeProfitAtrMult : takeProfitAtrMult;
    const period = shortLeg ? shortClassic.atrPeriod : atrPeriod;
    const orderType = shortLeg
      ? shortClassic.takeProfitOrderType
      : takeProfitOrderType;
    const missing = shortLeg ? shortTpMissing : tpMissing;
    const lockSpacing =
      !shortLeg && cycleLocked && averaging === "dip" && spacingKind === "atr";
    return (
      <div className={fieldRowClass}>
        <label className={labelClass}>
          <HintLabel text="Basis" required />
          <AppSelect
            name={classicField(leg, "takeProfitBasis")}
            value={basis}
            onChange={(event) => {
              const next = parseDcaExitBasis(event.target.value);
              if (shortLeg) {
                patchShort("takeProfitBasis", next);
              } else {
                setTakeProfitBasis(next);
              }
            }}
            className={fieldClass}
          >
            <option value="average">Average entry</option>
            <option value="first_entry">First fill</option>
          </AppSelect>
        </label>
        <label className={labelClass}>
          <HintLabel text="Method" required />
          <AppSelect
            name={classicField(leg, "takeProfitKind")}
            value={kind}
            onChange={(event) => {
              const next = parseDcaTakeProfitKind(event.target.value);
              if (shortLeg) {
                patchShort("takeProfitKind", next);
              } else {
                setTakeProfitKind(next);
              }
            }}
            className={fieldClass}
          >
            <option value="percent">Percentage</option>
            <option value="atr">ATR × multiplier</option>
          </AppSelect>
        </label>
        {kind === "percent" ? (
          <BotField label="Target %" required>
            <PercentInput
              name={classicField(leg, "takeProfitPct")}
              value={pct}
              onChange={(next) =>
                shortLeg ? patchShort("takeProfitPct", next) : setTakeProfitPct(next)
              }
              ariaLabel="Take profit target percent"
              invalid={dirty && missing}
            />
          </BotField>
        ) : (
          <>
            <CycleLock locked={lockSpacing}>
              <label className={labelClass}>
                <HintLabel text="ATR period" required />
                <GroupedNumberInput
                  name={
                    shortLeg || !(averaging === "dip" && spacingKind === "atr")
                      ? classicField(leg, shortLeg ? "atrPeriod" : "atrPeriod")
                      : undefined
                  }
                  value={period}
                  onChange={(next) =>
                    shortLeg ? patchShort("atrPeriod", next) : setAtrPeriod(next)
                  }
                  className={
                    dirty && asNumber(period) == null ? botFieldInvalidClass : fieldClass
                  }
                  ariaLabel="ATR period"
                />
              </label>
            </CycleLock>
            <label className={labelClass}>
              <HintLabel text="ATR multiple" required />
              <GroupedNumberInput
                name={classicField(leg, "takeProfitAtrMult")}
                value={atrMult}
                onChange={(next) =>
                  shortLeg
                    ? patchShort("takeProfitAtrMult", next)
                    : setTakeProfitAtrMult(next)
                }
                allowDecimal
                className={dirty && missing ? botFieldInvalidClass : fieldClass}
                ariaLabel="Take profit ATR multiple"
              />
            </label>
          </>
        )}
        <BotField label="Order type" required>
          <OrderTypePill
            name={classicField(leg, "takeProfitOrderType")}
            value={orderType === "limit" ? "limit" : "market"}
            onChange={(next) =>
              shortLeg
                ? patchShort("takeProfitOrderType", next)
                : setTakeProfitOrderType(next)
            }
          />
        </BotField>
      </div>
    );
  }
  function dcaTrailingFields(leg: "primary" | "short") {
    const shortLeg = usesShortExit(leg);
    const trigger = shortLeg ? shortClassic.trailingTriggerPct : trailingTriggerPct;
    const trail = shortLeg ? shortClassic.trailingPct : trailingPct;
    const missing = shortLeg ? shortTrailMissing : trailMissing;
    return (
      <div className={fieldRowClass}>
        <BotField
          label="Trigger %"
          hint="Trail starts after price moves this %."
          required
        >
          <PercentInput
            name={classicField(leg, "trailingTriggerPct")}
            value={trigger}
            onChange={(next) =>
              shortLeg
                ? patchShort("trailingTriggerPct", next)
                : setTrailingTriggerPct(next)
            }
            ariaLabel="Trailing trigger percent"
            invalid={dirty && missing}
          />
        </BotField>
        <BotField label="Trailing %" required>
          <PercentInput
            name={classicField(leg, "trailingPct")}
            value={trail}
            onChange={(next) =>
              shortLeg ? patchShort("trailingPct", next) : setTrailingPct(next)
            }
            ariaLabel="Trailing percent"
            invalid={dirty && missing}
          />
        </BotField>
      </div>
    );
  }
  function dcaStopFields(leg: "primary" | "short") {
    const shortLeg = usesShortExit(leg);
    const basis = shortLeg ? shortClassic.stopLossBasis : stopLossBasis;
    const pct = shortLeg ? shortClassic.stopLossPct : stopLossPct;
    const breakeven = shortLeg ? shortClassic.breakevenOn : breakevenOn;
    const activation = shortLeg
      ? shortClassic.breakevenActivationPct
      : breakevenActivationPct;
    const offset = shortLeg ? shortClassic.breakevenOffsetPct : breakevenOffsetPct;
    const missing = shortLeg ? shortSlMissing : slMissing;
    const breakevenInvalid = shortLeg ? shortBreakevenMissing : breakevenMissing;
    return (
      <div className="@container">
        <div className="grid grid-cols-2 items-start gap-4 @min-[40rem]:grid-cols-4">
          <label className={labelClass}>
            <HintLabel text="Basis" required />
            <AppSelect
              name={classicField(leg, "stopLossBasis")}
              value={basis}
              onChange={(event) => {
                const next = parseDcaExitBasis(event.target.value);
                if (shortLeg) {
                  patchShort("stopLossBasis", next);
                } else {
                  setStopLossBasis(next);
                }
              }}
              className={fieldClass}
            >
              <option value="average">Average entry</option>
              <option value="first_entry">First fill</option>
            </AppSelect>
          </label>
          <BotField label="Stop loss %" required>
            <PercentInput
              name={classicField(leg, "stopLossPct")}
              value={pct}
              onChange={(next) =>
                shortLeg ? patchShort("stopLossPct", next) : setStopLossPct(next)
              }
              ariaLabel="Stop loss percent"
              invalid={dirty && missing}
            />
          </BotField>
          <OptionalSection
            title="Move Breakeven"
            className="col-span-2"
            enabled={breakeven}
            onEnabled={(next) =>
              shortLeg ? patchShort("breakevenOn", next) : setBreakevenOn(next)
            }
          >
            <div className="grid grid-cols-2 gap-4">
              <BotField label="Move stop to breakeven at %" required>
                <PercentInput
                  name={classicField(leg, "breakevenActivationPct")}
                  value={activation}
                  onChange={(next) =>
                    shortLeg
                      ? patchShort("breakevenActivationPct", next)
                      : setBreakevenActivationPct(next)
                  }
                  ariaLabel="Move stop to breakeven at percent"
                  invalid={dirty && breakevenInvalid}
                />
              </BotField>
              <label className={labelClass}>
                Breakeven offset %
                <PercentInput
                  name={classicField(leg, "breakevenOffsetPct")}
                  value={offset}
                  onChange={(next) =>
                    shortLeg
                      ? patchShort("breakevenOffsetPct", next)
                      : setBreakevenOffsetPct(next)
                  }
                  placeholder="0"
                  ariaLabel="Breakeven offset percent"
                />
              </label>
            </div>
          </OptionalSection>
        </div>
      </div>
    );
  }

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
      onChange={() => {
        setTouched(true);
        setFormTick((tick) => tick + 1);
      }}
      guard={async (event) => {
        if (embedded) {
          return false;
        }
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
      className={
        embedded
          ? "@container min-w-0 space-y-5 scroll-mt-24"
          : "space-y-5 scroll-mt-24"
      }
    >
      <BotColumnLayout enabled={embedded}>
      <input type="hidden" name="playbookId" value={playbook?.id ?? ""} />
      <input type="hidden" name="deskVenue" value={policy.venueId} />
      <input type="hidden" name="botStatus" value={status} />
      <BotFormColumns single={embedded}>
      <BotFormCard>
      {reduceOnly ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Reduce only is on. New orders stay blocked until you turn it off in
          Desk Settings. Take profit and stop still run.
        </p>
      ) : null}
      <BotFormStep title="General">
        {embedded ? (
          <input
            type="hidden"
            name="name"
            defaultValue={source?.name ?? defaultName ?? DEFAULT_DCA_NAME}
          />
        ) : null}
        <div className={fieldRowClass}>
          {embedded ? null : (
          <BotField label="Name" required className={nameSpan}>
            <input
              name="name"
              defaultValue={source?.name ?? defaultName ?? DEFAULT_DCA_NAME}
              maxLength={40}
              onChange={() => {
                setTouched(true);
                setFormTick((tick) => tick + 1);
              }}
              className={fieldClass}
            />
          </BotField>
          )}
          <label
            className={`${labelClass}${
              cycleLocked ? " pointer-events-none opacity-40" : ""
            }`}
            inert={cycleLocked || undefined}
            aria-disabled={cycleLocked || undefined}
          >
              <HintLabel text="Contract" required />
              <FuturesSymbolSelect
                options={options}
                defaultSymbol={defaultSymbol}
                value={symbol}
                onChange={setSymbol}
                agreementGate={agreementGate}
              />
            </label>
            <label
              className={`${labelClass}${
                cycleLocked ? " pointer-events-none opacity-40" : ""
              }`}
              inert={cycleLocked || undefined}
              aria-disabled={cycleLocked || undefined}
            >
              <HintLabel
                text="Direction"
                hint="Long and Short are independent positions and never flatten each other."
                required
              />
              <AppSelect
                name="direction"
                value={direction}
                onChange={(event) => {
                  const next = event.target.value as typeof direction;
                  if (next === "both" && direction === "short") {
                    copyDcaPrimaryEntryToShort();
                    blankDcaLongEntry();
                    copyPrimaryClassicToShort();
                    blankPrimaryClassic();
                    const kept = exitClauses;
                    setShortClauses(kept);
                    const moved = customStackFromClauses(kept);
                    setShortExitIf(moved.anchor);
                    setShortExitRows(moved.rows);
                    const blank = blankExitClauses();
                    setExitClauses(blank);
                    setExitIf(null);
                    setExitRows([]);
                    applyClassicFlags(blank, kept);
                  } else if (next === "both" && direction !== "both") {
                    const shortHasClassic = shortClauses.some(
                      (clause) =>
                        clause.kind === "take_profit" ||
                        clause.kind === "trailing_stop" ||
                        clause.kind === "stop_loss",
                    );
                    if (!shortHasClassic) {
                      setShortClassic(blankClassicDraft());
                    }
                    applyClassicFlags(exitClauses, shortClauses);
                  } else if (direction === "both" && next === "short") {
                    copyDcaShortEntryToPrimary();
                    copyShortClassicToPrimary();
                    setExitClauses(shortClauses);
                    const moved = customStackFromClauses(shortClauses);
                    setExitIf(moved.anchor);
                    setExitRows(moved.rows);
                    applyClassicFlags(shortClauses, null);
                  } else if (direction === "both" && next === "long") {
                    applyClassicFlags(exitClauses, null);
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
              </AppSelect>
            </label>
        </div>
        <BotFormGroup title="Maximum Exposure" locked={cycleLocked}>
          <div className={fieldRowClass}>
            <label className={`min-w-0 ${labelClass}`}>
              Max orders
              <GroupedNumberInput
                name="maxClips"
                value={maxClips}
                onChange={setMaxClips}
                className={
                  dirty &&
                  averaging === "dip" &&
                  restGrid &&
                  !(
                    Number.isInteger(Number(maxClips.replace(/,/g, "").trim())) &&
                    Number(maxClips.replace(/,/g, "").trim()) >= 2
                  )
                    ? botFieldInvalidClass
                    : fieldClass
                }
                placeholder="No cap"
              />
            </label>
            <label className={`min-w-0 ${labelClass}`}>
              Max value
              <AppSelect
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
              </AppSelect>
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
                  className={
                    dirty && asNumber(maxValue) == null
                      ? botFieldInvalidClass
                      : fieldClass
                  }
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
      </BotFormStep>
      {cycleLocked ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          {status === "disabled" && statusDirty
            ? "Save Disabled to close this position. Cycle settings stay locked until the close is accepted."
            : "A position is open. Cycle settings are locked. Take profit and stops still save."}
        </p>
      ) : hasOpenPosition && !running ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Closing this position. Cycle settings are unlocked for the next
          cycle.
        </p>
      ) : null}

      {direction !== "short" ? (
      <BotFormStep
        title="Long Entry Condition Builder"
        locked={cycleLocked}
        defaultCollapsed={hasOpenPosition}
      >
        {dcaEntryFields("long")}
      </BotFormStep>
      ) : null}
      {direction !== "long" ? (
      <BotFormStep
        title="Short Entry Condition Builder"
        locked={cycleLocked}
        defaultCollapsed={hasOpenPosition}
      >
        {dcaEntryFields("short")}
      </BotFormStep>
      ) : null}
      <BotFormStep
        title="Additional Orders"
        locked={cycleLocked}
        defaultCollapsed={hasOpenPosition}
      >
        <BotFormGroup
          title="Additional Order Types"
          hint="This method applies to every add after the first fill. The step next to Spacing is the first add; later adds use the same method."
          locked={cycleLocked}
        >
          <div className={fieldRowClass5}>
            <label className={`${labelClass} ${pairSpan}`}>
              <HintLabel text="Averaging" required />
              <AppSelect
                name="averaging"
                value={averaging}
                onChange={(event) =>
                  setAveraging(event.target.value as DcaAveragingKind)
                }
                className={fieldClass}
              >
                <option value="dip">Add on price deviation</option>
                <option value="interval">Add on interval</option>
              </AppSelect>
            </label>
            {averaging === "dip" ? (
              <label className={labelClass}>
                <HintLabel
                  text="Spacing"
                  hint="Percentage or ATR. Used for every add, not only the first."
                  required
                />
                <AppSelect
                  name="spacingKind"
                  value={spacingKind}
                  onChange={(event) =>
                    setSpacingKind(parseDcaSpacingKind(event.target.value))
                  }
                  className={fieldClass}
                >
                  <option value="percent">Percentage</option>
                  <option value="atr">ATR</option>
                </AppSelect>
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
                  invalid={dirty && asNumber(dipPct) == null}
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
                    className={
                      dirty && asNumber(atrPeriod) == null
                        ? botFieldInvalidClass
                        : fieldClass
                    }
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
                    className={
                      dirty && asNumber(atrSpacingMult) == null
                        ? botFieldInvalidClass
                        : fieldClass
                    }
                    ariaLabel="ATR spacing multiple"
                  />
                </label>
              </>
            ) : null}
            {averaging === "interval" ? (
              <div className={nameSpan}>
                <p className={labelClass}>
                  <HintLabel text="Add every" required />
                </p>
                <div
                  className={
                    embedded
                      ? "grid min-w-0 grid-cols-1 gap-2 @min-[22rem]:grid-cols-2"
                      : "grid grid-cols-[minmax(8.5rem,1.4fr)_minmax(5rem,0.8fr)] gap-2"
                  }
                >
                  <AppSelect
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
                  </AppSelect>
                  <GroupedNumberInput
                    name="intervalValue"
                    value={intervalValue}
                    onChange={setIntervalValue}
                    className={
                      dirty &&
                      !(
                        Number.isInteger(
                          Number(intervalValue.replace(/,/g, "").trim()),
                        ) && Number(intervalValue.replace(/,/g, "").trim()) > 0
                      )
                        ? botFieldInvalidClass
                        : fieldClass
                    }
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
          <div
            className={
              embedded
                ? "grid min-w-0 gap-3"
                : "flex flex-wrap items-end gap-3"
            }
          >
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
            <label className={`${labelClass}${embedded ? " w-full min-w-0" : " min-w-40 flex-1"}`}>
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
                className={`mt-0.5 w-full rounded-control border bg-canvas px-2 py-1.5 text-sm text-ink focus:outline-none ${
                  ladderMaxError
                    ? "border-warning focus:border-warning"
                    : "border-line focus:border-line-strong"
                }`}
              />
            </label>
            <label className={`${labelClass}${embedded ? " w-full min-w-0" : " min-w-40 flex-1"}`}>
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
      </BotFormStep>
      
      {tpLive ? <input type="hidden" name="tpOn" value="on" /> : (
        <div hidden>
          <input type="hidden" name="takeProfitKind" value="percent" />
          <input type="hidden" name="takeProfitPct" value="" />
          <input type="hidden" name="takeProfitAtrMult" value="" />
          <input type="hidden" name="takeProfitBasis" value={takeProfitBasis} />
          <input type="hidden" name="takeProfitOrderType" value="market" />
        </div>
      )}
      {trailLive ? <input type="hidden" name="trailOn" value="on" /> : (
        <div hidden>
          <input type="hidden" name="trailingTriggerPct" value="" />
          <input type="hidden" name="trailingPct" value="" />
        </div>
      )}
      {slLive ? <input type="hidden" name="slOn" value="on" /> : (
        <div hidden>
          <input type="hidden" name="stopLossPct" value="" />
          <input type="hidden" name="stopLossBasis" value={stopLossBasis} />
        </div>
      )}
      {slLive && breakevenOn ? (
        <input type="hidden" name="breakeven" value="on" />
      ) : null}
      {!slLive || !breakevenOn ? (
        <div hidden>
          <input type="hidden" name="breakevenActivationPct" value="" />
          <input type="hidden" name="breakevenOffsetPct" value="" />
        </div>
      ) : null}
      {direction === "both" ? (
        <input type="hidden" name="shortClassic" value="on" />
      ) : null}
      {shortTpLive ? <input type="hidden" name="shortTpOn" value="on" /> : direction === "both" ? (
        <div hidden>
          <input type="hidden" name="shortTakeProfitKind" value="percent" />
          <input type="hidden" name="shortTakeProfitPct" value="" />
          <input type="hidden" name="shortTakeProfitAtrMult" value="" />
        </div>
      ) : null}
      {shortTrailLive ? <input type="hidden" name="shortTrailOn" value="on" /> : direction === "both" ? (
        <div hidden>
          <input type="hidden" name="shortTrailingTriggerPct" value="" />
          <input type="hidden" name="shortTrailingPct" value="" />
        </div>
      ) : null}
      {shortSlLive ? <input type="hidden" name="shortSlOn" value="on" /> : direction === "both" ? (
        <div hidden>
          <input type="hidden" name="shortStopLossPct" value="" />
        </div>
      ) : null}
      {shortSlLive && shortClassic.breakevenOn ? (
        <input type="hidden" name="shortBreakeven" value="on" />
      ) : direction === "both" ? (
        <div hidden>
          <input type="hidden" name="shortBreakevenActivationPct" value="" />
          <input type="hidden" name="shortBreakevenOffsetPct" value="" />
        </div>
      ) : null}
      {direction !== "short" ? (
      <BotFormStep title="Long Exit Condition Builder">
        <ExitSideBuilder
          clauses={exitClauses}
          onChange={(next) => commitExitClauses(next, "primary")}
          side="long"
          prefix="exitIf"
          webhooks={signalWebhooks}
          fieldClass={fieldClass}
          labelClass={labelClass}
          gridClass={fieldRowClass5}
          showErrors={dirty}
          renderTakeProfit={() => dcaTakeProfitFields("primary")}
          renderTrailingStop={() => dcaTrailingFields("primary")}
          renderStopLoss={() => dcaStopFields("primary")}
        />
      </BotFormStep>
      ) : null}
      {direction !== "long" ? (
      <BotFormStep title="Short Exit Condition Builder">
        <ExitSideBuilder
          clauses={direction === "both" ? shortClauses : exitClauses}
          onChange={(next) =>
            commitExitClauses(next, direction === "both" ? "short" : "primary")
          }
          side="short"
          prefix={direction === "both" ? "shortExitIf" : "exitIf"}
          webhooks={signalWebhooks}
          fieldClass={fieldClass}
          labelClass={labelClass}
          gridClass={fieldRowClass5}
          showErrors={dirty}
          renderTakeProfit={() =>
            dcaTakeProfitFields(direction === "both" ? "short" : "primary")
          }
          renderTrailingStop={() =>
            dcaTrailingFields(direction === "both" ? "short" : "primary")
          }
          renderStopLoss={() =>
            dcaStopFields(direction === "both" ? "short" : "primary")
          }
        />
      </BotFormStep>
      ) : null}


      </BotFormCard>
      {embedded ? null : (
      <BotFormSidebar
        status={
          <BotStatusField
            desk="dca"
            name="botStatusControl"
            value={status}
            applied={currentStatus}
            onChange={(next) => {
              setStatus(next as DcaBotStatus);
              setTouched(true);
              setFormTick((tick) => tick + 1);
            }}
            inUse={hasOpenPosition}
            accountReduceOnly={reduceOnly}
          />
        }
        dirty={showSaveNotes}
        error={
          requiredMissing
            ? completeRequiredNotice
            : constraintBlocked ?? undefined
        }
        save={
          <div className="space-y-2">
            <PendingSubmitButton
              pendingLabel="Saving…"
              deskAction="default"
              className={botSidebarSaveClass}
              disabled={Boolean(!dirty || constraintBlocked || requiredMissing)}
              title={
                requiredMissing
                  ? completeRequiredNotice
                  : constraintBlocked ?? undefined
              }
            >
              <span className="inline-flex items-center gap-1.5">
                <IconSave {...botBtnIcon} />
                Save
              </span>
            </PendingSubmitButton>
            <DeskFormFlash />
          </div>
        }
      >
        <BotFormSidebarSection title="Templates">
          <SaveAsTemplateButton
            isAdmin={isAdmin}
            defaultName={source?.name ?? defaultName ?? DEFAULT_DCA_NAME}
            kind="dca"
            folders={folders}
            library={backtestLibrary}
            currentRecipe={liveRecipe()}
            buildForm={snapshotForm}
            buttonClassName={botSidebarActionClass}
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
        </BotFormSidebarSection>
        <BotFormSidebarSection
          title="Backtesting"
          titleAside={<BacktestingTrialMark />}
        >
          <BacktestTemplateLink
            current={liveRecipe()}
            getRecipe={recipeForBacktest}
            templates={backtestLibrary}
            savedBacktests={savedBacktests}
            venueId={policy.venueId}
            venueEnvironment={venueEnvironment}
            className="flex w-full flex-col"
            buttonClassName={botSidebarActionClass}
          />
        </BotFormSidebarSection>
        {removeControl ? (
          <BotFormSidebarSection>{removeControl}</BotFormSidebarSection>
        ) : null}
      </BotFormSidebar>
      )}
      </BotFormColumns>
      {embedded ? null : running ? (
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
      {!embedded && (!running || ladderOpen) ? (
      <BotFormSummaryCard className="space-y-3">
        <h3 className={sectionTitleClass}>Summary</h3>
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
            className={`text-hint text-ink-muted ${
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
              <thead className="border-b border-line bg-surface-raised text-xs uppercase tracking-[0.08em] text-ink-faint">
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
            <p className="border-t border-line px-3 py-2 text-hint text-ink-muted">
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
      </BotFormSummaryCard>
      ) : null}
      </BotColumnLayout>
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
  onTriggerBy,
  onCompare,
  onPrice,
  quoteLabel,
  seriesSlots,
  seriesIndex,
  priceInvalid = false,
}: {
  prefix: "arm" | "disarm" | "shortArm";
  triggerBy: string;
  compare: string;
  price: string;
  onTriggerBy: (next: string) => void;
  onCompare: (next: string) => void;
  onPrice: (next: string) => void;
  quoteLabel: string;
  seriesSlots?: readonly EntryConflictSlot[];
  seriesIndex?: number;
  priceInvalid?: boolean;
}) {
  return (
    <>
      <label className={labelClass}>
        <HintLabel text="Price" required />
        <AppSelect
          name={`${prefix}TriggerBy`}
          value={triggerBy}
          onChange={(event) => onTriggerBy(event.target.value)}
          className={fieldClass}
        >
          {(["last", "mark", "index"] as const).map((source) => (
            <option
              key={source}
              value={source}
              disabled={priceChoiceConflicts(
                seriesSlots,
                seriesIndex,
                { source: triggerBy, compare, price },
                { source },
              )}
            >
              {source === "last" ? "Last" : source === "mark" ? "Mark" : "Index"}
            </option>
          ))}
        </AppSelect>
      </label>
      <label className={labelClass}>
        <HintLabel text="When" required />
        <AppSelect
          name={`${prefix}Compare`}
          value={compare}
          onChange={(event) => onCompare(event.target.value)}
          className={fieldClass}
        >
          {(["gte", "lte"] as const).map((next) => (
            <option
              key={next}
              value={next}
              disabled={priceChoiceConflicts(
                seriesSlots,
                seriesIndex,
                { source: triggerBy, compare, price },
                { compare: next },
              )}
            >
              {next === "gte" ? "At or above" : "At or below"}
            </option>
          ))}
        </AppSelect>
      </label>
      <label className={labelClass}>
        <HintLabel text={`Level (${quoteLabel})`} required />
        <GroupedNumberInput
          name={`${prefix}Price`}
          value={price}
          onChange={onPrice}
          allowDecimal
          className={priceInvalid ? botFieldInvalidClass : fieldClass}
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
