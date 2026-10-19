"use client";

import { useState, type ReactNode } from "react";
import {
  BotFormCard,
  BotFormColumns,
  BotFormStep,
  BotFormSidebar,
  BotFormSidebarSection,
  completeRequiredNotice,
  BotFormSummaryCard,
  BotButtonLead,
  botBtnIcon,
  PreviousBacktestLink,
  BotStatusField,
  botFieldClass,
  botFieldInvalidClass,
  botLabelClass,
  botRowClass,
  botRowClass5,
  botSectionTitleClass,
  botSidebarActionClass,
  botSidebarSaveClass,
  deskActionBtnClass,
} from "@/components/bot-form-chrome";
import { AppCheck } from "@/components/app-check";
import {
  IndicatorStartFields,
  TrendStartFields,
} from "@/components/bot-indicator-fields";
import { ColumnHint } from "@/components/column-hint";
import { DcaFilterBlock } from "@/components/dca-filter-fields";
import { ExitSideBuilder } from "@/components/exit-side-builder";
import {
  DcaGroupSizeFields,
  entryExtraOrdersMissing,
  entryGroupOrderKey,
  entryGroupShowsSizing,
  GroupPositionSizing,
  PerpsGroupOrderFields,
  useExtraGroupOrders,
} from "@/components/entry-group-order";
import { PerpsAdditionalOrders } from "@/components/perps-additional-orders";
import {
  blankPerpsAddOrderGroups,
  perpsAddGroupsSizingMissing,
  positiveSizingText,
} from "@/lib/futures/perps-add-condition";
import {
  type ExitStackRow,
} from "@/components/exit-condition-stack";
import {
  blankExitClauses,
  customStackFromClauses,
  classicExitFlags,
  exitPriceLive,
  exitClauseListMissing,
  exitClausesFromSaved,
  type ExitBuilderClause,
  type ExitFieldSlot,
} from "@/lib/strategy/exit-clauses";
import { exitCardsBlockReason } from "@/lib/strategy/exit-actions";
import { type TrailActivationKind } from "@/lib/strategy/exit-clauses";
import {
  EntryConditionStack,
  entryConflictSlots,
  entryRowsMissing,
  type EntryAnchor,
  type EntryStackRow,
} from "@/components/entry-condition-stack";
import { indicatorClaim, priceClaim, type ConflictClaim } from "@/lib/strategy/conflicts";
import { retraceClaim } from "@/lib/strategy/retrace";
import { RetraceFields, blankRetraceDraft, type RetraceDraft } from "@/components/retrace-fields";
import {
  entryKindDisabled,
  entryWebhookIdDisabled,
  priceChoiceConflicts,
  type EntryConflictSlot,
} from "@/lib/strategy/expr";
import {
  dcaFilterComplete,
  type DcaFilterSpec,
} from "@/lib/dca/filters";
import {
  defaultHardExit,
  hardExitComplete,
  type HardExitDraft,
} from "@/lib/dca/hard-exit";
import { FuturesSymbolSelect } from "@/components/futures-symbol-select";
import { ChevronIcon, TabButton } from "@/components/trade-expand";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import {
  DEFAULT_DCA_RSI_PERIOD,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DEFAULT_DCA_SUPERTREND_PERIOD,
  indicatorCompareForDirection,
  indicatorDraftMissing,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import { AppSelect } from "@/components/app-select";
import { IconBacktest, IconPlus, IconSave, IconTemplates } from "@/components/icons";
import { FreeTrialBadge } from "@/components/plan-trial-hint";

const fieldClass = botFieldClass;
const fieldInvalidClass = botFieldInvalidClass;
const labelClass = botLabelClass;
const sectionTitleClass = botSectionTitleClass;
const rowClass = botRowClass;
const rowClass5 = botRowClass5;
const headerBtnClass = "rounded-control px-3 py-1.5 text-xs font-medium";
const headerPrimaryClass = `${headerBtnClass} bg-accent-strong text-ink hover:bg-accent`;
const headerSecondaryClass = `${headerBtnClass} border border-line bg-surface text-ink hover:bg-surface-raised`;
const headerLongClass = `${headerBtnClass} bg-success text-canvas`;
const headerRemoveClass =
  "shrink-0 rounded-control border border-line px-2 py-0.5 text-xs text-danger hover:bg-danger/10";
const deskBtnClass = deskActionBtnClass;

type DeskKind = "flex" | "dca" | "cnc";

const SAMPLE_PAIRS: LinearPerp[] = [
  {
    symbol: "BTCUSDT",
    baseCoin: "BTC",
    quoteCoin: "USDT",
    minQty: 0.001,
    maxQty: 100,
    maxMktQty: 100,
    minNotional: 5,
    qtyStep: 0.001,
    minPrice: 0.1,
    tickSize: 0.1,
  },
  {
    symbol: "ETHUSDT",
    baseCoin: "ETH",
    quoteCoin: "USDT",
    minQty: 0.01,
    maxQty: 1000,
    maxMktQty: 1000,
    minNotional: 5,
    qtyStep: 0.01,
    minPrice: 0.01,
    tickSize: 0.01,
  },
  {
    symbol: "SOLUSDT",
    baseCoin: "SOL",
    quoteCoin: "USDT",
    minQty: 0.1,
    maxQty: 10000,
    maxMktQty: 10000,
    minNotional: 5,
    qtyStep: 0.1,
    minPrice: 0.01,
    tickSize: 0.01,
  },
];

function StatusLight({
  fill,
  label,
  inUse = false,
}: {
  fill: string;
  label?: string;
  inUse?: boolean;
}) {
  const title = label
    ? inUse
      ? `${label} · in use by an open position`
      : label
    : inUse
      ? "In use by an open position"
      : "Status";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
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
      {label}
    </span>
  );
}

function DraftCallout({
  tone,
  children,
}: {
  tone: "warning" | "danger" | "success";
  children: ReactNode;
}) {
  const toneClass =
    tone === "warning"
      ? "border-warning/30 bg-warning/10 text-warning"
      : tone === "danger"
        ? "border-danger/30 bg-danger/10 text-danger"
        : "border-success/30 bg-success/10 text-success";
  return (
    <p className={`rounded-card border px-4 py-3 text-sm ${toneClass}`}>
      {children}
    </p>
  );
}

function DraftStat({
  label,
  value,
  hint,
  valueClass = "text-ink",
}: {
  label: string;
  value: string;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0 flex-1 basis-36 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-hint text-ink-muted">{hint}</p> : null}
    </div>
  );
}

function HintLabel({
  text,
  hint,
  required = false,
  className,
}: {
  text: string;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  const label = (
    <span className={className}>
      {text}
      {required ? (
        <>
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
          <span className="sr-only"> required</span>
        </>
      ) : null}
    </span>
  );
  return hint ? <ColumnHint label={label} hint={hint} /> : label;
}

function OptionalSection({
  title,
  hint,
  enabled,
  onEnabled,
  nested = false,
  className,
  children,
}: {
  title: string;
  hint?: string;
  enabled: boolean;
  onEnabled: (next: boolean) => void;
  nested?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`block min-w-0 space-y-3 ${className ?? "col-span-full w-full"}`}
    >
      <div className="flex items-center gap-3">
        <label className="inline-flex shrink-0 cursor-pointer">
          <AppCheck
            checked={enabled}
            onChange={(event) => onEnabled(event.target.checked)}
            aria-label={title}
            className=""
          />
        </label>
        <HintLabel text={title} hint={hint} className={sectionTitleClass} />
      </div>
      {enabled ? children : null}
    </section>
  );
}

function Group({
  title,
  hint,
  children,
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="col-span-full block w-full min-w-0 space-y-3">
      {title ? (
        <h3 className={sectionTitleClass}>
          <HintLabel text={title} hint={hint} />
        </h3>
      ) : null}
      {children}
    </section>
  );
}

type ExitMethod = "" | "price" | "percent" | "atr";

type ThemeClassicDraft = {
  tpMethod: ExitMethod;
  tpValue: string;
  tpBasis: string;
  tpTrigger: string;
  tpOrderType: string;
  tpLimitPrice: string;
  trailValue: string;
  trailTrigger: string;
  trailActiveKind: TrailActivationKind;
  slMethod: ExitMethod;
  slValue: string;
  slBasis: string;
  slTrigger: string;
  slOrderType: string;
  slLimitPrice: string;
  breakevenOn: boolean;
  breakevenAt: string;
  breakevenOffset: string;
  atrPeriod: string;
};

function blankThemeClassic(): ThemeClassicDraft {
  return {
    tpMethod: "percent",
    tpValue: "",
    tpBasis: "average",
    tpTrigger: "last",
    tpOrderType: "market",
    tpLimitPrice: "",
    trailValue: "",
    trailTrigger: "",
    trailActiveKind: "percent",
    slMethod: "percent",
    slValue: "",
    slBasis: "average",
    slTrigger: "last",
    slOrderType: "market",
    slLimitPrice: "",
    breakevenOn: false,
    breakevenAt: "",
    breakevenOffset: "0",
    atrPeriod: "14",
  };
}
type StartKind = "" | "price" | "indicator" | "trend" | "webhook" | "retrace";
function Field({
  label,
  hint,
  required = false,
  className,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`${labelClass} ${className ?? ""}`}>
      <HintLabel text={label} hint={hint} required={required} />
      {children}
    </label>
  );
}

function OrderTypePill({
  value,
  onChange,
}: {
  value: "market" | "limit";
  onChange?: (next: "market" | "limit") => void;
}) {
  return (
    <span className="mt-1 flex w-fit rounded-control border border-line bg-surface p-0.5">
      {(["market", "limit"] as const).map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            className={
              selected
                ? "rounded-control bg-surface-raised px-3 py-1.5 text-sm font-medium text-ink"
                : "rounded-control px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
            }
            onClick={() => onChange?.(option)}
          >
            {option === "market" ? "Market" : "Limit"}
          </button>
        );
      })}
    </span>
  );
}

function filled(raw: string): boolean {
  return raw.trim() !== "";
}

function OffNumber({
  value,
  onChange,
  allowDecimal = true,
  required = false,
  invalid = false,
}: {
  value: string;
  onChange: (next: string) => void;
  allowDecimal?: boolean;
  required?: boolean;
  invalid?: boolean;
}) {
  return (
    <GroupedNumberInput
      value={value}
      onChange={onChange}
      allowDecimal={allowDecimal}
      placeholder={required ? "" : "Off"}
      className={invalid ? fieldInvalidClass : fieldClass}
    />
  );
}

function PercentField({
  value,
  onChange,
  required = false,
  invalid = false,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  invalid?: boolean;
  placeholder?: string;
}) {
  return (
    <span className="relative mt-1 block">
      <GroupedNumberInput
        value={value}
        onChange={onChange}
        allowDecimal
        placeholder={placeholder ?? (required ? "" : "Off")}
        className={`${invalid ? fieldInvalidClass : fieldClass} mt-0 pr-7`}
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-muted">
        %
      </span>
    </span>
  );
}

function ThemeSecondaryEntry({
  side,
  prefix,
  spec,
  onChange,
  enabled,
  onEnabled,
  showErrors = false,
}: {
  side: "long" | "short";
  prefix: string;
  spec: DcaFilterSpec | null;
  onChange: (next: DcaFilterSpec | null) => void;
  enabled: boolean;
  onEnabled: (next: boolean) => void;
  showErrors?: boolean;
}) {
  return (
    <OptionalSection
      title="Secondary Entry Condition"
      hint="Must be true for the entry trigger to execute."
      enabled={enabled}
      onEnabled={(next) => {
        onEnabled(next);
        onChange(next ? spec : null);
      }}
    >
      <DcaFilterBlock
        label="Kind"
        prefix={prefix}
        side={side}
        spec={spec}
        onChange={onChange}
        dense
        allowOff={false}
        gridClass={rowClass5}
        fieldClass={fieldClass}
        labelClass={labelClass}
        showErrors={showErrors}
      />
    </OptionalSection>
  );
}

function PriceTriggerFields({
  priceSource,
  onPriceSource,
  priceWhen,
  onPriceWhen,
  priceLevel,
  onPriceLevel,
  invalid = false,
  seriesSlots,
  seriesIndex,
}: {
  priceSource: string;
  onPriceSource: (next: string) => void;
  priceWhen: string;
  onPriceWhen: (next: string) => void;
  priceLevel: string;
  onPriceLevel: (next: string) => void;
  invalid?: boolean;
  seriesSlots?: readonly EntryConflictSlot[];
  seriesIndex?: number;
}) {
  return (
    <>
      <Field label="Price source" required>
          <AppSelect
            value={priceSource}
            onChange={(event) => onPriceSource(event.target.value)}
            className={fieldClass}
          >
            {(["last", "mark", "index"] as const).map((source) => (
              <option
                key={source}
                value={source}
                disabled={priceChoiceConflicts(
                  seriesSlots,
                  seriesIndex,
                  { source: priceSource, compare: priceWhen, price: priceLevel },
                  { source },
                )}
              >
                {source === "last"
                  ? "Last is"
                  : source === "mark"
                    ? "Mark is"
                    : "Index is"}
              </option>
            ))}
          </AppSelect>
        </Field>
        <Field label="Compare" required>
          <AppSelect
            value={priceWhen}
            onChange={(event) => onPriceWhen(event.target.value)}
            className={fieldClass}
          >
            {(["gte", "lte"] as const).map((compare) => (
              <option
                key={compare}
                value={compare}
                disabled={priceChoiceConflicts(
                  seriesSlots,
                  seriesIndex,
                  { source: priceSource, compare: priceWhen, price: priceLevel },
                  { compare },
                )}
              >
                {compare === "gte" ? "At or above" : "At or below"}
              </option>
            ))}
          </AppSelect>
        </Field>
        <Field label="Price" required>
          <OffNumber
            value={priceLevel}
            onChange={onPriceLevel}
            required
            invalid={invalid}
          />
        </Field>
    </>
  );
}

