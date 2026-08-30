"use client";

import { useState } from "react";
import { FuturesSymbolSelect } from "@/components/futures-symbol-select";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  DeskFormFlash,
  StayOnPageForm,
  keepFormKeys,
} from "@/components/stay-on-page-form";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  parseAutomationMode,
  type AutomationMode,
} from "@/lib/engine/decide";
import {
  saveFuturesAutomations,
  type SaveFuturesAutomationsResult,
} from "@/lib/futures/actions";
import {
  cloneFuturesAutomationForm,
  defaultFuturesAutomationForm,
  parseAutomationEntry,
  type FuturesAutomationFormValues,
} from "@/lib/futures/automation";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import type { FuturesWebhookRow } from "@/lib/futures/webhook-load";
import {
  BacktestTemplateLink,
  type BacktestLibraryItem,
} from "@/components/backtest-dialog";
import { snapshotPerpsRecipe } from "@/lib/templates/recipe";
import { FuturesTpslFields } from "@/components/futures-tpsl";
import { FuturesTrailingFields } from "@/components/futures-trailing";
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
  const [layers, setLayers] = useState(rules);
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
      return fresh.length === 0 ? current : [...current, ...fresh];
    });
  }

  function applySaveResult(result: SaveFuturesAutomationsResult) {
    if (!result.ok || !result.forms) {
      return;
    }
    setLayers((current) => keepFormKeys(current, result.forms ?? []));
  }

  return (
    <StayOnPageForm
      action={saveFuturesAutomations}
      onResult={applySaveResult}
      className="space-y-4"
    >
      <input type="hidden" name="ruleCount" value={layers.length} />
      <input type="hidden" name="deskVenue" value={venueId} />
      {empty ? (
        <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
          No bots yet. Add a bot to fire Buy, Sell, or Close on a price
          cross or a Signal webhook.
        </p>
      ) : (
        layers.map((layer, index) => (
          <RuleCard
            key={layer.key}
            index={index}
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
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setLayers((current) => [
              ...current,
              defaultFuturesAutomationForm(current.length, defaultSymbol),
            ])
          }
          className="rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong"
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
                ...current,
                cloneFuturesAutomationForm(source),
              ]);
              setCloneMenu((n) => n + 1);
            }}
            className="rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong"
          >
            <option value="">Clone existing bot</option>
            {cloneSources.map((item) => (
              <option key={item.key} value={item.key}>
                {item.name} · {item.symbol}
              </option>
            ))}
          </select>
        ) : null}
        {empty ? null : (
          <>
            <DeskFormFlash />
            <PendingSubmitButton
              pendingLabel="Saving…"
              deskAction="default"
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              Save Bots
            </PendingSubmitButton>
          </>
        )}
      </div>
    </StayOnPageForm>
  );
}

