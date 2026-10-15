"use client";

import { useEffect, useRef, useState } from "react";
import { NewBotLink } from "@/components/quota-access";
import { useRouter } from "next/navigation";
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
  BotButtonLead,
  botBtnIcon,
  BotStatusField,
  OptionalSection,
  OrderTypePill,
  botCompactRowClass,
  botFieldClass,
  botLabelClass,
  botRowClass,
  botRowClass5,
  botSidebarActionClass,
  botSidebarRemoveClass,
  botSidebarSaveClass,
  deskActionBtnClass,
} from "@/components/bot-form-chrome";
import { HardExitFields } from "@/components/hard-exit-fields";
import {
  ExitConditionStack,
  anchorDisabledKinds,
  anchorDisabledWebhookIds,
  exitConflictSlots,
  exitRowsFromStack,
  exitStackFromRows,
  type ExitStackRow,
} from "@/components/exit-condition-stack";
import {
  initialPerpsEntryDrafts,
  oppositePerpsEntryDraft,
  PerpsEntryPanel,
  perpsEntryDraftMissing,
  perpsEntryLegFromDraft,
  type PerpsEntryDraft,
} from "@/components/perps-entry-panel";
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
  keepFormKeys,
} from "@/components/stay-on-page-form";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  botDeleteAllowed,
  disableConfirmMessage,
  disableConfirmTitle,
  disableNeedsConfirm,
} from "@/lib/bots/status";
import { parseAutomationMode } from "@/lib/engine/decide";
import {
  deleteFuturesAutomationAction,
  saveFuturesAutomations,
  setFuturesBotModesAction,
  type SaveFuturesAutomationsResult,
} from "@/lib/futures/actions";
import {
  cloneFuturesAutomationForm,
  defaultFuturesAutomationForm,
  parseFuturesAutomationForm,
  type FuturesAutomationFormValues,
} from "@/lib/futures/automation";
import { venueAllowsPerpsBoth } from "@/lib/futures/perps-direction";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import type { FuturesWebhookRow } from "@/lib/futures/webhook-load";
import {
  BacktestTemplateLink,
  type BacktestLibraryItem,
  type SavedBacktestMatch,
} from "@/components/backtest-dialog";
import { BacktestingTrialMark } from "@/components/research-gate-access";
import {
  snapshotPerpsRecipe,
  type PerpsTemplateRecipe,
} from "@/lib/templates/recipe";
import {
  defaultHardExit,
  hardExitComplete,
  hardExitDraftFromStored,
  hardExitParts,
  type HardExitDraft,
} from "@/lib/dca/hard-exit";
import type { FuturesOrderType, FuturesSide, FuturesTrigger } from "@/lib/futures/model";
import type { FuturesTpslLevelKind } from "@/lib/futures/tpsl";
import { IconPlus, IconSave } from "@/components/icons";
import { DeskTemplateBar, SaveAsTemplateButton } from "@/components/template-modals";
import { perpsFormToSnapshotSource } from "@/lib/templates/recipe";
import type { AppliedDeskItem } from "@/lib/templates/apply";
import type { AutomationTemplateSet, TemplateSummary } from "@/lib/templates/store";
import { AppSelect } from "@/components/app-select";
import {
  automationsBotBlotterCells,
  botModeLabel,
  botPairBaseCoin,
  rowsForDesk,
  perpsBotPair,
  perpsBotSummary,
  type AutomationsBotBlotter,
} from "@/lib/bots/automations-list";
import { perpsBotConfig } from "@/lib/bots/bot-config";
import {
  AUTOMATIONS_NEW,
  automationsEditHref,
  automationsNewHref,
  automationsStayEditHref,
} from "@/lib/bots/automations-path";
import { FUTURES_PATHS } from "@/lib/strategies/registry";

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
  savedBacktests = [],
  agreementGate = CLOSED_AGREEMENT_GATE,
  edit = null,
  clone = null,
  listHref,
  blotter,
  revealId = null,
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
  savedBacktests?: readonly SavedBacktestMatch[];
  agreementGate?: BybitAgreementGate;
  edit?: string | null;
  clone?: string | null;
  listHref: string;
  blotter?: Record<string, AutomationsBotBlotter>;
  revealId?: string | null;
}) {
  const router = useRouter();
  const [layers, setLayers] = useState(() => [...rules].reverse());
  const [extraLibrary, setExtraLibrary] = useState<BacktestLibraryItem[]>([]);
  const library = [...backtestLibrary, ...extraLibrary];
  const [deskId, setDeskId] = useState(accountId ?? "");
  const deskChanged = (accountId ?? "") !== deskId;
  const visibleLayers = rowsForDesk({
    deskChanged,
    current: layers,
    incoming: [...rules].reverse(),
    id: (layer) => layer.id,
  });
  if (deskChanged) {
    setDeskId(accountId ?? "");
    setLayers([...visibleLayers]);
    setExtraLibrary([]);
  } else if (visibleLayers !== layers) {
    setLayers([...visibleLayers]);
  }
  const savedLayers = visibleLayers.filter((layer) => layer.id);
  const inUse = new Set(inUseRuleIds);
  const preferredSymbol = venueId === "hyperliquid" ? "BTC" : "BTCUSDT";
  const defaultSymbol =
    options.find((row) => row.symbol === preferredSymbol)?.symbol ??
    options[0]?.symbol ??
    preferredSymbol;
  const [draft, setDraft] = useState(() =>
    edit === AUTOMATIONS_NEW
      ? resolvePerpsDraft(rules, clone, defaultSymbol)
      : null,
  );
  const [draftEdit, setDraftEdit] = useState(edit);
  const [draftClone, setDraftClone] = useState(clone);
  const nextDraft =
    edit !== draftEdit || clone !== draftClone
      ? edit === AUTOMATIONS_NEW
        ? resolvePerpsDraft(rules, clone, defaultSymbol)
        : null
      : draft;
  if (edit !== draftEdit || clone !== draftClone) {
    setDraftEdit(edit);
    setDraftClone(clone);
    setDraft(nextDraft);
  }
  const formLayer =
    edit === AUTOMATIONS_NEW
      ? nextDraft
      : edit
        ? visibleLayers.find((layer) => layer.id === edit) ?? null
        : null;
  const showForm = Boolean(formLayer);

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
    router.refresh();
  }

  function leaveToList() {
    router.push(listHref);
    router.refresh();
  }

  function stayOnEdit(botId: string | null | undefined, notice?: string | null) {
    const id = String(botId ?? "").trim();
    if (!id) {
      return;
    }
    router.replace(automationsStayEditHref(listHref, id, notice));
    router.refresh();
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
      {showForm && formLayer ? (
        <RuleCard
          key={formLayer.key}
          layer={formLayer}
          options={options}
          triggerWebhooks={triggerWebhooks}
          accountReduceOnly={reduceOnly}
          inUse={Boolean(formLayer.id && inUse.has(formLayer.id))}
          isAdmin={isAdmin}
          folders={sets}
          quoteLabel={quoteLabel}
          venueId={venueId}
          venueEnvironment={venueEnvironment}
          backtestLibrary={library}
          savedBacktests={savedBacktests}
          agreementGate={agreementGate}
          onSaved={(result) => {
            const previous = new Set(
              layers.flatMap((layer) => (layer.id ? [layer.id] : [])),
            );
            const created = result.forms?.find(
              (layer) => layer.id && !previous.has(layer.id),
            );
            applySaveResult(result);
            if (result.ok) {
              stayOnEdit(created?.id ?? formLayer.id, result.notice);
            }
          }}
          onTemplateSaved={(item) =>
            setExtraLibrary((current) => [
              ...current.filter((row) => row.id !== item.id),
              item,
            ])
          }
          onRemove={() => {
            const next = layers.filter((item) => item.key !== formLayer.key);
            setLayers(next);
            if (formLayer.id && next.filter((item) => item.id).length === 0) {
              const data = new FormData();
              data.set("ruleCount", "0");
              void saveFuturesAutomations(data).then(applySaveResult);
            }
            leaveToList();
          }}
        />
      ) : (
        <>
          <AutomationsBotTable
            desk="perps"
            revealId={revealId}
            toolbar={
              <>
                <NewBotLink
                  href={automationsNewHref(listHref)}
                  className={`inline-flex items-center ${deskActionBtnClass}`}
                >
                  <BotButtonLead icon={<IconPlus {...botBtnIcon} />}>
                    Create New Bot
                  </BotButtonLead>
                </NewBotLink>
                {accountId ? (
                  <DeskTemplateBar
                    deskType="perps"
                    accountId={accountId}
                    templates={templates}
                    sets={sets}
                    onApplied={appendApplied}
                  />
                ) : null}
              </>
            }
            empty="No bots yet. Create a bot to fire Buy, Sell, or Close on a price cross, Indicator, Trend, or a Signal webhook."
            onBulkStatus={async (ids, action) => {
              const data = new FormData();
              data.set("bulk", action);
              for (const id of ids) {
                data.append("id", id);
              }
              const result = await setFuturesBotModesAction(data);
              if (result.ok) {
                applySaveResult(result);
              }
              return result.ok
                ? { ok: true }
                : { ok: false, error: result.error };
            }}
            rows={savedLayers.map((layer) => {
              const agreementOff =
                !inUse.has(layer.id) &&
                symbolNeedsBybitAgreement(agreementGate.symbols, layer.symbol);
              const statusKey = agreementOff ? "disabled" : layer.mode;
              return {
              id: layer.id,
              name: layer.name || "Bot",
              pair: perpsBotPair(layer),
              baseCoin: botPairBaseCoin(layer.symbol),
              pairNote: symbolNeedsBybitAgreement(agreementGate.symbols, layer.symbol)
                ? BYBIT_AGREEMENT_NOTE
                : undefined,
              status: botModeLabel("perps", statusKey),
              statusKey,
              summary: perpsBotSummary(layer),
              config: perpsBotConfig(layer),
              canRemove:
                botDeleteAllowed(statusKey) && !inUse.has(layer.id),
              ownsOpen: inUse.has(layer.id),
              removeBlocked: botDeleteAllowed(statusKey)
                ? "This bot has an open position. Close that row before removing it."
                : "Disable this bot before deleting it.",
              onRemove: async () => {
                const data = new FormData();
                data.set("ruleId", layer.id);
                const result = await deleteFuturesAutomationAction(data);
                if (!result.ok) {
                  return;
                }
                applySaveResult(result);
                setLayers((current) =>
                  current.filter((item) => item.id !== layer.id),
                );
              },
              ...automationsBotBlotterCells(
                layer.id,
                blotter,
                FUTURES_PATHS.positions,
                FUTURES_PATHS.performance,
                FUTURES_PATHS.activity,
                accountId,
              ),
              editHref: automationsEditHref(listHref, layer.id),
              cloneHref: automationsNewHref(listHref, layer.id),
            };
            })}
          />
        </>
      )}
    </div>
  );
}