function themeStartClaim(input: {
  kind: StartKind;
  priceSource: string;
  priceWhen: string;
  priceLevel: string;
  indicatorKind: DcaIndicatorKind | "";
  timeframe: DcaIndicatorTimeframe;
  when: string;
  period: string;
  slowPeriod: string;
  level: string;
  multiplier: string;
  retrace?: RetraceDraft;
  divergenceWhen?: string;
}): ConflictClaim | null {
  if (input.kind === "price") {
    return priceClaim({
      source: input.priceSource,
      compare: input.priceWhen,
      price: input.priceLevel,
    });
  }
  if (input.kind === "retrace" && input.retrace) {
    return retraceClaim(input.retrace);
  }
  if (input.kind === "indicator" || input.kind === "trend") {
    if (!input.indicatorKind) {
      return null;
    }
    return indicatorClaim({
      surface: "entry",
      kind: input.indicatorKind,
      timeframe: input.timeframe,
      compare: input.when,
      level: input.level,
      period: input.period,
      slowPeriod: input.slowPeriod,
      multiplier: input.multiplier,
      when: input.indicatorKind === "rsi_divergence" ? input.divergenceWhen : undefined,
    });
  }
  return null;
}

export function ThemeBotFormDraft() {
  const [name, setName] = useState("Sample bot");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [perpsDirection, setPerpsDirection] = useState<
    "long" | "short" | "both"
  >("long");
  const [shortStartKind, setShortStartKind] = useState<StartKind>("");
  const [shortWebhookId, setShortWebhookId] = useState("sample");
  const [shortEntryRows, setShortEntryRows] = useState<EntryStackRow[]>([]);
  const [startKind, setStartKind] = useState<StartKind>("");
  const [retrace, setRetrace] = useState<RetraceDraft>(() => blankRetraceDraft("long"));
  const [shortRetrace, setShortRetrace] = useState<RetraceDraft>(() =>
    blankRetraceDraft("short"),
  );
  const [divergenceWhen, setDivergenceWhen] = useState("bullish");
  const [divergenceStyle, setDivergenceStyle] = useState("regular");
  const [pivotBars, setPivotBars] = useState("5");
  const [divergenceSpan, setDivergenceSpan] = useState("50");
  const [minPricePct, setMinPricePct] = useState("");
  const [minRsi, setMinRsi] = useState("");
  const [shortDivergenceWhen, setShortDivergenceWhen] = useState("bearish");
  const [shortDivergenceStyle, setShortDivergenceStyle] = useState("regular");
  const [shortPivotBars, setShortPivotBars] = useState("5");
  const [shortDivergenceSpan, setShortDivergenceSpan] = useState("50");
  const [shortMinPricePct, setShortMinPricePct] = useState("");
  const [shortMinRsi, setShortMinRsi] = useState("");
  const [addRows, setAddRows] = useState<EntryStackRow[]>([]);
  const [shortAddRows, setShortAddRows] = useState<EntryStackRow[]>([]);
  const [priceSource, setPriceSource] = useState("last");
  const [priceWhen, setPriceWhen] = useState("gte");
  const [priceLevel, setPriceLevel] = useState("");
  const [indicatorKind, setIndicatorKind] = useState<DcaIndicatorKind | "">("");
  const [timeframe, setTimeframe] = useState<DcaIndicatorTimeframe>("15");
  const [when, setWhen] = useState("cross_lte");
  const [period, setPeriod] = useState(String(DEFAULT_DCA_RSI_PERIOD));
  const [slowPeriod, setSlowPeriod] = useState("21");
  const [level, setLevel] = useState("30");
  const [multiplier, setMultiplier] = useState(
    String(DEFAULT_DCA_SUPERTREND_MULTIPLIER),
  );
  const [shortPriceSource, setShortPriceSource] = useState("last");
  const [shortPriceWhen, setShortPriceWhen] = useState("lte");
  const [shortPriceLevel, setShortPriceLevel] = useState("");
  const [shortIndicatorKind, setShortIndicatorKind] = useState<
    DcaIndicatorKind | ""
  >("");
  const [shortTimeframe, setShortTimeframe] =
    useState<DcaIndicatorTimeframe>("15");
  const [shortWhen, setShortWhen] = useState("cross_gte");
  const [shortPeriod, setShortPeriod] = useState(String(DEFAULT_DCA_RSI_PERIOD));
  const [shortSlowPeriod, setShortSlowPeriod] = useState("21");
  const [shortLevel, setShortLevel] = useState("70");
  const [shortMultiplier, setShortMultiplier] = useState(
    String(DEFAULT_DCA_SUPERTREND_MULTIPLIER),
  );
  const [confirmOn, setConfirmOn] = useState(false);
  const [confirm, setConfirm] = useState<DcaFilterSpec | null>(null);
  const [entryRows, setEntryRows] = useState<EntryStackRow[]>([
    {
      key: "sample-and",
      join: "and",
      draft: { kind: "price", triggerBy: "last", compare: "gte", price: "100" },
    },
    {
      key: "sample-or",
      join: "or",
      draft: { kind: "webhook", webhookId: "sample" },
    },
  ]);
  const [shortConfirmOn, setShortConfirmOn] = useState(false);
  const [shortConfirm, setShortConfirm] = useState<DcaFilterSpec | null>(null);
  const [tpOn, setTpOn] = useState(false);
  const [trailOn, setTrailOn] = useState(false);
  const [slOn, setSlOn] = useState(false);
  const [breakevenOn, setBreakevenOn] = useState(false);
  const [minApr, setMinApr] = useState("");
  const [minDte, setMinDte] = useState("");
  const [maxDte, setMaxDte] = useState("");
  const [maxOpenNotional, setMaxOpenNotional] = useState("");
  const [maxOpenCount, setMaxOpenCount] = useState("1");
  const [carrySizeType, setCarrySizeType] = useState<"dynamic" | "fixed">(
    "dynamic",
  );
  const [orderSizeUsdt, setOrderSizeUsdt] = useState("10000");
  const [minCapacity, setMinCapacity] = useState("");
  const [minOrderSize, setMinOrderSize] = useState("");
  const [closeMaxDte, setCloseMaxDte] = useState("");
  const [closeMinApr, setCloseMinApr] = useState("");
  const [exitSizeType, setExitSizeType] = useState<"dynamic" | "fixed">(
    "dynamic",
  );
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [longAddGroups, setLongAddGroups] = useState(() =>
    blankPerpsAddOrderGroups("long"),
  );
  const [shortAddGroups, setShortAddGroups] = useState(() =>
    blankPerpsAddOrderGroups("short"),
  );
  const [webhookId, setWebhookId] = useState("sample");
  const themeLongAnchor: EntryAnchor = {
    kind: startKind === "" ? "indicator" : startKind,
    webhookId,
    claim: themeStartClaim({
      kind: startKind,
      priceSource,
      priceWhen,
      priceLevel,
      indicatorKind,
      timeframe,
      when,
      period,
      slowPeriod,
      level,
      multiplier,
      retrace,
      divergenceWhen,
    }),
  };
  const themeShortAnchor: EntryAnchor = {
    kind: shortStartKind === "" ? "indicator" : shortStartKind,
    webhookId: shortWebhookId,
    claim: themeStartClaim({
      kind: shortStartKind,
      priceSource: shortPriceSource,
      priceWhen: shortPriceWhen,
      priceLevel: shortPriceLevel,
      indicatorKind: shortIndicatorKind,
      timeframe: shortTimeframe,
      when: shortWhen,
      period: shortPeriod,
      slowPeriod: shortSlowPeriod,
      level: shortLevel,
      multiplier: shortMultiplier,
      retrace: shortRetrace,
      divergenceWhen: shortDivergenceWhen,
    }),
  };
  const themeEntrySlots = entryConflictSlots(themeLongAnchor, entryRows);
  const themeShortSlots = entryConflictSlots(themeShortAnchor, shortEntryRows);
  const [size, setSize] = useState("100");
  const [sizeUnit, setSizeUnit] = useState<"qty" | "usdt">("usdt");
  const longExtraOrders = useExtraGroupOrders();
  const shortExtraOrders = useExtraGroupOrders();
  const [sizeMultiplier, setSizeMultiplier] = useState("1");
  const [deviationMultiplier, setDeviationMultiplier] = useState("1");
  const [ladderOpen, setLadderOpen] = useState(true);
  const [ladderTab, setLadderTab] = useState<"long" | "short">("long");
  const [maxClips, setMaxClips] = useState("");
  const [maxValueMode, setMaxValueMode] = useState<
    "none" | "usdt" | "percent" | "margin"
  >("none");
  const [maxValue, setMaxValue] = useState("");
  const [tpMethod, setTpMethod] = useState<ExitMethod>("percent");
  const [tpValue, setTpValue] = useState("");
  const [tpBasis, setTpBasis] = useState("average");
  const [tpTrigger, setTpTrigger] = useState("last");
  const [tpOrderType, setTpOrderType] = useState("market");
  const [tpLimitPrice, setTpLimitPrice] = useState("");
  const [trailValue, setTrailValue] = useState("");
  const [trailTrigger, setTrailTrigger] = useState("");
  const [trailActiveKind, setTrailActiveKind] = useState<TrailActivationKind>("percent");
  const [slMethod, setSlMethod] = useState<ExitMethod>("percent");
  const [slValue, setSlValue] = useState("");
  const [slBasis, setSlBasis] = useState("average");
  const [slTrigger, setSlTrigger] = useState("last");
  const [slOrderType, setSlOrderType] = useState("market");
  const [slLimitPrice, setSlLimitPrice] = useState("");
  const [breakevenAt, setBreakevenAt] = useState("");
  const [breakevenOffset, setBreakevenOffset] = useState("0");
  const [shortClassic, setShortClassic] = useState<ThemeClassicDraft>(() =>
    blankThemeClassic(),
  );
  const [exitIf, setExitIf] = useState<HardExitDraft | null>(defaultHardExit("long"));
  const [exitRows, setExitRows] = useState<ExitStackRow[]>([
    {
      key: "sample-exit-and",
      join: "and",
      draft: { trigger: "price", triggerBy: "last", compare: "lte", price: "90" },
    },
    {
      key: "sample-exit-or",
      join: "or",
      draft: { trigger: "webhook", webhookId: "sample" },
    },
  ]);
  const [shortExitIf, setShortExitIf] = useState<HardExitDraft | null>(null);
  const [shortExitRows, setShortExitRows] = useState<ExitStackRow[]>([]);
  const [exitClauses, setExitClauses] = useState(() =>
    exitClausesFromSaved({
      takeProfit: tpOn,
      trailing: trailOn,
      stopLoss: slOn,
      anchor: exitIf,
      rows: exitRows,
    }),
  );
  const [shortClauses, setShortClauses] = useState(() =>
    exitClausesFromSaved({
      takeProfit: false,
      trailing: false,
      stopLoss: false,
      anchor: shortExitIf,
      rows: shortExitRows,
    }),
  );
  function themeIsBoth() {
    return (
      (desk === "flex" && perpsDirection === "both") ||
      (desk === "dca" && direction === "both")
    );
  }
  function applyThemeFlags(
    primary: readonly ExitBuilderClause[],
    short: readonly ExitBuilderClause[] | null,
  ) {
    const flags = classicExitFlags(primary);
    setTpOn(flags.takeProfit);
    setTrailOn(flags.trailing);
    setSlOn(flags.stopLoss);
    setBreakevenOn(primary.some((clause) => clause.kind === "breakeven"));
    if (short) {
      const on = short.some((clause) => clause.kind === "breakeven");
      setShortClassic((draft) =>
        draft.breakevenOn === on ? draft : { ...draft, breakevenOn: on },
      );
    }
  }
  function commitThemeExit(
    next: ExitBuilderClause[],
    which: "primary" | "short",
  ) {
    const custom = customStackFromClauses(next);
    if (which === "short") {
      setShortClauses(next);
      setShortExitIf(custom.anchor);
      setShortExitRows(custom.rows);
      applyThemeFlags(exitClauses, next);
    } else {
      setExitClauses(next);
      setExitIf(custom.anchor);
      setExitRows(custom.rows);
      applyThemeFlags(next, themeIsBoth() ? shortClauses : null);
    }
  }
  const themeWebhooks = [{ id: "sample", name: "Sample signal" }];
  const [averaging, setAveraging] = useState<"dip" | "interval">("dip");
  const [spacingKind, setSpacingKind] = useState<"percent" | "atr">("percent");
  const [dipPct, setDipPct] = useState("1");
  const [atrPeriod, setAtrPeriod] = useState("14");
  const [atrSpacing, setAtrSpacing] = useState("1");
  const [intervalUnit, setIntervalUnit] = useState<"minutes" | "hours" | "days">(
    "hours",
  );
  const [intervalValue, setIntervalValue] = useState("1");
  const [restGrid, setRestGrid] = useState(true);
  const [direction, setDirection] = useState<"long" | "short" | "both">("long");
  const [desk, setDesk] = useState<DeskKind>("flex");
  const [status, setStatus] = useState("disabled");
  const [appliedStatus, setAppliedStatus] = useState("disabled");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [persisted, setPersisted] = useState(false);
  const draftValue = {
    name,
    symbol,
    perpsDirection,
    startKind,
    orderType,
    limitPrice,
    longAddGroups,
    shortAddGroups,
    webhookId,
    priceSource,
    priceWhen,
    priceLevel,
    indicatorKind,
    timeframe,
    when,
    period,
    slowPeriod,
    level,
    multiplier,
    shortPriceSource,
    shortPriceWhen,
    shortPriceLevel,
    shortIndicatorKind,
    shortTimeframe,
    shortWhen,
    shortPeriod,
    shortSlowPeriod,
    shortLevel,
    shortMultiplier,
    confirmOn,
    confirm,
    shortConfirmOn,
    shortConfirm,
    tpOn,
    trailOn,
    slOn,
    breakevenOn,
    size,
    sizeUnit,
    longExtraOrders: longExtraOrders.orders,
    shortExtraOrders: shortExtraOrders.orders,
    longExtraSame: longExtraOrders.sameAsLead,
    shortExtraSame: shortExtraOrders.sameAsLead,
    sizeMultiplier,
    deviationMultiplier,
    maxClips,
    maxValueMode,
    maxValue,
    tpMethod,
    tpValue,
    tpBasis,
    tpTrigger,
    tpOrderType,
    tpLimitPrice,
    trailValue,
    trailTrigger,
    trailActiveKind,
    slMethod,
    slValue,
    slBasis,
    slTrigger,
    slOrderType,
    slLimitPrice,
    breakevenAt,
    breakevenOffset,
    shortClassic,
    shortClauses,
    exitIf,
    exitRows,
    shortExitIf,
    shortExitRows,
    averaging,
    spacingKind,
    dipPct,
    atrPeriod,
    atrSpacing,
    intervalUnit,
    intervalValue,
    restGrid,
    direction,
    minApr,
    minDte,
    maxDte,
    maxOpenNotional,
    maxOpenCount,
    carrySizeType,
    orderSizeUsdt,
    minCapacity,
    minOrderSize,
    closeMaxDte,
    closeMinApr,
    exitSizeType,
    status,
  };
  const draftKey = JSON.stringify(draftValue);
  if (savedKey === null) {
    setSavedKey(draftKey);
  }
  const dirty = savedKey !== null && draftKey !== savedKey;
  const closing = false;
  const entrySide: "long" | "short" =
    desk === "dca"
      ? direction === "short"
        ? "short"
        : "long"
      : perpsDirection === "short"
        ? "short"
        : "long";
  const bothSides = desk === "dca" && direction === "both";
  const themeBothExits =
    (desk === "flex" && perpsDirection === "both") ||
    (desk === "dca" && direction === "both");
  const primaryExitFlags = exitPriceLive(exitClauses);
  const shortExitFlags = exitPriceLive(shortClauses);
  const requireTp = desk !== "cnc" && !closing && primaryExitFlags.takeProfit;
  const requireSl = desk !== "cnc" && !closing && primaryExitFlags.stopLoss;
  const requireTrail = desk !== "cnc" && !closing && primaryExitFlags.trailing;
  const requireShortTp = themeBothExits && shortExitFlags.takeProfit;
  const requireShortSl = themeBothExits && shortExitFlags.stopLoss;
  const requireShortTrail = themeBothExits && shortExitFlags.trailing;
  const requireTrailTrigger =
    requireTrail && (desk === "dca" || desk === "flex");
  const requireShortTrailTrigger =
    requireShortTrail && (desk === "dca" || desk === "flex");
  const requireBreakeven =
    desk !== "cnc" && !closing && exitClauses.some((clause) => clause.kind === "breakeven");
  const requireShortBreakeven =
    themeBothExits && shortClauses.some((clause) => clause.kind === "breakeven");
  const requireConfirm = desk !== "cnc" && !closing && confirmOn;
  const requireShortConfirm = bothSides && !closing && shortConfirmOn;
  const requireExitIf =
    desk !== "cnc" && !closing && exitClauses.some((clause) => clause.kind === "custom");
  const requireShortExitIf =
    desk !== "cnc" &&
    !closing &&
    ((desk === "flex" && perpsDirection === "both") ||
      (desk === "dca" && direction === "both")) &&
    shortClauses.some((clause) => clause.kind === "custom");
  const requirePrice =
    startKind === "price" && (desk === "flex" || !closing);
  const requireShortPrice = themeBothExits && shortStartKind === "price";
  const requireShortWebhook =
    themeBothExits && shortStartKind === "webhook" && !filled(shortWebhookId);
  const requireLimitPrice =
    desk === "flex" && orderType === "limit" && !filled(limitPrice);
  const requireWebhook =
    startKind === "webhook" && (desk === "flex" || !closing) && !filled(webhookId);
  const requireSize = desk !== "cnc" && !closing && !filled(size);
  const groupSizingMissing =
    !closing &&
    desk !== "cnc" &&
    (entryExtraOrdersMissing(
      startKind !== "",
      entryRows,
      longExtraOrders.orders,
      longExtraOrders.sameAsLead,
    ) ||
      (themeBothExits &&
        entryExtraOrdersMissing(
          shortStartKind !== "",
          shortEntryRows,
          shortExtraOrders.orders,
          shortExtraOrders.sameAsLead,
        )) ||
      (desk === "flex" &&
        perpsDirection !== "short" &&
        perpsAddGroupsSizingMissing(longAddGroups)) ||
      (desk === "flex" &&
        (perpsDirection === "short" || perpsDirection === "both") &&
        perpsAddGroupsSizingMissing(shortAddGroups)));
  const requireDip =
    desk === "dca" &&
    averaging === "dip" &&
    spacingKind === "percent" &&
    !filled(dipPct);
  const requireAtrSpacing =
    desk === "dca" && averaging === "dip" && spacingKind === "atr" && !filled(atrSpacing);
  const requireAtrPeriod =
    desk === "dca" &&
    ((averaging === "dip" && spacingKind === "atr") ||
      (requireTp && tpMethod === "atr")) &&
    !filled(atrPeriod);
  const requireShortAtrPeriod =
    desk === "dca" &&
    requireShortTp &&
    shortClassic.tpMethod === "atr" &&
    !filled(shortClassic.atrPeriod);
  const requireInterval =
    desk === "dca" && averaging === "interval" && !filled(intervalValue);
  const requireMaxClips =
    desk === "dca" && averaging === "dip" && restGrid && !filled(maxClips);
  const requireMaxValue =
    desk === "dca" && maxValueMode !== "none" && !filled(maxValue);
  const requireTpLimit =
    desk === "flex" && !closing && requireTp && tpOrderType === "limit" && !filled(tpLimitPrice);
  const requireSlLimit =
    desk === "flex" && !closing && requireSl && slOrderType === "limit" && !filled(slLimitPrice);
  const requireShortTpLimit =
    desk === "flex" &&
    requireShortTp &&
    shortClassic.tpOrderType === "limit" &&
    !filled(shortClassic.tpLimitPrice);
  const requireShortSlLimit =
    desk === "flex" &&
    requireShortSl &&
    shortClassic.slOrderType === "limit" &&
    !filled(shortClassic.slLimitPrice);
  const requireMaxPairs = desk === "cnc" && !filled(maxOpenCount);
  const requireCarrySize =
    desk === "cnc" && carrySizeType === "fixed" && !filled(orderSizeUsdt);
  const missing = {
    name: !filled(name),
    conditionType: desk !== "cnc" && startKind === "",
    shortConditionType: themeBothExits && shortStartKind === "",
    indicatorStart:
      desk !== "cnc" &&
      (startKind === "indicator" || startKind === "trend") &&
      indicatorDraftMissing({
        family: startKind,
        kind: indicatorKind,
        compare: when,
        level,
        period,
        slowPeriod,
        multiplier,
      }),
    shortIndicatorStart:
      themeBothExits &&
      (shortStartKind === "indicator" || shortStartKind === "trend") &&
      indicatorDraftMissing({
        family: shortStartKind,
        kind: shortIndicatorKind,
        compare: shortWhen,
        level: shortLevel,
        period: shortPeriod,
        slowPeriod: shortSlowPeriod,
        multiplier: shortMultiplier,
      }),
    entryRows: desk !== "cnc" && entryRowsMissing(entryRows),
    shortEntryRows: themeBothExits && entryRowsMissing(shortEntryRows),
    exitKind:
      desk !== "cnc" &&
      (exitClauseListMissing(exitClauses) || Boolean(exitCardsBlockReason(exitClauses))),
    shortExitKind:
      themeBothExits &&
      (exitClauseListMissing(shortClauses) || Boolean(exitCardsBlockReason(shortClauses))),
    priceLevel: requirePrice && !filled(priceLevel),
    shortPriceLevel: requireShortPrice && !filled(shortPriceLevel),
    limitPrice: requireLimitPrice,
    webhookId: requireWebhook,
    shortWebhookId: requireShortWebhook,
    size: requireSize,
    groupSizing: groupSizingMissing,
    dipPct: requireDip,
    atrPeriod: requireAtrPeriod,
    atrSpacing: requireAtrSpacing,
    intervalValue: requireInterval,
    maxClips: requireMaxClips,
    maxValue: requireMaxValue,
    tpValue: requireTp && !filled(tpValue),
    tpLimitPrice: requireTpLimit,
    slValue: requireSl && !filled(slValue),
    slLimitPrice: requireSlLimit,
    trailValue: requireTrail && !filled(trailValue),
    trailTrigger: requireTrailTrigger && !filled(trailTrigger),
    breakevenAt: requireBreakeven && !filled(breakevenAt),
    shortTpValue: requireShortTp && !filled(shortClassic.tpValue),
    shortTpLimitPrice: requireShortTpLimit,
    shortSlValue: requireShortSl && !filled(shortClassic.slValue),
    shortSlLimitPrice: requireShortSlLimit,
    shortTrailValue: requireShortTrail && !filled(shortClassic.trailValue),
    shortTrailTrigger: requireShortTrailTrigger && !filled(shortClassic.trailTrigger),
    shortBreakevenAt: requireShortBreakeven && !filled(shortClassic.breakevenAt),
    shortAtrPeriod: requireShortAtrPeriod,
    maxOpenCount: requireMaxPairs,
    orderSizeUsdt: requireCarrySize,
    confirm: requireConfirm && !dcaFilterComplete(confirm),
    shortConfirm: requireShortConfirm && !dcaFilterComplete(shortConfirm),
    exitIf:
      requireExitIf &&
      (!hardExitComplete(exitIf) ||
        exitRows.some((row) => !hardExitComplete(row.draft))),
    shortExitIf:
      requireShortExitIf &&
      (!hardExitComplete(shortExitIf) ||
        shortExitRows.some((row) => !hardExitComplete(row.draft))),
  };
  const hasMissing = Object.values(missing).some(Boolean);
  const showFieldErrors = dirty && hasMissing;
  const sampleBase =
    SAMPLE_PAIRS.find((pair) => pair.symbol === symbol)?.baseCoin ?? "BTC";

  function perpsOrderFooter(
    rows: typeof entryRows,
    extra: typeof longExtraOrders,
    named: boolean,
    leadChosen: boolean,
  ) {
    function renderPerpsOrderFooter(groupIndex: number) {
      const key = entryGroupOrderKey(rows, groupIndex);
      const lead = key === "lead";
      const values = lead
        ? { size, sizeUnit, orderType, limitPrice }
        : extra.orderFor(key);
      return (
        <GroupPositionSizing
          groupIndex={groupIndex}
          show={entryGroupShowsSizing(groupIndex, leadChosen, rows)}
          sameAsGroup1={lead || extra.sharesLead(key)}
          onSameAsGroup1={
            lead
              ? undefined
              : (same) =>
                  extra.setShares(key, same, {
                    size,
                    sizeUnit,
                    orderType,
                    limitPrice,
                  })
          }
        >
          <PerpsGroupOrderFields
            order={values}
            quoteLabel="USDT"
            baseCoin={sampleBase}
            fieldClass={fieldClass}
            invalidFieldClass={fieldInvalidClass}
            gridClass={rowClass}
            named={lead && named}
            required
            sizeInvalid={
              showFieldErrors &&
              (lead ? missing.size : !positiveSizingText(values.size))
            }
            limitInvalid={
              showFieldErrors &&
              (lead
                ? missing.limitPrice
                : values.orderType === "limit" &&
                  !positiveSizingText(values.limitPrice))
            }
            onChange={(partial) => {
              if (!lead) {
                extra.patch(key, partial);
                return;
              }
              if (partial.size != null) setSize(partial.size);
              if (partial.sizeUnit != null) setSizeUnit(partial.sizeUnit);
              if (partial.orderType != null) setOrderType(partial.orderType);
              if (partial.limitPrice != null) setLimitPrice(partial.limitPrice);
            }}
          />
        </GroupPositionSizing>
      );
    }
    return renderPerpsOrderFooter;
  }

  function dcaSizeFooter(
    rows: typeof entryRows,
    extra: typeof longExtraOrders,
    named: boolean,
    leadChosen: boolean,
  ) {
    function renderDcaSizeFooter(groupIndex: number) {
      const key = entryGroupOrderKey(rows, groupIndex);
      const lead = key === "lead";
      const values = lead ? { size, sizeUnit } : extra.orderFor(key);
      return (
        <GroupPositionSizing
          groupIndex={groupIndex}
          show={entryGroupShowsSizing(groupIndex, leadChosen, rows)}
          sameAsGroup1={lead || extra.sharesLead(key)}
          onSameAsGroup1={
            lead
              ? undefined
              : (same) =>
                  extra.setShares(key, same, {
                    size,
                    sizeUnit,
                    orderType: "market",
                    limitPrice: "",
                  })
          }
        >
          <DcaGroupSizeFields
            size={values.size}
            sizeUnit={values.sizeUnit}
            onSize={(next) => {
              if (lead) {
                setSize(next);
                return;
              }
              extra.patch(key, { size: next });
            }}
            onUnit={(unit) => {
              if (lead) {
                setSizeUnit(unit);
                return;
              }
              extra.patch(key, { sizeUnit: unit, size: "" });
            }}
            quoteLabel="USDT"
            baseCoin={sampleBase}
            fieldClass={fieldClass}
            sizeInputClass={
              showFieldErrors &&
              (lead ? missing.size : !positiveSizingText(values.size))
                ? fieldInvalidClass
                : fieldClass
            }
            gridClass={rowClass}
            named={lead && named}
            required
          />
        </GroupPositionSizing>
      );
    }
    return renderDcaSizeFooter;
  }

  function applyStartKind(next: StartKind) {
    const touchShort = !(desk === "dca" && direction === "both");
    if (next === "trend") {
      setIndicatorKind("supertrend");
      setWhen(indicatorCompareForDirection(entrySide, "supertrend", ""));
      setPeriod(String(DEFAULT_DCA_SUPERTREND_PERIOD));
      setMultiplier(String(DEFAULT_DCA_SUPERTREND_MULTIPLIER));
      setLevel("");
      if (touchShort) {
        setShortIndicatorKind("supertrend");
        setShortWhen(indicatorCompareForDirection("short", "supertrend", ""));
        setShortPeriod(String(DEFAULT_DCA_SUPERTREND_PERIOD));
        setShortMultiplier(String(DEFAULT_DCA_SUPERTREND_MULTIPLIER));
        setShortLevel("");
      }
    } else if (next === "indicator" && startKind !== "indicator") {
      setIndicatorKind("");
      if (touchShort) {
        setShortIndicatorKind("");
      }
    }
    setStartKind(next);
  }

  function applyShortStartKind(next: StartKind) {
    if (next === "trend") {
      setShortIndicatorKind("supertrend");
      setShortWhen(indicatorCompareForDirection("short", "supertrend", ""));
      setShortPeriod(String(DEFAULT_DCA_SUPERTREND_PERIOD));
      setShortMultiplier(String(DEFAULT_DCA_SUPERTREND_MULTIPLIER));
      setShortLevel("");
    } else if (next === "indicator" && shortStartKind !== "indicator") {
      setShortIndicatorKind("");
    }
    setShortStartKind(next);
  }

  function switchDesk(next: DeskKind) {
    setPersisted(false);
    setSavedKey(null);
    setDesk(next);
    setStatus("active");
    setAppliedStatus("active");
    if (
      next === "flex" &&
      closing &&
      (startKind === "indicator" || startKind === "trend")
    ) {
      setStartKind("price");
    }
  }

  function copyThemeEntryToShort() {
    setShortStartKind(startKind);
    setShortWebhookId(webhookId);
    setShortEntryRows(entryRows.map((row) => ({ ...row, draft: { ...row.draft } })));
    setShortPriceSource(priceSource);
    setShortPriceWhen(priceWhen);
    setShortPriceLevel(priceLevel);
    setShortIndicatorKind(indicatorKind);
    setShortTimeframe(timeframe);
    setShortWhen(when);
    setShortPeriod(period);
    setShortSlowPeriod(slowPeriod);
    setShortLevel(level);
    setShortMultiplier(multiplier);
    setShortConfirmOn(confirmOn);
    setShortConfirm(confirm);
  }
  function blankThemeLongEntry() {
    setStartKind("");
    setEntryRows([]);
    setWebhookId("sample");
    setPriceSource("last");
    setPriceWhen("gte");
    setPriceLevel("");
    setIndicatorKind("");
    setTimeframe("15");
    setWhen("cross_lte");
    setPeriod(String(DEFAULT_DCA_RSI_PERIOD));
    setSlowPeriod("21");
    setLevel("30");
    setMultiplier(String(DEFAULT_DCA_SUPERTREND_MULTIPLIER));
    setConfirmOn(false);
    setConfirm(null);
  }
  function currentThemeClassic(): ThemeClassicDraft {
    return {
      tpMethod,
      tpValue,
      tpBasis,
      tpTrigger,
      tpOrderType,
      tpLimitPrice,
      trailValue,
      trailTrigger,
      trailActiveKind,
      slMethod,
      slValue,
      slBasis,
      slTrigger,
      slOrderType,
      slLimitPrice,
      breakevenOn,
      breakevenAt,
      breakevenOffset,
      atrPeriod,
    };
  }
  function copyThemeClassicToShort() {
    setShortClassic(currentThemeClassic());
  }
  function blankThemePrimaryClassic() {
    setTpMethod("percent");
    setTpValue("");
    setTpBasis("average");
    setTpTrigger("last");
    setTpOrderType("market");
    setTpLimitPrice("");
    setTrailValue("");
    setTrailTrigger("");
    setTrailActiveKind("percent");
    setSlMethod("");
    setSlValue("");
    setSlBasis("average");
    setSlTrigger("last");
    setSlOrderType("market");
    setSlLimitPrice("");
    setBreakevenOn(false);
    setBreakevenAt("");
    setBreakevenOffset("0");
  }
  function copyThemeShortClassicToPrimary() {
    setTpMethod(shortClassic.tpMethod);
    setTpValue(shortClassic.tpValue);
    setTpBasis(shortClassic.tpBasis);
    setTpTrigger(shortClassic.tpTrigger);
    setTpOrderType(shortClassic.tpOrderType);
    setTpLimitPrice(shortClassic.tpLimitPrice);
    setTrailValue(shortClassic.trailValue);
    setTrailTrigger(shortClassic.trailTrigger);
    setTrailActiveKind(shortClassic.trailActiveKind);
    setSlMethod(shortClassic.slMethod);
    setSlValue(shortClassic.slValue);
    setSlBasis(shortClassic.slBasis);
    setSlTrigger(shortClassic.slTrigger);
    setSlOrderType(shortClassic.slOrderType);
    setSlLimitPrice(shortClassic.slLimitPrice);
    setBreakevenOn(shortClassic.breakevenOn);
    setBreakevenAt(shortClassic.breakevenAt);
    setBreakevenOffset(shortClassic.breakevenOffset);
    if (spacingKind !== "atr" && shortClassic.tpMethod === "atr") {
      setAtrPeriod(shortClassic.atrPeriod || atrPeriod);
    }
  }
  function blankThemeShortIfEmpty(clauses: readonly ExitBuilderClause[]) {
    const shortHasClassic = clauses.some(
      (clause) =>
        clause.kind === "take_profit" ||
        clause.kind === "trailing_stop" ||
        clause.kind === "stop_loss" ||
        clause.kind === "breakeven",
    );
    if (!shortHasClassic) {
      setShortClassic(blankThemeClassic());
    }
  }
  function moveThemeExitToShort() {
    copyThemeClassicToShort();
    blankThemePrimaryClassic();
    const kept = exitClauses;
    setShortClauses(kept);
    const moved = customStackFromClauses(kept);
    setShortExitIf(moved.anchor);
    setShortExitRows(moved.rows);
    const blank = blankExitClauses();
    setExitClauses(blank);
    setExitIf(null);
    setExitRows([]);
    applyThemeFlags(blank, kept);
  }
  function promoteThemeShort() {
    setStartKind(shortStartKind);
    setWebhookId(shortWebhookId);
    setEntryRows(shortEntryRows);
    setPriceSource(shortPriceSource);
    setPriceWhen(shortPriceWhen);
    setPriceLevel(shortPriceLevel);
    setIndicatorKind(shortIndicatorKind);
    setTimeframe(shortTimeframe);
    setWhen(shortWhen);
    setPeriod(shortPeriod);
    setSlowPeriod(shortSlowPeriod);
    setLevel(shortLevel);
    setMultiplier(shortMultiplier);
    setConfirmOn(shortConfirmOn);
    setConfirm(shortConfirm);
    copyThemeShortClassicToPrimary();
    setExitClauses(shortClauses);
    const moved = customStackFromClauses(shortClauses);
    setExitIf(moved.anchor);
    setExitRows(moved.rows);
    applyThemeFlags(shortClauses, null);
  }

  function applyPerpsDirection(next: "long" | "short" | "both") {
    if (next === "both" && perpsDirection === "short") {
      copyThemeEntryToShort();
      blankThemeLongEntry();
      moveThemeExitToShort();
    } else if (next === "both" && perpsDirection !== "both") {
      blankThemeShortIfEmpty(shortClauses);
      applyThemeFlags(exitClauses, shortClauses);
    } else if (perpsDirection === "both" && next === "short") {
      promoteThemeShort();
    } else if (perpsDirection === "both" && next === "long") {
      applyThemeFlags(exitClauses, null);
    }
    setPerpsDirection(next);
  }

  function applyDirection(next: "long" | "short" | "both") {
    if (next === "both" && direction === "short") {
      copyThemeEntryToShort();
      blankThemeLongEntry();
      moveThemeExitToShort();
    } else if (next === "both" && direction !== "both") {
      blankThemeShortIfEmpty(shortClauses);
      applyThemeFlags(exitClauses, shortClauses);
    } else if (direction === "both" && next === "short") {
      promoteThemeShort();
    } else if (direction === "both" && next === "long") {
      applyThemeFlags(exitClauses, null);
    }
    setDirection(next);
  }

  function saveDraft() {
    if (hasMissing) {
      return;
    }
    setPersisted(true);
    setSavedKey(draftKey);
    setAppliedStatus(status);
  }


  function themeUsesShort(leg: "primary" | "short") {
    return leg === "short" && themeIsBoth();
  }
  function patchThemeShort(patch: Partial<ThemeClassicDraft>) {
    setShortClassic((draft) => ({ ...draft, ...patch }));
  }
  function themeTakeProfitFields(leg: "primary" | "short", slot?: ExitFieldSlot | null) {
    const shortLeg = themeUsesShort(leg);
    const repeat = slot != null;
    const method = repeat
      ? desk === "dca"
        ? slot.levels.method === "atr"
          ? "atr"
          : "percent"
        : slot.levels.method === "percent"
          ? "percent"
          : "price"
      : shortLeg
        ? shortClassic.tpMethod
        : tpMethod;
    const value = repeat
      ? method === "atr"
        ? slot.levels.atrMult
        : slot.levels.target
      : shortLeg
        ? shortClassic.tpValue
        : tpValue;
    const basis = repeat
      ? slot.levels.basis
      : shortLeg
        ? shortClassic.tpBasis
        : tpBasis;
    const trigger = repeat
      ? slot.levels.trigger || "last"
      : shortLeg
        ? shortClassic.tpTrigger
        : tpTrigger;
    const order = repeat
      ? slot.levels.orderType
      : shortLeg
        ? shortClassic.tpOrderType
        : tpOrderType;
    const limit = repeat
      ? slot.levels.limitPrice
      : shortLeg
        ? shortClassic.tpLimitPrice
        : tpLimitPrice;
    const period = repeat
      ? slot.levels.atrPeriod
      : shortLeg
        ? shortClassic.atrPeriod
        : atrPeriod;
    const valueInvalid = repeat
      ? slot.showErrors && !filled(value)
      : showFieldErrors && (shortLeg ? missing.shortTpValue : missing.tpValue);
    const periodInvalid = repeat
      ? slot.showErrors && method === "atr" && !filled(period)
      : showFieldErrors && (shortLeg ? missing.shortAtrPeriod : missing.atrPeriod);
    const limitInvalid = repeat
      ? slot.showErrors && order === "limit" && !filled(limit)
      : showFieldErrors && (shortLeg ? missing.shortTpLimitPrice : missing.tpLimitPrice);
    return (
      <>
        {desk === "dca" ? (
          <ExitMethodFields
            method={method === "atr" ? "atr" : "percent"}
            onMethod={(next) =>
              repeat
                ? slot.onChange({ method: next })
                : shortLeg
                  ? patchThemeShort({ tpMethod: next })
                  : setTpMethod(next)
            }
            value={value}
            onValue={(next) =>
              repeat
                ? slot.onChange(method === "atr" ? { atrMult: next } : { target: next })
                : shortLeg
                  ? patchThemeShort({ tpValue: next })
                  : setTpValue(next)
            }
            basis={basis}
            onBasis={(next) =>
              repeat
                ? slot.onChange({ basis: next })
                : shortLeg
                  ? patchThemeShort({ tpBasis: next })
                  : setTpBasis(next)
            }
            orderType={order}
            onOrderType={(next) =>
              repeat
                ? slot.onChange({ orderType: next })
                : shortLeg
                  ? patchThemeShort({ tpOrderType: next })
                  : setTpOrderType(next)
            }
            atrPeriod={period}
            onAtrPeriod={(next) =>
              repeat
                ? slot.onChange({ atrPeriod: next })
                : shortLeg
                  ? patchThemeShort({ atrPeriod: next })
                  : setAtrPeriod(next)
            }
            atrPeriodInvalid={periodInvalid}
            invalid={valueInvalid}
          />
        ) : (
          <div className="contents">
            <Field label="Type" required>
              <AppSelect
                className={fieldClass}
                value={method === "percent" ? "percent" : "price"}
                onChange={(event) => {
                  const next = event.target.value === "percent" ? "percent" : "price";
                  if (repeat) {
                    slot.onChange({ method: next, target: "" });
                  } else if (shortLeg) {
                    patchThemeShort({ tpMethod: next, tpValue: "" });
                  } else {
                    setTpMethod(next);
                    setTpValue("");
                  }
                }}
              >
                <option value="price">Price</option>
                <option value="percent">Percentage</option>
              </AppSelect>
            </Field>
            <Field label={method === "percent" ? "%" : "Price"} required>
              {method === "percent" ? (
                <PercentField
                  value={value}
                  onChange={(next) =>
                    repeat
                      ? slot.onChange({ target: next })
                      : shortLeg
                        ? patchThemeShort({ tpValue: next })
                        : setTpValue(next)
                  }
                  required
                  invalid={valueInvalid}
                />
              ) : (
                <OffNumber
                  value={value}
                  onChange={(next) =>
                    repeat
                      ? slot.onChange({ target: next })
                      : shortLeg
                        ? patchThemeShort({ tpValue: next })
                        : setTpValue(next)
                  }
                  required
                  invalid={valueInvalid}
                />
              )}
            </Field>
            <Field label="Price source" required>
              <AppSelect
                className={fieldClass}
                value={trigger}
                onChange={(event) =>
                  repeat
                    ? slot.onChange({ trigger: event.target.value })
                    : shortLeg
                      ? patchThemeShort({ tpTrigger: event.target.value })
                      : setTpTrigger(event.target.value)
                }
              >
                <option value="last">Last</option>
                <option value="mark">Mark</option>
                <option value="index">Index</option>
              </AppSelect>
            </Field>
            <Field label="Order type" required>
              <OrderTypePill
                value={order === "limit" ? "limit" : "market"}
                onChange={(next) =>
                  repeat
                    ? slot.onChange({ orderType: next })
                    : shortLeg
                      ? patchThemeShort({ tpOrderType: next })
                      : setTpOrderType(next)
                }
              />
            </Field>
            {order === "limit" ? (
              <Field label="Limit price" required>
                <OffNumber
                  value={limit}
                  onChange={(next) =>
                    repeat
                      ? slot.onChange({ limitPrice: next })
                      : shortLeg
                        ? patchThemeShort({ tpLimitPrice: next })
                        : setTpLimitPrice(next)
                  }
                  required
                  invalid={limitInvalid}
                />
              </Field>
            ) : null}
          </div>
        )}
      </>
    );
  }
  function themeTrailingFields(leg: "primary" | "short", slot?: ExitFieldSlot | null) {
    const shortLeg = themeUsesShort(leg);
    const repeat = slot != null;
    const trigger = repeat
      ? slot.levels.trigger
      : shortLeg
        ? shortClassic.trailTrigger
        : trailTrigger;
    const value = repeat
      ? slot.levels.trail
      : shortLeg
        ? shortClassic.trailValue
        : trailValue;
    const triggerInvalid = repeat
      ? slot.showErrors && !filled(trigger)
      : showFieldErrors && (shortLeg ? missing.shortTrailTrigger : missing.trailTrigger);
    const valueInvalid = repeat
      ? slot.showErrors && !filled(value)
      : showFieldErrors && (shortLeg ? missing.shortTrailValue : missing.trailValue);
    const writeTrigger = (next: string) => {
      if (repeat) {
        slot.onChange({ method: "percent", trigger: next });
      } else if (shortLeg) {
        patchThemeShort({ trailActiveKind: "percent", trailTrigger: next });
      } else {
        setTrailActiveKind("percent");
        setTrailTrigger(next);
      }
    };
    const writeDistance = (next: string) => {
      if (repeat) {
        slot.onChange({ method: "percent", trail: next });
      } else if (shortLeg) {
        patchThemeShort({ trailValue: next });
      } else {
        setTrailValue(next);
      }
    };
    return (
      <div className="contents">
        <Field label="Activation %" required>
          <PercentField
            value={trigger}
            onChange={writeTrigger}
            required
            invalid={triggerInvalid}
          />
        </Field>
        <Field label="Trailing %" required>
          <PercentField
            value={value}
            onChange={writeDistance}
            required
            invalid={valueInvalid}
          />
        </Field>
      </div>
    );
  }
  function themeStopFields(leg: "primary" | "short", slot?: ExitFieldSlot | null) {
    const shortLeg = themeUsesShort(leg);
    const repeat = slot != null;
    const basis = repeat ? slot.levels.basis : shortLeg ? shortClassic.slBasis : slBasis;
    const value = repeat ? slot.levels.target : shortLeg ? shortClassic.slValue : slValue;
    const method = repeat
      ? desk === "dca"
        ? "percent"
        : slot.levels.method === "percent"
          ? "percent"
          : "price"
      : shortLeg
        ? shortClassic.slMethod
        : slMethod;
    const trigger = repeat
      ? slot.levels.trigger || "last"
      : shortLeg
        ? shortClassic.slTrigger
        : slTrigger;
    const order = repeat ? slot.levels.orderType : shortLeg ? shortClassic.slOrderType : slOrderType;
    const limit = repeat ? slot.levels.limitPrice : shortLeg ? shortClassic.slLimitPrice : slLimitPrice;
    const valueInvalid = repeat
      ? slot.showErrors && !filled(value)
      : showFieldErrors && (shortLeg ? missing.shortSlValue : missing.slValue);
    const limitInvalid = repeat
      ? slot.showErrors && order === "limit" && !filled(limit)
      : showFieldErrors && (shortLeg ? missing.shortSlLimitPrice : missing.slLimitPrice);
    if (desk !== "dca") {
      return (
        <div className="contents">
          <Field label="Type" required>
            <AppSelect
              className={fieldClass}
              value={method === "percent" ? "percent" : "price"}
              onChange={(event) => {
                const next = event.target.value === "percent" ? "percent" : "price";
                if (repeat) {
                  slot.onChange({ method: next, target: "" });
                } else if (shortLeg) {
                  patchThemeShort({ slMethod: next, slValue: "" });
                } else {
                  setSlMethod(next);
                  setSlValue("");
                }
              }}
            >
              <option value="price">Price</option>
              <option value="percent">Percentage</option>
            </AppSelect>
          </Field>
          <Field label={method === "percent" ? "%" : "Price"} required>
            {method === "percent" ? (
              <PercentField
                value={value}
                onChange={(next) =>
                  repeat
                    ? slot.onChange({ target: next })
                    : shortLeg
                      ? patchThemeShort({ slValue: next })
                      : setSlValue(next)
                }
                required
                invalid={valueInvalid}
              />
            ) : (
              <OffNumber
                value={value}
                onChange={(next) =>
                  repeat
                    ? slot.onChange({ target: next })
                    : shortLeg
                      ? patchThemeShort({ slValue: next })
                      : setSlValue(next)
                }
                required
                invalid={valueInvalid}
              />
            )}
          </Field>
          <Field label="Price source" required>
            <AppSelect
              className={fieldClass}
              value={trigger}
              onChange={(event) =>
                repeat
                  ? slot.onChange({ trigger: event.target.value })
                  : shortLeg
                    ? patchThemeShort({ slTrigger: event.target.value })
                    : setSlTrigger(event.target.value)
              }
            >
              <option value="last">Last</option>
              <option value="mark">Mark</option>
              <option value="index">Index</option>
            </AppSelect>
          </Field>
          <Field label="Order type" required>
            <OrderTypePill
              value={order === "limit" ? "limit" : "market"}
              onChange={(next) =>
                repeat
                  ? slot.onChange({ orderType: next })
                  : shortLeg
                    ? patchThemeShort({ slOrderType: next })
                    : setSlOrderType(next)
              }
            />
          </Field>
          {order === "limit" ? (
            <Field label="Limit price" required>
              <OffNumber
                value={limit}
                onChange={(next) =>
                  repeat
                    ? slot.onChange({ limitPrice: next })
                    : shortLeg
                      ? patchThemeShort({ slLimitPrice: next })
                      : setSlLimitPrice(next)
                }
                required
                invalid={limitInvalid}
              />
            </Field>
          ) : null}
        </div>
      );
    }
    return (
      <div className="@container col-span-full">
        <div className="grid grid-cols-2 items-start gap-4 [&>*]:min-w-0">
          <Field label="Basis" required>
            <AppSelect
              className={fieldClass}
              value={basis}
              onChange={(event) =>
                repeat
                  ? slot.onChange({ basis: event.target.value })
                  : shortLeg
                    ? patchThemeShort({ slBasis: event.target.value })
                    : setSlBasis(event.target.value)
              }
            >
              <option value="average">Average entry</option>
              <option value="first_entry">First fill</option>
            </AppSelect>
          </Field>
          <Field label="Stop loss %" required>
            <PercentField
              value={value}
              onChange={(next) =>
                repeat
                  ? slot.onChange({ target: next })
                  : shortLeg
                    ? patchThemeShort({ slValue: next })
                    : setSlValue(next)
              }
              required
              invalid={valueInvalid}
            />
          </Field>
        </div>
      </div>
    );
  }
  function themeBreakevenFields(leg: "primary" | "short", slot?: ExitFieldSlot | null) {
    if (slot) {
      return null;
    }
    const shortLeg = themeUsesShort(leg);
    const activation = shortLeg ? shortClassic.breakevenAt : breakevenAt;
    const offset = shortLeg ? shortClassic.breakevenOffset : breakevenOffset;
    const invalid =
      showFieldErrors && (shortLeg ? missing.shortBreakevenAt : missing.breakevenAt);
    return (
      <>
        <Field label="Activation %" required>
          <PercentField
            value={activation}
            onChange={(next) =>
              shortLeg ? patchThemeShort({ breakevenAt: next }) : setBreakevenAt(next)
            }
            required
            invalid={invalid}
          />
        </Field>
        <Field label="Buffer %">
          <PercentField
            value={offset}
            onChange={(next) =>
              shortLeg ? patchThemeShort({ breakevenOffset: next }) : setBreakevenOffset(next)
            }
            placeholder="0"
          />
        </Field>
      </>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-muted">
        Draft standard for every desk. Local only — nothing saves. Save
        lives in the Status & Save sidebar. Status + Save applies
        the selected mode. Switch the sample desk to see each status list.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={deskBtnClass}>
          <BotButtonLead icon={<IconPlus {...botBtnIcon} />}>
            Create New Bot
          </BotButtonLead>
        </button>
        <button type="button" className={deskBtnClass}>
          <BotButtonLead icon={<IconTemplates {...botBtnIcon} />}>
            Create Bot from Template
          </BotButtonLead>
        </button>
        <button type="button" className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink">
          Save Bots
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className={labelClass}>Sample desk</p>
        <div className="flex gap-1 rounded-control border border-line bg-surface p-0.5">
          <button
            type="button"
            className={`rounded-control px-3 py-1.5 text-xs ${
              desk === "flex"
                ? "bg-surface-raised font-medium text-ink"
                : "text-ink-muted hover:text-ink"
            }`}
            onClick={() => switchDesk("flex")}
          >
            Flex
          </button>
          <button
            type="button"
            className={`rounded-control px-3 py-1.5 text-xs ${
              desk === "dca"
                ? "bg-surface-raised font-medium text-ink"
                : "text-ink-muted hover:text-ink"
            }`}
            onClick={() => switchDesk("dca")}
          >
            DCA
          </button>
          <button
            type="button"
            className={`rounded-control px-3 py-1.5 text-xs ${
              desk === "cnc"
                ? "bg-surface-raised font-medium text-ink"
                : "text-ink-muted hover:text-ink"
            }`}
            onClick={() => switchDesk("cnc")}
          >
            C&C
          </button>
        </div>
      </div>

      <BotFormColumns>
      <BotFormCard>
        <BotFormStep title="General">
        <div className={rowClass}>
          <Field label="Name" required className="col-span-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              className={
                showFieldErrors && !filled(name) ? fieldInvalidClass : fieldClass
              }
            />
          </Field>
          {desk !== "cnc" ? (
            <>
              <Field label="Contract" required>
                <FuturesSymbolSelect
                  options={SAMPLE_PAIRS}
                  value={symbol}
                  onChange={setSymbol}
                />
              </Field>
              {desk === "flex" ? (
                <Field
                  label="Direction"
                  hint="Long and Short are independent positions and never flatten each other."
                  required
                >
                  <AppSelect
                    value={perpsDirection}
                    onChange={(event) =>
                      applyPerpsDirection(
                        event.target.value as "long" | "short" | "both",
                      )
                    }
                    className={fieldClass}
                  >
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                    <option value="both">Both</option>
                  </AppSelect>
                </Field>
              ) : (
                <Field
                  label="Direction"
                  hint="Long and Short are independent positions and never flatten each other."
                  required
                >
                  <AppSelect
                    value={direction}
                    onChange={(event) =>
                      applyDirection(
                        event.target.value as "long" | "short" | "both",
                      )
                    }
                    className={fieldClass}
                  >
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                    <option value="both">Both</option>
                  </AppSelect>
                </Field>
              )}
            </>
          ) : null}
        </div>
        {desk === "dca" && !closing ? (
          <Group title="Maximum Exposure">
            <div className={rowClass}>
              <Field label="Max orders" required={averaging === "dip" && restGrid}>
                <GroupedNumberInput
                  value={maxClips}
                  onChange={setMaxClips}
                  className={
                    showFieldErrors && missing.maxClips
                      ? fieldInvalidClass
                      : fieldClass
                  }
                  placeholder="No cap"
                />
              </Field>
              <Field label="Max value">
                <AppSelect
                  value={maxValueMode}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (next === "none") {
                      setMaxValueMode("none");
                      setMaxValue("");
                      return;
                    }
                    setMaxValueMode(next as "usdt" | "percent" | "margin");
                    const amount = Number(maxValue.replace(/,/g, "").trim());
                    if (
                      (next === "percent" || next === "margin") &&
                      Number.isFinite(amount) &&
                      amount > 100
                    ) {
                      setMaxValue("");
                    }
                  }}
                  className={fieldClass}
                >
                  <option value="usdt">Fixed USDT</option>
                  <option value="percent">% of account</option>
                  <option value="margin">% of available margin</option>
                  <option value="none">No max value</option>
                </AppSelect>
              </Field>
              {maxValueMode !== "none" ? (
                <Field
                  label={
                    maxValueMode === "percent" || maxValueMode === "margin"
                      ? "Percent"
                      : "USDT"
                  }
                  required
                >
                  <GroupedNumberInput
                    value={maxValue}
                    onChange={setMaxValue}
                    allowDecimal
                    className={
                      showFieldErrors && missing.maxValue
                        ? fieldInvalidClass
                        : fieldClass
                    }
                    placeholder={
                      maxValueMode === "percent" || maxValueMode === "margin"
                        ? "e.g. 20"
                        : "e.g. 700"
                    }
                  />
                </Field>
              ) : null}
            </div>
          </Group>
        ) : null}
        </BotFormStep>

        {desk !== "cnc" ? (
        <>
        <BotFormStep
          shell="canvas"
          badge="Condition Builder"
          title={
            (desk === "flex" ? perpsDirection : direction) === "short"
              ? "Short Entry"
              : "Long Entry"
          }
        >
        {(() => {
          const lead = (
            <>
        <Group>
          <div className={rowClass}>
              <Field label="Condition Type" required>
                <AppSelect
                  value={startKind}
                  onChange={(event) =>
                    applyStartKind(event.target.value as StartKind)
                  }
                  className={
                    !closing && startKind === ""
                      ? `${fieldInvalidClass} !min-w-72`
                      : `${fieldClass} !min-w-72`
                  }
                >
                  {closing ? null : <option value="">Select Condition Type</option>}
                  {closing ? null : (
                    <option value="indicator">Indicator</option>
                  )}
                  {closing ? null : <option value="trend">Trend</option>}
                  <option
                    value="price"
                    disabled={entryKindDisabled({
                      slots: themeEntrySlots,
                      index: 0,
                      kind: "price",
                      webhookIds: ["sample"],
                    })}
                  >
                    Price Cross
                  </option>
                  <option value="retrace">Retrace</option>
                  <option
                    value="webhook"
                    disabled={entryKindDisabled({
                      slots: themeEntrySlots,
                      index: 0,
                      kind: "webhook",
                      webhookIds: ["sample"],
                    })}
                  >
                    Signal Webhook
                  </option>
                </AppSelect>
              </Field>
          </div>
        </Group>

        <Group>
          {startKind === "webhook" ? (
            <>
            <div className={rowClass5}>
              <Field
                label="Webhook"
                className="col-span-full"
                required
              >
                <AppSelect
                  className={
                    showFieldErrors && missing.webhookId
                      ? fieldInvalidClass
                      : fieldClass
                  }
                  value={webhookId}
                  onChange={(event) => setWebhookId(event.target.value)}
                >
                  <option value="">
                    Pick a webhook
                  </option>
                  <option
                    value="sample"
                    disabled={entryWebhookIdDisabled({
                      slots: themeEntrySlots,
                      index: 0,
                      webhookId: "sample",
                    })}
                  >
                    Sample signal
                  </option>
                </AppSelect>
              </Field>
            </div>
            </>
          ) : startKind === "indicator" && !closing ? (
              <div className={rowClass5}>
                <IndicatorStartFields
                  side={entrySide}
                  prefix="theme"
                  kind={indicatorKind}
                  timeframe={timeframe}
                  compare={when}
                  level={level}
                  period={period}
                  slowPeriod={slowPeriod}
                  multiplier={multiplier}
                  onKindChange={setIndicatorKind}
                  onTimeframeChange={setTimeframe}
                  onCompareChange={setWhen}
                  onLevelChange={setLevel}
                  onPeriodChange={setPeriod}
                  onSlowPeriodChange={setSlowPeriod}
                  onMultiplierChange={setMultiplier}
                  divergenceWhen={divergenceWhen}
                  divergenceStyle={divergenceStyle}
                  pivotBars={pivotBars}
                  span={divergenceSpan}
                  minPricePct={minPricePct}
                  minRsi={minRsi}
                  onDivergenceWhenChange={setDivergenceWhen}
                  onDivergenceStyleChange={setDivergenceStyle}
                  onPivotBarsChange={setPivotBars}
                  onSpanChange={setDivergenceSpan}
                  onMinPricePctChange={setMinPricePct}
                  onMinRsiChange={setMinRsi}
                  seriesSlots={themeEntrySlots}
                  seriesIndex={0}
                  showErrors={showFieldErrors}
                />
              </div>
          ) : startKind === "trend" && !closing ? (
              <div className={rowClass5}>
                <TrendStartFields
                  side={entrySide}
                  prefix="theme"
                  kind={indicatorKind || "supertrend"}
                  timeframe={timeframe}
                  compare={when}
                  period={period}
                  multiplier={multiplier}
                  onKindChange={setIndicatorKind}
                  onTimeframeChange={setTimeframe}
                  onCompareChange={setWhen}
                  onPeriodChange={setPeriod}
                  onMultiplierChange={setMultiplier}
                  seriesSlots={themeEntrySlots}
                  seriesIndex={0}
                  showErrors={showFieldErrors}
                />
              </div>
          ) : startKind === "retrace" ? (
            <div className={rowClass5}>
              <RetraceFields
                prefix="theme"
                draft={retrace}
                onChange={setRetrace}
                fieldClass={fieldClass}
                labelClass={labelClass}
                slots={themeEntrySlots}
                slotIndex={0}
                showErrors={showFieldErrors}
              />
            </div>
          ) : startKind === "price" ? (
            <div className={rowClass5}>
                <PriceTriggerFields
                  priceSource={priceSource}
                  onPriceSource={setPriceSource}
                  priceWhen={priceWhen}
                  onPriceWhen={setPriceWhen}
                  priceLevel={priceLevel}
                  onPriceLevel={setPriceLevel}
                  invalid={showFieldErrors && missing.priceLevel}
                  seriesSlots={themeEntrySlots}
                  seriesIndex={0}
                />
            </div>
          ) : null}
        </Group>
            </>
          );
          if (!closing && desk === "flex") {
            return (
              <EntryConditionStack
                grouped
                lead={lead}
                prefix="themeEntry"
                side={entrySide}
                rows={entryRows}
                onChange={setEntryRows}
                anchor={themeLongAnchor}
                webhooks={[{ id: "sample", name: "Sample signal" }]}
                gridClass={rowClass5}
                fieldClass={fieldClass}
                labelClass={labelClass}
                showErrors={showFieldErrors}
                optionalAddedKind
                groupFooter={perpsOrderFooter(
                  entryRows,
                  longExtraOrders,
                  true,
                  startKind !== "",
                )}
              />
            );
          }
          if (!closing && desk === "dca") {
            return (
              <EntryConditionStack
                grouped
                lead={lead}
                prefix="themeDcaEntry"
                side={entrySide}
                rows={entryRows}
                onChange={setEntryRows}
                anchor={themeLongAnchor}
                webhooks={[{ id: "sample", name: "Sample signal" }]}
                triggerTimeframe={
                  startKind === "indicator" || startKind === "trend"
                    ? timeframe
                    : null
                }
                gridClass={rowClass5}
                fieldClass={fieldClass}
                labelClass={labelClass}
                showErrors={showFieldErrors}
                optionalAddedKind
                groupFooter={dcaSizeFooter(
                  entryRows,
                  longExtraOrders,
                  true,
                  startKind !== "",
                )}
              />
            );
          }
          return (
            <>
              {lead}
              {!closing ? (
                <ThemeSecondaryEntry
                  side={entrySide}
                  prefix="themeConfirm"
                  spec={confirm}
                  onChange={setConfirm}
                  enabled={confirmOn}
                  onEnabled={setConfirmOn}
                  showErrors={showFieldErrors}
                />
              ) : null}
            </>
          );
        })()}
        </BotFormStep>

        {desk === "flex" && perpsDirection === "both" ? (
          <BotFormStep shell="canvas" badge="Condition Builder" title="Short Entry">
            {(() => {
              const lead = (
                <>
            <Group>
              <div className={rowClass}>
                <Field label="Condition Type" required>
                  <AppSelect
                    value={shortStartKind}
                    onChange={(event) =>
                      applyShortStartKind(event.target.value as StartKind)
                    }
                    className={
                      shortStartKind === ""
                        ? `${fieldInvalidClass} !min-w-72`
                        : `${fieldClass} !min-w-72`
                    }
                  >
                    <option value="">Select Condition Type</option>
                    <option value="indicator">Indicator</option>
                    <option value="trend">Trend</option>
                    <option
                      value="price"
                      disabled={entryKindDisabled({
                        slots: themeShortSlots,
                        index: 0,
                        kind: "price",
                        webhookIds: ["sample"],
                      })}
                    >
                      Price Cross
                    </option>
                    <option value="retrace">Retrace</option>
                    <option
                      value="webhook"
                      disabled={entryKindDisabled({
                        slots: themeShortSlots,
                        index: 0,
                        kind: "webhook",
                        webhookIds: ["sample"],
                      })}
                    >
                      Signal Webhook
                    </option>
                  </AppSelect>
                </Field>
              </div>
            </Group>
            <Group>
              {shortStartKind === "webhook" ? (
                <div className={rowClass5}>
                  <Field label="Webhook" className="col-span-full" required>
                    <AppSelect
                      value={shortWebhookId}
                      onChange={(event) => setShortWebhookId(event.target.value)}
                      className={
                        showFieldErrors && !filled(shortWebhookId)
                          ? fieldInvalidClass
                          : fieldClass
                      }
                    >
                      <option value="">Pick a webhook</option>
                      <option
                        value="sample"
                        disabled={entryWebhookIdDisabled({
                          slots: themeShortSlots,
                          index: 0,
                          webhookId: "sample",
                        })}
                      >
                        Sample signal
                      </option>
                    </AppSelect>
                  </Field>
                </div>
              ) : shortStartKind === "indicator" ? (
                <div className={rowClass5}>
                  <IndicatorStartFields
                    side="short"
                    prefix="themeShort"
                    kind={shortIndicatorKind}
                    timeframe={shortTimeframe}
                    compare={shortWhen}
                    level={shortLevel}
                    period={shortPeriod}
                    slowPeriod={shortSlowPeriod}
                    multiplier={shortMultiplier}
                    onKindChange={setShortIndicatorKind}
                    onTimeframeChange={setShortTimeframe}
                    onCompareChange={setShortWhen}
                    onLevelChange={setShortLevel}
                    onPeriodChange={setShortPeriod}
                    onSlowPeriodChange={setShortSlowPeriod}
                    onMultiplierChange={setShortMultiplier}
                    divergenceWhen={shortDivergenceWhen}
                    divergenceStyle={shortDivergenceStyle}
                    pivotBars={shortPivotBars}
                    span={shortDivergenceSpan}
                    minPricePct={shortMinPricePct}
                    minRsi={shortMinRsi}
                    onDivergenceWhenChange={setShortDivergenceWhen}
                    onDivergenceStyleChange={setShortDivergenceStyle}
                    onPivotBarsChange={setShortPivotBars}
                    onSpanChange={setShortDivergenceSpan}
                    onMinPricePctChange={setShortMinPricePct}
                    onMinRsiChange={setShortMinRsi}
                    seriesSlots={themeShortSlots}
                    seriesIndex={0}
                    showErrors={showFieldErrors}
                  />
                </div>
              ) : shortStartKind === "trend" ? (
                <div className={rowClass5}>
                  <TrendStartFields
                    side="short"
                    prefix="themeShort"
                    kind={shortIndicatorKind || "supertrend"}
                    timeframe={shortTimeframe}
                    compare={shortWhen}
                    period={shortPeriod}
                    multiplier={shortMultiplier}
                    onKindChange={setShortIndicatorKind}
                    onTimeframeChange={setShortTimeframe}
                    onCompareChange={setShortWhen}
                    onPeriodChange={setShortPeriod}
                    onMultiplierChange={setShortMultiplier}
                    seriesSlots={themeShortSlots}
                    seriesIndex={0}
                    showErrors={showFieldErrors}
                  />
                </div>
              ) : shortStartKind === "retrace" ? (
                <div className={rowClass5}>
                  <RetraceFields
                    prefix="themeShort"
                    draft={shortRetrace}
                    onChange={setShortRetrace}
                    fieldClass={fieldClass}
                    labelClass={labelClass}
                    slots={themeShortSlots}
                    slotIndex={0}
                    showErrors={showFieldErrors}
                  />
                </div>
              ) : shortStartKind === "price" ? (
                <div className={rowClass5}>
                  <PriceTriggerFields
                    priceSource={shortPriceSource}
                    onPriceSource={setShortPriceSource}
                    priceWhen={shortPriceWhen}
                    onPriceWhen={setShortPriceWhen}
                    priceLevel={shortPriceLevel}
                    onPriceLevel={setShortPriceLevel}
                    invalid={showFieldErrors && !filled(shortPriceLevel)}
                    seriesSlots={themeShortSlots}
                    seriesIndex={0}
                  />
                </div>
              ) : null}
            </Group>
                </>
              );
              return (
            <EntryConditionStack
              grouped
              lead={lead}
              prefix="themeShortEntry"
              side="short"
              rows={shortEntryRows}
              onChange={setShortEntryRows}
              anchor={themeShortAnchor}
              webhooks={[{ id: "sample", name: "Sample signal" }]}
              gridClass={rowClass5}
              fieldClass={fieldClass}
              labelClass={labelClass}
              showErrors={showFieldErrors}
              optionalAddedKind
              groupFooter={perpsOrderFooter(
                shortEntryRows,
                shortExtraOrders,
                false,
                shortStartKind !== "",
              )}
            />
              );
            })()}
          </BotFormStep>
        ) : null}

        {desk === "dca" && direction === "both" ? (
          <BotFormStep shell="canvas" badge="Condition Builder" title="Short Entry">
            {(() => {
              const lead = (
                <>
            <Group>
              <div className={rowClass}>
                <Field label="Condition Type" required>
                  <AppSelect
                    value={shortStartKind}
                    onChange={(event) =>
                      applyShortStartKind(event.target.value as StartKind)
                    }
                    className={
                      shortStartKind === ""
                        ? `${fieldInvalidClass} !min-w-72`
                        : `${fieldClass} !min-w-72`
                    }
                  >
                    <option value="">Select Condition Type</option>
                    <option value="indicator">Indicator</option>
                    <option value="trend">Trend</option>
                    <option
                      value="price"
                      disabled={entryKindDisabled({
                        slots: themeShortSlots,
                        index: 0,
                        kind: "price",
                        webhookIds: ["sample"],
                      })}
                    >
                      Price Cross
                    </option>
                    <option value="retrace">Retrace</option>
                    <option
                      value="webhook"
                      disabled={entryKindDisabled({
                        slots: themeShortSlots,
                        index: 0,
                        kind: "webhook",
                        webhookIds: ["sample"],
                      })}
                    >
                      Signal Webhook
                    </option>
                  </AppSelect>
                </Field>
              </div>
            </Group>
            <Group>
              {shortStartKind === "webhook" ? (
                <div className={rowClass5}>
                  <Field label="Webhook" className="col-span-full" required>
                    <AppSelect
                      value={shortWebhookId}
                      onChange={(event) => setShortWebhookId(event.target.value)}
                      className={
                        showFieldErrors && !filled(shortWebhookId)
                          ? fieldInvalidClass
                          : fieldClass
                      }
                    >
                      <option value="">Pick a webhook</option>
                      <option
                        value="sample"
                        disabled={entryWebhookIdDisabled({
                          slots: themeShortSlots,
                          index: 0,
                          webhookId: "sample",
                        })}
                      >
                        Sample signal
                      </option>
                    </AppSelect>
                  </Field>
                </div>
              ) : shortStartKind === "indicator" ? (
                <div className={rowClass5}>
                  <IndicatorStartFields
                    side="short"
                    prefix="themeShort"
                    kind={shortIndicatorKind}
                    timeframe={shortTimeframe}
                    compare={shortWhen}
                    level={shortLevel}
                    period={shortPeriod}
                    slowPeriod={shortSlowPeriod}
                    multiplier={shortMultiplier}
                    onKindChange={setShortIndicatorKind}
                    onTimeframeChange={setShortTimeframe}
                    onCompareChange={setShortWhen}
                    onLevelChange={setShortLevel}
                    onPeriodChange={setShortPeriod}
                    onSlowPeriodChange={setShortSlowPeriod}
                    onMultiplierChange={setShortMultiplier}
                    divergenceWhen={shortDivergenceWhen}
                    divergenceStyle={shortDivergenceStyle}
                    pivotBars={shortPivotBars}
                    span={shortDivergenceSpan}
                    minPricePct={shortMinPricePct}
                    minRsi={shortMinRsi}
                    onDivergenceWhenChange={setShortDivergenceWhen}
                    onDivergenceStyleChange={setShortDivergenceStyle}
                    onPivotBarsChange={setShortPivotBars}
                    onSpanChange={setShortDivergenceSpan}
                    onMinPricePctChange={setShortMinPricePct}
                    onMinRsiChange={setShortMinRsi}
                    seriesSlots={themeShortSlots}
                    seriesIndex={0}
                    showErrors={showFieldErrors}
                  />
                </div>
              ) : shortStartKind === "trend" ? (
                <div className={rowClass5}>
                  <TrendStartFields
                    side="short"
                    prefix="themeShort"
                    kind={shortIndicatorKind || "supertrend"}
                    timeframe={shortTimeframe}
                    compare={shortWhen}
                    period={shortPeriod}
                    multiplier={shortMultiplier}
                    onKindChange={setShortIndicatorKind}
                    onTimeframeChange={setShortTimeframe}
                    onCompareChange={setShortWhen}
                    onPeriodChange={setShortPeriod}
                    onMultiplierChange={setShortMultiplier}
                    seriesSlots={themeShortSlots}
                    seriesIndex={0}
                    showErrors={showFieldErrors}
                  />
                </div>
              ) : shortStartKind === "retrace" ? (
                <div className={rowClass5}>
                  <RetraceFields
                    prefix="themeShort"
                    draft={shortRetrace}
                    onChange={setShortRetrace}
                    fieldClass={fieldClass}
                    labelClass={labelClass}
                    slots={themeShortSlots}
                    slotIndex={0}
                    showErrors={showFieldErrors}
                  />
                </div>
              ) : shortStartKind === "price" ? (
                <div className={rowClass5}>
                  <PriceTriggerFields
                    priceSource={shortPriceSource}
                    onPriceSource={setShortPriceSource}
                    priceWhen={shortPriceWhen}
                    onPriceWhen={setShortPriceWhen}
                    priceLevel={shortPriceLevel}
                    onPriceLevel={setShortPriceLevel}
                    invalid={showFieldErrors && missing.shortPriceLevel}
                    seriesSlots={themeShortSlots}
                    seriesIndex={0}
                  />
                </div>
              ) : null}
            </Group>
                </>
              );
              return (
            <EntryConditionStack
              grouped
              lead={lead}
              prefix="themeDcaShortEntry"
              side="short"
              rows={shortEntryRows}
              onChange={setShortEntryRows}
              anchor={themeShortAnchor}
              webhooks={[{ id: "sample", name: "Sample signal" }]}
              triggerTimeframe={
                shortStartKind === "indicator" || shortStartKind === "trend"
                  ? shortTimeframe
                  : null
              }
              gridClass={rowClass5}
              fieldClass={fieldClass}
              labelClass={labelClass}
              showErrors={showFieldErrors}
              optionalAddedKind
              groupFooter={dcaSizeFooter(
                shortEntryRows,
                shortExtraOrders,
                false,
                shortStartKind !== "",
              )}
            />
              );
            })()}
          </BotFormStep>
        ) : null}

        {desk === "dca" ? (
        <>
        <BotFormStep title="Additional Orders">
        <Group
          title="Additional Order Types"
          hint="This method applies to every add after the first fill. The step next to Spacing is the first add; later adds use the same method."
        >
          <div className={rowClass5}>
            <Field label="Averaging" className="lg:col-span-2" required>
              <AppSelect
                className={fieldClass}
                value={averaging}
                onChange={(event) =>
                  setAveraging(event.target.value as "dip" | "interval")
                }
              >
                <option value="dip">Add on price deviation</option>
                <option value="interval">Add on interval</option>
              </AppSelect>
            </Field>
            {averaging === "dip" ? (
              <Field
                label="Spacing"
                hint="Percentage or ATR. Used for every add, not only the first."
                required
              >
                <AppSelect
                  className={fieldClass}
                  value={spacingKind}
                  onChange={(event) =>
                    setSpacingKind(
                      event.target.value === "atr" ? "atr" : "percent",
                    )
                  }
                >
                  <option value="percent">Percentage</option>
                  <option value="atr">ATR</option>
                </AppSelect>
              </Field>
            ) : null}
            {averaging === "dip" && spacingKind === "percent" ? (
              <Field
                label="Initial Price Deviation"
                hint="Distance from the previous fill for the first add. Later adds use this times Price deviation multiplier."
                required
              >
                <span className="relative mt-1 block">
                  <GroupedNumberInput
                    value={dipPct}
                    onChange={setDipPct}
                    allowDecimal
                    className={`${
                      showFieldErrors && missing.dipPct
                        ? fieldInvalidClass
                        : fieldClass
                    } mt-0 pr-7`}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-muted">
                    %
                  </span>
                </span>
              </Field>
            ) : null}
            {averaging === "dip" && spacingKind === "atr" ? (
              <>
                <Field label="ATR period" required>
                  <GroupedNumberInput
                    value={atrPeriod}
                    onChange={setAtrPeriod}
                    className={
                      showFieldErrors && missing.atrPeriod
                        ? fieldInvalidClass
                        : fieldClass
                    }
                  />
                </Field>
                <Field
                  label="ATR spacing"
                  hint="First-add distance in ATR multiples. Later adds use this times Price deviation multiplier."
                  required
                >
                  <GroupedNumberInput
                    value={atrSpacing}
                    onChange={setAtrSpacing}
                    allowDecimal
                    className={
                      showFieldErrors && missing.atrSpacing
                        ? fieldInvalidClass
                        : fieldClass
                    }
                  />
                </Field>
              </>
            ) : null}
            {averaging === "interval" ? (
              <div className="col-span-2">
                <p className={labelClass}>
                  <HintLabel text="Add every" required />
                </p>
                <div className="grid grid-cols-[minmax(8.5rem,1.4fr)_minmax(5rem,0.8fr)] gap-2">
                  <AppSelect
                    className={fieldClass}
                    value={intervalUnit}
                    onChange={(event) =>
                      setIntervalUnit(
                        event.target.value as "minutes" | "hours" | "days",
                      )
                    }
                    aria-label="Interval unit"
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </AppSelect>
                  <GroupedNumberInput
                    value={intervalValue}
                    onChange={setIntervalValue}
                    className={
                      showFieldErrors && missing.intervalValue
                        ? fieldInvalidClass
                        : fieldClass
                    }
                    placeholder={intervalUnit === "minutes" ? "15" : "1"}
                  />
                </div>
              </div>
            ) : null}
            {averaging === "dip" ? (
              <Field
                label="Order"
                hint="Limit rests remaining adds as GTC. Market fills them when the add triggers."
                required
              >
                <OrderTypePill
                  value={restGrid ? "limit" : "market"}
                  onChange={(next) => setRestGrid(next === "limit")}
                />
              </Field>
            ) : null}
          </div>
        </Group>
        <Group
          title="Additional Order Scaling"
          hint="How size and distance grow after the first add. 1 keeps later adds the same as the first add."
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs text-ink"
                onClick={() => {
                  setSizeMultiplier("1");
                  setDeviationMultiplier("1");
                }}
              >
                Equal orders
              </button>
              <button
                type="button"
                className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs text-ink"
                onClick={() => {
                  setSizeMultiplier("2");
                  setDeviationMultiplier("1.5");
                }}
              >
                Martingale
              </button>
            </div>
            <Field
              label="Order size multiplier"
              hint="1 keeps every clip the same size. 1.5 means each later clip is 1.5× the last."
              className="min-w-40 flex-1"
              required
            >
              <GroupedNumberInput
                value={sizeMultiplier}
                onChange={setSizeMultiplier}
                allowDecimal
                className={fieldClass}
              />
            </Field>
            <Field
              label="Price deviation multiplier"
              hint="1 keeps every add the same distance. Above 1 widens each later step. Does not replace Initial Price Deviation or ATR spacing."
              className="min-w-40 flex-1"
              required
            >
              <GroupedNumberInput
                value={deviationMultiplier}
                onChange={setDeviationMultiplier}
                allowDecimal
                className={fieldClass}
              />
            </Field>
          </div>
        </Group>
        </BotFormStep>
        <BotFormStep
          title="Additional order conditions"
          badge="Condition Builder"
          shell="canvas"
          hint="Optional. The ladder still places the add. These have to be true on the same check."
        >
          <EntryConditionStack
            grouped
            prefix="themeAdd"
            side={entrySide}
            rows={addRows}
            onChange={setAddRows}
            anchor={{ kind: "indicator", webhookId: null, claim: null }}
            gridClass={rowClass5}
            fieldClass={fieldClass}
            labelClass={labelClass}
            showErrors={showFieldErrors}
            optionalAddedKind
            kinds={["retrace", "indicator"]}
          />
          {direction === "both" ? (
            <EntryConditionStack
              grouped
              prefix="themeShortAdd"
              side="short"
              rows={shortAddRows}
              onChange={setShortAddRows}
              anchor={{ kind: "indicator", webhookId: null, claim: null }}
              gridClass={rowClass5}
              fieldClass={fieldClass}
              labelClass={labelClass}
              showErrors={showFieldErrors}
              optionalAddedKind
              kinds={["retrace", "indicator"]}
            />
          ) : null}
        </BotFormStep>
        </>
        ) : desk === "flex" && !closing ? (
          <>
            {perpsDirection !== "short" ? (
              <BotFormStep shell="canvas" badge="Condition Builder" title="Long Additional Orders">
                <PerpsAdditionalOrders
                  groups={longAddGroups}
                  onGroupsChange={setLongAddGroups}
                  quoteLabel="USDT"
                  baseCoin={
                    SAMPLE_PAIRS.find((pair) => pair.symbol === symbol)?.baseCoin ??
                    "BTC"
                  }
                  fieldClass={fieldClass}
                  gridClass={rowClass}
                  fieldsClass={rowClass5}
                  side="long"
                  webhooks={themeWebhooks}
                  showErrors={showFieldErrors}
                  invalidFieldClass={fieldInvalidClass}
                />
              </BotFormStep>
            ) : null}
            {perpsDirection === "short" || perpsDirection === "both" ? (
              <BotFormStep shell="canvas" badge="Condition Builder" title="Short Additional Orders">
                <PerpsAdditionalOrders
                  groups={shortAddGroups}
                  onGroupsChange={setShortAddGroups}
                  quoteLabel="USDT"
                  baseCoin={
                    SAMPLE_PAIRS.find((pair) => pair.symbol === symbol)?.baseCoin ??
                    "BTC"
                  }
                  fieldClass={fieldClass}
                  gridClass={rowClass}
                  fieldsClass={rowClass5}
                  side="short"
                  webhooks={themeWebhooks}
                  showErrors={showFieldErrors}
                  invalidFieldClass={fieldInvalidClass}
                />
              </BotFormStep>
            ) : null}
          </>
        ) : null}

        {(desk === "flex" ? perpsDirection !== "short" : direction !== "short") ? (
          <BotFormStep shell="canvas" badge="Condition Builder" title="Long Exit">
            <ExitSideBuilder
              clauses={exitClauses}
              onChange={(next) => commitThemeExit(next, "primary")}
              side="long"
              prefix="themeExitIf"
              named={false}
              webhooks={themeWebhooks}
              fieldClass={fieldClass}
              labelClass={labelClass}
              showErrors={showFieldErrors}
              priceStyle={desk === "dca" ? "dca" : "flex"}
              renderTakeProfit={(slot) => themeTakeProfitFields("primary", slot)}
              renderTrailingStop={(slot) => themeTrailingFields("primary", slot)}
              renderStopLoss={(slot) => themeStopFields("primary", slot)}
              renderBreakeven={(slot) => themeBreakevenFields("primary", slot)}
            />
          </BotFormStep>
        ) : null}
        {(desk === "flex"
          ? perpsDirection === "short" || perpsDirection === "both"
          : direction === "short" || direction === "both") ? (
          <BotFormStep shell="canvas" badge="Condition Builder" title="Short Exit">
            <ExitSideBuilder
              clauses={
                (desk === "flex" ? perpsDirection === "both" : direction === "both")
                  ? shortClauses
                  : exitClauses
              }
              onChange={(next) =>
                commitThemeExit(
                  next,
                  (desk === "flex" ? perpsDirection === "both" : direction === "both")
                    ? "short"
                    : "primary",
                )
              }
              side="short"
              prefix="themeShortExitIf"
              named={false}
              webhooks={themeWebhooks}
              fieldClass={fieldClass}
              labelClass={labelClass}
              showErrors={showFieldErrors}
              priceStyle={desk === "dca" ? "dca" : "flex"}
              renderTakeProfit={(slot) =>
                themeTakeProfitFields(themeBothExits ? "short" : "primary", slot)
              }
              renderTrailingStop={(slot) =>
                themeTrailingFields(themeBothExits ? "short" : "primary", slot)
              }
              renderStopLoss={(slot) =>
                themeStopFields(themeBothExits ? "short" : "primary", slot)
              }
              renderBreakeven={(slot) =>
                themeBreakevenFields(themeBothExits ? "short" : "primary", slot)
              }
            />
          </BotFormStep>
        ) : null}
        </>
        ) : (
          <>
            <BotFormStep title="Entry Conditions" hint="All conditions must be true.">
              <div className={rowClass}>
                <Field label="Min APR %">
                  <OffNumber value={minApr} onChange={setMinApr} />
                </Field>
                <Field label="Min DTE">
                  <OffNumber
                    value={minDte}
                    onChange={setMinDte}
                    allowDecimal={false}
                  />
                </Field>
                <Field label="Max DTE">
                  <OffNumber
                    value={maxDte}
                    onChange={setMaxDte}
                    allowDecimal={false}
                  />
                </Field>
              </div>
            </BotFormStep>

            <BotFormStep title="Position Sizing">
            <Group title="Position and Orders">
              <div className={rowClass}>
                <Field label="Max Position Size">
                  <OffNumber
                    value={maxOpenNotional}
                    onChange={setMaxOpenNotional}
                  />
                </Field>
                <Field label="Max pairs" required>
                  <GroupedNumberInput
                    value={maxOpenCount}
                    onChange={setMaxOpenCount}
                    className={
                      showFieldErrors && missing.maxOpenCount
                        ? fieldInvalidClass
                        : fieldClass
                    }
                  />
                </Field>
                <Field label="Order Type" required>
                  <AppSelect
                    value={carrySizeType}
                    onChange={(event) =>
                      setCarrySizeType(
                        event.target.value === "fixed" ? "fixed" : "dynamic",
                      )
                    }
                    className={fieldClass}
                  >
                    <option value="dynamic">Dynamic (scale in)</option>
                    <option value="fixed">Fixed</option>
                  </AppSelect>
                </Field>
                {carrySizeType === "fixed" ? (
                  <>
                    <Field label="Order size (USDT)" required>
                      <GroupedNumberInput
                        value={orderSizeUsdt}
                        onChange={setOrderSizeUsdt}
                        allowDecimal
                        className={
                          showFieldErrors && missing.orderSizeUsdt
                            ? fieldInvalidClass
                            : fieldClass
                        }
                      />
                    </Field>
                    <Field label="Min usable book">
                      <OffNumber
                        value={minCapacity}
                        onChange={setMinCapacity}
                      />
                    </Field>
                  </>
                ) : null}
                {carrySizeType === "dynamic" || exitSizeType === "dynamic" ? (
                  <Field label="Min Order Size">
                    <OffNumber
                      value={minOrderSize}
                      onChange={setMinOrderSize}
                    />
                  </Field>
                ) : null}
              </div>
            </Group>
            </BotFormStep>

            <BotFormStep title="Exit Conditions" hint="Any condition can be true.">
            <Group title="Exit" hint="Any condition can be true.">
              <div className={rowClass}>
                <Field label="DTE ≤">
                  <OffNumber
                    value={closeMaxDte}
                    onChange={setCloseMaxDte}
                    allowDecimal={false}
                  />
                </Field>
                <Field label="APR % below">
                  <OffNumber value={closeMinApr} onChange={setCloseMinApr} />
                </Field>
                <Field label="Order Type" required>
                  <AppSelect
                    value={exitSizeType}
                    onChange={(event) =>
                      setExitSizeType(
                        event.target.value === "fixed" ? "fixed" : "dynamic",
                      )
                    }
                    className={fieldClass}
                  >
                    <option value="dynamic">Dynamic (scale out)</option>
                    <option value="fixed">Fixed (entire position)</option>
                  </AppSelect>
                </Field>
              </div>
            </Group>
            </BotFormStep>
          </>
        )}

      </BotFormCard>
      <BotFormSidebar
        status={
          <BotStatusField
            desk={desk}
            name="themeStatus"
            value={status}
            applied={appliedStatus}
            onChange={setStatus}
          />
        }
        dirty={persisted && dirty}
        error={hasMissing ? completeRequiredNotice : undefined}
        save={
          <button
            type="button"
            className={botSidebarSaveClass}
            disabled={!dirty || hasMissing}
            title={hasMissing ? completeRequiredNotice : undefined}
            onClick={saveDraft}
          >
            <span className="inline-flex items-center gap-1.5">
              <IconSave {...botBtnIcon} />
              Save
            </span>
          </button>
        }
      >
        <BotFormSidebarSection title="Templates">
          <button type="button" className={botSidebarActionClass}>
            <BotButtonLead icon={<IconTemplates {...botBtnIcon} />}>
              Save as template
            </BotButtonLead>
          </button>
        </BotFormSidebarSection>
        {desk !== "cnc" ? (
          <BotFormSidebarSection
            title="Backtesting"
            titleAside={
              <FreeTrialBadge message="Backtesting is in a free trial until 28/10/2026." />
            }
          >
            <button type="button" className={botSidebarActionClass}>
              <BotButtonLead icon={<IconBacktest {...botBtnIcon} />}>
                Backtest
              </BotButtonLead>
            </button>
            <PreviousBacktestLink
              href="/account/backtests/sample"
              name="DCA Test · results"
            />
          </BotFormSidebarSection>
        ) : null}
      </BotFormSidebar>
      </BotFormColumns>
      {desk === "dca" ? (
        <ThemeDcaSummary
          bothSides={bothSides}
          ladderOpen={ladderOpen}
          onLadderOpen={setLadderOpen}
          ladderTab={ladderTab}
          onLadderTab={setLadderTab}
        />
      ) : null}

      <ThemeBotFormReference />
    </div>
  );
}

