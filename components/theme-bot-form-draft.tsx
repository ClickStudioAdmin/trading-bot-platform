"use client";

import { useState, type ReactNode } from "react";
import { DcaFilterBlock } from "@/components/dca-filter-fields";
import { ChevronIcon, TabButton } from "@/components/trade-expand";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  DCA_CONFIRM_FIELD_LABEL,
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
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";

const fieldClass =
  "mt-1 w-full rounded-control border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
const labelClass = "block text-xs text-ink-muted";
const sectionTitleClass =
  "text-xs font-semibold uppercase tracking-[0.1em] text-ink";
const rowClass = "grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-4";
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

type DeskKind = "perps" | "dca";

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

function statusOptionsFor(desk: DeskKind) {
  return desk === "perps" ? PERPS_STATUS_OPTIONS : DCA_STATUS_OPTIONS;
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

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 py-5">
      <div>
        <h3 className={sectionTitleClass}>{title}</h3>
        {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
      </div>
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

const TRAIL_METHODS = [
  { value: "", label: "Off" },
  { value: "distance", label: "Distance" },
  { value: "percent", label: "Percentage" },
] as const;

type ExitMethod = (typeof EXIT_METHODS)[number]["value"];
type TrailMethod = (typeof TRAIL_METHODS)[number]["value"];
type StartKind = "price" | "indicator" | "trend" | "webhook";
type Action = "buy" | "sell" | "close_long" | "close_short";

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`${labelClass} ${className ?? ""}`}>
      {label}
      {hint ? (
        <span className="mt-0.5 block text-[11px] font-normal normal-case tracking-normal text-ink-faint">
          {hint}
        </span>
      ) : null}
      {children}
    </label>
  );
}