function resolvePerpsDraft(
  rules: FuturesAutomationFormValues[],
  clone: string | null,
  defaultSymbol: string,
): FuturesAutomationFormValues {
  if (clone) {
    const source = rules.find((rule) => rule.id === clone);
    if (source) {
      return cloneFuturesAutomationForm(source);
    }
  }
  return defaultFuturesAutomationForm(rules.length, defaultSymbol);
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
  savedBacktests = [],
  agreementGate = CLOSED_AGREEMENT_GATE,
  onTemplateSaved,
  embedded = false,
  onRecipeChange,
  controlledSymbol,
  onSymbolChange,
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
  savedBacktests?: readonly SavedBacktestMatch[];
  agreementGate?: BybitAgreementGate;
  onTemplateSaved?: (item: BacktestLibraryItem) => void;
  embedded?: boolean;
  onRecipeChange?: (
    recipe: PerpsTemplateRecipe,
    error: string | null,
    fromUser?: boolean,
  ) => void;
  controlledSymbol?: string;
  onSymbolChange?: (symbol: string) => void;
}) {
  const prefix = "r0_";
  const formRef = useRef<HTMLFormElement>(null);
  const fieldRow = embedded ? botCompactRowClass : botRowClass;
  const fieldRow5 = embedded ? botCompactRowClass : botRowClass5;
  const nameSpan = embedded ? "col-span-full" : "col-span-2";
  const pairSpan = embedded ? "col-span-full" : "lg:col-span-2";
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState(
    !inUse && symbolNeedsBybitAgreement(agreementGate.symbols, layer.symbol)
      ? "disabled"
      : layer.mode,
  );
  const allowBoth = venueAllowsPerpsBoth(venueId);
  const [direction, setDirection] = useState<PerpsFormDirection>(() =>
    initialPerpsFormDirection(layer, allowBoth),
  );
  const [entryDrafts, setEntryDrafts] = useState(() =>
    initialPerpsEntryDrafts(layer),
  );
  const [orderType, setOrderType] = useState(layer.orderType);
  const [sizeUnit, setSizeUnit] = useState(layer.sizeUnit);
  const [size, setSize] = useState(layer.size);
  const [limitPrice, setLimitPrice] = useState(layer.limitPrice);
  const [symbolState, setSymbolState] = useState(() =>
    embedded || layer.id
      ? layer.symbol
      : firstOpenPerp(options, agreementGate, layer.symbol),
  );
  const symbol = controlledSymbol?.trim() ? controlledSymbol : symbolState;
  const [formTick, setFormTick] = useState(0);
  function setSymbol(next: string) {
    setSymbolState(next);
    if (next !== symbol) {
      onSymbolChange?.(next);
    }
  }
  const [exitIf, setExitIf] = useState<HardExitDraft | null>(
    () => layer.exitDraft ?? hardExitDraftFromStored(layer.exitIf, layer.exitHard),
  );
  const [exitRows, setExitRows] = useState<ExitStackRow[]>(() =>
    exitRowsFromStack(layer.exitStack),
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
  const [slOn, setSlOn] = useState(
    () =>
      layer.tpsl?.stopLoss != null ||
      layer.breakevenActivationPct.trim() !== "",
  );
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
  const closing = direction === "close_long" || direction === "close_short";
  const showLong =
    direction === "long" || direction === "both" || direction === "close_long";
  const showShort =
    direction === "short" || direction === "both" || direction === "close_short";
  const formAction = perpsFormAction(direction);
  const storedDirection = perpsStoredDirection(direction);
  const exitSide: FuturesSide =
    direction === "short" || direction === "close_short" ? "short" : "long";
  const primaryDraft =
    direction === "short" || direction === "close_short"
      ? entryDrafts.short
      : entryDrafts.long;
  const primaryLeg = perpsEntryLegFromDraft(primaryDraft, closing);
  const shortLeg =
    storedDirection === "both"
      ? perpsEntryLegFromDraft(entryDrafts.short, false)
      : null;
  const tpMissing = tpOn && takeProfit.trim() === "";
  const slMissing = slOn && stopLoss.trim() === "";
  const trailMissing = trailOn && trailingStop.trim() === "";
  const breakevenMissing =
    !closing &&
    slOn &&
    breakevenOn &&
    breakevenActivationPct.trim() === "";
  const tpLimitMissing =
    tpOn && tpOrderType === "limit" && tpLimitPrice.trim() === "";
  const slLimitMissing =
    slOn && slOrderType === "limit" && slLimitPrice.trim() === "";
  const entryMissing =
    (showLong &&
      perpsEntryDraftMissing(entryDrafts.long, direction === "close_long")) ||
    (showShort &&
      perpsEntryDraftMissing(entryDrafts.short, direction === "close_short"));
  const exitIfMissing =
    Boolean(exitIf) &&
    (!hardExitComplete(exitIf) ||
      exitRows.some((row) => !hardExitComplete(row.draft)));
  const exitParts = hardExitParts(closing ? null : exitIf);
  const exitStack = closing ? null : exitStackFromRows(exitRows);
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
  const selected = options.find((row) => row.symbol === symbol);
  const baseCoin = selected?.baseCoin ?? "Token";
  const snapshotLayer: FuturesAutomationFormValues = {
    ...layer,
    mode,
    formAction,
    direction: storedDirection,
    orderType,
    sizeUnit,
    size,
    limitPrice,
    triggerPrice: String(primaryLeg.triggerPrice || ""),
    symbol,
    entrySource: primaryLeg.entrySource,
    webhookId: primaryLeg.webhookId ?? "",
    triggerBy: primaryLeg.triggerBy,
    triggerCompare: primaryLeg.triggerCompare,
    skipIfOpen: primaryLeg.skipIfOpen,
    tpsl,
    trailing,
    indicator: primaryLeg.indicator,
    confirm: primaryLeg.confirm,
    entryStack: primaryLeg.entryStack,
    shortEntry: shortLeg,
    exitIf: exitParts.filter,
    exitHard: exitParts.signal,
    exitStack,
    exitDraft: closing ? null : exitIf,
    breakevenActivationPct:
      closing || !slOn || !breakevenOn ? "" : breakevenActivationPct,
    breakevenOffsetPct:
      closing || !slOn || !breakevenOn ? "" : breakevenOffsetPct,
  };
  let parsedLive: ReturnType<typeof parseFuturesAutomationForm>;
  try {
    const snapshot = perpsFormToSnapshotSource(snapshotLayer, venueId);
    if (primaryDraft.entrySource === "") {
      snapshot.set("r0_entrySource", "");
    }
    if (storedDirection === "both" && entryDrafts.short.entrySource === "") {
      snapshot.set("r0_short_entrySource", "");
    }
    parsedLive = parseFuturesAutomationForm(snapshot, venueId);
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
    entryMissing ||
    exitIfMissing ||
    !parsedLive.ok;
  function controlValue(name: string, fallback: string): string {
    const named = formRef.current?.elements.namedItem(name);
    if (
      named instanceof HTMLInputElement ||
      named instanceof HTMLSelectElement ||
      named instanceof HTMLTextAreaElement
    ) {
      return named.value;
    }
    return fallback;
  }
  function recipeNow(name: string) {
    return snapshotPerpsRecipe({
      name,
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
      direction: storedDirection,
      orderType,
      sizeUnit,
      size: Number(size.replace(/,/g, "")) || null,
      limitPrice: Number(limitPrice.replace(/,/g, "")) || null,
      entrySource: primaryLeg.entrySource,
      triggerBy: primaryLeg.triggerBy,
      triggerCompare: primaryLeg.triggerCompare,
      triggerPrice: primaryLeg.triggerPrice,
      skipIfOpen: primaryLeg.skipIfOpen,
      tpsl,
      trailing,
      indicator: primaryLeg.indicator,
      confirm: primaryLeg.confirm,
      entryStack: primaryLeg.entryStack,
      shortEntry: shortLeg,
      exitIf: exitParts.filter,
      exitHard: exitParts.signal,
      exitStack,
      breakevenActivationPct:
        closing || !slOn || !breakevenOn
          ? null
          : Number(breakevenActivationPct.replace(/,/g, "")) || null,
      breakevenOffsetPct:
        closing || !slOn || !breakevenOn
          ? null
          : Number(breakevenOffsetPct.replace(/,/g, "")) || 0,
    });
  }
  function liveRecipe() {
    return recipeNow(layer.name);
  }
  const publishError = !parsedLive.ok
    ? parsedLive.error
    : requiredMissing
      ? "Fill required fields before saving."
      : null;
  useEffect(() => {
    if (!embedded) {
      return;
    }
    const recipe = recipeNow(
      controlValue(`${prefix}name`, layer.name).trim() || layer.name,
    );
    onRecipeChange?.(recipe, publishError, dirty);
    // formTick advances on each edit, so this effect reads the latest fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, formTick, publishError, onRecipeChange, symbol]);

  function updateEntryDraft(side: "long" | "short", next: PerpsEntryDraft) {
    setEntryDrafts((current) => ({ ...current, [side]: next }));
    setDirty(true);
    setFormTick((tick) => tick + 1);
  }
  function applyPerpsDirection(next: PerpsFormDirection) {
    setEntryDrafts((current) => {
      if (next !== "both" || direction === "both") {
        return current;
      }
      if (direction === "short" || direction === "close_short") {
        return {
          ...current,
          long: oppositePerpsEntryDraft(current.short, "long"),
        };
      }
      return {
        ...current,
        short: oppositePerpsEntryDraft(current.long, "short"),
      };
    });
    setDirection(next);
    setDirty(true);
    setFormTick((tick) => tick + 1);
  }

  const { confirm: askConfirm, dialog } = useConfirmDialog();

  return (
    <>
    <StayOnPageForm
      ref={formRef}
      action={saveFuturesAutomations}
      onResult={(result) => {
        onSaved(result);
        if (result.ok) {
          setDirty(false);
        }
      }}
      onChange={() => {
        setDirty(true);
        setFormTick((tick) => tick + 1);
      }}
      guard={async () => {
        if (embedded) {
          return false;
        }
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
      className={
        embedded
          ? "@container min-w-0 space-y-5 scroll-mt-24"
          : "space-y-5 scroll-mt-24"
      }
      id={layer.id ? `bot-${layer.id}` : undefined}
    >
      <BotColumnLayout enabled={embedded}>
      <input type="hidden" name="saveScope" value="one" />
      <input type="hidden" name="ruleCount" value="1" />
      <input type="hidden" name="deskVenue" value={venueId} />
      <input type="hidden" name={`${prefix}id`} value={layer.id} />
      <BotFormColumns single={embedded}>
      <BotFormCard>
      <BotFormStep title="General">
        {embedded ? (
          <input
            type="hidden"
            name={`${prefix}name`}
            defaultValue={layer.name}
          />
        ) : null}
        <div className={fieldRow}>
          {embedded ? null : (
          <BotField label="Name" required className={nameSpan}>
            <input
              id={`${prefix}name`}
              name={`${prefix}name`}
              defaultValue={layer.name}
              maxLength={40}
              className={botFieldClass}
            />
          </BotField>
          )}
          <BotField label="Contract" required>
            <FuturesSymbolSelect
              name={`${prefix}symbol`}
              options={options}
              value={symbol}
              onChange={setSymbol}
              agreementGate={agreementGate}
            />
          </BotField>
          <BotField
            label="Direction"
            hint="Long and Short are independent positions and never flatten each other."
            required
          >
            <input type="hidden" name={`${prefix}direction`} value={storedDirection} />
            <input type="hidden" name={`${prefix}action`} value={formAction} />
            <AppSelect
              value={direction}
              onChange={(event) =>
                applyPerpsDirection(
                  event.target.value as PerpsFormDirection,
                )
              }
              className={botFieldClass}
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
              {allowBoth ? <option value="both">Both</option> : null}
              {layer.formAction === "close_long" ? (
                <option value="close_long">Close long</option>
              ) : null}
              {layer.formAction === "close_short" ? (
                <option value="close_short">Close short</option>
              ) : null}
            </AppSelect>
          </BotField>
        </div>
      </BotFormStep>

      {showLong ? (
      <BotFormStep
        title="Long entry"
        defaultCollapsed={inUse}
      >
        <PerpsEntryPanel
          prefix={prefix}
          side="long"
          closing={direction === "close_long"}
          draft={entryDrafts.long}
          onChange={(next) => updateEntryDraft("long", next)}
          webhooks={triggerWebhooks}
          fieldRow={fieldRow}
          fieldRow5={fieldRow5}
          pairSpan={pairSpan}
          fieldClass={botFieldClass}
          labelClass={botLabelClass}
        />
      </BotFormStep>
      ) : null}
      {showShort ? (
      <BotFormStep
        title="Short entry"
        defaultCollapsed={inUse}
      >
        <PerpsEntryPanel
          prefix={direction === "both" ? `${prefix}short_` : prefix}
          side="short"
          closing={direction === "close_short"}
          draft={entryDrafts.short}
          onChange={(next) => updateEntryDraft("short", next)}
          webhooks={triggerWebhooks}
          fieldRow={fieldRow}
          fieldRow5={fieldRow5}
          pairSpan={pairSpan}
          fieldClass={botFieldClass}
          labelClass={botLabelClass}
        />
      </BotFormStep>
      ) : null}

      <BotFormStep title="Position Sizing" defaultCollapsed={inUse}>
      <BotFormGroup title={closing ? undefined : "Order Size"}>
        <div className={fieldRow}>
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
              <AppSelect
                value={sizeUnit}
                onChange={(event) => {
                  setSizeUnit(event.target.value as "qty" | "usdt");
                  setSize("");
                }}
                className={botFieldClass}
              >
                <option value="usdt">{quoteLabel}</option>
                <option value="qty">{baseCoin}</option>
              </AppSelect>
            </BotField>
          )}
          <BotField label="Order" required>
            <OrderTypePill
              name={`${prefix}orderType`}
              value={orderType === "limit" ? "limit" : "market"}
              onChange={setOrderType}
            />
          </BotField>
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
      </BotFormStep>

      {!closing ? (
        <BotFormStep title="Exit Conditions">
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
            <div className={fieldRow5}>
              <BotField label="Type" required>
                <AppSelect
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
                </AppSelect>
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
                <AppSelect
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
                </AppSelect>
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
            <div className={fieldRow}>
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
          {!slOn || !breakevenOn ? (
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
            title="Stop loss"
            enabled={slOn}
            onEnabled={(next) => {
              setSlOn(next);
              if (!next) {
                setBreakevenOn(false);
              }
            }}
          >
            <div className="@container">
            <div className="grid items-start gap-4 @min-[40rem]:grid-cols-2">
              <div className="grid grid-cols-2 gap-4">
              <BotField label="Type" required>
                <AppSelect
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
                </AppSelect>
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
                <AppSelect
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
                </AppSelect>
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
              <OptionalSection
                title="Move Breakeven"
                className="min-w-0"
                enabled={breakevenOn}
                onEnabled={setBreakevenOn}
              >
                <div className="grid grid-cols-2 gap-4">
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
            </div>
            </div>
          </OptionalSection>
          <OptionalSection
            title="Hard Exit Condition"
            hint="Flattens this bot’s open size at market when the condition is true."
            enabled={Boolean(exitIf)}
            onEnabled={(next) => {
              setExitIf(next ? (exitIf ?? defaultHardExit(exitSide)) : null);
              if (!next) {
                setExitRows([]);
              }
              setDirty(true);
              setFormTick((tick) => tick + 1);
            }}
          >
            {exitIf ? (
              <ExitConditionStack
                grouped
                lead={
                <HardExitFields
                  prefix={`${prefix}exitIf`}
                  side={exitSide}
                  value={exitIf}
                  onChange={setExitIf}
                  webhooks={triggerWebhooks}
                  gridClass={fieldRow5}
                  fieldClass={botFieldClass}
                  labelClass={botLabelClass}
                  seriesSlots={exitConflictSlots(exitIf, exitRows)}
                  seriesIndex={0}
                  disabledKinds={anchorDisabledKinds(
                    exitIf,
                    exitRows,
                    triggerWebhooks.map((hook) => hook.id),
                  )}
                  disabledWebhookIds={anchorDisabledWebhookIds(
                    exitIf,
                    exitRows,
                    triggerWebhooks.map((hook) => hook.id),
                  )}
                />
                }
                prefix={`${prefix}exitIf`}
                  side={exitSide}
                  anchor={exitIf}
                  rows={exitRows}
                  onChange={(next) => {
                    setExitRows(next);
                    setDirty(true);
                    setFormTick((tick) => tick + 1);
                  }}
                  webhooks={triggerWebhooks}
                  gridClass={fieldRow5}
                  fieldClass={botFieldClass}
                  labelClass={botLabelClass}
              />
            ) : null}
          </OptionalSection>
        </BotFormStep>
      ) : null}

      </BotFormCard>
      {embedded ? null : (
      <BotFormSidebar
        status={
          <BotStatusField
            desk="perps"
            name={`${prefix}mode`}
            value={mode}
            applied={layer.mode}
            onChange={(next) => {
              setMode(parseAutomationMode(next));
              setDirty(true);
            }}
            inUse={inUse}
            accountReduceOnly={accountReduceOnly}
          />
        }
        dirty={dirty}
        error={
          dirty && requiredMissing
            ? "Fill required fields before saving."
            : undefined
        }
        save={
          <div className="space-y-2">
            <PendingSubmitButton
              pendingLabel="Saving…"
              deskAction="default"
              className={botSidebarSaveClass}
              disabled={!dirty || requiredMissing}
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
            defaultName={layer.name}
            kind="perps"
            folders={folders}
            library={backtestLibrary}
            currentRecipe={liveRecipe()}
            buildForm={() =>
              perpsFormToSnapshotSource(snapshotLayer, venueId)
            }
            buttonClassName={botSidebarActionClass}
            onSaved={(saved) =>
              onTemplateSaved?.({
                id: saved.id,
                name: saved.name,
                recipe: liveRecipe(),
                visibility: saved.visibility,
              })
            }
          />
        </BotFormSidebarSection>
        <BotFormSidebarSection
          title="Backtesting"
          titleAside={<BacktestingTrialMark />}
        >
          <BacktestTemplateLink
            current={liveRecipe()}
            templates={backtestLibrary}
            savedBacktests={savedBacktests}
            venueId={venueId}
            venueEnvironment={venueEnvironment}
            className="flex w-full flex-col"
            buttonClassName={botSidebarActionClass}
          />
        </BotFormSidebarSection>
        {layer.id ? null : (
          <BotFormSidebarSection>
            <button
              type="button"
              onClick={onRemove}
              className={botSidebarRemoveClass}
            >
              Remove
            </button>
          </BotFormSidebarSection>
        )}
      </BotFormSidebar>
      )}
      </BotFormColumns>
      </BotColumnLayout>
    </StayOnPageForm>
    {dialog}
    </>
  );
}

export function PerpsRecipeForm({
  seed,
  options,
  quoteLabel,
  venueId,
  onRecipeChange,
  controlledSymbol,
  onSymbolChange,
}: {
  seed: FuturesAutomationFormValues;
  options: LinearPerp[];
  quoteLabel: string;
  venueId: string;
  onRecipeChange: (
    recipe: PerpsTemplateRecipe,
    error: string | null,
    fromUser?: boolean,
  ) => void;
  controlledSymbol?: string;
  onSymbolChange?: (symbol: string) => void;
}) {
  return (
    <RuleCard
      embedded
      layer={seed}
      options={options}
      triggerWebhooks={[]}
      accountReduceOnly={false}
      inUse={false}
      isAdmin={false}
      onRemove={() => {}}
      onSaved={() => {}}
      quoteLabel={quoteLabel}
      venueId={venueId}
      onRecipeChange={onRecipeChange}
      controlledSymbol={controlledSymbol}
      onSymbolChange={onSymbolChange}
    />
  );
}

type PerpsFormDirection = "long" | "short" | "both" | "close_long" | "close_short";

function initialPerpsFormDirection(
  layer: FuturesAutomationFormValues,
  allowBoth: boolean,
): PerpsFormDirection {
  if (layer.formAction === "close_long" || layer.formAction === "close_short") {
    return layer.formAction;
  }
  if (layer.direction === "both" && allowBoth) {
    return "both";
  }
  if (layer.formAction === "sell" || layer.direction === "short") {
    return "short";
  }
  return "long";
}

function perpsFormAction(
  direction: PerpsFormDirection,
): FuturesAutomationFormValues["formAction"] {
  if (direction === "close_long" || direction === "close_short") {
    return direction;
  }
  return direction === "short" ? "sell" : "buy";
}

function perpsStoredDirection(
  direction: PerpsFormDirection,
): "long" | "short" | "both" {
  if (direction === "both") {
    return "both";
  }
  if (direction === "short" || direction === "close_short") {
    return "short";
  }
  return "long";
}