function ThemeDcaSummary({
  bothSides,
  ladderOpen,
  onLadderOpen,
  ladderTab,
  onLadderTab,
}: {
  bothSides: boolean;
  ladderOpen: boolean;
  onLadderOpen: (next: boolean) => void;
  ladderTab: "long" | "short";
  onLadderTab: (next: "long" | "short") => void;
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
        aria-expanded={ladderOpen}
        onClick={() => onLadderOpen(!ladderOpen)}
      >
        {ladderOpen ? "Hide Summary" : "Show Summary"}
        <ChevronIcon className={ladderOpen ? "rotate-90" : undefined} />
      </button>
      {ladderOpen ? (
        <BotFormSummaryCard className="space-y-3">
          <h3 className={sectionTitleClass}>Summary</h3>
          <div
            className={
              bothSides
                ? "mb-3 flex items-end justify-between gap-3 border-b border-line"
                : "mb-2"
            }
          >
            {bothSides ? (
              <div
                role="tablist"
                aria-label="Ladder side"
                className="flex gap-1"
              >
                <TabButton
                  selected={ladderTab === "long"}
                  panelId="theme-draft-ladder"
                  onClick={() => onLadderTab("long")}
                >
                  Long ladder
                </TabButton>
                <TabButton
                  selected={ladderTab === "short"}
                  panelId="theme-draft-ladder"
                  onClick={() => onLadderTab("short")}
                >
                  Short ladder
                </TabButton>
              </div>
            ) : null}
            <p
              className={`text-hint text-ink-muted ${
                bothSides ? "pb-2 text-right" : ""
              }`}
            >
              Summary is based on the current asset price and the parameters
              configured above
            </p>
          </div>
          <div
            role={bothSides ? "tabpanel" : undefined}
            id={bothSides ? "theme-draft-ladder" : undefined}
            className="flex flex-wrap"
          >
            <DraftStat
              label="Covered Range"
              value="4.2%"
              hint="First fill to last clip"
            />
            <DraftStat
              label="Max Exposure"
              value="$1,200"
              hint={
                bothSides
                  ? "Full ladder notional · This side only"
                  : "Full ladder notional"
              }
            />
            <DraftStat
              label="Initial Margin"
              value="$120"
              hint="Max exposure ÷ 10×"
            />
            <DraftStat
              label="Profit range"
              value="∞"
              hint="No take profit — unlimited"
              valueClass="text-success"
            />
            <DraftStat
              label="Loss range"
              value="∞"
              hint="No stop loss — unlimited"
              valueClass="text-danger"
            />
          </div>
        </BotFormSummaryCard>
      ) : null}
    </div>
  );
}