function RuleCard({
  index,
  layer,
  options,
  triggerWebhooks,
  accountReduceOnly,
  inUse,
  isAdmin,
  onRemove,
  folders = [],
  quoteLabel = "USDT",
  venueId = "bybit",
  venueEnvironment = null,
  backtestLibrary = [],
  onTemplateSaved,
}: {
  index: number;
  layer: FuturesAutomationFormValues;
  options: LinearPerp[];
  triggerWebhooks: Pick<FuturesWebhookRow, "id" | "name">[];
  accountReduceOnly: boolean;
  inUse: boolean;
  isAdmin: boolean;
  onRemove: () => void;
  folders?: AutomationTemplateSet[];
  quoteLabel?: string;
  venueId?: string;
  venueEnvironment?: string | null;
  backtestLibrary?: BacktestLibraryItem[];
  onTemplateSaved?: (item: BacktestLibraryItem) => void;
}) {
  const prefix = `r${index}_`;
  const [mode, setMode] = useState(layer.mode);
  const [formAction, setFormAction] = useState(layer.formAction);
  const [orderType, setOrderType] = useState(layer.orderType);
  const [sizeUnit, setSizeUnit] = useState(layer.sizeUnit);
  const [size, setSize] = useState(layer.size);
  const [limitPrice, setLimitPrice] = useState(layer.limitPrice);
  const [triggerPrice, setTriggerPrice] = useState(layer.triggerPrice);
  const [symbol, setSymbol] = useState(layer.symbol);
  const [entrySource, setEntrySource] = useState(layer.entrySource);
  const closing = formAction === "close_long" || formAction === "close_short";
  const webhookEntry = entrySource === "webhook";
  const whenWebhooks =
    layer.webhookId &&
    !triggerWebhooks.some((hook) => hook.id === layer.webhookId)
      ? [
          ...triggerWebhooks,
          { id: layer.webhookId, name: "Webhook (removed)" },
        ]
      : triggerWebhooks;
  const selected = options.find((row) => row.symbol === symbol);
  const baseCoin = selected?.baseCoin ?? "Token";
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
      tpsl: layer.tpsl,
      trailing: layer.trailing,
    });
  }

  return (
    <section className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3">
        <label htmlFor={`${prefix}name`} className="block text-[11px] text-ink-muted">
          Name
          <input
            id={`${prefix}name`}
            name={`${prefix}name`}
            defaultValue={layer.name}
            maxLength={40}
            className="mt-0.5 w-full rounded-control border border-line bg-surface-raised px-1.5 py-1 text-sm font-semibold text-ink focus:border-line-strong focus:outline-none"
          />
        </label>
        <label htmlFor={`${prefix}mode`} className="block text-[11px] text-ink-muted">
          Mode
          <span className="mt-0.5 flex items-center gap-2">
            <select
              id={`${prefix}mode`}
              name={`${prefix}mode`}
              value={mode}
              onChange={(event) => setMode(parseAutomationMode(event.target.value))}
              className="w-52 rounded-control border border-line bg-surface-raised px-1.5 py-1 text-xs text-ink focus:border-line-strong focus:outline-none"
            >
              <option value="active">
                {accountReduceOnly ? "Active (Reduce only)" : "Active"}
              </option>
              <option value="reduce_only">Reduce only</option>
              <option value="disabled">Disabled</option>
            </select>
            <ModeLight
              mode={mode}
              inUse={inUse}
              accountReduceOnly={accountReduceOnly}
            />
          </span>
        </label>
      </div>
      <input type="hidden" name={`${prefix}id`} value={layer.id} />

      <div className="mt-3 grid items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm text-ink">
          Contract
          <FuturesSymbolSelect
            name={`${prefix}symbol`}
            options={options}
            value={symbol}
            onChange={setSymbol}
          />
        </label>
        <label className="block text-sm text-ink">
          Action
          <select
            name={`${prefix}action`}
            value={formAction}
            onChange={(event) =>
              setFormAction(
                event.target.value as FuturesAutomationFormValues["formAction"],
              )
            }
            className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
            <option value="close_long">Close long</option>
            <option value="close_short">Close short</option>
          </select>
        </label>
        <label className="block text-sm text-ink">
          Order
          <input type="hidden" name={`${prefix}orderType`} value={orderType} />
          <span className="mt-1 flex w-fit rounded-control border border-line bg-surface p-0.5">
            <Toggle active={orderType === "market"} onClick={() => setOrderType("market")}>
              Market
            </Toggle>
            <Toggle active={orderType === "limit"} onClick={() => setOrderType("limit")}>
              Limit
            </Toggle>
          </span>
        </label>
        <label className="block text-sm text-ink">
          {closing ? "Qty to close" : "Size"}
          <span className="mt-1 flex gap-1">
            <span className="relative min-w-0 flex-1">
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
                className={`w-full rounded-control border border-line bg-surface-raised py-2 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none ${
                  !closing && sizeUnit === "usdt" ? "pr-3 pl-7" : "px-3"
                }`}
              />
            </span>
            {closing ? (
              <input type="hidden" name={`${prefix}sizeUnit`} value="qty" />
            ) : (
              <>
                <input type="hidden" name={`${prefix}sizeUnit`} value={sizeUnit} />
                <span className="flex shrink-0 rounded-control border border-line bg-surface p-0.5">
                  <Toggle
                    active={sizeUnit === "qty"}
                    onClick={() => {
                      setSizeUnit("qty");
                      setSize("");
                    }}
                  >
                    {baseCoin}
                  </Toggle>
                  <Toggle
                    active={sizeUnit === "usdt"}
                    onClick={() => {
                      setSizeUnit("usdt");
                      setSize("");
                    }}
                  >
                    {quoteLabel}
                  </Toggle>
                </span>
              </>
            )}
          </span>
          {closing ? (
            <span className="mt-1 block text-xs text-ink-muted">
              Empty closes the whole row.
            </span>
          ) : null}
        </label>
      </div>

      {orderType === "limit" ? (
        <label className="mt-3 block max-w-xs text-sm text-ink">
          Limit price
          <span className="relative mt-1 block">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
              $
            </span>
            <GroupedNumberInput
              name={`${prefix}limitPrice`}
              value={limitPrice}
              onChange={setLimitPrice}
              allowDecimal
              className="w-full rounded-control border border-line bg-surface-raised py-2 pr-3 pl-7 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
            />
          </span>
        </label>
      ) : null}

      <div
        className={`mt-3 grid items-end gap-3 ${
          webhookEntry
            ? "md:grid-cols-3"
            : "sm:grid-cols-2 md:grid-cols-4"
        }`}
      >
        <label className="block text-sm text-ink">
          When
          <input type="hidden" name={`${prefix}entrySource`} value={entrySource} />
          <select
            value={entrySource}
            onChange={(event) =>
              setEntrySource(parseAutomationEntry(event.target.value))
            }
            className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          >
            <option value="price">Price cross</option>
            <option value="webhook">Signal webhook</option>
          </select>
        </label>
        {webhookEntry ? (
          <label className="block text-sm text-ink md:col-span-2">
            Webhook
            <select
              name={`${prefix}webhookId`}
              defaultValue={layer.webhookId}
              className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
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
          </label>
        ) : (
          <>
            <label className="block text-sm text-ink">
              Price source
              <select
                name={`${prefix}triggerBy`}
                defaultValue={layer.triggerBy}
                className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
              >
                <option value="last">Last is</option>
                <option value="mark">Mark is</option>
                <option value="index">Index is</option>
              </select>
            </label>
            <label className="block text-sm text-ink">
              Compare
              <select
                name={`${prefix}triggerCompare`}
                defaultValue={layer.triggerCompare}
                className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
              >
                <option value="gte">At or above</option>
                <option value="lte">At or below</option>
              </select>
            </label>
            <label className="block text-sm text-ink">
              Price
              <span className="relative mt-1 block">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
                  $
                </span>
                <GroupedNumberInput
                  name={`${prefix}triggerPrice`}
                  value={triggerPrice}
                  onChange={setTriggerPrice}
                  allowDecimal
                  className="w-full rounded-control border border-line bg-surface-raised py-2 pr-3 pl-7 text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
                />
              </span>
            </label>
          </>
        )}
      </div>

      {!closing ? (
        <>
          <FuturesTpslFields namePrefix={prefix} defaultTpsl={layer.tpsl} />
          <FuturesTrailingFields
            namePrefix={prefix}
            defaultTrailing={layer.trailing}
          />
        </>
      ) : null}

      <div className="mt-3 flex items-end justify-between gap-3">
        {closing ? (
          <span />
        ) : (
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name={`${prefix}skipIfOpen`}
              value="on"
              defaultChecked={layer.skipIfOpen}
              className="mt-0.5 size-4"
            />
            <span>
              Skip if this side is already open
              <span className="mt-1 block text-xs text-ink-muted">
                Off means each new cross or trigger can add size to the same row.
              </span>
            </span>
          </label>
        )}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
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
            buildForm={() =>
              perpsFormToSnapshotSource(
                {
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
                },
                venueId,
              )
            }
            onSaved={(templateId) =>
              onTemplateSaved?.({
                id: templateId,
                name: layer.name,
                recipe: liveRecipe(),
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
                className="pointer-events-none shrink-0 rounded-control border border-line px-2 py-0.5 text-xs text-danger opacity-40"
              >
                Remove
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={onRemove}
              className="shrink-0 rounded-control border border-line px-2 py-0.5 text-xs text-danger hover:bg-danger/10"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-control px-3 py-1.5 text-sm ${
        active
          ? "bg-surface-raised font-medium text-ink"
          : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ModeLight({
  mode,
  inUse,
  accountReduceOnly,
}: {
  mode: AutomationMode;
  inUse: boolean;
  accountReduceOnly: boolean;
}) {
  const fill =
    mode === "disabled"
      ? "bg-ink-faint"
      : mode === "reduce_only" || accountReduceOnly
        ? "bg-warning"
        : "bg-success";
  const label =
    mode === "disabled"
      ? "Disabled"
      : mode === "reduce_only"
        ? "Reduce only"
        : accountReduceOnly
          ? "Active · book Reduce only has priority"
          : "Active";
  const title = inUse ? `${label} · in use by an open position` : label;
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
