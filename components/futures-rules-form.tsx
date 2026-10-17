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
import { PerpsAdditionalOrders } from "@/components/perps-additional-orders";
import {
  exitRowsFromStack,
  exitStackFromRows,
  type ExitStackRow,
} from "@/components/exit-condition-stack";
import {
  blankExitClauses,
  customStackFromClauses,
  exitClauseListMissing,
  classicExitFlags,
  exitClausesFromSaved,
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
import {
  blankPerpsAddOrderGroups,
  perpsAddGroupsSizingMissing,
} from "@/lib/futures/perps-add-condition";
import {
  entryExtraOrdersMissing,
  useExtraGroupOrders,
} from "@/components/entry-group-order";
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
import type { PerpsShortClassic } from "@/lib/futures/conditions";
import type { FuturesOrderType, FuturesSide, FuturesTrigger } from "@/lib/futures/model";
import {
  defaultTpslLevelKind,
  type FuturesTpslLevelKind,
} from "@/lib/futures/tpsl";
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
} from "@/lib/bots/automations-path";
import { withCreatedFormKey } from "@/lib/bots/automations-saved-edit";
import {
  rememberSavedBotEdit,
  useShownAutomationsEdit,
} from "@/components/automations-saved-edit";
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
  const [shownEdit, setShownEdit] = useShownAutomationsEdit(edit);
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
    shownEdit === AUTOMATIONS_NEW
      ? nextDraft
      : shownEdit
        ? visibleLayers.find((layer) => layer.id === shownEdit) ?? null
        : null;
  const showForm = Boolean(formLayer);

  function appendApplied(items: AppliedDeskItem[]) {
    const nextRules = items
      .filter(
        (item): item is Extract<AppliedDeskItem, { deskType: "flex" }> =>
          item.deskType === "flex",
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

  function applySaveResult(
    result: SaveFuturesAutomationsResult,
    created?: { id: string; key: string } | null,
  ) {
    if (!result.ok || !result.forms) {
      return;
    }
    setLayers((current) =>
      withCreatedFormKey(
        keepFormKeys(current, [...(result.forms ?? [])].reverse()),
        created?.id,
        created?.key,
      ),
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
            const savedId = created?.id ?? formLayer.id;
            applySaveResult(
              result,
              created?.id
                ? { id: created.id, key: formLayer.key }
                : null,
            );
            if (result.ok) {
              const saved = result.forms?.find((layer) => layer.id === savedId);
              stayOnSaved(savedId, saved?.name ?? formLayer.name);
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
            desk="flex"
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
                    deskType="flex"
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
              status: botModeLabel("flex", statusKey),
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

type PerpsClassicDraft = {
  tpKind: FuturesTpslLevelKind;
  slKind: FuturesTpslLevelKind;
  takeProfit: string;
  stopLoss: string;
  tpTrigger: FuturesTrigger;
  slTrigger: FuturesTrigger;
  tpOrderType: FuturesOrderType;
  slOrderType: FuturesOrderType;
  tpLimitPrice: string;
  slLimitPrice: string;
  trailingStop: string;
  trailingActive: string;
  breakevenOn: boolean;
  breakevenActivationPct: string;
  breakevenOffsetPct: string;
};

function blankPerpsClassic(): PerpsClassicDraft {
  return {
    tpKind: "percent",
    slKind: "percent",
    takeProfit: "",
    stopLoss: "",
    tpTrigger: "last",
    slTrigger: "last",
    tpOrderType: "market",
    slOrderType: "market",
    tpLimitPrice: "",
    slLimitPrice: "",
    trailingStop: "",
    trailingActive: "",
    breakevenOn: false,
    breakevenActivationPct: "",
    breakevenOffsetPct: "",
  };
}

function perpsDraftFromClassic(
  classic: NonNullable<NonNullable<FuturesAutomationFormValues["shortEntry"]>["classic"]>,
): PerpsClassicDraft {
  return {
    tpKind: defaultTpslLevelKind(classic.tpsl?.takeProfit, classic.tpsl?.tpKind),
    slKind: defaultTpslLevelKind(classic.tpsl?.stopLoss, classic.tpsl?.slKind),
    takeProfit:
      classic.tpsl?.takeProfit != null ? String(classic.tpsl.takeProfit) : "",
    stopLoss: classic.tpsl?.stopLoss != null ? String(classic.tpsl.stopLoss) : "",
    tpTrigger: classic.tpsl?.tpTrigger ?? "last",
    slTrigger: classic.tpsl?.slTrigger ?? "last",
    tpOrderType: classic.tpsl?.tpOrderType === "limit" ? "limit" : "market",
    slOrderType: classic.tpsl?.slOrderType === "limit" ? "limit" : "market",
    tpLimitPrice:
      classic.tpsl?.tpLimitPrice != null ? String(classic.tpsl.tpLimitPrice) : "",
    slLimitPrice:
      classic.tpsl?.slLimitPrice != null ? String(classic.tpsl.slLimitPrice) : "",
    trailingStop: classic.trailing != null ? String(classic.trailing.distance) : "",
    trailingActive:
      classic.trailing?.activePrice != null
        ? String(classic.trailing.activePrice)
        : "",
    breakevenOn: classic.breakevenActivationPct != null,
    breakevenActivationPct:
      classic.breakevenActivationPct != null
        ? String(classic.breakevenActivationPct)
        : "",
    breakevenOffsetPct:
      classic.breakevenOffsetPct != null ? String(classic.breakevenOffsetPct) : "",
  };
}

function perpsDraftFromLong(layer: FuturesAutomationFormValues): PerpsClassicDraft {
  return {
    tpKind: defaultTpslLevelKind(layer.tpsl?.takeProfit, layer.tpsl?.tpKind),
    slKind: defaultTpslLevelKind(layer.tpsl?.stopLoss, layer.tpsl?.slKind),
    takeProfit:
      layer.tpsl?.takeProfit != null ? String(layer.tpsl.takeProfit) : "",
    stopLoss: layer.tpsl?.stopLoss != null ? String(layer.tpsl.stopLoss) : "",
    tpTrigger: layer.tpsl?.tpTrigger ?? "last",
    slTrigger: layer.tpsl?.slTrigger ?? "last",
    tpOrderType: layer.tpsl?.tpOrderType === "limit" ? "limit" : "market",
    slOrderType: layer.tpsl?.slOrderType === "limit" ? "limit" : "market",
    tpLimitPrice:
      layer.tpsl?.tpLimitPrice != null ? String(layer.tpsl.tpLimitPrice) : "",
    slLimitPrice:
      layer.tpsl?.slLimitPrice != null ? String(layer.tpsl.slLimitPrice) : "",
    trailingStop: layer.trailing != null ? String(layer.trailing.distance) : "",
    trailingActive:
      layer.trailing?.activePrice != null ? String(layer.trailing.activePrice) : "",
    breakevenOn: layer.breakevenActivationPct.trim() !== "",
    breakevenActivationPct: layer.breakevenActivationPct,
    breakevenOffsetPct: layer.breakevenOffsetPct,
  };
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
  const [longAddGroups, setLongAddGroups] = useState(() =>
    blankPerpsAddOrderGroups("long"),
  );
  const [shortAddGroups, setShortAddGroups] = useState(() =>
    blankPerpsAddOrderGroups("short"),
  );
  const longExtraOrders = useExtraGroupOrders();
  const shortExtraOrders = useExtraGroupOrders();
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
  const [tpOn] = useState(() => layer.tpsl?.takeProfit != null);
  const [slOn] = useState(
    () =>
      layer.tpsl?.stopLoss != null ||
      layer.breakevenActivationPct.trim() !== "",
  );
  const [trailOn] = useState(
    () => Boolean(layer.trailing && layer.trailing.distance > 0),
  );
  const [takeProfit, setTakeProfit] = useState(
    layer.tpsl?.takeProfit != null ? String(layer.tpsl.takeProfit) : "",
  );
  const [stopLoss, setStopLoss] = useState(
    layer.tpsl?.stopLoss != null ? String(layer.tpsl.stopLoss) : "",
  );
  const [tpKind, setTpKind] = useState<FuturesTpslLevelKind>(() =>
    defaultTpslLevelKind(layer.tpsl?.takeProfit, layer.tpsl?.tpKind),
  );
  const [slKind, setSlKind] = useState<FuturesTpslLevelKind>(() =>
    defaultTpslLevelKind(layer.tpsl?.stopLoss, layer.tpsl?.slKind),
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
  const [shortClassic, setShortClassic] = useState<PerpsClassicDraft>(() => {
    if (initialPerpsFormDirection(layer, allowBoth) !== "both") {
      return blankPerpsClassic();
    }
    if (layer.shortEntry?.classic) {
      return perpsDraftFromClassic(layer.shortEntry.classic);
    }
    return perpsDraftFromLong(layer);
  });
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
  const [shortClauses, setShortClauses] = useState(() => {
    const both = initialPerpsFormDirection(layer, allowBoth) === "both";
    const saved = both ? (layer.shortEntry?.classic ?? null) : null;
    const legacy = both && saved == null;
    return exitClausesFromSaved({
      takeProfit: saved ? saved.tpsl?.takeProfit != null : legacy && tpOn,
      trailing: saved
        ? Boolean(saved.trailing && saved.trailing.distance > 0)
        : legacy && trailOn,
      stopLoss: saved
        ? saved.tpsl?.stopLoss != null || saved.breakevenActivationPct != null
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
  const primaryFlags = classicExitFlags(exitClauses);
  const shortFlags = classicExitFlags(shortClauses);
  const tpLive = primaryFlags.takeProfit;
  const slLive = primaryFlags.stopLoss;
  const trailLive = primaryFlags.trailing;
  const shortTpLive = storedDirection === "both" && shortFlags.takeProfit;
  const shortSlLive = storedDirection === "both" && shortFlags.stopLoss;
  const shortTrailLive = storedDirection === "both" && shortFlags.trailing;
  const storedShort = layer.shortEntry?.classic ?? null;
  const shortClassicValue: PerpsShortClassic = {
    tpsl:
      shortTpLive || shortSlLive
        ? {
            takeProfit: shortTpLive
              ? Number(shortClassic.takeProfit.replace(/,/g, "")) || null
              : null,
            stopLoss: shortSlLive
              ? Number(shortClassic.stopLoss.replace(/,/g, "")) || null
              : null,
            tpKind: shortTpLive ? shortClassic.tpKind : "percent",
            slKind: shortSlLive ? shortClassic.slKind : "percent",
            tpTrigger: shortClassic.tpTrigger,
            slTrigger: shortClassic.slTrigger,
            mode: storedShort?.tpsl?.mode ?? layer.tpsl?.mode ?? "full",
            tpQty: storedShort?.tpsl?.tpQty ?? null,
            slQty: storedShort?.tpsl?.slQty ?? null,
            tpOrderType: shortClassic.tpOrderType,
            slOrderType: shortClassic.slOrderType,
            tpLimitPrice:
              shortTpLive && shortClassic.tpOrderType === "limit"
                ? Number(shortClassic.tpLimitPrice.replace(/,/g, "")) || null
                : null,
            slLimitPrice:
              shortSlLive && shortClassic.slOrderType === "limit"
                ? Number(shortClassic.slLimitPrice.replace(/,/g, "")) || null
                : null,
          }
        : null,
    trailing:
      shortTrailLive && Number(shortClassic.trailingStop.replace(/,/g, "")) > 0
        ? {
            distance: Number(shortClassic.trailingStop.replace(/,/g, "")),
            activePrice: Number(shortClassic.trailingActive.replace(/,/g, "")) || null,
            peak: storedShort?.trailing?.peak ?? null,
          }
        : null,
    breakevenActivationPct:
      shortSlLive && shortClassic.breakevenOn
        ? Number(shortClassic.breakevenActivationPct.replace(/,/g, "")) || null
        : null,
    breakevenOffsetPct:
      shortSlLive && shortClassic.breakevenOn
        ? Number(shortClassic.breakevenOffsetPct.replace(/,/g, "")) || 0
        : null,
  };
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
          classic: shortClassicValue,
        }
      : null;
  function positiveText(text: string): boolean {
    const value = Number(text.replace(/,/g, "").trim());
    return Number.isFinite(value) && value > 0;
  }
  const tpMissing = tpLive && !positiveText(takeProfit);
  const slMissing = slLive && !positiveText(stopLoss);
  const trailMissing = trailLive && !positiveText(trailingStop);
  const trailActiveMissing = trailLive && !positiveText(trailingActive);
  const breakevenMissing =
    !closing &&
    slLive &&
    breakevenOn &&
    !positiveText(breakevenActivationPct);
  const tpLimitMissing =
    tpLive && tpOrderType === "limit" && !positiveText(tpLimitPrice);
  const slLimitMissing =
    slLive && slOrderType === "limit" && !positiveText(slLimitPrice);
  const shortTpMissing = shortTpLive && !positiveText(shortClassic.takeProfit);
  const shortSlMissing = shortSlLive && !positiveText(shortClassic.stopLoss);
  const shortTrailMissing =
    shortTrailLive && !positiveText(shortClassic.trailingStop);
  const shortTrailActiveMissing =
    shortTrailLive && !positiveText(shortClassic.trailingActive);
  const shortBreakevenMissing =
    shortSlLive &&
    shortClassic.breakevenOn &&
    !positiveText(shortClassic.breakevenActivationPct);
  const shortTpLimitMissing =
    shortTpLive &&
    shortClassic.tpOrderType === "limit" &&
    !positiveText(shortClassic.tpLimitPrice);
  const shortSlLimitMissing =
    shortSlLive &&
    shortClassic.slOrderType === "limit" &&
    !positiveText(shortClassic.slLimitPrice);
  const sizeMissing = !closing && !positiveText(size);
  const orderLimitMissing =
    !closing && orderType === "limit" && !positiveText(limitPrice);
  const groupSizingMissing =
    (!closing &&
      showLong &&
      entryExtraOrdersMissing(
        entryDrafts.long.entrySource !== "",
        entryDrafts.long.entryRows,
        longExtraOrders.orders,
        longExtraOrders.sameAsLead,
      )) ||
    (!closing &&
      showShort &&
      entryExtraOrdersMissing(
        entryDrafts.short.entrySource !== "",
        entryDrafts.short.entryRows,
        shortExtraOrders.orders,
        shortExtraOrders.sameAsLead,
      )) ||
    (!closing &&
      (direction === "long" || direction === "both") &&
      perpsAddGroupsSizingMissing(longAddGroups)) ||
    (!closing &&
      (direction === "short" || direction === "both") &&
      perpsAddGroupsSizingMissing(shortAddGroups));
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
          tpKind: tpLive ? tpKind : "percent",
          slKind: slLive ? slKind : "percent",
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
    trailActiveMissing ||
    breakevenMissing ||
    tpLimitMissing ||
    slLimitMissing ||
    shortTpMissing ||
    shortSlMissing ||
    shortTrailMissing ||
    shortTrailActiveMissing ||
    shortBreakevenMissing ||
    shortTpLimitMissing ||
    shortSlLimitMissing ||
    sizeMissing ||
    orderLimitMissing ||
    groupSizingMissing ||
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
  function currentPrimaryClassic(): PerpsClassicDraft {
    return {
      tpKind,
      slKind,
      takeProfit,
      stopLoss,
      tpTrigger,
      slTrigger,
      tpOrderType,
      slOrderType,
      tpLimitPrice,
      slLimitPrice,
      trailingStop,
      trailingActive,
      breakevenOn,
      breakevenActivationPct,
      breakevenOffsetPct,
    };
  }
  function copyPrimaryClassicToShort() {
    setShortClassic(currentPrimaryClassic());
  }
  function blankPrimaryClassic() {
    setTpKind("percent");
    setSlKind("percent");
    setTakeProfit("");
    setStopLoss("");
    setTpTrigger("last");
    setSlTrigger("last");
    setTpOrderType("market");
    setSlOrderType("market");
    setTpLimitPrice("");
    setSlLimitPrice("");
    setTrailingStop("");
    setTrailingActive("");
    setBreakevenOn(false);
    setBreakevenActivationPct("");
    setBreakevenOffsetPct("");
  }
  function copyShortClassicToPrimary() {
    setTpKind(shortClassic.tpKind);
    setSlKind(shortClassic.slKind);
    setTakeProfit(shortClassic.takeProfit);
    setStopLoss(shortClassic.stopLoss);
    setTpTrigger(shortClassic.tpTrigger);
    setSlTrigger(shortClassic.slTrigger);
    setTpOrderType(shortClassic.tpOrderType);
    setSlOrderType(shortClassic.slOrderType);
    setTpLimitPrice(shortClassic.tpLimitPrice);
    setSlLimitPrice(shortClassic.slLimitPrice);
    setTrailingStop(shortClassic.trailingStop);
    setTrailingActive(shortClassic.trailingActive);
    setBreakevenOn(shortClassic.breakevenOn);
    setBreakevenActivationPct(shortClassic.breakevenActivationPct);
    setBreakevenOffsetPct(shortClassic.breakevenOffsetPct);
  }
  function applyPerpsDirection(next: PerpsFormDirection) {
    if (next === "both" && direction === "short") {
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
        setShortClassic(blankPerpsClassic());
      }
      applyClassicFlags(exitClauses, shortClauses);
    } else if (direction === "both" && next === "short") {
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
    setDirty(true);
    setFormTick((tick) => tick + 1);
  }

  const { confirm: askConfirm, dialog } = useConfirmDialog();


  function usesShortExit(leg: "primary" | "short") {
    return leg === "short" && direction === "both";
  }
  function exitFieldName(leg: "primary" | "short", field: string) {
    const root = usesShortExit(leg) ? `${prefix}short_` : prefix;
    return `${root}${field}`;
  }
  function patchShort(patch: Partial<PerpsClassicDraft>) {
    setShortClassic((draft) => ({ ...draft, ...patch }));
  }
  function perpsTakeProfitFields(leg: "primary" | "short") {
    const shortLeg = usesShortExit(leg);
    const kind = shortLeg ? shortClassic.tpKind : tpKind;
    const price = shortLeg ? shortClassic.takeProfit : takeProfit;
    const trigger = shortLeg ? shortClassic.tpTrigger : tpTrigger;
    const orderTypeValue = shortLeg ? shortClassic.tpOrderType : tpOrderType;
    const limit = shortLeg ? shortClassic.tpLimitPrice : tpLimitPrice;
    const missing = shortLeg ? shortTpMissing : tpMissing;
    const limitMissing = shortLeg ? shortTpLimitMissing : tpLimitMissing;
    return (
      <div className={fieldRow5}>
        <BotField label="Type" required>
          <AppSelect
            name={exitFieldName(leg, "tpKind")}
            value={kind}
            onChange={(event) => {
              const next = event.target.value === "percent" ? "percent" : "price";
              if (shortLeg) {
                patchShort({ tpKind: next, takeProfit: "" });
              } else {
                setTpKind(next);
                setTakeProfit("");
              }
            }}
            className={botFieldClass}
          >
            <option value="price">Price</option>
            <option value="percent">Percentage</option>
          </AppSelect>
        </BotField>
        <BotField label={kind === "percent" ? "%" : "Price"} required>
          {kind === "percent" ? (
            <span className="relative mt-1 block">
              <GroupedNumberInput
                name={exitFieldName(leg, "takeProfit")}
                value={price}
                onChange={(next) =>
                  shortLeg ? patchShort({ takeProfit: next }) : setTakeProfit(next)
                }
                allowDecimal
                className={`${dirty && missing ? botFieldInvalidClass : botFieldClass} !mt-0 pr-7`}
              />
              <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-muted">
                %
              </span>
            </span>
          ) : (
            <GroupedNumberInput
              name={exitFieldName(leg, "takeProfit")}
              value={price}
              onChange={(next) =>
                shortLeg ? patchShort({ takeProfit: next }) : setTakeProfit(next)
              }
              allowDecimal
              className={dirty && missing ? botFieldInvalidClass : botFieldClass}
            />
          )}
        </BotField>
        <BotField label="Trigger" required>
          <AppSelect
            name={exitFieldName(leg, "tpTrigger")}
            value={trigger}
            onChange={(event) => {
              const next = event.target.value as FuturesTrigger;
              if (shortLeg) {
                patchShort({ tpTrigger: next });
              } else {
                setTpTrigger(next);
              }
            }}
            className={botFieldClass}
          >
            <option value="last">Last</option>
            <option value="mark">Mark</option>
            <option value="index">Index</option>
          </AppSelect>
        </BotField>
        <BotField label="Order type" required>
          <OrderTypePill
            name={exitFieldName(leg, "tpOrderType")}
            value={orderTypeValue === "limit" ? "limit" : "market"}
            onChange={(next) =>
              shortLeg ? patchShort({ tpOrderType: next }) : setTpOrderType(next)
            }
          />
        </BotField>
        {orderTypeValue === "limit" ? (
          <BotField label="Limit price" required>
            <GroupedNumberInput
              name={exitFieldName(leg, "tpLimitPrice")}
              value={limit}
              onChange={(next) =>
                shortLeg ? patchShort({ tpLimitPrice: next }) : setTpLimitPrice(next)
              }
              allowDecimal
              className={dirty && limitMissing ? botFieldInvalidClass : botFieldClass}
            />
          </BotField>
        ) : (
          <input type="hidden" name={exitFieldName(leg, "tpLimitPrice")} value="" />
        )}
      </div>
    );
  }
  function perpsTrailingFields(leg: "primary" | "short") {
    const shortLeg = usesShortExit(leg);
    const distance = shortLeg ? shortClassic.trailingStop : trailingStop;
    const active = shortLeg ? shortClassic.trailingActive : trailingActive;
    const missing = shortLeg ? shortTrailMissing : trailMissing;
    return (
      <div className={fieldRow}>
        <BotField label="Retracement" required>
          <GroupedNumberInput
            name={exitFieldName(leg, "trailingStop")}
            value={distance}
            onChange={(next) =>
              shortLeg ? patchShort({ trailingStop: next }) : setTrailingStop(next)
            }
            allowDecimal
            className={dirty && missing ? botFieldInvalidClass : botFieldClass}
          />
        </BotField>
        <BotField label="Activation price" required>
          <GroupedNumberInput
            name={exitFieldName(leg, "trailingActive")}
            value={active}
            onChange={(next) =>
              shortLeg ? patchShort({ trailingActive: next }) : setTrailingActive(next)
            }
            allowDecimal
            className={
              dirty && (shortLeg ? shortTrailActiveMissing : trailActiveMissing)
                ? botFieldInvalidClass
                : botFieldClass
            }
          />
        </BotField>
        <input type="hidden" name={exitFieldName(leg, "trailingActivation")} value="on" />
      </div>
    );
  }
  function perpsStopFields(leg: "primary" | "short") {
    const shortLeg = usesShortExit(leg);
    const kind = shortLeg ? shortClassic.slKind : slKind;
    const price = shortLeg ? shortClassic.stopLoss : stopLoss;
    const trigger = shortLeg ? shortClassic.slTrigger : slTrigger;
    const orderTypeValue = shortLeg ? shortClassic.slOrderType : slOrderType;
    const limit = shortLeg ? shortClassic.slLimitPrice : slLimitPrice;
    const breakeven = shortLeg ? shortClassic.breakevenOn : breakevenOn;
    const activation = shortLeg
      ? shortClassic.breakevenActivationPct
      : breakevenActivationPct;
    const offset = shortLeg ? shortClassic.breakevenOffsetPct : breakevenOffsetPct;
    const stopOn = shortLeg ? shortSlLive : slLive;
    const missing = shortLeg ? shortSlMissing : slMissing;
    const limitMissing = shortLeg ? shortSlLimitMissing : slLimitMissing;
    const moveMissing = shortLeg ? shortBreakevenMissing : breakevenMissing;
    return (
      <>
        {!stopOn || !breakeven ? (
          <div hidden>
            <input type="hidden" name={exitFieldName(leg, "breakevenActivationPct")} value="" />
            <input type="hidden" name={exitFieldName(leg, "breakevenOffsetPct")} value="" />
          </div>
        ) : null}
        <div className="@container">
          <div className="grid items-start gap-4 @min-[40rem]:grid-cols-2">
            <div className="grid grid-cols-2 gap-4">
              <BotField label="Type" required>
                <AppSelect
                  name={exitFieldName(leg, "slKind")}
                  value={kind}
                  onChange={(event) => {
                    const next = event.target.value === "percent" ? "percent" : "price";
                    if (shortLeg) {
                      patchShort({ slKind: next, stopLoss: "" });
                    } else {
                      setSlKind(next);
                      setStopLoss("");
                    }
                  }}
                  className={botFieldClass}
                >
                  <option value="price">Price</option>
                  <option value="percent">Percentage</option>
                </AppSelect>
              </BotField>
              <BotField label={kind === "percent" ? "%" : "Price"} required>
                {kind === "percent" ? (
                  <span className="relative mt-1 block">
                    <GroupedNumberInput
                      name={exitFieldName(leg, "stopLoss")}
                      value={price}
                      onChange={(next) =>
                        shortLeg ? patchShort({ stopLoss: next }) : setStopLoss(next)
                      }
                      allowDecimal
                      className={`${dirty && missing ? botFieldInvalidClass : botFieldClass} !mt-0 pr-7`}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-muted">
                      %
                    </span>
                  </span>
                ) : (
                  <GroupedNumberInput
                    name={exitFieldName(leg, "stopLoss")}
                    value={price}
                    onChange={(next) =>
                      shortLeg ? patchShort({ stopLoss: next }) : setStopLoss(next)
                    }
                    allowDecimal
                    className={dirty && missing ? botFieldInvalidClass : botFieldClass}
                  />
                )}
              </BotField>
              <BotField label="Trigger" required>
                <AppSelect
                  name={exitFieldName(leg, "slTrigger")}
                  value={trigger}
                  onChange={(event) => {
                    const next = event.target.value as FuturesTrigger;
                    if (shortLeg) {
                      patchShort({ slTrigger: next });
                    } else {
                      setSlTrigger(next);
                    }
                  }}
                  className={botFieldClass}
                >
                  <option value="last">Last</option>
                  <option value="mark">Mark</option>
                  <option value="index">Index</option>
                </AppSelect>
              </BotField>
              <BotField label="Order type" required>
                <OrderTypePill
                  name={exitFieldName(leg, "slOrderType")}
                  value={orderTypeValue === "limit" ? "limit" : "market"}
                  onChange={(next) =>
                    shortLeg ? patchShort({ slOrderType: next }) : setSlOrderType(next)
                  }
                />
              </BotField>
              {orderTypeValue === "limit" ? (
                <BotField label="Limit price" required>
                  <GroupedNumberInput
                    name={exitFieldName(leg, "slLimitPrice")}
                    value={limit}
                    onChange={(next) =>
                      shortLeg
                        ? patchShort({ slLimitPrice: next })
                        : setSlLimitPrice(next)
                    }
                    allowDecimal
                    className={dirty && limitMissing ? botFieldInvalidClass : botFieldClass}
                  />
                </BotField>
              ) : (
                <input type="hidden" name={exitFieldName(leg, "slLimitPrice")} value="" />
              )}
            </div>
            <OptionalSection
              title="Move Breakeven"
              className="min-w-0"
              enabled={breakeven}
              onEnabled={(next) =>
                shortLeg ? patchShort({ breakevenOn: next }) : setBreakevenOn(next)
              }
            >
              <div className="grid grid-cols-2 gap-4">
                <BotField label="Move stop to breakeven at %" required>
                  <span className="relative mt-1 block">
                    <GroupedNumberInput
                      name={exitFieldName(leg, "breakevenActivationPct")}
                      value={activation}
                      onChange={(next) =>
                        shortLeg
                          ? patchShort({ breakevenActivationPct: next })
                          : setBreakevenActivationPct(next)
                      }
                      allowDecimal
                      className={`${dirty && moveMissing ? botFieldInvalidClass : botFieldClass} !mt-0 pr-7`}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-muted">
                      %
                    </span>
                  </span>
                </BotField>
                <BotField label="Breakeven offset %">
                  <span className="relative mt-1 block">
                    <GroupedNumberInput
                      name={exitFieldName(leg, "breakevenOffsetPct")}
                      value={offset}
                      onChange={(next) =>
                        shortLeg
                          ? patchShort({ breakevenOffsetPct: next })
                          : setBreakevenOffsetPct(next)
                      }
                      allowDecimal
                      placeholder="0"
                      className={`${botFieldClass} !mt-0 pr-7`}
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
            message: disableConfirmMessage("flex"),
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
      {!closing && storedDirection === "both" ? (
        <input type="hidden" name={`${prefix}short_classic`} value="on" />
      ) : null}
      {!closing && (shortTpLive || shortSlLive) ? (
        <>
          <input type="hidden" name={`${prefix}short_tpsl`} value="on" />
          <input
            type="hidden"
            name={`${prefix}short_tpslMode`}
            value={storedShort?.tpsl?.mode ?? layer.tpsl?.mode ?? "full"}
          />
        </>
      ) : null}
      {!closing && shortTpLive ? (
        <input type="hidden" name={`${prefix}short_tpOn`} value="on" />
      ) : null}
      {!closing && shortSlLive ? (
        <input type="hidden" name={`${prefix}short_slOn`} value="on" />
      ) : null}
      {!closing && shortTrailLive ? (
        <input type="hidden" name={`${prefix}short_trailing`} value="on" />
      ) : null}
      {!closing && shortSlLive && shortClassic.breakevenOn ? (
        <input type="hidden" name={`${prefix}short_breakeven`} value="on" />
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
              className={dirty && nameMissing ? botFieldInvalidClass : botFieldClass}
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
        title="Long Entry"
        badge="Condition Builder"
        shell="canvas"
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
          fieldClass={botFieldClass}
          labelClass={botLabelClass}
          showErrors={dirty}
          order={{ size, sizeUnit, orderType, limitPrice }}
          onOrderChange={(partial) => {
            if (partial.size != null) setSize(partial.size);
            if (partial.sizeUnit != null) setSizeUnit(partial.sizeUnit);
            if (partial.orderType != null) setOrderType(partial.orderType);
            if (partial.limitPrice != null) setLimitPrice(partial.limitPrice);
          }}
          orderNamed
          quoteLabel={quoteLabel}
          baseCoin={baseCoin}
          orderSizeInvalid={dirty && sizeMissing}
          orderLimitInvalid={dirty && orderLimitMissing}
          extraOrders={longExtraOrders}
        />
      </BotFormStep>
      ) : null}
      {showShort ? (
      <BotFormStep
        title="Short Entry"
        badge="Condition Builder"
        shell="canvas"
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
          fieldClass={botFieldClass}
          labelClass={botLabelClass}
          showErrors={dirty}
          order={{ size, sizeUnit, orderType, limitPrice }}
          onOrderChange={(partial) => {
            if (partial.size != null) setSize(partial.size);
            if (partial.sizeUnit != null) setSizeUnit(partial.sizeUnit);
            if (partial.orderType != null) setOrderType(partial.orderType);
            if (partial.limitPrice != null) setLimitPrice(partial.limitPrice);
          }}
          orderNamed={!showLong}
          quoteLabel={quoteLabel}
          baseCoin={baseCoin}
          orderSizeInvalid={dirty && sizeMissing}
          orderLimitInvalid={dirty && orderLimitMissing}
          extraOrders={shortExtraOrders}
        />
      </BotFormStep>
      ) : null}

      {closing ? (
      <BotFormStep title="Position Sizing" defaultCollapsed={inUse}>
      <BotFormGroup>
        <div className={fieldRow}>
          <BotField label="Qty to close" hint="Empty closes the whole row.">
            <GroupedNumberInput
              name={`${prefix}size`}
              value={size}
              onChange={setSize}
              allowDecimal
              placeholder="All"
              className={botFieldClass}
            />
          </BotField>
          <input type="hidden" name={`${prefix}sizeUnit`} value="qty" />
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
      ) : null}

      {!closing && (direction === "long" || direction === "both") ? (
        <BotFormStep title="Long Additional Orders" badge="Condition Builder" shell="canvas" defaultCollapsed={inUse}>
          <PerpsAdditionalOrders
            groups={longAddGroups}
            onGroupsChange={setLongAddGroups}
            quoteLabel={quoteLabel}
            baseCoin={baseCoin}
            fieldClass={botFieldClass}
            gridClass={fieldRow}
            fieldsClass={fieldRow5}
            side="long"
            webhooks={triggerWebhooks}
            showErrors={dirty}
            invalidFieldClass={botFieldInvalidClass}
          />
        </BotFormStep>
      ) : null}
      {!closing && (direction === "short" || direction === "both") ? (
        <BotFormStep title="Short Additional Orders" badge="Condition Builder" shell="canvas" defaultCollapsed={inUse}>
          <PerpsAdditionalOrders
            groups={shortAddGroups}
            onGroupsChange={setShortAddGroups}
            quoteLabel={quoteLabel}
            baseCoin={baseCoin}
            fieldClass={botFieldClass}
            gridClass={fieldRow}
            fieldsClass={fieldRow5}
            side="short"
            webhooks={triggerWebhooks}
            showErrors={dirty}
            invalidFieldClass={botFieldInvalidClass}
          />
        </BotFormStep>
      ) : null}

      {!closing && (direction === "long" || direction === "both") ? (
        <BotFormStep title="Long Exit" badge="Condition Builder" shell="canvas">
          <ExitSideBuilder
            clauses={exitClauses}
            onChange={(next) => commitExitClauses(next, "primary")}
            side="long"
            prefix={`${prefix}exitIf`}
            webhooks={triggerWebhooks}
            fieldClass={botFieldClass}
            labelClass={botLabelClass}
            gridClass={fieldRow5}
            showErrors={dirty}
            renderTakeProfit={() => perpsTakeProfitFields("primary")}
            renderTrailingStop={() => perpsTrailingFields("primary")}
            renderStopLoss={() => perpsStopFields("primary")}
          />
        </BotFormStep>
      ) : null}
      {!closing && (direction === "short" || direction === "both") ? (
        <BotFormStep title="Short Exit" badge="Condition Builder" shell="canvas">
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
            showErrors={dirty}
            renderTakeProfit={() =>
              perpsTakeProfitFields(direction === "both" ? "short" : "primary")
            }
            renderTrailingStop={() =>
              perpsTrailingFields(direction === "both" ? "short" : "primary")
            }
            renderStopLoss={() =>
              perpsStopFields(direction === "both" ? "short" : "primary")
            }
          />
        </BotFormStep>
      ) : null}

      </BotFormCard>
      {embedded ? null : (
      <BotFormSidebar
        status={
          <BotStatusField
            desk="flex"
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
            kind="flex"
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