function ThemeBotFormReference() {
  return (
    <div className="space-y-5 rounded-card border border-line bg-surface px-5 py-5">
      <div>
        <h3 className={sectionTitleClass}>Reference</h3>
        <p className="mt-1 text-sm text-ink-muted">
          States and chrome that are not on the sample bot above. Nothing
          here is live.
        </p>
      </div>

      <div className="space-y-2">
        <p className={labelClass}>Empty desk</p>
        <p className="text-sm text-ink-muted">
          Empty list keeps the table headers. The message sits in one spanning
          row, same as every other Theme table.
        </p>
      </div>

      <div className="space-y-2">
        <p className={labelClass}>Flex statuses</p>
        <p className="text-hint text-ink-muted">
          Own list. Do not mix with DCA.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <StatusLight fill="bg-success" label="Active" />
          <StatusLight fill="bg-warning" label="Reduce only" />
          <StatusLight fill="bg-ink-faint" label="Disabled" />
          <StatusLight fill="bg-success" label="In use (open position)" inUse />
        </div>
      </div>

      <div className="space-y-2">
        <p className={labelClass}>C&C statuses</p>
        <p className="text-hint text-ink-muted">
          Same three as Flex. Reduce only is not DCA Stop adding.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <StatusLight fill="bg-success" label="Active" />
          <StatusLight fill="bg-warning" label="Reduce only" />
          <StatusLight fill="bg-ink-faint" label="Disabled" />
          <StatusLight fill="bg-success" label="In use (open position)" inUse />
        </div>
      </div>

      <div className="space-y-2">
        <p className={labelClass}>DCA statuses</p>
        <p className="text-hint text-ink-muted">
          Own list. Stop adding is not Reduce only. Save and Arm / Arm /
          Disarm / Close bot become Status + Save.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <StatusLight fill="bg-success" label="Active" />
          <StatusLight fill="bg-warning" label="Stop adding" />
          <StatusLight fill="bg-ink-faint" label="Disabled" />
          <StatusLight fill="bg-success" label="In use (open position)" inUse />
        </div>
      </div>

      <div className="space-y-2">
        <p className={labelClass}>Current DCA buttons (replaced by the dropdown)</p>
        <p className="text-hint text-ink-muted">
          Replaced. Pick the status, then Save. Save and Arm is Active +
          Save. Close bot is Disabled + Save.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={headerLongClass}>
            Save and Arm
          </button>
          <button type="button" className={headerSecondaryClass}>
            Arm
          </button>
          <button
            type="button"
            className={headerPrimaryClass}
            title="Stop adding any new orders (also cancels any existing entry limit orders)"
          >
            Stop adding
          </button>
          <button
            type="button"
            className={headerPrimaryClass}
            title="Stop listening for new entries"
          >
            Disarm
          </button>
          <button
            type="button"
            className={headerPrimaryClass}
            title="Replaced by Status Disabled. Save then closes the bot’s positions."
          >
            Close bot
          </button>
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
        </div>
      </div>

      <div className="space-y-2">
        <p className={labelClass}>Flashes and locks</p>
        <p className="rounded-card border border-success/30 bg-success/10 px-4 py-3 text-sm text-success" role="status">
          Saved.
        </p>
        <DraftCallout tone="danger">
          Could not save. Sample error flash.
        </DraftCallout>
        <DraftCallout tone="warning">
          Size is above the desk max. Save is blocked.
        </DraftCallout>
        <DraftCallout tone="warning">
          Reduce only is on. New orders stay blocked until you turn it off in
          Desk Settings. Take profit and stop still run.
        </DraftCallout>
        <p className="text-xs text-warning">
          A position is open. Cycle settings are locked. Take profit and stops
          still save.
        </p>
      </div>

      <div className="space-y-3">
        <p className={labelClass}>DCA summary / ladder</p>
        <p className="text-hint text-ink-muted">
          Same block as the sample DCA card. Show / Hide when the bot is
          running. Long / Short tabs only when Direction is Both.
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
        >
          Hide Summary
          <ChevronIcon className="rotate-90" />
        </button>
        <div className="flex items-end justify-between gap-3 border-b border-line">
          <div
            role="tablist"
            aria-label="Ladder side"
            className="flex gap-1"
          >
            <TabButton
              selected={true}
              panelId="theme-ref-ladder"
              onClick={() => undefined}
            >
              Long ladder
            </TabButton>
            <TabButton
              selected={false}
              panelId="theme-ref-ladder"
              onClick={() => undefined}
            >
              Short ladder
            </TabButton>
          </div>
          <p className="pb-2 text-right text-hint text-ink-muted">
            Summary is based on the current asset price and the parameters
            configured above
          </p>
        </div>
        <div id="theme-ref-ladder" role="tabpanel" className="flex flex-wrap">
          <DraftStat
            label="Covered Range"
            value="4.2%"
            hint="First fill to last clip"
          />
          <DraftStat
            label="Max Exposure"
            value="$1,200"
            hint="Full ladder notional · This side only"
          />
          <DraftStat
            label="Initial Margin"
            value="$120"
            hint="Max exposure ÷ 10×"
          />
        </div>
      </div>
    </div>
  );
}

