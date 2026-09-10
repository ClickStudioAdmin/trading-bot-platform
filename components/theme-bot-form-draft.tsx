"use client";

import { useState, type ReactNode } from "react";
import {
  BotStatusField,
  deskActionBtnClass,
  deskActionSelectClass,
  triggerSectionTitle,
} from "@/components/bot-form-chrome";
import {
  IndicatorStartFields,
  TrendStartFields,
} from "@/components/bot-indicator-fields";
import { ColumnHint } from "@/components/column-hint";
import { DcaFilterBlock } from "@/components/dca-filter-fields";
import {
  dcaFilterComplete,
  dcaFilterSpecForKind,
  type DcaFilterSpec,
} from "@/lib/dca/filters";
import { FuturesSymbolSelect } from "@/components/futures-symbol-select";
import { ChevronIcon, TabButton } from "@/components/trade-expand";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import {
  DEFAULT_DCA_RSI_PERIOD,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DEFAULT_DCA_SUPERTREND_PERIOD,
  indicatorCompareForDirection,
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
const deskBtnClass = deskActionBtnClass;

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

type ExitMethod = "" | "price" | "percent" | "atr";
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

function PriceTriggerFields({
  desk,
  priceSource,
  onPriceSource,
  priceWhen,
  onPriceWhen,
  priceLevel,
  onPriceLevel,
  invalid = false,
}: {
  desk: DeskKind;
  priceSource: string;
  onPriceSource: (next: string) => void;
  priceWhen: string;
  onPriceWhen: (next: string) => void;
  priceLevel: string;
  onPriceLevel: (next: string) => void;
  invalid?: boolean;
}) {
  if (desk === "perps") {
    return (
      <>
        <Field label="Price source" required>
          <select
            value={priceSource}
            onChange={(event) => onPriceSource(event.target.value)}
            className={fieldClass}
          >
            <option value="last">Last is</option>
            <option value="mark">Mark is</option>
            <option value="index">Index is</option>
          </select>
        </Field>
        <Field label="Compare" required>
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
  return (
    <>
      <Field label="Price" required>
        <select
          value={priceSource}
          onChange={(event) => onPriceSource(event.target.value)}
          className={fieldClass}
        >
          <option value="last">Last</option>
          <option value="mark">Mark</option>
          <option value="index">Index</option>
        </select>
      </Field>
      <Field label="When" required>
        <select
          value={priceWhen}
          onChange={(event) => onPriceWhen(event.target.value)}
          className={fieldClass}
        >
          <option value="gte">At or above</option>
          <option value="lte">At or below</option>
        </select>
      </Field>
      <Field label="Level (USDT)" required>
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
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [webhookId, setWebhookId] = useState("sample");
  const [size, setSize] = useState("100");
  const [sizeUnit, setSizeUnit] = useState<"qty" | "usdt">("usdt");
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
  const [slMethod, setSlMethod] = useState<ExitMethod>("");
  const [slValue, setSlValue] = useState("");
  const [slBasis, setSlBasis] = useState("average");
  const [slTrigger, setSlTrigger] = useState("last");
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
  const [status, setStatus] = useState("disabled");
  const [appliedStatus, setAppliedStatus] = useState("disabled");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const draftValue = {
    name,
    symbol,
    action,
    startKind,
    orderType,
    limitPrice,
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
    exitIfOn,
    shortExitIfOn,
    size,
    sizeUnit,
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
    slMethod,
    slValue,
    slBasis,
    slTrigger,
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
  if (savedKey === null) {
    setSavedKey(draftKey);
  }
  const dirty = savedKey !== null && draftKey !== savedKey;
  const closing =
    desk === "perps" &&
    (action === "close_long" || action === "close_short");
  const entrySide: "long" | "short" =
    desk === "dca"
      ? direction === "short"
        ? "short"
        : "long"
      : action === "sell" || action === "close_short"
        ? "short"
        : "long";
  const bothSides = desk === "dca" && direction === "both";
  const requireTp = desk !== "cnc" && !closing && tpOn;
  const requireSl = desk !== "cnc" && !closing && slOn;
  const requireTrail = desk !== "cnc" && !closing && trailOn;
  const requireTrailTrigger = requireTrail && desk === "dca";
  const requireBreakeven = desk !== "cnc" && !closing && breakevenOn;
  const requireCarryTp = desk === "cnc" && carryTpOn;
  const requireCarrySl = desk === "cnc" && carrySlOn;
  const requireConfirm = desk !== "cnc" && !closing && confirmOn;
  const requireShortConfirm = bothSides && !closing && shortConfirmOn;
  const requireExitIf = desk !== "cnc" && !closing && exitIfOn;
  const requireShortExitIf = bothSides && !closing && shortExitIfOn;
  const requirePrice =
    startKind === "price" && (desk === "perps" || !closing);
  const requireLimitPrice =
    desk === "perps" && orderType === "limit" && !filled(limitPrice);
  const requireWebhook =
    startKind === "webhook" && (desk === "perps" || !closing) && !filled(webhookId);
  const requireSize = desk !== "cnc" && !closing && !filled(size);
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
      (tpOn && tpMethod === "atr")) &&
    !filled(atrPeriod);
  const requireInterval =
    desk === "dca" && averaging === "interval" && !filled(intervalValue);
  const requireMaxClips =
    desk === "dca" && averaging === "dip" && restGrid && !filled(maxClips);
  const requireMaxValue =
    desk === "dca" && maxValueMode !== "none" && !filled(maxValue);
  const requireTpLimit =
    desk === "perps" && !closing && tpOn && tpOrderType === "limit" && !filled(tpLimitPrice);
  const requireSlLimit =
    desk === "perps" && !closing && slOn && slOrderType === "limit" && !filled(slLimitPrice);
  const requireMaxPairs = desk === "cnc" && !filled(maxOpenCount);
  const requireCarrySize =
    desk === "cnc" && carrySizeType === "fixed" && !filled(orderSizeUsdt);
  const missing = {
    priceLevel: requirePrice && !filled(priceLevel),
    shortPriceLevel: requirePrice && bothSides && !filled(shortPriceLevel),
    limitPrice: requireLimitPrice,
    webhookId: requireWebhook,
    size: requireSize,
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
    carryTp: requireCarryTp && !filled(carryTp),
    carrySl: requireCarrySl && !filled(carrySl),
    maxOpenCount: requireMaxPairs,
    orderSizeUsdt: requireCarrySize,
    confirm: requireConfirm && !dcaFilterComplete(confirm),
    shortConfirm: requireShortConfirm && !dcaFilterComplete(shortConfirm),
    exitIf: requireExitIf && !dcaFilterComplete(exitIf),
    shortExitIf: requireShortExitIf && !dcaFilterComplete(shortExitIf),
  };
  const hasMissing = Object.values(missing).some(Boolean);
  const showFieldErrors = dirty && hasMissing;

  function applyStartKind(next: StartKind) {
    if (next === "trend") {
      setIndicatorKind("supertrend");
      setWhen(indicatorCompareForDirection(entrySide, "supertrend", ""));
      setPeriod(String(DEFAULT_DCA_SUPERTREND_PERIOD));
      setMultiplier(String(DEFAULT_DCA_SUPERTREND_MULTIPLIER));
      setLevel("");
      setShortIndicatorKind("supertrend");
      setShortWhen(indicatorCompareForDirection("short", "supertrend", ""));
      setShortPeriod(String(DEFAULT_DCA_SUPERTREND_PERIOD));
      setShortMultiplier(String(DEFAULT_DCA_SUPERTREND_MULTIPLIER));
      setShortLevel("");
    } else if (
      next === "indicator" &&
      (startKind === "trend" || indicatorKind === "supertrend")
    ) {
      setIndicatorKind("rsi");
      setWhen(indicatorCompareForDirection(entrySide, "rsi", ""));
      setPeriod(String(DEFAULT_DCA_RSI_PERIOD));
      setLevel(entrySide === "short" ? "70" : "30");
      setShortIndicatorKind("rsi");
      setShortWhen(indicatorCompareForDirection("short", "rsi", ""));
      setShortPeriod(String(DEFAULT_DCA_RSI_PERIOD));
      setShortLevel("70");
    }
    setStartKind(next);
  }

  function switchDesk(next: DeskKind) {
    setSavedKey(null);
    setDesk(next);
    setStatus("active");
    setAppliedStatus("active");
    if (
      next === "perps" &&
      closing &&
      (startKind === "indicator" || startKind === "trend")
    ) {
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
      return;
    }
    setSavedKey(draftKey);
    setAppliedStatus(status);
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
        <select aria-label="Clone existing bot" className={deskActionSelectClass} defaultValue="">
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
        {dirty || hasMissing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-sm text-warning">
                You have unsaved changes on this bot
              </p>
              {hasMissing ? (
                <p className="mt-1 text-sm text-danger">
                  Fill required fields before saving.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className={headerPrimaryClass}
              disabled={hasMissing}
              title={
                hasMissing ? "Fill required fields before saving." : undefined
              }
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
              maxLength={40}
              className={fieldClass}
            />
          </Field>
          <BotStatusField
            desk={desk}
            name="themeStatus"
            value={status}
            applied={appliedStatus}
            onChange={setStatus}
          />
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
                    onChange={(event) => {
                      const next = event.target.value as Action;
                      setAction(next);
                      if (next === "close_long" || next === "close_short") {
                        if (
                          startKind === "indicator" ||
                          startKind === "trend"
                        ) {
                          setStartKind("price");
                        }
                        return;
                      }
                      const side: "long" | "short" =
                        next === "sell" ? "short" : "long";
                      setWhen(
                        indicatorCompareForDirection(side, indicatorKind, ""),
                      );
                      if (indicatorKind === "rsi") {
                        setLevel(side === "short" ? "70" : "30");
                      }
                    }}
                    className={fieldClass}
                  >
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                    <option value="close_long">Close long</option>
                    <option value="close_short">Close short</option>
                  </select>
                </Field>
                <Field label="Order" required>
                  <OrderTypePill value={orderType} onChange={setOrderType} />
                </Field>
                <Field label="When" required>
                  <select
                    value={startKind}
                    onChange={(event) =>
                      applyStartKind(event.target.value as StartKind)
                    }
                    className={fieldClass}
                  >
                    <option value="price">Price cross</option>
                    {closing ? null : (
                      <option value="indicator">Indicator</option>
                    )}
                    {closing ? null : <option value="trend">Trend</option>}
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
                    onChange={(event) =>
                      applyStartKind(event.target.value as StartKind)
                    }
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

        <Group title={triggerSectionTitle(startKind)}>
          {startKind === "webhook" ? (
            <div className={rowClass5}>
              <Field
                label={desk === "perps" ? "Webhook" : "Signal Webhook"}
                className="lg:col-span-2"
                required
              >
                <select
                  className={
                    showFieldErrors && missing.webhookId
                      ? fieldInvalidClass
                      : fieldClass
                  }
                  value={webhookId}
                  onChange={(event) => setWebhookId(event.target.value)}
                >
                  <option value="">
                    {desk === "perps"
                      ? "Pick a webhook"
                      : "Pick a Signal webhook"}
                  </option>
                  <option value="sample">Sample signal</option>
                </select>
              </Field>
              {desk === "perps" && orderType === "limit" ? (
                <Field label="Limit price" required>
                  <OffNumber
                    value={limitPrice}
                    onChange={setLimitPrice}
                    required
                    invalid={showFieldErrors && missing.limitPrice}
                  />
                </Field>
              ) : null}
            </div>
          ) : startKind === "indicator" && !closing ? (
            bothSides ? (
              <div className="space-y-5">
                <SideBlock title="Long">
                  <div className={rowClass}>
                    <IndicatorStartFields
                      side="long"
                      prefix="theme"
                      kind={indicatorKind}
                      timeframe={timeframe}
                      compare={when}
                      level={level}
                      period={period}
                      slowPeriod={slowPeriod}
                      onKindChange={setIndicatorKind}
                      onTimeframeChange={setTimeframe}
                      onCompareChange={setWhen}
                      onLevelChange={setLevel}
                      onPeriodChange={setPeriod}
                      onSlowPeriodChange={setSlowPeriod}
                    />
                  </div>
                </SideBlock>
                <div className="space-y-5 border-t border-line pt-5">
                  <SideBlock title="Short">
                    <div className={rowClass}>
                      <IndicatorStartFields
                        side="short"
                        prefix="themeShort"
                        kind={shortIndicatorKind}
                        timeframe={shortTimeframe}
                        compare={shortWhen}
                        level={shortLevel}
                        period={shortPeriod}
                        slowPeriod={shortSlowPeriod}
                        onKindChange={setShortIndicatorKind}
                        onTimeframeChange={setShortTimeframe}
                        onCompareChange={setShortWhen}
                        onLevelChange={setShortLevel}
                        onPeriodChange={setShortPeriod}
                        onSlowPeriodChange={setShortSlowPeriod}
                      />
                    </div>
                  </SideBlock>
                </div>
              </div>
            ) : (
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
                  onKindChange={setIndicatorKind}
                  onTimeframeChange={setTimeframe}
                  onCompareChange={setWhen}
                  onLevelChange={setLevel}
                  onPeriodChange={setPeriod}
                  onSlowPeriodChange={setSlowPeriod}
                />
                {desk === "perps" && orderType === "limit" ? (
                  <Field label="Limit price" required>
                    <OffNumber
                      value={limitPrice}
                      onChange={setLimitPrice}
                      required
                      invalid={showFieldErrors && missing.limitPrice}
                    />
                  </Field>
                ) : null}
              </div>
            )
          ) : startKind === "trend" && !closing ? (
            bothSides ? (
              <div className="space-y-5">
                <SideBlock title="Long">
                  <div className={rowClass}>
                    <TrendStartFields
                      side="long"
                      prefix="theme"
                      kind={indicatorKind}
                      timeframe={timeframe}
                      compare={when}
                      period={period}
                      multiplier={multiplier}
                      onKindChange={setIndicatorKind}
                      onTimeframeChange={setTimeframe}
                      onCompareChange={setWhen}
                      onPeriodChange={setPeriod}
                      onMultiplierChange={setMultiplier}
                    />
                  </div>
                </SideBlock>
                <div className="space-y-5 border-t border-line pt-5">
                  <SideBlock title="Short">
                    <div className={rowClass}>
                      <TrendStartFields
                        side="short"
                        prefix="themeShort"
                        kind={shortIndicatorKind}
                        timeframe={shortTimeframe}
                        compare={shortWhen}
                        period={shortPeriod}
                        multiplier={shortMultiplier}
                        onKindChange={setShortIndicatorKind}
                        onTimeframeChange={setShortTimeframe}
                        onCompareChange={setShortWhen}
                        onPeriodChange={setShortPeriod}
                        onMultiplierChange={setShortMultiplier}
                      />
                    </div>
                  </SideBlock>
                </div>
              </div>
            ) : (
              <div className={rowClass5}>
                <TrendStartFields
                  side={entrySide}
                  prefix="theme"
                  kind={indicatorKind}
                  timeframe={timeframe}
                  compare={when}
                  period={period}
                  multiplier={multiplier}
                  onKindChange={setIndicatorKind}
                  onTimeframeChange={setTimeframe}
                  onCompareChange={setWhen}
                  onPeriodChange={setPeriod}
                  onMultiplierChange={setMultiplier}
                />
                {desk === "perps" && orderType === "limit" ? (
                  <Field label="Limit price" required>
                    <OffNumber
                      value={limitPrice}
                      onChange={setLimitPrice}
                      required
                      invalid={showFieldErrors && missing.limitPrice}
                    />
                  </Field>
                ) : null}
              </div>
            )
          ) : (
            <div className={desk === "perps" ? rowClass5 : rowClass}>
              {bothSides ? (
                <div className="space-y-5 sm:col-span-2 lg:col-span-4">
                  <SideBlock title="Long">
                    <div className={rowClass}>
                      <PriceTriggerFields
                        desk={desk}
                        priceSource={priceSource}
                        onPriceSource={setPriceSource}
                        priceWhen={priceWhen}
                        onPriceWhen={setPriceWhen}
                        priceLevel={priceLevel}
                        onPriceLevel={setPriceLevel}
                        invalid={showFieldErrors && missing.priceLevel}
                      />
                    </div>
                  </SideBlock>
                  <div className="space-y-5 border-t border-line pt-5">
                    <SideBlock title="Short">
                      <div className={rowClass}>
                        <PriceTriggerFields
                          desk={desk}
                          priceSource={shortPriceSource}
                          onPriceSource={setShortPriceSource}
                          priceWhen={shortPriceWhen}
                          onPriceWhen={setShortPriceWhen}
                          priceLevel={shortPriceLevel}
                          onPriceLevel={setShortPriceLevel}
                          invalid={showFieldErrors && missing.shortPriceLevel}
                        />
                      </div>
                    </SideBlock>
                  </div>
                </div>
              ) : (
                <PriceTriggerFields
                  desk={desk}
                  priceSource={priceSource}
                  onPriceSource={setPriceSource}
                  priceWhen={priceWhen}
                  onPriceWhen={setPriceWhen}
                  priceLevel={priceLevel}
                  onPriceLevel={setPriceLevel}
                  invalid={showFieldErrors && missing.priceLevel}
                />
              )}
              {desk === "perps" && orderType === "limit" ? (
                <Field label="Limit price" required>
                  <OffNumber
                    value={limitPrice}
                    onChange={setLimitPrice}
                    required
                    invalid={showFieldErrors && missing.limitPrice}
                  />
                </Field>
              ) : null}
            </div>
          )}
        </Group>

        {!closing ? (
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
                    ? (confirm ?? dcaFilterSpecForKind("rsi", entrySide))
                    : null,
                );
              }}
            >
              <DcaFilterBlock
                label="Kind"
                prefix="themeConfirm"
                side={entrySide}
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

        {!closing ? (
          <Group title={desk === "dca" ? "Initial Order Size" : "Order Size"}>
            <div className={rowClass}>
              {desk === "dca" ? (
                <>
                  <Field label="Size unit" required>
                    <select
                      value={sizeUnit}
                      onChange={(event) =>
                        setSizeUnit(event.target.value as "qty" | "usdt")
                      }
                      className={fieldClass}
                    >
                      <option value="usdt">USDT</option>
                      <option value="qty">Token qty</option>
                    </select>
                  </Field>
                  <Field label="Order size" required>
                    <GroupedNumberInput
                      value={size}
                      onChange={setSize}
                      allowDecimal
                      className={
                        showFieldErrors && missing.size
                          ? fieldInvalidClass
                          : fieldClass
                      }
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Size" required>
                    <span className="relative mt-1 block">
                      {sizeUnit === "usdt" ? (
                        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
                          $
                        </span>
                      ) : null}
                      <GroupedNumberInput
                        value={size}
                        onChange={setSize}
                        allowDecimal
                        className={`${
                          showFieldErrors && missing.size
                            ? fieldInvalidClass
                            : fieldClass
                        } ${sizeUnit === "usdt" ? "pl-7" : ""}`}
                      />
                    </span>
                  </Field>
                  <Field label="Unit" required>
                    <select
                      value={sizeUnit}
                      onChange={(event) => {
                        setSizeUnit(event.target.value as "qty" | "usdt");
                        setSize("");
                      }}
                      className={fieldClass}
                    >
                      <option value="usdt">USDT</option>
                      <option value="qty">
                        {SAMPLE_PAIRS.find((pair) => pair.symbol === symbol)
                          ?.baseCoin ?? "BTC"}
                      </option>
                    </select>
                  </Field>
                </>
              )}
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
        <Group
          title="Additional Order Rules"
          hint="How later clips are triggered and filled. Size and distance live in Additional Order Sizes."
        >
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
              <Field
                label="Spacing"
                hint="Percentage or ATR. Used for every add, not only the first."
                required
              >
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
        ) : null}

        {desk === "dca" ? (
        <Group
          title="Additional Order Sizes"
          hint="First-add distance plus how size and distance grow on later clips. Entry #1 uses Initial Order Size."
        >
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
          <div className={rowClass5}>
            <Field
              label="Order size multiplier"
              hint="Applies from Entry #2. 1 keeps every clip the same size. 1.5 means each later clip is 1.5× the last."
              required
            >
              <GroupedNumberInput
                value={sizeMultiplier}
                onChange={setSizeMultiplier}
                allowDecimal
                className={fieldClass}
              />
            </Field>
            {averaging === "dip" && spacingKind === "percent" ? (
              <Field
                label="Price deviation %"
                hint="Distance from the previous fill for Entry #2. Later adds use this times Price deviation multiplier."
                required
              >
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
                    className={
                      showFieldErrors && missing.atrPeriod
                        ? fieldInvalidClass
                        : fieldClass
                    }
                  />
                </Field>
                <Field
                  label="ATR spacing"
                  hint="Entry #2 distance in ATR multiples. Later adds use this times Price deviation multiplier."
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
            {averaging === "dip" ? (
              <Field
                label="Price deviation multiplier"
                hint="Applies from Entry #3. 1 keeps every add the same distance as Price deviation % or ATR spacing."
                required
              >
                <GroupedNumberInput
                  value={deviationMultiplier}
                  onChange={setDeviationMultiplier}
                  allowDecimal
                  className={fieldClass}
                />
              </Field>
            ) : null}
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
                  method={tpMethod === "atr" ? "atr" : "percent"}
                  onMethod={setTpMethod}
                  value={tpValue}
                  onValue={setTpValue}
                  basis={tpBasis}
                  onBasis={setTpBasis}
                  orderType={tpOrderType}
                  onOrderType={setTpOrderType}
                  atrPeriod={atrPeriod}
                  onAtrPeriod={setAtrPeriod}
                  atrPeriodInvalid={showFieldErrors && missing.atrPeriod}
                  invalid={showFieldErrors && missing.tpValue}
                />
              ) : (
                <div className={rowClass}>
                  <Field label="Type" required>
                    <select
                      className={fieldClass}
                      value={tpMethod === "percent" ? "percent" : "price"}
                      onChange={(event) => {
                        setTpMethod(
                          event.target.value === "percent" ? "percent" : "price",
                        );
                        setTpValue("");
                      }}
                    >
                      <option value="price">Price</option>
                      <option value="percent">Percentage</option>
                    </select>
                  </Field>
                  <Field
                    label={tpMethod === "percent" ? "%" : "Price"}
                    required
                  >
                    {tpMethod === "percent" ? (
                      <PercentField
                        value={tpValue}
                        onChange={setTpValue}
                        required
                        invalid={showFieldErrors && missing.tpValue}
                      />
                    ) : (
                      <OffNumber
                        value={tpValue}
                        onChange={setTpValue}
                        required
                        invalid={showFieldErrors && missing.tpValue}
                      />
                    )}
                  </Field>
                  <Field label="Trigger" required>
                    <select
                      className={fieldClass}
                      value={tpTrigger}
                      onChange={(event) => setTpTrigger(event.target.value)}
                    >
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
                        invalid={showFieldErrors && missing.tpLimitPrice}
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
                      <PercentField
                        value={trailTrigger}
                        onChange={setTrailTrigger}
                        required
                        invalid={showFieldErrors && missing.trailTrigger}
                      />
                    </Field>
                    <Field label="Trailing %" required>
                      <PercentField
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
                    <select
                      className={fieldClass}
                      value={slBasis}
                      onChange={(event) => setSlBasis(event.target.value)}
                    >
                      <option value="average">Average entry</option>
                      <option value="first_entry">First fill</option>
                    </select>
                  </Field>
                  <Field label="Stop loss %" required>
                    <PercentField
                      value={slValue}
                      onChange={setSlValue}
                      required
                      invalid={showFieldErrors && missing.slValue}
                    />
                  </Field>
                </div>
              ) : (
                <div className={rowClass}>
                  <Field label="Type" required>
                    <select
                      className={fieldClass}
                      value={slMethod === "percent" ? "percent" : "price"}
                      onChange={(event) => {
                        setSlMethod(
                          event.target.value === "percent" ? "percent" : "price",
                        );
                        setSlValue("");
                      }}
                    >
                      <option value="price">Price</option>
                      <option value="percent">Percentage</option>
                    </select>
                  </Field>
                  <Field
                    label={slMethod === "percent" ? "%" : "Price"}
                    required
                  >
                    {slMethod === "percent" ? (
                      <PercentField
                        value={slValue}
                        onChange={setSlValue}
                        required
                        invalid={showFieldErrors && missing.slValue}
                      />
                    ) : (
                      <OffNumber
                        value={slValue}
                        onChange={setSlValue}
                        required
                        invalid={showFieldErrors && missing.slValue}
                      />
                    )}
                  </Field>
                  <Field label="Trigger" required>
                    <select
                      className={fieldClass}
                      value={slTrigger}
                      onChange={(event) => setSlTrigger(event.target.value)}
                    >
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
                        invalid={showFieldErrors && missing.slLimitPrice}
                      />
                    </Field>
                  ) : null}
                </div>
              )}
            </OptionalSection>

            <OptionalSection
              title="Move Breakeven"
              enabled={breakevenOn}
              onEnabled={setBreakevenOn}
            >
              <div className={rowClass}>
                <Field label="Move stop to breakeven at %" required>
                  <PercentField
                    value={breakevenAt}
                    onChange={setBreakevenAt}
                    required
                    invalid={showFieldErrors && missing.breakevenAt}
                  />
                </Field>
                <Field label="Breakeven offset %">
                  <PercentField
                    value={breakevenOffset}
                    onChange={setBreakevenOffset}
                    placeholder="0"
                  />
                </Field>
              </div>
            </OptionalSection>

            {bothSides ? (
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
                hint={
                  desk === "perps"
                    ? "Flattens this bot's open size at market when the condition is true."
                    : undefined
                }
                enabled={exitIfOn}
                onEnabled={(next) => {
                  setExitIfOn(next);
                  setExitIf(
                    next
                      ? (exitIf ?? dcaFilterSpecForKind("rsi", entrySide))
                      : null,
                  );
                }}
              >
                <DcaFilterBlock
                  label="Kind"
                  prefix="themeExitIf"
                  side={entrySide}
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
            )}

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
                    className={
                      showFieldErrors && missing.maxOpenCount
                        ? fieldInvalidClass
                        : fieldClass
                    }
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
        {desk === "dca" ? (
          <ThemeDcaSummary
            bothSides={bothSides}
            ladderOpen={ladderOpen}
            onLadderOpen={setLadderOpen}
            ladderTab={ladderTab}
            onLadderTab={setLadderTab}
          />
        ) : null}
      </div>

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
    <>
      <div className="py-4">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          aria-expanded={ladderOpen}
          onClick={() => onLadderOpen(!ladderOpen)}
        >
          {ladderOpen ? "Hide Summary" : "Show Summary"}
          <ChevronIcon className={ladderOpen ? "rotate-90" : undefined} />
        </button>
      </div>
      {ladderOpen ? (
        <section className="-mx-5 w-[calc(100%+2.5rem)] space-y-3 rounded-b-card bg-surface px-5 py-5">
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
              className={`text-xs text-ink-muted ${
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
        </section>
      ) : null}
    </>
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
        <p className="text-xs text-ink-faint">
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
    <div className={rowClass}>
      <Field label="Basis" required>
        <select
          className={fieldClass}
          value={basis}
          onChange={(event) => onBasis(event.target.value)}
        >
          <option value="average">Average entry</option>
          <option value="first_entry">First fill</option>
        </select>
      </Field>
      <Field label="Method" required>
        <select
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
        </select>
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