function OffNumber({
  value,
  onChange,
  allowDecimal = true,
}: {
  value: string;
  onChange: (next: string) => void;
  allowDecimal?: boolean;
}) {
  return (
    <GroupedNumberInput
      value={value}
      onChange={onChange}
      allowDecimal={allowDecimal}
      placeholder="Off"
      className={fieldClass}
    />
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
  const [confirm, setConfirm] = useState<DcaFilterSpec | null>(null);
  const [size, setSize] = useState("100");
  const [sizeUnit, setSizeUnit] = useState<"qty" | "usdt">("usdt");
  const [tpMethod, setTpMethod] = useState<ExitMethod>("percent");
  const [tpValue, setTpValue] = useState("");
  const [tpOrderType, setTpOrderType] = useState("market");
  const [trailMethod, setTrailMethod] = useState<TrailMethod>("");
  const [trailValue, setTrailValue] = useState("");
  const [trailTrigger, setTrailTrigger] = useState("");
  const [slMethod, setSlMethod] = useState<ExitMethod>("");
  const [slValue, setSlValue] = useState("");
  const [slOrderType, setSlOrderType] = useState("market");
  const [breakevenAt, setBreakevenAt] = useState("");
  const [breakevenOffset, setBreakevenOffset] = useState("0");
  const [exitIf, setExitIf] = useState<DcaFilterSpec | null>(null);
  const [skipIfOpen, setSkipIfOpen] = useState(true);
  const [restGrid, setRestGrid] = useState(true);
  const [desk, setDesk] = useState<DeskKind>("perps");
  const [status, setStatus] = useState("active");
  const closing = action === "close_long" || action === "close_short";
  const statusOptions = statusOptionsFor(desk);
  const selectedStatus =
    statusOptions.find((option) => option.value === status) ?? statusOptions[0];
  const startKindForFields =
    startKind === "trend" ? "supertrend" : indicatorKind;
  const whenOptions = dcaIndicatorWhenOptions(startKindForFields, "long", false);
  const showPeriod =
    startKind === "trend" || dcaIndicatorUsesPeriod(indicatorKind);
  const showPair = startKind === "indicator" && dcaIndicatorUsesPairPeriods(indicatorKind);
  const showLevel =
    startKind === "indicator" &&
    dcaIndicatorShowsLevel(indicatorKind, when, level);
  const showStartParams = startKind !== "webhook" && !closing;

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        Draft standard for every desk. Local only — nothing saves. Same
        chrome on every bot: Actions are one-shot, Status is a dropdown.
        Disabled closes that bot’s positions. Switch the sample desk to
        see each status list.
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
            onClick={() => {
              setDesk("perps");
              setStatus("active");
            }}
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
            onClick={() => {
              setDesk("dca");
              setStatus("active");
            }}
          >
            DCA
          </button>
        </div>
      </div>

      <div className="divide-y divide-line rounded-card border border-line bg-canvas px-5">
        <Group title="Bot">
        <div className="grid items-start gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto_16rem]">
          <Field label="Name">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
            />
          </Field>
          <div>
            <p className={labelClass}>Actions</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <button type="button" className={headerPrimaryClass}>
                Save
              </button>
            </div>
          </div>
          <div>
            <p className={labelClass}>Status</p>
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
            <p
              className={`mt-1.5 text-[11px] ${
                selectedStatus.value === "disabled"
                  ? "text-warning"
                  : "text-ink-faint"
              }`}
            >
              {selectedStatus.note}
            </p>
          </div>
        </div>
        </Group>

        <Group title="Pair and start">
          <div className={rowClass}>
            <Field label="Contract">
              <select
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                className={fieldClass}
              >
                <option value="BTCUSDT">BTC-USDT</option>
                <option value="ETHUSDT">ETH-USDT</option>
                <option value="SOLUSDT">SOL-USDT</option>
              </select>
            </Field>
            <Field label="Action">
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
            <Field label="Order">
              <span className="mt-1 flex w-fit rounded-control border border-line bg-surface p-0.5">
                <button
                  type="button"
                  className="rounded-control bg-surface-raised px-3 py-1.5 text-sm font-medium text-ink"
                >
                  Market
                </button>
                <button
                  type="button"
                  className="rounded-control px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
                >
                  Limit
                </button>
              </span>
            </Field>
            <Field label="Start">
              <select
                value={startKind}
                onChange={(event) => {
                  const next = event.target.value as StartKind;
                  setStartKind(next);
                  if (next === "trend") {
                    setWhen("cross_gte");
                    setPeriod(String(DEFAULT_DCA_SUPERTREND_PERIOD));
                  } else if (next === "indicator") {
                    setWhen("cross_lte");
                    setPeriod(String(DEFAULT_DCA_RSI_PERIOD));
                  }
                }}
                className={fieldClass}
              >
                <option value="price">Price</option>
                <option value="indicator">Indicator</option>
                <option value="trend">Trend</option>
                <option value="webhook">Webhook</option>
              </select>
            </Field>
          </div>

          {startKind === "webhook" && !closing ? (
            <div className={rowClass}>
              <Field label="Webhook" className="lg:col-span-2">
                <select className={fieldClass} defaultValue="">
                  <option value="">Pick a Signal webhook</option>
                  <option value="sample">Sample signal</option>
                </select>
              </Field>
            </div>
          ) : null}

          {startKind === "price" && !closing ? (
            <div className={rowClass}>
              <Field label="Price source">
                <select
                  value={priceSource}
                  onChange={(event) => setPriceSource(event.target.value)}
                  className={fieldClass}
                >
                  <option value="last">Last</option>
                  <option value="mark">Mark</option>
                  <option value="index">Index</option>
                </select>
              </Field>
              <Field label="When">
                <select
                  value={priceWhen}
                  onChange={(event) => setPriceWhen(event.target.value)}
                  className={fieldClass}
                >
                  <option value="gte">At or above</option>
                  <option value="lte">At or below</option>
                </select>
              </Field>
              <Field label="Price">
                <OffNumber value={priceLevel} onChange={setPriceLevel} />
              </Field>
            </div>
          ) : null}

          {showStartParams && startKind !== "price" ? (
            <div className={rowClass}>
              {startKind === "indicator" ? (
                <Field label="Indicator">
                  <select
                    value={indicatorKind}
                    onChange={(event) => {
                      const kind = event.target.value as DcaIndicatorKind;
                      setIndicatorKind(kind);
                      setPeriod(String(defaultDcaIndicatorPeriod(kind)));
                      setSlowPeriod(String(defaultDcaIndicatorSlowPeriod(kind)));
                      setLevel(
                        defaultDcaIndicatorLevel(kind) == null
                          ? ""
                          : String(defaultDcaIndicatorLevel(kind)),
                      );
                      const options = dcaIndicatorWhenOptions(kind, "long", false);
                      setWhen(options[0]?.value ?? "gte");
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
                <Field label="Trend">
                  <select className={fieldClass} value="supertrend" disabled>
                    <option value="supertrend">Supertrend</option>
                  </select>
                </Field>
              )}
              {showPeriod ? (
                <Field label="Period">
                  <GroupedNumberInput
                    value={period}
                    onChange={setPeriod}
                    className={fieldClass}
                  />
                </Field>
              ) : null}
              {showPair ? (
                <Field label="Slow">
                  <GroupedNumberInput
                    value={slowPeriod}
                    onChange={setSlowPeriod}
                    className={fieldClass}
                  />
                </Field>
              ) : null}
              {startKind === "trend" ? (
                <Field label="Multiplier">
                  <GroupedNumberInput
                    value={multiplier}
                    onChange={setMultiplier}
                    allowDecimal
                    className={fieldClass}
                  />
                </Field>
              ) : null}
              <Field label="Timeframe">
                <select
                  value={timeframe}
                  onChange={(event) =>
                    setTimeframe(event.target.value as DcaIndicatorTimeframe)
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
              <Field label="When" className="lg:col-span-2">
                <select
                  value={when}
                  onChange={(event) => setWhen(event.target.value)}
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
                <Field label="Level">
                  <GroupedNumberInput
                    value={level}
                    onChange={setLevel}
                    allowDecimal
                    className={fieldClass}
                  />
                </Field>
              ) : null}
            </div>
          ) : null}

        </Group>

        {!closing ? (
          <Group title="Confirm" hint={DCA_CONFIRM_FIELD_LABEL}>
            <DcaFilterBlock
              label="Filter"
              prefix="themeConfirm"
              side="long"
              spec={confirm}
              onChange={setConfirm}
              dense
              fieldClass={fieldClass}
              labelClass={labelClass}
            />
          </Group>
        ) : null}

        {!closing ? (
          <Group title="Size">
            <div className={rowClass}>
              <Field label="Size">
                <GroupedNumberInput
                  value={size}
                  onChange={setSize}
                  allowDecimal
                  className={fieldClass}
                />
              </Field>
              <Field label="Unit">
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
          <Group title="Size">
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
          title="Strategy extras"
          hint="DCA / scale-in only. Not on the Perps baseline."
        >
          <div className="mb-2 flex flex-wrap gap-2">
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
          <div className={rowClass}>
            <Field label="Additional orders">
              <select className={fieldClass} defaultValue="dip">
                <option value="dip">Price deviation</option>
                <option value="interval">Interval</option>
              </select>
            </Field>
            <Field label="Size multiplier">
              <GroupedNumberInput
                value="1"
                onChange={() => undefined}
                allowDecimal
                className={fieldClass}
              />
            </Field>
            <Field label="Price deviation multiplier">
              <GroupedNumberInput
                value="1"
                onChange={() => undefined}
                allowDecimal
                className={fieldClass}
              />
            </Field>
          </div>
          <label className="mt-2 flex items-start gap-2 text-xs text-ink">
            <input
              type="checkbox"
              checked={restGrid}
              onChange={(event) => setRestGrid(event.target.checked)}
              className="mt-0.5 size-4 accent-accent"
            />
            Remaining orders placed as GTC limit (instead of market)
          </label>
        </Group>
        ) : null}

        {!closing ? (
          <>
            <Group title="Take profit">
              <ExitMethodFields
                method={tpMethod}
                onMethod={setTpMethod}
                value={tpValue}
                onValue={setTpValue}
                orderType={tpOrderType}
                onOrderType={setTpOrderType}
              />
            </Group>

            <Group title="Trailing stop">
              <div className={rowClass}>
                <Field label="Method">
                  <select
                    value={trailMethod}
                    onChange={(event) =>
                      setTrailMethod(event.target.value as TrailMethod)
                    }
                    className={fieldClass}
                  >
                    {TRAIL_METHODS.map((option) => (
                      <option key={option.value || "off"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                {trailMethod === "distance" ? (
                  <>
                    <Field label="Retracement">
                      <OffNumber value={trailValue} onChange={setTrailValue} />
                    </Field>
                    <Field label="Activation price" hint="Empty is Off.">
                      <OffNumber
                        value={trailTrigger}
                        onChange={setTrailTrigger}
                      />
                    </Field>
                  </>
                ) : null}
                {trailMethod === "percent" ? (
                  <>
                    <Field
                      label="Trigger %"
                      hint="Trail starts after price moves this %."
                    >
                      <OffNumber
                        value={trailTrigger}
                        onChange={setTrailTrigger}
                      />
                    </Field>
                    <Field label="Trailing %">
                      <OffNumber value={trailValue} onChange={setTrailValue} />
                    </Field>
                  </>
                ) : null}
              </div>
            </Group>

            <Group title="Stop loss">
              <ExitMethodFields
                method={slMethod}
                onMethod={setSlMethod}
                value={slValue}
                onValue={setSlValue}
                orderType={slOrderType}
                onOrderType={setSlOrderType}
              />
            </Group>

            <Group title="Move breakeven">
              <div className={rowClass}>
                <Field label="Move stop to breakeven at %">
                  <OffNumber value={breakevenAt} onChange={setBreakevenAt} />
                </Field>
                <Field label="Breakeven offset %">
                  <OffNumber
                    value={breakevenOffset}
                    onChange={setBreakevenOffset}
                  />
                </Field>
              </div>
            </Group>

            <Group title="Exit-if">
              <DcaFilterBlock
                label="Filter"
                prefix="themeExitIf"
                side="long"
                spec={exitIf}
                onChange={setExitIf}
                dense
                fieldClass={fieldClass}
                labelClass={labelClass}
              />
            </Group>

            <section className="py-5">
              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={skipIfOpen}
                  onChange={(event) => setSkipIfOpen(event.target.checked)}
                  className="mt-0.5 size-4 accent-accent"
                />
                <span>
                  Skip if this side is already open
                  <span className="mt-1 block text-xs text-ink-muted">
                    Flag only. Off means a new fire can add to the same row.
                  </span>
                </span>
              </label>
            </section>
          </>
        ) : null}

        <section className="flex flex-wrap items-center justify-end gap-2 py-5">
          <button type="button" className={headerGhostClass}>
            Backtest
          </button>
          <button type="button" className={headerGhostClass}>
            Save as template
          </button>
          <button type="button" className={headerGhostClass}>
            Save as platform template
          </button>
          <button type="button" className={headerRemoveClass}>
            Remove
          </button>
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
}: {
  method: ExitMethod;
  onMethod: (next: ExitMethod) => void;
  value: string;
  onValue: (next: string) => void;
  orderType: string;
  onOrderType: (next: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className={rowClass}>
        <Field label="Method">
          <select
            value={method}
            onChange={(event) => onMethod(event.target.value as ExitMethod)}
            className={fieldClass}
          >
            {EXIT_METHODS.map((option) => (
              <option key={option.value || "off"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        {method === "price" ? (
          <Field label="Price">
            <OffNumber value={value} onChange={onValue} />
          </Field>
        ) : null}
        {method === "percent" ? (
          <Field label="Target %">
            <OffNumber value={value} onChange={onValue} />
          </Field>
        ) : null}
        {method === "atr" ? (
          <Field label="ATR multiple">
            <OffNumber value={value || "2"} onChange={onValue} />
          </Field>
        ) : null}
      </div>
      {method ? (
        <div className={rowClass}>
          {method !== "price" ? (
            <Field label="Basis">
              <select className={fieldClass} defaultValue="first_entry">
                <option value="first_entry">First fill</option>
                <option value="average">Average entry</option>
              </select>
            </Field>
          ) : (
            <Field label="Trigger">
              <select className={fieldClass} defaultValue="last">
                <option value="last">Last</option>
                <option value="mark">Mark</option>
                <option value="index">Index</option>
              </select>
            </Field>
          )}
          <Field label="Order type">
            <select
              value={orderType}
              onChange={(event) => onOrderType(event.target.value)}
              className={fieldClass}
            >
              <option value="market">Market</option>
              <option value="limit">Limit</option>
            </select>
          </Field>
        </div>
      ) : null}
    </div>
  );
}
