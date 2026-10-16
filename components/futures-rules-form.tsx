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
  completeRequiredNotice,
  BotButtonLead,
  botBtnIcon,
  BotStatusField,
  OptionalSection,
  OrderTypePill,
  botCompactRowClass,
  botFieldClass,
  botFieldInvalidClass,
  botLabelClass,
  botRowClass,
  botRowClass5,
  botSidebarActionClass,
  botSidebarRemoveClass,
  botSidebarSaveClass,
  deskActionBtnClass,
} from "@/components/bot-form-chrome";
import { ExitSideBuilder } from "@/components/exit-side-builder";
import {
  PerpsAdditionalOrders,
  type PerpsAddConditionType,
} from "@/components/perps-additional-orders";
import {
  exitRowsFromStack,
  exitStackFromRows,
  type ExitStackRow,
} from "@/components/exit-condition-stack";
import {
  blankExitClauses,
  customStackFromClauses,
  exitClauseListMissing,
  exitClausesFromSaved,
  mergedClassicExitFlags,
  type ExitBuilderClause,
} from "@/lib/strategy/exit-clauses";
import {
  initialPerpsEntryDrafts,
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
  deskBotRows,
  perpsBotPair,
  perpsBotSummary,
  type AutomationsBotBlotter,
} from "@/lib/bots/automations-list";
import { withRemovedIds } from "@/lib/table-chrome";
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
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [extraLibrary, setExtraLibrary] = useState<BacktestLibraryItem[]>([]);
  const library = [...backtestLibrary, ...extraLibrary];
  const [deskId, setDeskId] = useState(accountId ?? "");
  const deskChanged = (accountId ?? "") !== deskId;
  const botList = deskBotRows({
    deskChanged,
    current: layers,
    incoming: [...rules].reverse(),
    removedIds,
    id: (layer) => layer.id,
  });
  const visibleLayers = botList.rows;
  if (deskChanged) {
    setDeskId(accountId ?? "");
    setLayers([...visibleLayers]);
    setExtraLibrary([]);
    if (botList.removedIds !== removedIds) {
      setRemovedIds(botList.removedIds);
    }
  } else {
    if (botList.removedIds !== removedIds) {
      setRemovedIds(botList.removedIds);
    }
    if (visibleLayers !== layers) {
      setLayers([...visibleLayers]);
    }
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
                if (action === "delete") {
                  setRemovedIds((current) => withRemovedIds(current, ids));
                }
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
                setRemovedIds((current) => withRemovedIds(current, [layer.id]));
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
  const [addConditionType, setAddConditionType] = useState<PerpsAddConditionType>("");
  const [addSize, setAddSize] = useState("");
  const [addSizeUnit, setAddSizeUnit] = useState<"qty" | "usdt">("usdt");
  const [addOrderType, setAddOrderType] = useState<"market" | "limit">("market");
  const [addLimitPrice, setAddLimitPrice] = useState("");
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
  const [shortExitIf, setShortExitIf] = useState<HardExitDraft | null>(() =>
    hardExitDraftFromStored(
      layer.shortEntry?.exitIf,
      layer.shortEntry?.exitHard,
    ),
  );
  const [shortExitRows, setShortExitRows] = useState<ExitStackRow[]>(() =>
    exitRowsFromStack(layer.shortEntry?.exitStack),
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
  const [shortClauses, setShortClauses] = useState(() =>
    exitClausesFromSaved({
      takeProfit: direction === "both" && tpOn,
      trailing: direction === "both" && trailOn,
      stopLoss: direction === "both" && slOn,
      anchor: shortExitIf,
      rows: shortExitRows,
    }),
  );
  function applyClassicFlags(
    primary: readonly ExitBuilderClause[],
    short: readonly ExitBuilderClause[] | null,
  ) {
    const flags = mergedClassicExitFlags(primary, short);
    setTpOn(flags.takeProfit);
    setTrailOn(flags.trailing);
    setSlOn(flags.stopLoss);
    if (!flags.stopLoss) {
      setBreakevenOn(false);
    }
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
    setDirty(true);
    setFormTick((tick) => tick + 1);
  }
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
  const shortExitParts = hardExitParts(
    storedDirection === "both" ? shortExitIf : null,
  );
  const shortLeg =
    storedDirection === "both"
      ? {
          ...perpsEntryLegFromDraft(entryDrafts.short, false),
          ...(shortExitIf || shortExitRows.some((row) => row.draft.trigger !== "unset")
            ? {
                exitIf: shortExitParts.filter,
                exitHard: shortExitParts.signal,
                exitStack: exitStackFromRows(shortExitRows),
              }
            : {}),
        }
      : null;
  const exitFlags = mergedClassicExitFlags(
    exitClauses,
    storedDirection === "both" ? shortClauses : null,
  );
  const tpLive = exitFlags.takeProfit;
  const slLive = exitFlags.stopLoss;
  const trailLive = exitFlags.trailing;
  function positiveText(text: string): boolean {
    const value = Number(text.replace(/,/g, "").trim());
    return Number.isFinite(value) && value > 0;
  }
  const tpMissing = tpLive && !positiveText(takeProfit);
  const slMissing = slLive && !positiveText(stopLoss);
  const trailMissing = trailLive && !positiveText(trailingStop);
  const breakevenMissing =
    !closing &&
    slLive &&
    breakevenOn &&
    !positiveText(breakevenActivationPct);
  const tpLimitMissing =
    tpLive && tpOrderType === "limit" && !positiveText(tpLimitPrice);
  const slLimitMissing =
    slLive && slOrderType === "limit" && !positiveText(slLimitPrice);
  const sizeMissing = !closing && !positiveText(size);
  const orderLimitMissing =
    !closing && orderType === "limit" && !positiveText(limitPrice);
  const exitKindMissing =
    !closing &&
    (exitClauseListMissing(exitClauses) ||
      (storedDirection === "both" && exitClauseListMissing(shortClauses)));
  const nameMissing =
    !embedded && controlValue(`${prefix}name`, layer.name).trim() === "";
  const entryMissing =
    (showLong &&
      perpsEntryDraftMissing(entryDrafts.long, direction === "close_long")) ||
    (showShort &&
      perpsEntryDraftMissing(entryDrafts.short, direction === "close_short"));
  const exitIfMissing =
    Boolean(exitIf) &&
    (!hardExitComplete(exitIf) ||
      exitRows.some((row) => !hardExitComplete(row.draft)));
  const shortExitMissing =
    storedDirection === "both" &&
    Boolean(shortExitIf) &&
    (!hardExitComplete(shortExitIf) ||
      shortExitRows.some((row) => !hardExitComplete(row.draft)));
  const exitParts = hardExitParts(closing ? null : exitIf);
  const exitStack = closing ? null : exitStackFromRows(exitRows);
  const tpsl =
    tpLive || slLive
      ? {
          takeProfit: tpLive ? Number(takeProfit.replace(/,/g, "")) || null : null,
          stopLoss: slLive ? Number(stopLoss.replace(/,/g, "")) || null : null,
          tpKind: tpLive ? tpKind : "price",
          slKind: slLive ? slKind : "price",
          tpTrigger,
          slTrigger,
          mode: layer.tpsl?.mode ?? "full",
          tpQty: layer.tpsl?.tpQty ?? null,
          slQty: layer.tpsl?.slQty ?? null,
          tpOrderType,
          slOrderType,
          tpLimitPrice:
            tpLive && tpOrderType === "limit"
              ? Number(tpLimitPrice.replace(/,/g, "")) || null
              : null,
          slLimitPrice:
            slLive && slOrderType === "limit"
              ? Number(slLimitPrice.replace(/,/g, "")) || null
              : null,
        }
      : null;
  const trailing =
        trailLive && Number(trailingStop.replace(/,/g, "")) > 0
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
      closing || !slLive || !breakevenOn ? "" : breakevenActivationPct,
    breakevenOffsetPct:
      closing || !slLive || !breakevenOn ? "" : breakevenOffsetPct,
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
    if (!closing && (tpLive || slLive)) {
      snapshot.set(`${prefix}tpsl`, "on");
      snapshot.set(`${prefix}tpslMode`, layer.tpsl?.mode ?? "full");
    }
    if (!closing && tpLive) {
      snapshot.set(`${prefix}tpOn`, "on");
    }
    if (!closing && slLive) {
      snapshot.set(`${prefix}slOn`, "on");
    }
    if (!closing && trailLive) {
      snapshot.set(`${prefix}trailing`, "on");
    }
    if (!closing && slLive && breakevenOn) {
      snapshot.set(`${prefix}breakeven`, "on");
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
    sizeMissing ||
    orderLimitMissing ||
    exitKindMissing ||
    nameMissing ||
    entryMissing ||
    exitIfMissing ||
    shortExitMissing ||
    !parsedLive.ok;
  function controlValue(name: string, fallback: string): string {
    if (typeof HTMLInputElement === "undefined") {
      return fallback;
    }
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
        closing || !slLive || !breakevenOn
          ? null
          : Number(breakevenActivationPct.replace(/,/g, "")) || null,
      breakevenOffsetPct:
        closing || !slLive || !breakevenOn
          ? null
          : Number(breakevenOffsetPct.replace(/,/g, "")) || 0,
    });
  }
  function liveRecipe() {
    return recipeNow(layer.name);
  }
  const saveError = !parsedLive.ok
    ? parsedLive.error
    : requiredMissing
      ? "Fill required fields before saving."
      : null;
  const publishError = saveError;
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
    if (next === "both" && direction === "short") {
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
      applyClassicFlags(exitClauses, shortClauses);
    } else if (direction === "both" && next === "short") {
      setExitClauses(shortClauses);
      const moved = customStackFromClauses(shortClauses);
      setExitIf(moved.anchor);
      setExitRows(moved.rows);
      applyClassicFlags(shortClauses, null);
    } else if (direction === "both" && next === "long") {
      applyClassicFlags(exitClauses, null);
    }
    setDirection(next);
    setDirty(true);
    setFormTick((tick) => tick + 1);
  }

  const { confirm: askConfirm, dialog } = useConfirmDialog();


  function perpsNamed(submit: boolean, field: string) {
    return submit ? `${prefix}${field}` : undefined;
  }
  function classicSubmits(
    kind: "take_profit" | "trailing_stop" | "stop_loss",
    side: "long" | "short",
  ) {
    if (direction !== "both") {
      return true;
    }
    if (side === "long") {
      return true;
    }
    return !exitClauses.some((clause) => clause.kind === kind);
  }
  function perpsTakeProfitFields(submit: boolean) {
    return (
      <>
        <div className={fieldRow5}>
          <BotField label="Type" required>
            <AppSelect
              name={perpsNamed(submit, "tpKind")}
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
                  name={perpsNamed(submit, "takeProfit")}
                  value={takeProfit}
                  onChange={setTakeProfit}
                  allowDecimal
                  className={`${dirty && tpMissing ? botFieldInvalidClass : botFieldClass} pr-7`}
                />
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-muted">
                  %
                </span>
              </span>
            ) : (
              <GroupedNumberInput
                name={perpsNamed(submit, "takeProfit")}
                value={takeProfit}
                onChange={setTakeProfit}
                allowDecimal
                className={dirty && tpMissing ? botFieldInvalidClass : botFieldClass}
              />
            )}
          </BotField>
          <BotField label="Trigger" required>
            <AppSelect
              name={perpsNamed(submit, "tpTrigger")}
              value={tpTrigger}
              onChange={(event) => setTpTrigger(event.target.value as FuturesTrigger)}
              className={botFieldClass}
            >
              <option value="last">Last</option>
              <option value="mark">Mark</option>
              <option value="index">Index</option>
            </AppSelect>
          </BotField>
          <BotField label="Order type" required>
            <OrderTypePill
              name={perpsNamed(submit, "tpOrderType")}
              value={tpOrderType === "limit" ? "limit" : "market"}
              onChange={setTpOrderType}
            />
          </BotField>
          {tpOrderType === "limit" ? (
            <BotField label="Limit price" required>
              <GroupedNumberInput
                name={perpsNamed(submit, "tpLimitPrice")}
                value={tpLimitPrice}
                onChange={setTpLimitPrice}
                allowDecimal
                className={dirty && tpLimitMissing ? botFieldInvalidClass : botFieldClass}
              />
            </BotField>
          ) : submit ? (
            <input type="hidden" name={`${prefix}tpLimitPrice`} value="" />
          ) : null}
        </div>
      </>
    );
  }
  function perpsTrailingFields(submit: boolean) {
    return (
      <div className={fieldRow}>
        <BotField label="Retracement" required>
          <GroupedNumberInput
            name={perpsNamed(submit, "trailingStop")}
            value={trailingStop}
            onChange={setTrailingStop}
            allowDecimal
            className={dirty && trailMissing ? botFieldInvalidClass : botFieldClass}
          />
        </BotField>
        <BotField label="Activation price" hint="Empty is Off.">
          <GroupedNumberInput
            name={perpsNamed(submit, "trailingActive")}
            value={trailingActive}
            onChange={setTrailingActive}
            allowDecimal
            className={botFieldClass}
          />
        </BotField>
      </div>
    );
  }
  function perpsStopFields(submit: boolean) {
    return (
      <>
        {submit && (!slLive || !breakevenOn) ? (
          <div hidden>
            <input type="hidden" name={`${prefix}breakevenActivationPct`} value="" />
            <input type="hidden" name={`${prefix}breakevenOffsetPct`} value="" />
          </div>
        ) : null}
        <div className="@container">
          <div className="grid items-start gap-4 @min-[40rem]:grid-cols-2">
            <div className="grid grid-cols-2 gap-4">
              <BotField label="Type" required>
                <AppSelect
                  name={perpsNamed(submit, "slKind")}
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
                      name={perpsNamed(submit, "stopLoss")}
                      value={stopLoss}
                      onChange={setStopLoss}
                      allowDecimal
                      className={`${dirty && slMissing ? botFieldInvalidClass : botFieldClass} pr-7`}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-muted">
                      %
                    </span>
                  </span>
                ) : (
                  <GroupedNumberInput
                    name={perpsNamed(submit, "stopLoss")}
                    value={stopLoss}
                    onChange={setStopLoss}
                    allowDecimal
                    className={dirty && slMissing ? botFieldInvalidClass : botFieldClass}
                  />
                )}
              </BotField>
              <BotField label="Trigger" required>
                <AppSelect
                  name={perpsNamed(submit, "slTrigger")}
                  value={slTrigger}
                  onChange={(event) => setSlTrigger(event.target.value as FuturesTrigger)}
                  className={botFieldClass}
                >
                  <option value="last">Last</option>
                  <option value="mark">Mark</option>
                  <option value="index">Index</option>
                </AppSelect>
              </BotField>
              <BotField label="Order type" required>
                <OrderTypePill
                  name={perpsNamed(submit, "slOrderType")}
                  value={slOrderType === "limit" ? "limit" : "market"}
                  onChange={setSlOrderType}
                />
              </BotField>
              {slOrderType === "limit" ? (
                <BotField label="Limit price" required>
                  <GroupedNumberInput
                    name={perpsNamed(submit, "slLimitPrice")}
                    value={slLimitPrice}
                    onChange={setSlLimitPrice}
                    allowDecimal
                    className={dirty && slLimitMissing ? botFieldInvalidClass : botFieldClass}
                  />
                </BotField>
              ) : submit ? (
                <input type="hidden" name={`${prefix}slLimitPrice`} value="" />
              ) : null}
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
                      name={perpsNamed(submit, "breakevenActivationPct")}
                      value={breakevenActivationPct}
                      onChange={setBreakevenActivationPct}
                      allowDecimal
                      className={`${dirty && breakevenMissing ? botFieldInvalidClass : botFieldClass} pr-7`}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-muted">
                      %
                    </span>
                  </span>
                </BotField>
                <BotField label="Breakeven offset %">
                  <span className="relative mt-0.5 block">
                    <GroupedNumberInput
                      name={perpsNamed(submit, "breakevenOffsetPct")}
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
      </>
    );
  }

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
      {!closing && (tpLive || slLive) ? (
        <>
          <input type="hidden" name={`${prefix}tpsl`} value="on" />
          <input type="hidden" name={`${prefix}tpslMode`} value={layer.tpsl?.mode ?? "full"} />
        </>
      ) : null}
      {!closing && tpLive ? <input type="hidden" name={`${prefix}tpOn`} value="on" /> : null}
      {!closing && slLive ? <input type="hidden" name={`${prefix}slOn`} value="on" /> : null}
      {!closing && trailLive ? <input type="hidden" name={`${prefix}trailing`} value="on" /> : null}
      {!closing && slLive && breakevenOn ? (
        <input type="hidden" name={`${prefix}breakeven`} value="on" />
      ) : null}
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
        title="Long Entry Condition Builder"
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
          showErrors={dirty}
        />
      </BotFormStep>
      ) : null}
      {showShort ? (
      <BotFormStep
        title="Short Entry Condition Builder"
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
          showErrors={dirty}
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
                className={`${dirty && sizeMissing ? botFieldInvalidClass : botFieldClass} ${
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
                className={dirty && orderLimitMissing ? botFieldInvalidClass : botFieldClass}
              />
            </BotField>
          ) : null}
        </div>
      </BotFormGroup>
      </BotFormStep>

      {!closing ? (
        <BotFormStep title="Additional Orders" defaultCollapsed={inUse}>
          <PerpsAdditionalOrders
            conditionType={addConditionType}
            onConditionType={setAddConditionType}
            size={addSize}
            onSize={setAddSize}
            sizeUnit={addSizeUnit}
            onSizeUnit={setAddSizeUnit}
            orderType={addOrderType}
            onOrderType={setAddOrderType}
            limitPrice={addLimitPrice}
            onLimitPrice={setAddLimitPrice}
            quoteLabel={quoteLabel}
            baseCoin={baseCoin}
            fieldClass={botFieldClass}
            gridClass={fieldRow}
          />
        </BotFormStep>
      ) : null}

      {!closing && (direction === "long" || direction === "both") ? (
        <BotFormStep title="Long Exit Condition Builder">
          <ExitSideBuilder
            clauses={exitClauses}
            onChange={(next) => commitExitClauses(next, "primary")}
            side="long"
            prefix={`${prefix}exitIf`}
            webhooks={triggerWebhooks}
            fieldClass={botFieldClass}
            labelClass={botLabelClass}
            gridClass={fieldRow5}
            renderTakeProfit={() => perpsTakeProfitFields(classicSubmits("take_profit", "long"))}
            renderTrailingStop={() => perpsTrailingFields(classicSubmits("trailing_stop", "long"))}
            renderStopLoss={() => perpsStopFields(classicSubmits("stop_loss", "long"))}
          />
        </BotFormStep>
      ) : null}
      {!closing && (direction === "short" || direction === "both") ? (
        <BotFormStep title="Short Exit Condition Builder">
          <ExitSideBuilder
            clauses={direction === "both" ? shortClauses : exitClauses}
            onChange={(next) =>
              commitExitClauses(next, direction === "both" ? "short" : "primary")
            }
            side="short"
            prefix={direction === "both" ? `${prefix}short_exitIf` : `${prefix}exitIf`}
            webhooks={triggerWebhooks}
            fieldClass={botFieldClass}
            labelClass={botLabelClass}
            gridClass={fieldRow5}
            renderTakeProfit={() =>
              perpsTakeProfitFields(classicSubmits("take_profit", "short"))
            }
            renderTrailingStop={() =>
              perpsTrailingFields(classicSubmits("trailing_stop", "short"))
            }
            renderStopLoss={() => perpsStopFields(classicSubmits("stop_loss", "short"))}
          />
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
        dirty={Boolean(layer.id) && dirty}
        error={requiredMissing ? completeRequiredNotice : undefined}
        save={
          <div className="space-y-2">
            <PendingSubmitButton
              pendingLabel="Saving…"
              deskAction="default"
              className={botSidebarSaveClass}
              disabled={!dirty || requiredMissing}
              title={requiredMissing ? completeRequiredNotice : undefined}
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
