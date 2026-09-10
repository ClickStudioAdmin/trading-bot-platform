"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ColumnHint } from "@/components/column-hint";
import { DcaFilterBlock } from "@/components/dca-filter-fields";
import { FuturesSymbolSelect } from "@/components/futures-symbol-select";
import { ChevronIcon, TabButton } from "@/components/trade-expand";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import {
  dcaFilterSpecForKind,
  type DcaFilterSpec,
} from "@/lib/dca/filters";
import {
  DCA_INDICATOR_KIND_OPTIONS,
  DCA_INDICATOR_TIMEFRAME_LABELS,
  DCA_INDICATOR_TIMEFRAMES,
  DEFAULT_DCA_RSI_PERIOD,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DEFAULT_DCA_SUPERTREND_PERIOD,
  dcaIndicatorShowsLevel,
  dcaIndicatorUsesPairPeriods,
  dcaIndicatorUsesPeriod,
  dcaIndicatorWhenOptions,
  defaultDcaIndicatorLevel,
  defaultDcaIndicatorPeriod,
  defaultDcaIndicatorSlowPeriod,
  oppositeIndicatorCompare,
  oppositeRsiLevel,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";

const fieldClass =
  "mt-1 w-full rounded-control border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
const fieldInvalidClass =
  "mt-1 w-full rounded-control border border-danger bg-surface-raised px-3 py-2 text-sm text-ink focus:border-danger focus:outline-none";
const labelClass = "block text-xs text-ink-muted";
const sectionTitleClass =
  "text-xs font-semibold uppercase tracking-[0.1em] text-ink";
const rowClass = "grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-4";
const rowClass5 = "grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-5";
const headerBtnClass = "rounded-control px-3 py-1.5 text-xs font-medium";
const headerPrimaryClass = `${headerBtnClass} bg-accent-strong text-ink hover:bg-accent`;
const headerSecondaryClass = `${headerBtnClass} border border-line bg-surface text-ink hover:bg-surface-raised`;
const headerLongClass = `${headerBtnClass} bg-success text-canvas`;
const headerGhostClass =
  "shrink-0 rounded-control px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink";
const headerRemoveClass =
  "shrink-0 rounded-control border border-line px-2 py-0.5 text-xs text-danger hover:bg-danger/10";
const deskBtnClass =
  "rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong";

type DeskKind = "perps" | "dca" | "cnc";

const SAMPLE_PAIRS: LinearPerp[] = [
  {
    symbol: "BTCUSDT",
    baseCoin: "BTC",
    quoteCoin: "USDT",
    minQty: 0.001,
    maxQty: 100,
    maxMktQty: 100,
    minNotional: 5,
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
    minPrice: 0.01,
    tickSize: 0.01,
  },
];

const PERPS_STATUS_OPTIONS = [
  {
    value: "active",
    label: "Active",
    fill: "bg-success",
    note: "Save turns this bot on. It may open and add. Existing rows stay.",
  },
  {
    value: "reduce_only",
    label: "Reduce only",
    fill: "bg-warning",
    note: "Save stops new opens and adds. Exits still run. Existing rows stay.",
  },
  {
    value: "disabled",
    label: "Disabled",
    fill: "bg-ink-faint",
    note: "Save closes every position this bot owns and turns it off.",
  },
] as const;

const DCA_STATUS_OPTIONS = [
  {
    value: "active",
    label: "Active",
    fill: "bg-success",
    note: "Save turns this bot on. It listens for entries. Existing clips stay.",
  },
  {
    value: "stop_adding",
    label: "Stop adding",
    fill: "bg-warning",
    note: "Save stops new clips. Exits still run. Existing clips stay.",
  },
  {
    value: "disabled",
    label: "Disabled",
    fill: "bg-ink-faint",
    note: "Save closes every position this bot owns and turns it off.",
  },
] as const;

const CNC_STATUS_OPTIONS = [
  {
    value: "active",
    label: "Active",
    fill: "bg-success",
    note: "Save turns this bot on. It may open and add carries. Existing rows stay.",
  },
  {
    value: "reduce_only",
    label: "Reduce only",
    fill: "bg-warning",
    note: "Save stops new opens and adds. Exits still run. Existing carries stay.",
  },
  {
    value: "disabled",
    label: "Disabled",
    fill: "bg-ink-faint",
    note: "Save closes every carry this bot owns and turns it off.",
  },
] as const;

function statusOptionsFor(desk: DeskKind) {
  if (desk === "dca") {
    return DCA_STATUS_OPTIONS;
  }
  if (desk === "cnc") {
    return CNC_STATUS_OPTIONS;
  }
  return PERPS_STATUS_OPTIONS;
}

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
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 flex-1 basis-36 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

function EnableCheck({ checked }: { checked: boolean }) {
  return (
    <span
      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] border ${
        checked
          ? "border-accent bg-accent text-canvas"
          : "border-line-strong bg-surface-raised"
      }`}
      aria-hidden
    >
      {checked ? (
        <svg viewBox="0 0 12 12" className="size-3 fill-none stroke-current stroke-[1.8]">
          <path d="M2 6.2 4.6 9 10 3" />
        </svg>
      ) : null}
    </span>
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
  children,
}: {
  title: string;
  hint?: string;
  enabled: boolean;
  onEnabled: (next: boolean) => void;
  nested?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`col-span-full block w-full min-w-0 ${
        nested ? "space-y-3" : "space-y-3 py-5"
      }`}
    >
      <div className="flex items-center gap-3">
        <label className="inline-flex shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabled(event.target.checked)}
            className="sr-only"
            aria-label={title}
          />
          <EnableCheck checked={enabled} />
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
    <section className="col-span-full block w-full min-w-0 space-y-3 py-5">
      {title ? (
        <h3 className={sectionTitleClass}>
          <HintLabel text={title} hint={hint} />
        </h3>
      ) : null}
      {children}
    </section>
  );
}

const EXIT_METHODS = [
  { value: "", label: "Off" },
  { value: "price", label: "Price" },
  { value: "percent", label: "Percentage" },
  { value: "atr", label: "ATR × multiplier" },
] as const;

type ExitMethod = (typeof EXIT_METHODS)[number]["value"];
type StartKind = "price" | "indicator" | "trend" | "webhook";
type Action = "buy" | "sell" | "close_long" | "close_short";

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

function dcaFilterComplete(spec: DcaFilterSpec | null): boolean {
  if (!spec) {
    return false;
  }
  if (spec.kind === "rsi") {
    if (spec.level == null) {
      return false;
    }
    if (spec.compare === "between") {
      return spec.levelTo != null && spec.level < spec.levelTo;
    }
  }
  return true;
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

function SideBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h4 className={sectionTitleClass}>{title}</h4>
      {children}
    </div>
  );
}

function TriggerParamFields({
  startKind,
  desk,
  side,
  priceSource,
  onPriceSource,
  priceWhen,
  onPriceWhen,
  priceLevel,
  onPriceLevel,
  indicatorKind,
  onIndicatorKind,
  timeframe,
  onTimeframe,
  when,
  onWhen,
  period,
  onPeriod,
  slowPeriod,
  onSlowPeriod,
  level,
  onLevel,
  multiplier,
  onMultiplier,
}: {
  startKind: StartKind;
  desk: DeskKind;
  side: "long" | "short";
  priceSource: string;
  onPriceSource: (next: string) => void;
  priceWhen: string;
  onPriceWhen: (next: string) => void;
  priceLevel: string;
  onPriceLevel: (next: string) => void;
  indicatorKind: DcaIndicatorKind;
  onIndicatorKind: (next: DcaIndicatorKind) => void;
  timeframe: DcaIndicatorTimeframe;
  onTimeframe: (next: DcaIndicatorTimeframe) => void;
  when: string;
  onWhen: (next: string) => void;
  period: string;
  onPeriod: (next: string) => void;
  slowPeriod: string;
  onSlowPeriod: (next: string) => void;
  level: string;
  onLevel: (next: string) => void;
  multiplier: string;
  onMultiplier: (next: string) => void;
}) {
  const kindForFields = startKind === "trend" ? "supertrend" : indicatorKind;
  const whenOptions = dcaIndicatorWhenOptions(kindForFields, side, false);
  const showPeriod =
    startKind === "trend" || dcaIndicatorUsesPeriod(indicatorKind);
  const showPair =
    startKind === "indicator" && dcaIndicatorUsesPairPeriods(indicatorKind);
  const showLevel =
    startKind === "indicator" &&
    dcaIndicatorShowsLevel(indicatorKind, when, level);

  if (startKind === "price") {
    return (
      <div className={rowClass5}>
        <Field label="Price source" required>
          <select
            value={priceSource}
            onChange={(event) => onPriceSource(event.target.value)}
            className={fieldClass}
          >
            <option value="last">{desk === "perps" ? "Last is" : "Last"}</option>
            <option value="mark">{desk === "perps" ? "Mark is" : "Mark"}</option>
            <option value="index">
              {desk === "perps" ? "Index is" : "Index"}
            </option>
          </select>
        </Field>
        <Field label={desk === "perps" ? "Compare" : "When"} required>
          <select
            value={priceWhen}
            onChange={(event) => onPriceWhen(event.target.value)}
            className={fieldClass}
          >
            <option value="gte">At or above</option>
            <option value="lte">At or below</option>
          </select>
        </Field>
        <Field label="Price" required>
          <OffNumber value={priceLevel} onChange={onPriceLevel} />
        </Field>
      </div>
    );
  }

  if (startKind === "webhook") {
    return null;
  }

  return (
    <div className={rowClass5}>
      {startKind === "indicator" ? (
        <Field label="Indicator" required>
          <select
            value={indicatorKind}
            onChange={(event) => {
              const kind = event.target.value as DcaIndicatorKind;
              onIndicatorKind(kind);
              onPeriod(String(defaultDcaIndicatorPeriod(kind)));
              onSlowPeriod(String(defaultDcaIndicatorSlowPeriod(kind)));
              onLevel(
                defaultDcaIndicatorLevel(kind) == null
                  ? ""
                  : String(defaultDcaIndicatorLevel(kind)),
              );
              const options = dcaIndicatorWhenOptions(kind, side, false);
              onWhen(options[0]?.value ?? "gte");
            }}
            className={fieldClass}
          >
            {DCA_INDICATOR_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="Trend" required>
          <select className={fieldClass} value="supertrend" disabled>
            <option value="supertrend">Supertrend</option>
          </select>
        </Field>
      )}
      {showPeriod ? (
        <Field label="Period" required>
          <GroupedNumberInput
            value={period}
            onChange={onPeriod}
            className={fieldClass}
          />
        </Field>
      ) : null}
      {showPair ? (
        <Field label="Slow" required>
          <GroupedNumberInput
            value={slowPeriod}
            onChange={onSlowPeriod}
            className={fieldClass}
          />
        </Field>
      ) : null}
      {startKind === "trend" ? (
        <Field label="Multiplier" required>
          <GroupedNumberInput
            value={multiplier}
            onChange={onMultiplier}
            allowDecimal
            className={fieldClass}
          />
        </Field>
      ) : null}
      <Field label="Timeframe" required>
        <select
          value={timeframe}
          onChange={(event) =>
            onTimeframe(event.target.value as DcaIndicatorTimeframe)
          }
          className={fieldClass}
        >
          {DCA_INDICATOR_TIMEFRAMES.map((interval) => (
            <option key={interval} value={interval}>
              {DCA_INDICATOR_TIMEFRAME_LABELS[interval]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="When" required>
        <select
          value={when}
          onChange={(event) => onWhen(event.target.value)}
          className={fieldClass}
        >
          {whenOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      {showLevel ? (
        <Field label="Level" required>
          <GroupedNumberInput
            value={level}
            onChange={onLevel}
            allowDecimal
            className={fieldClass}
          />
        </Field>
      ) : null}
    </div>
  );
}

export function ThemeBotFormDraft() {
  const [name, setName] = useState("Sample bot");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [action, setAction] = useState<Action>("buy");
  const [startKind, setStartKind] = useState<StartKind>("indicator");
  const [priceSource, setPriceSource] = useState("last");
  const [priceWhen, setPriceWhen] = useState("gte");
  const [priceLevel, setPriceLevel] = useState("");
  const [indicatorKind, setIndicatorKind] = useState<DcaIndicatorKind>("rsi");
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
  const [shortIndicatorKind, setShortIndicatorKind] =
    useState<DcaIndicatorKind>("rsi");
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
  const [shortConfirmOn, setShortConfirmOn] = useState(false);
  const [shortConfirm, setShortConfirm] = useState<DcaFilterSpec | null>(null);
  const [tpOn, setTpOn] = useState(false);
  const [trailOn, setTrailOn] = useState(false);
  const [slOn, setSlOn] = useState(false);
  const [breakevenOn, setBreakevenOn] = useState(false);
  const [exitIfOn, setExitIfOn] = useState(false);
  const [shortExitIfOn, setShortExitIfOn] = useState(false);
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
  const [carryTpOn, setCarryTpOn] = useState(false);
  const [carrySlOn, setCarrySlOn] = useState(false);
  const [carryTp, setCarryTp] = useState("");
  const [carrySl, setCarrySl] = useState("");
  const [size, setSize] = useState("100");
  const [sizeUnit, setSizeUnit] = useState<"qty" | "usdt">("usdt");
  const [maxClips, setMaxClips] = useState("");
  const [maxValueMode, setMaxValueMode] = useState<
    "none" | "usdt" | "percent" | "margin"
  >("none");
  const [maxValue, setMaxValue] = useState("");
  const [tpMethod, setTpMethod] = useState<ExitMethod>("percent");
  const [tpValue, setTpValue] = useState("");
  const [tpOrderType, setTpOrderType] = useState("market");
  const [tpLimitPrice, setTpLimitPrice] = useState("");
  const [trailValue, setTrailValue] = useState("");
  const [trailTrigger, setTrailTrigger] = useState("");
  const [slMethod, setSlMethod] = useState<ExitMethod>("");
  const [slValue, setSlValue] = useState("");
  const [slOrderType, setSlOrderType] = useState("market");
  const [slLimitPrice, setSlLimitPrice] = useState("");
  const [breakevenAt, setBreakevenAt] = useState("");
  const [breakevenOffset, setBreakevenOffset] = useState("0");
  const [exitIf, setExitIf] = useState<DcaFilterSpec | null>(null);
  const [shortExitIf, setShortExitIf] = useState<DcaFilterSpec | null>(null);
  const [skipIfOpen, setSkipIfOpen] = useState(true);
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
  const [desk, setDesk] = useState<DeskKind>("perps");
  const [status, setStatus] = useState("active");
  const skipDeskDirty = useRef(false);
  const savedDraft = useRef<string | null>(null);
  const [saveTick, setSaveTick] = useState(0);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const draftValue = {
    name,
    symbol,
    action,
    startKind,
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
    exitIfOn,
    shortExitIfOn,
    size,
    sizeUnit,
    maxClips,
    maxValueMode,
    maxValue,
    tpMethod,
    tpValue,
    tpOrderType,
    tpLimitPrice,
    trailValue,
    trailTrigger,
    slMethod,
    slValue,
    slOrderType,
    slLimitPrice,
    breakevenAt,
    breakevenOffset,
    exitIf,
    shortExitIf,
    skipIfOpen,
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
    carryTpOn,
    carrySlOn,
    carryTp,
    carrySl,
    status,
  };
  const draftKey = JSON.stringify(draftValue);
  if (savedDraft.current === null) {
    savedDraft.current = draftKey;
  }
  const dirty = draftKey !== savedDraft.current;
  void saveTick;
  const closing = action === "close_long" || action === "close_short";
  const statusOptions = statusOptionsFor(desk);
  const selectedStatus =
    statusOptions.find((option) => option.value === status) ?? statusOptions[0];
  const showStartParams = startKind !== "webhook" && !closing;
  const bothSides = desk === "dca" && direction === "both";
  const requireTp = desk !== "cnc" && !closing && tpOn;
  const requireSl = desk !== "cnc" && !closing && slOn;
  const requireTrail = desk !== "cnc" && !closing && trailOn;
  const requireTrailTrigger = requireTrail && desk === "dca";
  const requireBreakeven = desk === "dca" && !closing && breakevenOn;
  const requireCarryTp = desk === "cnc" && carryTpOn;
  const requireCarrySl = desk === "cnc" && carrySlOn;
  const requireConfirm = desk === "dca" && !closing && confirmOn;
  const requireShortConfirm = bothSides && !closing && shortConfirmOn;
  const requireExitIf = desk === "dca" && !closing && exitIfOn;
  const requireShortExitIf = bothSides && !closing && shortExitIfOn;
  const missing = {
    tpValue: requireTp && !filled(tpValue),
    slValue: requireSl && !filled(slValue),
    trailValue: requireTrail && !filled(trailValue),
    trailTrigger: requireTrailTrigger && !filled(trailTrigger),
    breakevenAt: requireBreakeven && !filled(breakevenAt),
    breakevenOffset: requireBreakeven && !filled(breakevenOffset),
    carryTp: requireCarryTp && !filled(carryTp),
    carrySl: requireCarrySl && !filled(carrySl),
    confirm: requireConfirm && !dcaFilterComplete(confirm),
    shortConfirm: requireShortConfirm && !dcaFilterComplete(shortConfirm),
    exitIf: requireExitIf && !dcaFilterComplete(exitIf),
    shortExitIf: requireShortExitIf && !dcaFilterComplete(shortExitIf),
  };
  const hasMissing = Object.values(missing).some(Boolean);
  const showFieldErrors = saveAttempted && hasMissing;

  useEffect(() => {
    if (skipDeskDirty.current) {
      savedDraft.current = draftKey;
      skipDeskDirty.current = false;
      setSaveTick((tick) => tick + 1);
    }
  }, [desk, draftKey]);

  function switchDesk(next: DeskKind) {
    skipDeskDirty.current = true;
    setSaveAttempted(false);
    setDesk(next);
    setStatus("active");
    if (next === "perps" && (startKind === "indicator" || startKind === "trend")) {
      setStartKind("price");
    }
  }

  function applyDirection(next: "long" | "short" | "both") {
    const kindForSeed = startKind === "trend" ? "supertrend" : indicatorKind;
    if (next === "both" && direction !== "both") {
      setShortPriceSource(priceSource);
      setShortPriceWhen(priceWhen === "gte" ? "lte" : "gte");
      setShortPriceLevel(priceLevel);
      setShortIndicatorKind(indicatorKind);
      setShortTimeframe(timeframe);
      setShortWhen(oppositeIndicatorCompare(kindForSeed, when));
      setShortPeriod(period);
      setShortSlowPeriod(slowPeriod);
      const numericLevel = Number(level.replace(/,/g, ""));
      setShortLevel(
        indicatorKind === "rsi"
          ? String(
              oppositeRsiLevel(
                Number.isFinite(numericLevel) ? numericLevel : 30,
              ),
            )
          : level,
      );
      setShortMultiplier(multiplier);
      setShortConfirmOn(confirmOn);
      if (confirmOn) {
        setShortConfirm((current) => current ?? dcaFilterSpecForKind("rsi", "short"));
      }
      setShortExitIfOn(exitIfOn);
      if (exitIfOn) {
        setShortExitIf((current) => current ?? dcaFilterSpecForKind("rsi", "short"));
      }
    } else if (direction === "both" && next === "short") {
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
      setExitIfOn(shortExitIfOn);
      if (shortConfirm) {
        setConfirm(shortConfirm);
      }
      if (shortExitIf) {
        setExitIf(shortExitIf);
      }
    }
    setDirection(next);
  }

  function saveDraft() {
    if (hasMissing) {
      setSaveAttempted(true);
      return;
    }
    savedDraft.current = draftKey;
    setSaveAttempted(false);
    setSaveTick((tick) => tick + 1);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        Draft standard for every desk. Local only — nothing saves. Save
        appears at the top when this bot is dirty. Status + Save applies
        the selected mode. Switch the sample desk to see each status list.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={deskBtnClass}>
          Create New Bot
        </button>
        <button type="button" className={deskBtnClass}>
          Create New Bot from Template
        </button>
        <select aria-label="Clone existing bot" className={deskBtnClass} defaultValue="">
          <option value="">Clone existing bot</option>
          <option value="sample">Sample bot</option>
        </select>
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
              desk === "perps"
                ? "bg-surface-raised font-medium text-ink"
                : "text-ink-muted hover:text-ink"
            }`}
            onClick={() => switchDesk("perps")}
          >
            Perps
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

      <div className="flex flex-col divide-y divide-line rounded-card border border-line bg-canvas px-5">
        {dirty ? (
          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-sm text-warning">
                You have unsaved changes on this bot
              </p>
              {saveAttempted && hasMissing ? (
                <p className="mt-1 text-sm text-danger">
                  Fill required fields in enabled sections before saving.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className={headerPrimaryClass}
              onClick={saveDraft}
            >
              Save
            </button>
          </div>
        ) : null}
        <Group title="Bot">
        <div className="grid items-start gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <Field label="Name" required>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
            />
          </Field>
          <div>
            <p className={labelClass}>
              <HintLabel text="Status" hint={selectedStatus.note} />
            </p>
            <div className="mt-1 flex items-center gap-2">
              <select
                className={`${fieldClass} mt-0 min-w-0 flex-1`}
                value={selectedStatus.value}
                onChange={(event) => setStatus(event.target.value)}
                aria-label="Status"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <StatusLight fill={selectedStatus.fill} />
            </div>
          </div>
        </div>
        </Group>

        {desk !== "cnc" ? (
        <>
        <Group title="What & When">
          <div className={rowClass}>
            <Field label="Contract" required>
              <FuturesSymbolSelect
                options={SAMPLE_PAIRS}
                value={symbol}
                onChange={setSymbol}
              />
            </Field>
            {desk === "perps" ? (
              <>
                <Field label="Action" required>
                  <select
                    value={action}
                    onChange={(event) => setAction(event.target.value as Action)}
                    className={fieldClass}
                  >
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                    <option value="close_long">Close long</option>
                    <option value="close_short">Close short</option>
                  </select>
                </Field>
                <Field label="Order" required>
                  <OrderTypePill value="market" />
                </Field>
                <Field label="When" required>
                  <select
                    value={startKind === "webhook" ? "webhook" : "price"}
                    onChange={(event) =>
                      setStartKind(event.target.value as StartKind)
                    }
                    className={fieldClass}
                  >
                    <option value="price">Price cross</option>
                    <option value="webhook">Signal webhook</option>
                  </select>
                </Field>
              </>
            ) : (
              <>
                <Field
                  label="Direction"
                  hint="Long and Short are independent positions and never flatten each other."
                  required
                >
                  <select
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
                  </select>
                </Field>
                <Field label="Initial Order Trigger" className="lg:col-span-2" required>
                  <select
                    value={startKind}
                    onChange={(event) => {
                      const next = event.target.value as StartKind;
                      setStartKind(next);
                      if (next === "trend") {
                        setWhen("cross_gte");
                        setPeriod(String(DEFAULT_DCA_SUPERTREND_PERIOD));
                        setShortWhen("cross_lte");
                        setShortPeriod(String(DEFAULT_DCA_SUPERTREND_PERIOD));
                      } else if (next === "indicator") {
                        setWhen("cross_lte");
                        setPeriod(String(DEFAULT_DCA_RSI_PERIOD));
                        setShortWhen("cross_gte");
                        setShortPeriod(String(DEFAULT_DCA_RSI_PERIOD));
                      }
                    }}
                    className={fieldClass}
                  >
                    <option value="indicator">Indicator</option>
                    <option value="trend">Trend</option>
                    <option value="price">Price Cross</option>
                    <option value="webhook">Signal Webhook</option>
                  </select>
                </Field>
              </>
            )}
          </div>
          {desk === "perps" && !closing ? (
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={skipIfOpen}
                onChange={(event) => setSkipIfOpen(event.target.checked)}
                className="mt-0.5 size-4 accent-accent"
              />
              <HintLabel
                text="Skip if this side is already open"
                hint="Off means each new cross or trigger can add size to the same row."
              />
            </label>
          ) : null}

        </Group>

        {!closing ? (
        <Group
          title={`Trigger - ${
            startKind === "indicator"
              ? "Indicator"
              : startKind === "trend"
                ? "Trend"
                : startKind === "webhook"
                  ? "Signal Webhook"
                  : "Price Cross"
          }`}
        >
          {startKind === "webhook" && !closing ? (
            <div className={rowClass5}>
              <Field label="Webhook" className="lg:col-span-2" required>
                <select className={fieldClass} defaultValue="">
                  <option value="">
                    {desk === "perps"
                      ? "Pick a webhook"
                      : "Pick a Signal webhook"}
                  </option>
                  <option value="sample">Sample signal</option>
                </select>
              </Field>
            </div>
          ) : null}

          {showStartParams ? (
            bothSides ? (
              <div className="space-y-5">
                <SideBlock title="Long">
                  <TriggerParamFields
                    startKind={startKind}
                    desk={desk}
                    side="long"
                    priceSource={priceSource}
                    onPriceSource={setPriceSource}
                    priceWhen={priceWhen}
                    onPriceWhen={setPriceWhen}
                    priceLevel={priceLevel}
                    onPriceLevel={setPriceLevel}
                    indicatorKind={indicatorKind}
                    onIndicatorKind={setIndicatorKind}
                    timeframe={timeframe}
                    onTimeframe={setTimeframe}
                    when={when}
                    onWhen={setWhen}
                    period={period}
                    onPeriod={setPeriod}
                    slowPeriod={slowPeriod}
                    onSlowPeriod={setSlowPeriod}
                    level={level}
                    onLevel={setLevel}
                    multiplier={multiplier}
                    onMultiplier={setMultiplier}
                  />
                </SideBlock>
                <div className="space-y-5 border-t border-line pt-5">
                  <SideBlock title="Short">
                    <TriggerParamFields
                      startKind={startKind}
                      desk={desk}
                      side="short"
                      priceSource={shortPriceSource}
                      onPriceSource={setShortPriceSource}
                      priceWhen={shortPriceWhen}
                      onPriceWhen={setShortPriceWhen}
                      priceLevel={shortPriceLevel}
                      onPriceLevel={setShortPriceLevel}
                      indicatorKind={shortIndicatorKind}
                      onIndicatorKind={setShortIndicatorKind}
                      timeframe={shortTimeframe}
                      onTimeframe={setShortTimeframe}
                      when={shortWhen}
                      onWhen={setShortWhen}
                      period={shortPeriod}
                      onPeriod={setShortPeriod}
                      slowPeriod={shortSlowPeriod}
                      onSlowPeriod={setShortSlowPeriod}
                      level={shortLevel}
                      onLevel={setShortLevel}
                      multiplier={shortMultiplier}
                      onMultiplier={setShortMultiplier}
                    />
                  </SideBlock>
                </div>
              </div>
            ) : (
              <TriggerParamFields
                startKind={startKind}
                desk={desk}
                side={direction === "short" ? "short" : "long"}
                priceSource={priceSource}
                onPriceSource={setPriceSource}
                priceWhen={priceWhen}
                onPriceWhen={setPriceWhen}
                priceLevel={priceLevel}
                onPriceLevel={setPriceLevel}
                indicatorKind={indicatorKind}
                onIndicatorKind={setIndicatorKind}
                timeframe={timeframe}
                onTimeframe={setTimeframe}
                when={when}
                onWhen={setWhen}
                period={period}
                onPeriod={setPeriod}
                slowPeriod={slowPeriod}
                onSlowPeriod={setSlowPeriod}
                level={level}
                onLevel={setLevel}
                multiplier={multiplier}
                onMultiplier={setMultiplier}
              />
            )
          ) : null}
        </Group>
        ) : null}

        {desk === "dca" && !closing ? (
          bothSides ? (
            <Group
              title="Secondary Entry Condition"
              hint="Must be true for the entry trigger to execute."
            >
              <OptionalSection
                title="Long"
                nested
                enabled={confirmOn}
                onEnabled={(next) => {
                  setConfirmOn(next);
                  setConfirm(
                    next ? (confirm ?? dcaFilterSpecForKind("rsi", "long")) : null,
                  );
                }}
              >
                <DcaFilterBlock
                  label="Kind"
                  prefix="themeConfirm"
                  side="long"
                  spec={confirm}
                  onChange={setConfirm}
                  dense
                  allowOff={false}
                  gridClass={rowClass5}
                  whenClass=""
                  fieldClass={fieldClass}
                  labelClass={labelClass}
                />
              </OptionalSection>
              <OptionalSection
                title="Short"
                nested
                enabled={shortConfirmOn}
                onEnabled={(next) => {
                  setShortConfirmOn(next);
                  setShortConfirm(
                    next
                      ? (shortConfirm ?? dcaFilterSpecForKind("rsi", "short"))
                      : null,
                  );
                }}
              >
                <DcaFilterBlock
                  label="Kind"
                  prefix="themeShortConfirm"
                  side="short"
                  spec={shortConfirm}
                  onChange={setShortConfirm}
                  dense
                  allowOff={false}
                  gridClass={rowClass5}
                  whenClass=""
                  fieldClass={fieldClass}
                  labelClass={labelClass}
                />
              </OptionalSection>
            </Group>
          ) : (
            <OptionalSection
              title="Secondary Entry Condition"
              hint="Must be true for the entry trigger to execute."
              enabled={confirmOn}
              onEnabled={(next) => {
                setConfirmOn(next);
                setConfirm(
                  next
                    ? (confirm ??
                      dcaFilterSpecForKind(
                        "rsi",
                        direction === "short" ? "short" : "long",
                      ))
                    : null,
                );
              }}
            >
              <DcaFilterBlock
                label="Kind"
                prefix="themeConfirm"
                side={direction === "short" ? "short" : "long"}
                spec={confirm}
                onChange={setConfirm}
                dense
                allowOff={false}
                gridClass={rowClass5}
                whenClass=""
                fieldClass={fieldClass}
                labelClass={labelClass}
              />
            </OptionalSection>
          )
        ) : null}

        {desk === "dca" && !closing ? (
          <Group title="Maximum Exposure">
            <div className={rowClass}>
              <Field label="Max orders">
                <GroupedNumberInput
                  value={maxClips}
                  onChange={setMaxClips}
                  className={fieldClass}
                  placeholder="No cap"
                />
              </Field>
              <Field label="Max value">
                <select
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
                </select>
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
                    className={fieldClass}
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

        {!closing ? (
          <Group title={desk === "dca" ? "Initial Order Size" : "Order Size"}>
            <div className={rowClass}>
              <Field label="Size" required>
                <GroupedNumberInput
                  value={size}
                  onChange={setSize}
                  allowDecimal
                  className={fieldClass}
                />
              </Field>
              <Field label={desk === "dca" ? "Size unit" : "Unit"} required>
                <select
                  value={sizeUnit}
                  onChange={(event) =>
                    setSizeUnit(event.target.value as "qty" | "usdt")
                  }
                  className={fieldClass}
                >
                  <option value="usdt">USDT</option>
                  <option value="qty">Qty</option>
                </select>
              </Field>
            </div>
          </Group>
        ) : (
          <Group>
            <div className={rowClass}>
              <Field label="Qty to close" hint="Empty closes the whole row.">
                <GroupedNumberInput
                  value={size}
                  onChange={setSize}
                  allowDecimal
                  placeholder="All"
                  className={fieldClass}
                />
              </Field>
            </div>
          </Group>
        )}

        {desk === "dca" ? (
        <Group title="Additional orders">
          <div className={rowClass5}>
            <Field label="Averaging" className="lg:col-span-2" required>
              <select
                className={fieldClass}
                value={averaging}
                onChange={(event) =>
                  setAveraging(event.target.value as "dip" | "interval")
                }
              >
                <option value="dip">Add on price deviation</option>
                <option value="interval">Add on interval</option>
              </select>
            </Field>
            {averaging === "dip" ? (
              <Field label="Spacing" required>
                <select
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
                </select>
              </Field>
            ) : null}
            {averaging === "dip" && spacingKind === "percent" ? (
              <Field label="Price deviation %" required>
                <span className="relative mt-1 block">
                  <GroupedNumberInput
                    value={dipPct}
                    onChange={setDipPct}
                    allowDecimal
                    className={`${fieldClass} mt-0 pr-7`}
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
                    className={fieldClass}
                  />
                </Field>
                <Field label="ATR spacing" required>
                  <GroupedNumberInput
                    value={atrSpacing}
                    onChange={setAtrSpacing}
                    allowDecimal
                    className={fieldClass}
                  />
                </Field>
              </>
            ) : null}
            {averaging === "interval" ? (
              <div>
                <p className={labelClass}>
                  <HintLabel text="Add every" required />
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <select
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
                  </select>
                  <GroupedNumberInput
                    value={intervalValue}
                    onChange={setIntervalValue}
                    className={fieldClass}
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
        ) : null}

        {desk === "dca" ? (
        <Group title="Additional order multipliers">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs text-ink"
              >
                Equal orders
              </button>
              <button
                type="button"
                className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs text-ink"
              >
                Martingale
              </button>
            </div>
            <Field label="Order size multiplier" className="min-w-40 flex-1" required>
              <GroupedNumberInput
                value="1"
                onChange={() => undefined}
                allowDecimal
                className={fieldClass}
              />
            </Field>
            <Field label="Price deviation multiplier" className="min-w-40 flex-1" required>
              <GroupedNumberInput
                value="1"
                onChange={() => undefined}
                allowDecimal
                className={fieldClass}
              />
            </Field>
          </div>
        </Group>
        ) : null}

        {!closing ? (
          <>
            <OptionalSection
              title="Take profit"
              enabled={tpOn}
              onEnabled={(next) => {
                setTpOn(next);
                if (next && !tpMethod) {
                  setTpMethod(desk === "dca" ? "percent" : "price");
                }
              }}
            >
              {desk === "dca" ? (
                <ExitMethodFields
                  method={tpMethod || "percent"}
                  onMethod={setTpMethod}
                  value={tpValue}
                  onValue={setTpValue}
                  orderType={tpOrderType}
                  onOrderType={setTpOrderType}
                  invalid={showFieldErrors && missing.tpValue}
                />
              ) : (
                <div className={rowClass}>
                  <Field label="Price" required>
                    <OffNumber
                      value={tpValue}
                      onChange={setTpValue}
                      required
                      invalid={showFieldErrors && missing.tpValue}
                    />
                  </Field>
                  <Field label="Trigger" required>
                    <select className={fieldClass} defaultValue="last">
                      <option value="last">Last</option>
                      <option value="mark">Mark</option>
                      <option value="index">Index</option>
                    </select>
                  </Field>
                  <Field label="Order type" required>
                    <OrderTypePill
                      value={tpOrderType === "limit" ? "limit" : "market"}
                      onChange={setTpOrderType}
                    />
                  </Field>
                  {tpOrderType === "limit" ? (
                    <Field label="Limit price" required>
                      <OffNumber
                        value={tpLimitPrice}
                        onChange={setTpLimitPrice}
                        required
                      />
                    </Field>
                  ) : null}
                </div>
              )}
            </OptionalSection>

            <OptionalSection
              title="Trailing stop"
              enabled={trailOn}
              onEnabled={setTrailOn}
            >
              <div className={rowClass}>
                {desk === "dca" ? (
                  <>
                    <Field
                      label="Trigger %"
                      hint="Trail starts after price moves this %."
                      required
                    >
                      <OffNumber
                        value={trailTrigger}
                        onChange={setTrailTrigger}
                        required
                        invalid={showFieldErrors && missing.trailTrigger}
                      />
                    </Field>
                    <Field label="Trailing %" required>
                      <OffNumber
                        value={trailValue}
                        onChange={setTrailValue}
                        required
                        invalid={showFieldErrors && missing.trailValue}
                      />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Retracement" required>
                      <OffNumber
                        value={trailValue}
                        onChange={setTrailValue}
                        required
                        invalid={showFieldErrors && missing.trailValue}
                      />
                    </Field>
                    <Field label="Activation price" hint="Empty is Off.">
                      <OffNumber
                        value={trailTrigger}
                        onChange={setTrailTrigger}
                      />
                    </Field>
                  </>
                )}
              </div>
            </OptionalSection>

            <OptionalSection
              title="Stop loss"
              enabled={slOn}
              onEnabled={(next) => {
                setSlOn(next);
                if (next && !slMethod) {
                  setSlMethod(desk === "dca" ? "percent" : "price");
                }
              }}
            >
              {desk === "dca" ? (
                <div className={rowClass}>
                  <Field label="Basis" required>
                    <select className={fieldClass} defaultValue="average">
                      <option value="average">Average entry</option>
                      <option value="first_entry">First fill</option>
                    </select>
                  </Field>
                  <Field label="Stop loss %" required>
                    <OffNumber
                      value={slValue}
                      onChange={setSlValue}
                      required
                      invalid={showFieldErrors && missing.slValue}
                    />
                  </Field>
                </div>
              ) : (
                <div className={rowClass}>
                  <Field label="Price" required>
                    <OffNumber
                      value={slValue}
                      onChange={setSlValue}
                      required
                      invalid={showFieldErrors && missing.slValue}
                    />
                  </Field>
                  <Field label="Trigger" required>
                    <select className={fieldClass} defaultValue="last">
                      <option value="last">Last</option>
                      <option value="mark">Mark</option>
                      <option value="index">Index</option>
                    </select>
                  </Field>
                  <Field label="Order type" required>
                    <OrderTypePill
                      value={slOrderType === "limit" ? "limit" : "market"}
                      onChange={setSlOrderType}
                    />
                  </Field>
                  {slOrderType === "limit" ? (
                    <Field label="Limit price" required>
                      <OffNumber
                        value={slLimitPrice}
                        onChange={setSlLimitPrice}
                        required
                      />
                    </Field>
                  ) : null}
                </div>
              )}
            </OptionalSection>

            {desk === "dca" ? (
            <OptionalSection
              title="Move Breakeven"
              enabled={breakevenOn}
              onEnabled={setBreakevenOn}
            >
              <div className={rowClass}>
                <Field label="Move stop to breakeven at %" required>
                  <OffNumber
                    value={breakevenAt}
                    onChange={setBreakevenAt}
                    required
                    invalid={showFieldErrors && missing.breakevenAt}
                  />
                </Field>
                <Field label="Breakeven offset %" required>
                  <OffNumber
                    value={breakevenOffset}
                    onChange={setBreakevenOffset}
                    required
                    invalid={showFieldErrors && missing.breakevenOffset}
                  />
                </Field>
              </div>
            </OptionalSection>
            ) : null}

            {desk === "dca" ? (
            bothSides ? (
              <Group title="Hard Exit Condition">
                <OptionalSection
                  title="Long"
                  nested
                  enabled={exitIfOn}
                  onEnabled={(next) => {
                    setExitIfOn(next);
                    setExitIf(
                      next ? (exitIf ?? dcaFilterSpecForKind("rsi", "long")) : null,
                    );
                  }}
                >
                  <DcaFilterBlock
                    label="Kind"
                    prefix="themeExitIf"
                    side="long"
                    spec={exitIf}
                    onChange={setExitIf}
                    dense
                    allowOff={false}
                    gridClass={rowClass5}
                    whenClass=""
                    fieldClass={fieldClass}
                    labelClass={labelClass}
                  />
                </OptionalSection>
                <OptionalSection
                  title="Short"
                  nested
                  enabled={shortExitIfOn}
                  onEnabled={(next) => {
                    setShortExitIfOn(next);
                    setShortExitIf(
                      next
                        ? (shortExitIf ?? dcaFilterSpecForKind("rsi", "short"))
                        : null,
                    );
                  }}
                >
                  <DcaFilterBlock
                    label="Kind"
                    prefix="themeShortExitIf"
                    side="short"
                    spec={shortExitIf}
                    onChange={setShortExitIf}
                    dense
                    allowOff={false}
                    gridClass={rowClass5}
                    whenClass=""
                    fieldClass={fieldClass}
                    labelClass={labelClass}
                  />
                </OptionalSection>
              </Group>
            ) : (
              <OptionalSection
                title="Hard Exit Condition"
                enabled={exitIfOn}
                onEnabled={(next) => {
                  setExitIfOn(next);
                  setExitIf(
                    next
                      ? (exitIf ??
                        dcaFilterSpecForKind(
                          "rsi",
                          direction === "short" ? "short" : "long",
                        ))
                      : null,
                  );
                }}
              >
                <DcaFilterBlock
                  label="Kind"
                  prefix="themeExitIf"
                  side={direction === "short" ? "short" : "long"}
                  spec={exitIf}
                  onChange={setExitIf}
                  dense
                  allowOff={false}
                  gridClass={rowClass5}
                  whenClass=""
                  fieldClass={fieldClass}
                  labelClass={labelClass}
                />
              </OptionalSection>
            )
            ) : null}

          </>
        ) : null}
        </>
        ) : (
          <>
            <Group
              title="Entry"
              hint="All conditions must be true."
            >
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
            </Group>

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
                    className={fieldClass}
                  />
                </Field>
                <Field label="Order Type" required>
                  <select
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
                  </select>
                </Field>
                {carrySizeType === "fixed" ? (
                  <>
                    <Field label="Order size (USDT)" required>
                      <GroupedNumberInput
                        value={orderSizeUsdt}
                        onChange={setOrderSizeUsdt}
                        allowDecimal
                        className={fieldClass}
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
                  <select
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
                  </select>
                </Field>
              </div>
            </Group>

            <OptionalSection
              title="Take profit"
              enabled={carryTpOn}
              onEnabled={setCarryTpOn}
            >
              <div className={rowClass}>
                <Field label="Take profit %" required>
                  <OffNumber
                    value={carryTp}
                    onChange={setCarryTp}
                    required
                    invalid={showFieldErrors && missing.carryTp}
                  />
                </Field>
              </div>
            </OptionalSection>

            <OptionalSection
              title="Stop loss"
              enabled={carrySlOn}
              onEnabled={setCarrySlOn}
            >
              <div className={rowClass}>
                <Field label="Stop loss %" required>
                  <OffNumber
                    value={carrySl}
                    onChange={setCarrySl}
                    required
                    invalid={showFieldErrors && missing.carrySl}
                  />
                </Field>
              </div>
            </OptionalSection>
          </>
        )}

        <section className="flex flex-wrap items-center justify-between gap-2 py-5">
          <h3 className={sectionTitleClass}>Additional Actions</h3>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {desk !== "cnc" ? (
            <button type="button" className={headerGhostClass}>
              Backtest
            </button>
            ) : null}
            <button type="button" className={headerGhostClass}>
              Save as template
            </button>
            <button type="button" className={headerGhostClass}>
              Save as platform template
            </button>
            <button type="button" className={headerRemoveClass}>
              Remove
            </button>
          </div>
        </section>
      </div>

      <ThemeBotFormReference />
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
        <p className="rounded-card border border-line bg-canvas px-4 py-6 text-sm text-ink-muted">
          No bots yet. Add a bot to own orders and exits on one contract. Leave
          this empty if you are not ready to arm.
        </p>
      </div>

      <div className="space-y-2">
        <p className={labelClass}>Perps statuses</p>
        <p className="text-xs text-ink-faint">
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
        <p className="text-xs text-ink-faint">
          Same three as Perps. Reduce only is not DCA Stop adding.
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
        <p className="text-xs text-ink-faint">
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
        <p className="text-xs text-ink-faint">
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
        <p className="text-sm text-success" role="status">
          Saved.
        </p>
        <DraftCallout tone="danger">
          Could not save. Sample error flash.
        </DraftCallout>
        <DraftCallout tone="warning">
          Size is above the desk max. Save is blocked so this bot is not lost.
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
        <p className="text-xs text-ink-faint">
          DCA only. Not on the Perps baseline. Show / Hide when the bot is
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
          <p className="pb-2 text-right text-xs text-ink-muted">
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
  orderType,
  onOrderType,
  invalid = false,
}: {
  method: ExitMethod;
  onMethod: (next: ExitMethod) => void;
  value: string;
  onValue: (next: string) => void;
  orderType: string;
  onOrderType: (next: string) => void;
  invalid?: boolean;
}) {
  const valueField =
    method === "price" ? (
      <Field label="Price" required>
        <OffNumber
          value={value}
          onChange={onValue}
          required
          invalid={invalid}
        />
      </Field>
    ) : method === "percent" ? (
      <Field label="Target %" required>
        <OffNumber
          value={value}
          onChange={onValue}
          required
          invalid={invalid}
        />
      </Field>
    ) : method === "atr" ? (
      <Field label="ATR multiple" required>
        <OffNumber
          value={value}
          onChange={onValue}
          required
          invalid={invalid}
        />
      </Field>
    ) : null;

  return (
    <div className={rowClass}>
      {method !== "price" ? (
        <Field label="Basis" required>
          <select className={fieldClass} defaultValue="average">
            <option value="average">Average entry</option>
            <option value="first_entry">First fill</option>
          </select>
        </Field>
      ) : (
        <Field label="Trigger" required>
          <select className={fieldClass} defaultValue="last">
            <option value="last">Last</option>
            <option value="mark">Mark</option>
            <option value="index">Index</option>
          </select>
        </Field>
      )}
      <Field label="Method" required>
        <select
          value={method}
          onChange={(event) => {
            const next = event.target.value as ExitMethod;
            onMethod(next);
            if (next === "atr" && !filled(value)) {
              onValue("2");
            }
          }}
          className={fieldClass}
        >
          {EXIT_METHODS.filter((option) => option.value).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      {valueField}
      <Field label="Order type" required>
        <OrderTypePill
          value={orderType === "limit" ? "limit" : "market"}
          onChange={onOrderType}
        />
      </Field>
    </div>
  );
}
