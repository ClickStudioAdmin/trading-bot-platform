"use client";

import { useState, type ReactNode } from "react";
import { DcaFilterBlock } from "@/components/dca-filter-fields";
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
const subTitleClass =
  "text-xs font-medium uppercase tracking-[0.08em] text-ink";
const rowClass = "grid gap-x-3 gap-y-3 sm:grid-cols-2";

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
    <section className="space-y-3 border-t border-line pt-5">
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
  const closing = action === "close_long" || action === "close_short";
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
        Draft standard for every desk. Local only — nothing saves. Optional
        features use <span className="text-ink">Off</span>, not a checkbox that
        hides the section. Checkboxes are flags only.
      </p>

      <div className="space-y-0 rounded-card border border-line bg-canvas p-5">
        <section className="space-y-3 pb-5">
        <div className={rowClass}>
          <Field label="Name">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field label="Mode">
            <select disabled className={fieldClass} defaultValue="active">
              <option value="active">Active</option>
              <option value="reduce_only">Reduce only</option>
              <option value="disabled">Disabled</option>
            </select>
          </Field>
        </div>
        </section>

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
            <Field label="Webhook">
              <select className={fieldClass} defaultValue="">
                <option value="">Pick a Signal webhook</option>
                <option value="sample">Sample signal</option>
              </select>
            </Field>
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
              <Field label="When" className="sm:col-span-2">
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

          {!closing ? (
            <DcaFilterBlock
              label={DCA_CONFIRM_FIELD_LABEL}
              prefix="themeConfirm"
              side="long"
              spec={confirm}
              onChange={setConfirm}
              fieldClass={fieldClass}
              labelClass={labelClass}
            />
          ) : null}
        </Group>

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
            <Field label="Qty to close" hint="Empty closes the whole row.">
              <GroupedNumberInput
                value={size}
                onChange={setSize}
                allowDecimal
                placeholder="All"
                className={fieldClass}
              />
            </Field>
          </Group>
        )}

        <Group
          title="Strategy extras"
          hint="DCA / scale-in only. Not on the Perps baseline."
        >
          <div className={rowClass}>
            <Field label="Additional orders">
              <select disabled className={fieldClass} defaultValue="dip">
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
          </div>
        </Group>

        {!closing ? (
          <>
            <div className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
              <Group title="Take profit">
                <ExitMethodFields
                  method={tpMethod}
                  onMethod={setTpMethod}
                  value={tpValue}
                  onValue={setTpValue}
                  orderType={tpOrderType}
                  onOrderType={setTpOrderType}
                />
                <div className="space-y-3 border-t border-line pt-5">
                  <h4 className={subTitleClass}>Trailing stop</h4>
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
                    <div className={rowClass}>
                      <Field label="Retracement">
                        <OffNumber value={trailValue} onChange={setTrailValue} />
                      </Field>
                      <Field
                        label="Activation price"
                        hint="Empty is Off."
                      >
                        <OffNumber
                          value={trailTrigger}
                          onChange={setTrailTrigger}
                        />
                      </Field>
                    </div>
                  ) : null}
                  {trailMethod === "percent" ? (
                    <div className={rowClass}>
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
                    </div>
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
                <div className="space-y-3 border-t border-line pt-5">
                  <h4 className={subTitleClass}>Move breakeven</h4>
                  <div className={rowClass}>
                    <Field label="Move stop to breakeven at %">
                      <OffNumber
                        value={breakevenAt}
                        onChange={setBreakevenAt}
                      />
                    </Field>
                    <Field label="Breakeven offset %">
                      <OffNumber
                        value={breakevenOffset}
                        onChange={setBreakevenOffset}
                      />
                    </Field>
                  </div>
                </div>
                <div className="space-y-3 border-t border-line pt-5">
                  <DcaFilterBlock
                    label="Exit-if"
                    prefix="themeExitIf"
                    side="long"
                    spec={exitIf}
                    onChange={setExitIf}
                    fieldClass={fieldClass}
                    labelClass={labelClass}
                  />
                </div>
              </Group>
            </div>

            <label className="flex items-start gap-2 border-t border-line pt-5 text-sm text-ink">
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
          </>
        ) : null}
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
