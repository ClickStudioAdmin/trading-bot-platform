"use client";

import { useState } from "react";
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
  deskActionBtnClass,
  deskActionSelectClass,
  triggerSectionTitle,
} from "@/components/bot-form-chrome";
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
  keepFormKeys,
} from "@/components/stay-on-page-form";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  disableConfirmMessage,
  disableConfirmTitle,
  disableNeedsConfirm,
} from "@/lib/bots/status";
import { parseAutomationMode } from "@/lib/engine/decide";
import {
  saveFuturesAutomations,
  type SaveFuturesAutomationsResult,
} from "@/lib/futures/actions";
import {
  cloneFuturesAutomationForm,
  defaultFuturesAutomationForm,
  parseAutomationEntry,
  parseFuturesAutomationForm,
  type FuturesAutomationFormValues,
} from "@/lib/futures/automation";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import type { FuturesWebhookRow } from "@/lib/futures/webhook-load";
import {
  BacktestTemplateLink,
  type BacktestLibraryItem,
} from "@/components/backtest-dialog";
import { snapshotPerpsRecipe } from "@/lib/templates/recipe";
import {
  dcaFilterComplete,
  dcaFilterSpecForKind,
  type DcaFilterSpec,
} from "@/lib/dca/filters";
import {
  DEFAULT_DCA_RSI_PERIOD,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DEFAULT_DCA_SUPERTREND_PERIOD,
  indicatorCompareForDirection,
  parseDcaIndicatorCompare,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import type { DcaIndicatorStart } from "@/lib/dca/playbook";
import type { FuturesOrderType, FuturesSide, FuturesTrigger } from "@/lib/futures/model";
import type { FuturesTpslLevelKind } from "@/lib/futures/tpsl";
import { DeskTemplateBar, SaveAsTemplateButton } from "@/components/template-modals";
import { perpsFormToSnapshotSource } from "@/lib/templates/recipe";
import type { AppliedDeskItem } from "@/lib/templates/apply";
import type { AutomationTemplateSet, TemplateSummary } from "@/lib/templates/store";

export function FuturesAutomationsDesk({
  rules,
  options,
  triggerWebhooks = [],
  inUseRuleIds = [],
  reduceOnly = false,
  isAdmin = false,
  accountId,
  templates = [],
  sets = [],
  venueId = "bybit",
  quoteLabel = "USDT",
  venueEnvironment = null,
  backtestLibrary = [],
}: {
  rules: FuturesAutomationFormValues[];
  options: LinearPerp[];
  triggerWebhooks?: Pick<FuturesWebhookRow, "id" | "name">[];
  inUseRuleIds?: string[];
  reduceOnly?: boolean;
  isAdmin?: boolean;
  accountId?: string;
  templates?: TemplateSummary[];
  sets?: AutomationTemplateSet[];
  venueId?: string;
  quoteLabel?: string;
  venueEnvironment?: string | null;
  backtestLibrary?: BacktestLibraryItem[];
}) {
  const [layers, setLayers] = useState(() => [...rules].reverse());
  const [extraLibrary, setExtraLibrary] = useState<BacktestLibraryItem[]>([]);
  const library = [...backtestLibrary, ...extraLibrary];
  const [cloneMenu, setCloneMenu] = useState(0);
  const empty = layers.length === 0;
  const inUse = new Set(inUseRuleIds);
  const cloneSources = layers.filter((layer) => layer.id);
  const preferredSymbol = venueId === "hyperliquid" ? "BTC" : "BTCUSDT";
  const defaultSymbol =
    options.find((row) => row.symbol === preferredSymbol)?.symbol ??
    options[0]?.symbol ??
    preferredSymbol;

  function appendApplied(items: AppliedDeskItem[]) {
    const nextRules = items
      .filter(
        (item): item is Extract<AppliedDeskItem, { deskType: "perps" }> =>
          item.deskType === "perps",
      )
      .map((item) => item.rule);
    if (nextRules.length === 0) {
      return;
    }
    setLayers((current) => {
      const seen = new Set(current.map((row) => row.id).filter(Boolean));
      const fresh = nextRules.filter((row) => !row.id || !seen.has(row.id));
      return fresh.length === 0 ? current : [...fresh, ...current];
    });
  }

  function applySaveResult(result: SaveFuturesAutomationsResult) {
    if (!result.ok || !result.forms) {
      return;
    }
    setLayers((current) =>
      keepFormKeys(current, [...(result.forms ?? [])].reverse()),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setLayers((current) => [
              defaultFuturesAutomationForm(current.length, defaultSymbol),
              ...current,
            ])
          }
          className={deskActionBtnClass}
        >
          Create New Bot
        </button>
        {accountId ? (
          <DeskTemplateBar
            deskType="perps"
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
              const key = event.target.value;
              const source = cloneSources.find((item) => item.key === key);
              if (!source) {
                return;
              }
              setLayers((current) => [
                cloneFuturesAutomationForm(source),
                ...current,
              ]);
              setCloneMenu((n) => n + 1);
            }}
            className={deskActionSelectClass}
          >
            <option value="">Clone existing bot</option>
            {cloneSources.map((item) => (
              <option key={item.key} value={item.key}>
                {item.name} · {item.symbol}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {empty ? (
        <p className="rounded-card border border-line bg-canvas px-4 py-6 text-sm text-ink-muted">
          No bots yet. Add a bot to fire Buy, Sell, or Close on a price
          cross, Indicator, Trend, or a Signal webhook.
        </p>
      ) : (
        layers.map((layer) => (
          <RuleCard
            key={layer.key}
            layer={layer}
            options={options}
            triggerWebhooks={triggerWebhooks}
            accountReduceOnly={reduceOnly}
            inUse={Boolean(layer.id && inUse.has(layer.id))}
            isAdmin={isAdmin}
            folders={sets}
            quoteLabel={quoteLabel}
            venueId={venueId}
            venueEnvironment={venueEnvironment}
            backtestLibrary={library}
            onSaved={applySaveResult}
            onTemplateSaved={(item) =>
              setExtraLibrary((current) => [
                ...current.filter((row) => row.id !== item.id),
                item,
              ])
            }
            onRemove={() => {
              const next = layers.filter((item) => item.key !== layer.key);
              setLayers(next);
              if (next.length === 0) {
                const data = new FormData();
                data.set("ruleCount", "0");
                void saveFuturesAutomations(data).then(applySaveResult);
              }
            }}
          />
        ))
      )}
    </div>
  );
}

function RuleCard({
  layer,
  options,
  triggerWebhooks,
  accountReduceOnly,
  inUse,
  isAdmin,
  onRemove,
  onSaved,
  folders = [],
  quoteLabel = "USDT",
  venueId = "bybit",
  venueEnvironment = null,
  backtestLibrary = [],
  onTemplateSaved,
}: {
  layer: FuturesAutomationFormValues;
  options: LinearPerp[];
  triggerWebhooks: Pick<FuturesWebhookRow, "id" | "name">[];
  accountReduceOnly: boolean;
  inUse: boolean;
  isAdmin: boolean;
  onRemove: () => void;
  onSaved: (result: SaveFuturesAutomationsResult) => void;
  folders?: AutomationTemplateSet[];
  quoteLabel?: string;
  venueId?: string;
  venueEnvironment?: string | null;
  backtestLibrary?: BacktestLibraryItem[];
  onTemplateSaved?: (item: BacktestLibraryItem) => void;
}) {
  const prefix = "r0_";
  const [dirty, setDirty] = useState(!layer.id);
  const [mode, setMode] = useState(layer.mode);
  const [formAction, setFormAction] = useState(layer.formAction);
  const [orderType, setOrderType] = useState(layer.orderType);
  const [sizeUnit, setSizeUnit] = useState(layer.sizeUnit);
  const [size, setSize] = useState(layer.size);
  const [limitPrice, setLimitPrice] = useState(layer.limitPrice);
  const [triggerPrice, setTriggerPrice] = useState(layer.triggerPrice);
  const [symbol, setSymbol] = useState(layer.symbol);
  const [entrySource, setEntrySource] = useState(layer.entrySource);
  const [webhookId, setWebhookId] = useState(layer.webhookId);
  const entrySide: FuturesSide = formAction === "sell" ? "short" : "long";
  const [indicatorKind, setIndicatorKind] = useState<DcaIndicatorKind>(
    layer.indicator?.kind ??
      (layer.entrySource === "trend" ? "supertrend" : "rsi"),
  );
  const [indicatorTimeframe, setIndicatorTimeframe] =
    useState<DcaIndicatorTimeframe>(layer.indicator?.timeframe ?? "15");
  const [indicatorCompare, setIndicatorCompare] = useState(
    layer.indicator?.compare ??
      indicatorCompareForDirection(
        layer.formAction === "sell" ? "short" : "long",
        layer.indicator?.kind ??
          (layer.entrySource === "trend" ? "supertrend" : "rsi"),
        "",
      ),
  );
  const [indicatorLevel, setIndicatorLevel] = useState(
    layer.indicator?.level != null
      ? String(layer.indicator.level)
      : layer.formAction === "sell"
        ? "70"
        : "30",
  );
  const [indicatorPeriod, setIndicatorPeriod] = useState(
    String(
      layer.indicator?.period ??
        (layer.entrySource === "trend"
          ? DEFAULT_DCA_SUPERTREND_PERIOD
          : DEFAULT_DCA_RSI_PERIOD),
    ),
  );
  const [indicatorSlowPeriod, setIndicatorSlowPeriod] = useState(
    layer.indicator?.slowPeriod != null
      ? String(layer.indicator.slowPeriod)
      : "",
  );
  const [indicatorMultiplier, setIndicatorMultiplier] = useState(
    String(layer.indicator?.multiplier ?? DEFAULT_DCA_SUPERTREND_MULTIPLIER),
  );
  const [confirm, setConfirm] = useState<DcaFilterSpec | null>(
    layer.confirm ?? null,
  );
  const [exitIf, setExitIf] = useState<DcaFilterSpec | null>(
    layer.exitIf ?? null,
  );
  const [breakevenOn, setBreakevenOn] = useState(
    layer.breakevenActivationPct.trim() !== "",
  );
  const [breakevenActivationPct, setBreakevenActivationPct] = useState(
    layer.breakevenActivationPct,
  );
  const [breakevenOffsetPct, setBreakevenOffsetPct] = useState(
    layer.breakevenOffsetPct,
  );
  const [tpOn, setTpOn] = useState(() => layer.tpsl?.takeProfit != null);
  const [slOn, setSlOn] = useState(() => layer.tpsl?.stopLoss != null);
  const [trailOn, setTrailOn] = useState(
    () => Boolean(layer.trailing && layer.trailing.distance > 0),
  );
  const [takeProfit, setTakeProfit] = useState(
    layer.tpsl?.takeProfit != null ? String(layer.tpsl.takeProfit) : "",
  );
  const [stopLoss, setStopLoss] = useState(
    layer.tpsl?.stopLoss != null ? String(layer.tpsl.stopLoss) : "",
  );
  const [tpKind, setTpKind] = useState<FuturesTpslLevelKind>(
    layer.tpsl?.tpKind === "percent" ? "percent" : "price",
  );
  const [slKind, setSlKind] = useState<FuturesTpslLevelKind>(
    layer.tpsl?.slKind === "percent" ? "percent" : "price",
  );
  const [tpTrigger, setTpTrigger] = useState<FuturesTrigger>(
    layer.tpsl?.tpTrigger ?? "last",
  );
  const [slTrigger, setSlTrigger] = useState<FuturesTrigger>(
    layer.tpsl?.slTrigger ?? "last",
  );
  const [tpOrderType, setTpOrderType] = useState<FuturesOrderType>(
    layer.tpsl?.tpOrderType === "limit" ? "limit" : "market",
  );
  const [slOrderType, setSlOrderType] = useState<FuturesOrderType>(
    layer.tpsl?.slOrderType === "limit" ? "limit" : "market",
  );
  const [tpLimitPrice, setTpLimitPrice] = useState(
    layer.tpsl?.tpLimitPrice != null ? String(layer.tpsl.tpLimitPrice) : "",
  );
  const [slLimitPrice, setSlLimitPrice] = useState(
    layer.tpsl?.slLimitPrice != null ? String(layer.tpsl.slLimitPrice) : "",
  );
  const [trailingStop, setTrailingStop] = useState(
    layer.trailing != null ? String(layer.trailing.distance) : "",
  );
  const [trailingActive, setTrailingActive] = useState(
    layer.trailing?.activePrice != null ? String(layer.trailing.activePrice) : "",
  );
  const closing = formAction === "close_long" || formAction === "close_short";
  const tpMissing = tpOn && takeProfit.trim() === "";
  const slMissing = slOn && stopLoss.trim() === "";
  const trailMissing = trailOn && trailingStop.trim() === "";
  const breakevenMissing =
    !closing && breakevenOn && breakevenActivationPct.trim() === "";
  const tpLimitMissing =
    tpOn && tpOrderType === "limit" && tpLimitPrice.trim() === "";
  const slLimitMissing =
    slOn && slOrderType === "limit" && slLimitPrice.trim() === "";
  const confirmMissing = Boolean(confirm) && !dcaFilterComplete(confirm);
  const exitIfMissing = Boolean(exitIf) && !dcaFilterComplete(exitIf);
  const tpsl =
    tpOn || slOn
      ? {
          takeProfit: tpOn ? Number(takeProfit.replace(/,/g, "")) || null : null,
          stopLoss: slOn ? Number(stopLoss.replace(/,/g, "")) || null : null,
          tpKind: tpOn ? tpKind : "price",
          slKind: slOn ? slKind : "price",
          tpTrigger,
          slTrigger,
          mode: layer.tpsl?.mode ?? "full",
          tpQty: layer.tpsl?.tpQty ?? null,
          slQty: layer.tpsl?.slQty ?? null,
          tpOrderType,
          slOrderType,
          tpLimitPrice:
            tpOn && tpOrderType === "limit"
              ? Number(tpLimitPrice.replace(/,/g, "")) || null
              : null,
          slLimitPrice:
            slOn && slOrderType === "limit"
              ? Number(slLimitPrice.replace(/,/g, "")) || null
              : null,
        }
      : null;
  const trailing =
        trailOn && Number(trailingStop.replace(/,/g, "")) > 0
      ? {
          distance: Number(trailingStop.replace(/,/g, "")),
          activePrice: Number(trailingActive.replace(/,/g, "")) || null,
          peak: layer.trailing?.peak ?? null,
        }
      : null;
  const webhookEntry = entrySource === "webhook";
  const whenWebhooks =
    webhookId && !triggerWebhooks.some((hook) => hook.id === webhookId)
      ? [...triggerWebhooks, { id: webhookId, name: "Webhook (removed)" }]
      : triggerWebhooks;
  const selected = options.find((row) => row.symbol === symbol);
  const baseCoin = selected?.baseCoin ?? "Token";
  function liveIndicator(): DcaIndicatorStart | null {
    if (entrySource !== "indicator" && entrySource !== "trend") {
      return null;
    }
    return {
      kind: indicatorKind,
      timeframe: indicatorTimeframe,
      compare: parseDcaIndicatorCompare(indicatorCompare),
      level: Number(indicatorLevel) || null,
      period: Number(indicatorPeriod) || null,
      slowPeriod: Number(indicatorSlowPeriod) || null,
      multiplier: Number(indicatorMultiplier) || null,
    };
  }
  const snapshotLayer: FuturesAutomationFormValues = {
    ...layer,
    mode,
    formAction,
    orderType,
    sizeUnit,
    size,
    limitPrice,
    triggerPrice,
    symbol,
    entrySource,
    webhookId,
    tpsl,
    trailing,
    indicator: liveIndicator(),
    confirm: closing ? null : confirm,
    exitIf: closing ? null : exitIf,
    breakevenActivationPct:
      closing || !breakevenOn ? "" : breakevenActivationPct,
    breakevenOffsetPct: closing || !breakevenOn ? "" : breakevenOffsetPct,
  };
  let parsedLive: ReturnType<typeof parseFuturesAutomationForm>;
  try {
    parsedLive = parseFuturesAutomationForm(
      perpsFormToSnapshotSource(snapshotLayer, venueId),
      venueId,
    );
  } catch {
    parsedLive = { ok: false, error: "Could not read the form." };
  }
  const requiredMissing =
    tpMissing ||
    slMissing ||
    trailMissing ||
    breakevenMissing ||
    tpLimitMissing ||
    slLimitMissing ||
    confirmMissing ||
    exitIfMissing ||
    !parsedLive.ok;
  function liveRecipe() {
    return snapshotPerpsRecipe({
      name: layer.name,
      symbol,
      action:
        formAction === "sell"
          ? "sell"
          : formAction === "close_long" || formAction === "close_short"
            ? "flatten"
            : "buy",
      closeSide:
        formAction === "close_short"
          ? "short"
          : formAction === "close_long"
            ? "long"
            : null,
      orderType,
      sizeUnit,
      size: Number(size.replace(/,/g, "")) || null,
      limitPrice: Number(limitPrice.replace(/,/g, "")) || null,
      entrySource,
      triggerBy: layer.triggerBy,
      triggerCompare: layer.triggerCompare,
      triggerPrice: Number(triggerPrice.replace(/,/g, "")) || 0,
      skipIfOpen: layer.skipIfOpen,
      tpsl,
      trailing,
      indicator: liveIndicator(),
      confirm: closing ? null : confirm,
      exitIf: closing ? null : exitIf,
      breakevenActivationPct: closing || !breakevenOn
        ? null
        : Number(breakevenActivationPct.replace(/,/g, "")) || null,
      breakevenOffsetPct: closing || !breakevenOn
        ? null
        : Number(breakevenOffsetPct.replace(/,/g, "")) || 0,
    });
  }

  const { confirm: askConfirm, dialog } = useConfirmDialog();

  return (
    <>
    <StayOnPageForm
      action={saveFuturesAutomations}
      onResult={(result) => {
        onSaved(result);
        if (result.ok) {
          setDirty(false);
        }
      }}
      onChange={() => setDirty(true)}
      guard={async () => {
        if (requiredMissing) {
          return false;
        }
        if (mode === "disabled" && disableNeedsConfirm(inUse)) {
          return askConfirm({
            title: disableConfirmTitle(),
            message: disableConfirmMessage("perps"),
            confirmLabel: "Disable",
            danger: true,
          });
        }
        return true;
      }}
      className="flex flex-col scroll-mt-24 divide-y divide-line rounded-card border border-line bg-canvas px-5"
      id={layer.id ? `bot-${layer.id}` : undefined}
    >
      <input type="hidden" name="saveScope" value="one" />
      <input type="hidden" name="ruleCount" value="1" />
      <input type="hidden" name="deskVenue" value={venueId} />
      <input type="hidden" name={`${prefix}id`} value={layer.id} />
      <DirtySaveBanner
        dirty={dirty || requiredMissing}
        error={
          requiredMissing
            ? "Fill required fields before saving."
            : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <DeskFormFlash />
          <PendingSubmitButton
            pendingLabel="Saving…"
            deskAction="default"
            className={botHeaderPrimaryClass}
            disabled={requiredMissing}
          >
            Save
          </PendingSubmitButton>
        </div>
      </DirtySaveBanner>
      <BotFormGroup title="Bot">
        <div className="grid items-start gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <BotField label="Name" required>
            <input
              id={`${prefix}name`}
              name={`${prefix}name`}
              defaultValue={layer.name}
              maxLength={40}
              className={botFieldClass}
            />
          </BotField>
          <BotStatusField
            desk="perps"
            name={`${prefix}mode`}
            value={mode}
            applied={layer.mode}
            onChange={(next) => setMode(parseAutomationMode(next))}
            inUse={inUse}
            accountReduceOnly={accountReduceOnly}
          />
        </div>
      </BotFormGroup>

      <BotFormGroup title="What & When">
        <div className={botRowClass}>
          <BotField label="Contract" required>
            <FuturesSymbolSelect
              name={`${prefix}symbol`}
              options={options}
              value={symbol}
              onChange={setSymbol}
            />
          </BotField>
          <BotField label="Action" required>
            <select
              name={`${prefix}action`}
              value={formAction}
              onChange={(event) => {
                const next = event.target
                  .value as FuturesAutomationFormValues["formAction"];
                setFormAction(next);
                if (next === "close_long" || next === "close_short") {
                  if (
                    entrySource === "indicator" ||
                    entrySource === "trend"
                  ) {
                    setEntrySource("price");
                  }
                  return;
                }
                const side: FuturesSide = next === "sell" ? "short" : "long";
                setIndicatorCompare(
                  indicatorCompareForDirection(side, indicatorKind, ""),
                );
                if (indicatorKind === "rsi") {
                  setIndicatorLevel(side === "short" ? "70" : "30");
                }
              }}
              className={botFieldClass}
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
              <option value="close_long">Close long</option>
              <option value="close_short">Close short</option>
            </select>
          </BotField>
          <BotField label="Order" required>
            <OrderTypePill
              name={`${prefix}orderType`}
              value={orderType === "limit" ? "limit" : "market"}
              onChange={setOrderType}
            />
          </BotField>
          <BotField label="When" required>
            <input type="hidden" name={`${prefix}entrySource`} value={entrySource} />
            <select
              value={entrySource}
              onChange={(event) => {
                const next = parseAutomationEntry(event.target.value);
                setEntrySource(next);
                if (next === "trend") {
                  setIndicatorKind("supertrend");
                  setIndicatorCompare(
                    indicatorCompareForDirection(entrySide, "supertrend", ""),
                  );
                  setIndicatorPeriod(String(DEFAULT_DCA_SUPERTREND_PERIOD));
                  setIndicatorMultiplier(
                    String(DEFAULT_DCA_SUPERTREND_MULTIPLIER),
                  );
                }
                if (next === "indicator" && indicatorKind === "supertrend") {
                  setIndicatorKind("rsi");
                  setIndicatorCompare(
                    indicatorCompareForDirection(entrySide, "rsi", ""),
                  );
                  setIndicatorPeriod(String(DEFAULT_DCA_RSI_PERIOD));
                  setIndicatorLevel(entrySide === "short" ? "70" : "30");
                }
              }}
              className={botFieldClass}
            >
              <option value="price">Price cross</option>
              {closing ? null : <option value="indicator">Indicator</option>}
              {closing ? null : <option value="trend">Trend</option>}
              <option value="webhook">Signal webhook</option>
            </select>
          </BotField>
        </div>
        {closing ? null : (
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name={`${prefix}skipIfOpen`}
              value="on"
              defaultChecked={layer.skipIfOpen}
              className="mt-0.5 size-4 accent-accent"
            />
            <HintLabel
              text="Skip if this side is already open"
              hint="Off means each new cross or trigger can add size to the same row."
            />
          </label>
        )}
      </BotFormGroup>

      <BotFormGroup title={triggerSectionTitle(entrySource)}>
        <div className={botRowClass5}>
          {entrySource === "indicator" && !closing ? (
            <IndicatorStartFields
              side={entrySide}
              prefix={`${prefix}indicator`}
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
          ) : entrySource === "trend" && !closing ? (
            <TrendStartFields
              side={entrySide}
              prefix={`${prefix}indicator`}
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
          ) : webhookEntry ? (
            <BotField label="Webhook" className="lg:col-span-2" required>
              <select
                name={`${prefix}webhookId`}
                value={webhookId}
                onChange={(event) => setWebhookId(event.target.value)}
                className={botFieldClass}
              >
                <option value="">
                  {triggerWebhooks.length === 0
                    ? "Create a Signal webhook first"
                    : "Pick a webhook"}
                </option>
                {whenWebhooks.map((hook) => (
                  <option key={hook.id} value={hook.id}>
                    {hook.name}
                  </option>
                ))}
              </select>
            </BotField>
          ) : (
            <>
              <BotField label="Price source" required>
                <select
                  name={`${prefix}triggerBy`}
                  defaultValue={layer.triggerBy}
                  className={botFieldClass}
                >
                  <option value="last">Last is</option>
                  <option value="mark">Mark is</option>
                  <option value="index">Index is</option>
                </select>
              </BotField>
              <BotField label="Compare" required>
                <select
                  name={`${prefix}triggerCompare`}
                  defaultValue={layer.triggerCompare}
                  className={botFieldClass}
                >
                  <option value="gte">At or above</option>
                  <option value="lte">At or below</option>
                </select>
              </BotField>
              <BotField label="Price" required>
                <GroupedNumberInput
                  name={`${prefix}triggerPrice`}
                  value={triggerPrice}
                  onChange={setTriggerPrice}
                  allowDecimal
                  className={botFieldClass}
                />
              </BotField>
            </>
          )}
          {orderType === "limit" ? (
            <BotField label="Limit price" required>
              <GroupedNumberInput
                name={`${prefix}limitPrice`}
                value={limitPrice}
                onChange={setLimitPrice}
                allowDecimal
                className={botFieldClass}
              />
            </BotField>
          ) : null}
        </div>
      </BotFormGroup>

      {!closing ? (
        <OptionalSection
          title="Secondary Entry Condition"
          hint="Must be true for the entry trigger to execute."
          enabled={Boolean(confirm)}
          onEnabled={(next) =>
            setConfirm(
              next ? (confirm ?? dcaFilterSpecForKind("rsi", entrySide)) : null,
            )
          }
        >
          <DcaFilterBlock
            label="Kind"
            prefix={`${prefix}confirm`}
            side={entrySide}
            spec={confirm}
            onChange={setConfirm}
            named
            dense
            allowOff={false}
            gridClass={botRowClass5}
            whenClass=""
            fieldClass={botFieldClass}
            labelClass={botLabelClass}
          />
        </OptionalSection>
      ) : null}

      <BotFormGroup title={closing ? undefined : "Order Size"}>
        <div className={botRowClass}>
          <BotField
            label={closing ? "Qty to close" : "Size"}
            hint={closing ? "Empty closes the whole row." : undefined}
            required={!closing}
          >
            <span className="relative mt-1 block">
              {!closing && sizeUnit === "usdt" ? (
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
                  $
                </span>
              ) : null}
              <GroupedNumberInput
                name={`${prefix}size`}
                value={size}
                onChange={setSize}
                allowDecimal
                placeholder={closing ? "All" : undefined}
                className={`${botFieldClass} ${
                  !closing && sizeUnit === "usdt" ? "pl-7" : ""
                }`}
              />
            </span>
          </BotField>
          {closing ? (
            <input type="hidden" name={`${prefix}sizeUnit`} value="qty" />
          ) : (
            <BotField label="Unit" required>
              <input type="hidden" name={`${prefix}sizeUnit`} value={sizeUnit} />
              <select
                value={sizeUnit}
                onChange={(event) => {
                  setSizeUnit(event.target.value as "qty" | "usdt");
                  setSize("");
                }}
                className={botFieldClass}
              >
                <option value="usdt">{quoteLabel}</option>
                <option value="qty">{baseCoin}</option>
              </select>
            </BotField>
          )}
        </div>
      </BotFormGroup>

      {!closing ? (
        <>
          {tpOn || slOn ? (
            <>
              <input type="hidden" name={`${prefix}tpsl`} value="on" />
              <input
                type="hidden"
                name={`${prefix}tpslMode`}
                value={layer.tpsl?.mode ?? "full"}
              />
            </>
          ) : null}
          <OptionalSection
            title="Take profit"
            enabled={tpOn}
            onEnabled={setTpOn}
          >
            <div className={botRowClass5}>
              <BotField label="Type" required>
                <select
                  name={`${prefix}tpKind`}
                  value={tpKind}
                  onChange={(event) => {
                    const next = event.target.value === "percent" ? "percent" : "price";
                    setTpKind(next);
                    setTakeProfit("");
                  }}
                  className={botFieldClass}
                >
                  <option value="price">Price</option>
                  <option value="percent">Percentage</option>
                </select>
              </BotField>
              <BotField label={tpKind === "percent" ? "%" : "Price"} required>
                {tpKind === "percent" ? (
                  <span className="relative mt-0.5 block">
                    <GroupedNumberInput
                      name={`${prefix}takeProfit`}
                      value={takeProfit}
                      onChange={setTakeProfit}
                      allowDecimal
                      className={`${botFieldClass} pr-7`}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-muted">
                      %
                    </span>
                  </span>
                ) : (
                  <GroupedNumberInput
                    name={`${prefix}takeProfit`}
                    value={takeProfit}
                    onChange={setTakeProfit}
                    allowDecimal
                    className={botFieldClass}
                  />
                )}
              </BotField>
              <BotField label="Trigger" required>
                <select
                  name={`${prefix}tpTrigger`}
                  value={tpTrigger}
                  onChange={(event) =>
                    setTpTrigger(event.target.value as FuturesTrigger)
                  }
                  className={botFieldClass}
                >
                  <option value="last">Last</option>
                  <option value="mark">Mark</option>
                  <option value="index">Index</option>
                </select>
              </BotField>
              <BotField label="Order type" required>
                <OrderTypePill
                  name={`${prefix}tpOrderType`}
                  value={tpOrderType === "limit" ? "limit" : "market"}
                  onChange={setTpOrderType}
                />
              </BotField>
              {tpOrderType === "limit" ? (
                <BotField label="Limit price" required>
                  <GroupedNumberInput
                    name={`${prefix}tpLimitPrice`}
                    value={tpLimitPrice}
                    onChange={setTpLimitPrice}
                    allowDecimal
                    className={botFieldClass}
                  />
                </BotField>
              ) : (
                <input type="hidden" name={`${prefix}tpLimitPrice`} value="" />
              )}
            </div>
          </OptionalSection>
          <OptionalSection
            title="Trailing stop"
            enabled={trailOn}
            onEnabled={setTrailOn}
          >
            {trailOn ? (
              <input type="hidden" name={`${prefix}trailing`} value="on" />
            ) : null}
            <div className={botRowClass}>
              <BotField label="Retracement" required>
                <GroupedNumberInput
                  name={`${prefix}trailingStop`}
                  value={trailingStop}
                  onChange={setTrailingStop}
                  allowDecimal
                  className={botFieldClass}
                />
              </BotField>
              <BotField label="Activation price" hint="Empty is Off.">
                <GroupedNumberInput
                  name={`${prefix}trailingActive`}
                  value={trailingActive}
                  onChange={setTrailingActive}
                  allowDecimal
                  className={botFieldClass}
                />
              </BotField>
            </div>
          </OptionalSection>
          <OptionalSection
            title="Stop loss"
            enabled={slOn}
            onEnabled={setSlOn}
          >
            <div className={botRowClass5}>
              <BotField label="Type" required>
                <select
                  name={`${prefix}slKind`}
                  value={slKind}
                  onChange={(event) => {
                    const next = event.target.value === "percent" ? "percent" : "price";
                    setSlKind(next);
                    setStopLoss("");
                  }}
                  className={botFieldClass}
                >
                  <option value="price">Price</option>
                  <option value="percent">Percentage</option>
                </select>
              </BotField>
              <BotField label={slKind === "percent" ? "%" : "Price"} required>
                {slKind === "percent" ? (
                  <span className="relative mt-0.5 block">
                    <GroupedNumberInput
                      name={`${prefix}stopLoss`}
                      value={stopLoss}
                      onChange={setStopLoss}
                      allowDecimal
                      className={`${botFieldClass} pr-7`}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-muted">
                      %
                    </span>
                  </span>
                ) : (
                  <GroupedNumberInput
                    name={`${prefix}stopLoss`}
                    value={stopLoss}
                    onChange={setStopLoss}
                    allowDecimal
                    className={botFieldClass}
                  />
                )}
              </BotField>
              <BotField label="Trigger" required>
                <select
                  name={`${prefix}slTrigger`}
                  value={slTrigger}
                  onChange={(event) =>
                    setSlTrigger(event.target.value as FuturesTrigger)
                  }
                  className={botFieldClass}
                >
                  <option value="last">Last</option>
                  <option value="mark">Mark</option>
                  <option value="index">Index</option>
                </select>
              </BotField>
              <BotField label="Order type" required>
                <OrderTypePill
                  name={`${prefix}slOrderType`}
                  value={slOrderType === "limit" ? "limit" : "market"}
                  onChange={setSlOrderType}
                />
              </BotField>
              {slOrderType === "limit" ? (
                <BotField label="Limit price" required>
                  <GroupedNumberInput
                    name={`${prefix}slLimitPrice`}
                    value={slLimitPrice}
                    onChange={setSlLimitPrice}
                    allowDecimal
                    className={botFieldClass}
                  />
                </BotField>
              ) : (
                <input type="hidden" name={`${prefix}slLimitPrice`} value="" />
              )}
            </div>
          </OptionalSection>
          {!breakevenOn ? (
            <div hidden>
              <input
                type="hidden"
                name={`${prefix}breakevenActivationPct`}
                value=""
              />
              <input
                type="hidden"
                name={`${prefix}breakevenOffsetPct`}
                value=""
              />
            </div>
          ) : null}
          <OptionalSection
            title="Move Breakeven"
            enabled={breakevenOn}
            onEnabled={setBreakevenOn}
          >
            <div className={botRowClass}>
              <BotField label="Move stop to breakeven at %" required>
                <span className="relative mt-0.5 block">
                  <GroupedNumberInput
                    name={`${prefix}breakevenActivationPct`}
                    value={breakevenActivationPct}
                    onChange={setBreakevenActivationPct}
                    allowDecimal
                    className={`${botFieldClass} pr-7`}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-muted">
                    %
                  </span>
                </span>
              </BotField>
              <BotField label="Breakeven offset %">
                <span className="relative mt-0.5 block">
                  <GroupedNumberInput
                    name={`${prefix}breakevenOffsetPct`}
                    value={breakevenOffsetPct}
                    onChange={setBreakevenOffsetPct}
                    allowDecimal
                    placeholder="0"
                    className={`${botFieldClass} pr-7`}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-muted">
                    %
                  </span>
                </span>
              </BotField>
            </div>
          </OptionalSection>
          <OptionalSection
            title="Hard Exit Condition"
            hint="Flattens this bot’s open size at market when the condition is true."
            enabled={Boolean(exitIf)}
            onEnabled={(next) =>
              setExitIf(
                next ? (exitIf ?? dcaFilterSpecForKind("rsi", entrySide)) : null,
              )
            }
          >
            <DcaFilterBlock
              label="Kind"
              prefix={`${prefix}exitIf`}
              side={entrySide}
              spec={exitIf}
              onChange={setExitIf}
              named
              dense
              allowOff={false}
              gridClass={botRowClass5}
              whenClass=""
              fieldClass={botFieldClass}
              labelClass={botLabelClass}
            />
          </OptionalSection>
        </>
      ) : null}

      <AdditionalActions>
        <BacktestTemplateLink
          current={liveRecipe()}
          templates={backtestLibrary}
          venueId={venueId}
          venueEnvironment={venueEnvironment}
        />
        <SaveAsTemplateButton
          isAdmin={isAdmin}
          defaultName={layer.name}
          kind="perps"
          folders={folders}
          library={backtestLibrary}
          currentRecipe={liveRecipe()}
          buildForm={() =>
            perpsFormToSnapshotSource(snapshotLayer, venueId)
          }
          onSaved={(saved) =>
            onTemplateSaved?.({
              id: saved.id,
              name: saved.name,
              recipe: liveRecipe(),
              visibility: saved.visibility,
            })
          }
        />
        {inUse ? (
          <span
            className="inline-flex"
            title="This bot has an open position. Close that row before removing it."
          >
            <button
              type="button"
              disabled
              className={`${botHeaderRemoveClass} pointer-events-none opacity-40`}
            >
              Remove
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={onRemove}
            className={botHeaderRemoveClass}
          >
            Remove
          </button>
        )}
      </AdditionalActions>
    </StayOnPageForm>
    {dialog}
    </>
  );
}