function ExitMethodFields({
  method,
  onMethod,
  value,
  onValue,
  basis,
  onBasis,
  orderType,
  onOrderType,
  atrPeriod,
  onAtrPeriod,
  atrPeriodInvalid = false,
  invalid = false,
}: {
  method: ExitMethod;
  onMethod: (next: ExitMethod) => void;
  value: string;
  onValue: (next: string) => void;
  basis: string;
  onBasis: (next: string) => void;
  orderType: string;
  onOrderType: (next: string) => void;
  atrPeriod: string;
  onAtrPeriod: (next: string) => void;
  atrPeriodInvalid?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className="contents">
      <Field label="Basis" required>
        <AppSelect
          className={fieldClass}
          value={basis}
          onChange={(event) => onBasis(event.target.value)}
        >
          <option value="average">Average entry</option>
          <option value="first_entry">First fill</option>
        </AppSelect>
      </Field>
      <Field label="Method" required>
        <AppSelect
          value={method === "atr" ? "atr" : "percent"}
          onChange={(event) => {
            const next = event.target.value === "atr" ? "atr" : "percent";
            onMethod(next);
            if (next === "atr" && !filled(value)) {
              onValue("2");
            }
          }}
          className={fieldClass}
        >
          <option value="percent">Percentage</option>
          <option value="atr">ATR × multiplier</option>
        </AppSelect>
      </Field>
      {method === "atr" ? (
        <>
          <Field label="ATR period" required>
            <GroupedNumberInput
              value={atrPeriod}
              onChange={onAtrPeriod}
              className={atrPeriodInvalid ? fieldInvalidClass : fieldClass}
            />
          </Field>
          <Field label="ATR multiple" required>
            <OffNumber
              value={value}
              onChange={onValue}
              required
              invalid={invalid}
            />
          </Field>
        </>
      ) : (
        <Field label="Target %" required>
          <PercentField
            value={value}
            onChange={onValue}
            required
            invalid={invalid}
          />
        </Field>
      )}
      <Field label="Order type" required>
        <OrderTypePill
          value={orderType === "limit" ? "limit" : "market"}
          onChange={onOrderType}
        />
      </Field>
    </div>
  );
}
