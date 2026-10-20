"use client";

import { useState } from "react";
import { NewBotLink } from "@/components/quota-access";
import { useRouter } from "next/navigation";
import { AutomationsBotTable } from "@/components/automations-bot-table";
import {
  BotField,
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
  botFieldClass,
  botRowClass,
  botSidebarActionClass,
  botSidebarRemoveClass,
  botSidebarSaveClass,
  deskActionBtnClass,
} from "@/components/bot-form-chrome";
import {
  deletePaperRuleAction,
  savePaperRules,
  setPaperBotModesAction,
  type SavePaperRulesResult,
} from "@/lib/engine/actions";
import { parseAutomationMode } from "@/lib/engine/decide";
import {
  clonePaperLayerForm,
  defaultPaperLayer,
  paperConfigToFormValues,
  type PaperLayerFormValues,
  type PaperRulesFormValues,
} from "@/lib/engine/rules";
import {
  botDeleteAllowed,
  disableConfirmMessage,
  disableConfirmTitle,
  disableNeedsConfirm,
} from "@/lib/bots/status";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { useConfirmDialog } from "@/components/confirm-modal";
import {
  DeskFormFlash,
  StayOnPageForm,
  keepFormKeys,
} from "@/components/stay-on-page-form";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { IconPlus, IconSave } from "@/components/icons";
import { DeskTemplateBar, SaveAsTemplateButton } from "@/components/template-modals";
import {
  paperFormToSnapshotSource,
  snapshotPaperRecipe,
  type TemplateRecipe,
} from "@/lib/templates/recipe";
import { parsePaperRulesForm } from "@/lib/engine/rules";
import type { AppliedDeskItem } from "@/lib/templates/apply";
import type { AutomationTemplateSet, TemplateSummary } from "@/lib/templates/store";
import { AppSelect } from "@/components/app-select";
import {
  automationsBotBlotterCells,
  botModeLabel,
  deskBotRows,
  paperBotPair,
  paperBotSummary,
  paperListRecipe,
  type AutomationsBotBlotter,
} from "@/lib/bots/automations-list";
import { withRemovedIds } from "@/lib/table-chrome";
import { paperBotConfig } from "@/lib/bots/bot-config";
import {
  AUTOMATIONS_NEW,
  BOT_NAME_MAX,
  CASH_AND_CARRY_ACTIVITY_PATH,
  CASH_AND_CARRY_PERFORMANCE_PATH,
  CASH_AND_CARRY_POSITIONS_PATH,
  automationsEditHref,
  automationsNewHref,
} from "@/lib/bots/automations-path";
import { withCreatedFormKey } from "@/lib/bots/automations-saved-edit";
import {
  rememberSavedBotEdit,
  useShownAutomationsEdit,
} from "@/components/automations-saved-edit";

export function AutomationsDesk({
  values,
  inUseRuleIds,
  reduceOnly = false,
  isAdmin = false,
  accountId,
  templates = [],
  sets = [],
  recipeLibrary = [],
  edit = null,
  clone = null,
  listHref,
  blotter,
  revealId = null,
}: {
  values: PaperRulesFormValues;
  inUseRuleIds: number[];
  reduceOnly?: boolean;
  isAdmin?: boolean;
  accountId?: string;
  templates?: TemplateSummary[];
  sets?: AutomationTemplateSet[];
  recipeLibrary?: readonly {
    name: string;
    recipe: TemplateRecipe;
    visibility?: string;
  }[];
  edit?: string | null;
  clone?: string | null;
  listHref: string;
  blotter?: Record<string, AutomationsBotBlotter>;
  revealId?: string | null;
}) {
  return (
    <PaperRulesForm
      values={values}
      inUseRuleIds={inUseRuleIds}
      reduceOnly={reduceOnly}
      isAdmin={isAdmin}
      accountId={accountId}
      templates={templates}
      sets={sets}
      recipeLibrary={recipeLibrary}
      edit={edit}
      clone={clone}
      listHref={listHref}
      blotter={blotter}
      revealId={revealId}
    />
  );
}

export function PaperRulesForm({
  values,
  inUseRuleIds,
  reduceOnly = false,
  isAdmin = false,
  accountId,
  templates = [],
  sets = [],
  recipeLibrary = [],
  edit = null,
  clone = null,
  listHref,
  blotter,
  revealId = null,
}: {
  values: PaperRulesFormValues;
  inUseRuleIds: number[];
  reduceOnly?: boolean;
  isAdmin?: boolean;
  accountId?: string;
  templates?: TemplateSummary[];
  sets?: AutomationTemplateSet[];
  recipeLibrary?: readonly {
    name: string;
    recipe: TemplateRecipe;
    visibility?: string;
  }[];
  edit?: string | null;
  clone?: string | null;
  listHref: string;
  blotter?: Record<string, AutomationsBotBlotter>;
  revealId?: string | null;
}) {
  const router = useRouter();
  const [layers, setLayers] = useState(() => [...values.layers].reverse());
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [deskId, setDeskId] = useState(accountId ?? "");
  const [draft, setDraft] = useState(() =>
    edit === AUTOMATIONS_NEW
      ? resolvePaperDraft(values.layers, clone)
      : null,
  );
  const [draftEdit, setDraftEdit] = useState(edit);
  const [draftClone, setDraftClone] = useState(clone);
  const [shownEdit, setShownEdit] = useShownAutomationsEdit(edit);
  const [inUseIds, setInUseIds] = useState(inUseRuleIds);
  const deskChanged = (accountId ?? "") !== deskId;
  const botList = deskBotRows({
    deskChanged,
    current: layers,
    incoming: [...values.layers].reverse(),
    removedIds,
    id: (layer) => layer.id,
  });
  const visibleLayers = botList.rows;
  if (deskChanged) {
    setDeskId(accountId ?? "");
    setLayers([...visibleLayers]);
    setInUseIds(inUseRuleIds);
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
  const nextDraft =
    edit !== draftEdit || clone !== draftClone
      ? edit === AUTOMATIONS_NEW
        ? resolvePaperDraft(values.layers, clone)
        : null
      : draft;
  if (edit !== draftEdit || clone !== draftClone) {
    setDraftEdit(edit);
    setDraftClone(clone);
    setDraft(nextDraft);
  }
  const inUse = new Set(deskChanged ? inUseRuleIds : inUseIds);
  const savedLayers = visibleLayers.filter((layer) => layer.id);
  const formLayer =
    shownEdit === AUTOMATIONS_NEW
      ? nextDraft
      : shownEdit
        ? visibleLayers.find((layer) => layer.id === shownEdit) ?? null
        : null;
  const showForm = Boolean(formLayer);

  function applySaveResult(
    result: SavePaperRulesResult,
    created?: { id: string; key: string } | null,
  ) {
    if (!result.ok) {
      return;
    }
    if (result.layers) {
      setLayers((current) =>
        withCreatedFormKey(
          keepFormKeys(current, [...(result.layers ?? [])].reverse()),
          created?.id,
          created?.key,
        ),
      );
    }
    if (result.inUseRuleIds) {
      setInUseIds(result.inUseRuleIds);
    }
  }

  function appendApplied(items: AppliedDeskItem[]) {
    const nextLayers = items
      .filter(
        (
          item,
        ): item is Extract<AppliedDeskItem, { deskType: "cash_and_carry" }> =>
          item.deskType === "cash_and_carry",
      )
      .map((item) => item.layer);
    if (nextLayers.length === 0) {
      return;
    }
    setLayers((current) => {
      const seen = new Set(current.map((row) => row.id).filter(Boolean));
      const fresh = nextLayers.filter((row) => !row.id || !seen.has(row.id));
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

  function removeLayer(key: string, id: string) {
    const next = layers.filter((item) => item.key !== key);
    setLayers(next);
    if (next.length === 0 && id !== "") {
      const data = new FormData();
      data.set("ruleCount", "0");
      void savePaperRules(data).then(applySaveResult);
    }
  }

  return (
    <div className="space-y-4">
      {showForm && formLayer ? (
        <RuleRow
          key={formLayer.key}
          layer={formLayer}
          inUse={Boolean(formLayer.id && inUse.has(Number(formLayer.id)))}
          accountReduceOnly={reduceOnly}
          isAdmin={isAdmin}
          onSaved={(result) => {
            const previous = new Set(
              layers.flatMap((layer) => (layer.id ? [layer.id] : [])),
            );
            const created = result.layers?.find(
              (layer) => layer.id && !previous.has(layer.id),
            );
            const savedId = created?.id ?? formLayer.id;
            applySaveResult(
              result,
              created?.id ? { id: created.id, key: formLayer.key } : null,
            );
            if (result.ok) {
              const saved = result.layers?.find((layer) => layer.id === savedId);
              stayOnSaved(savedId, saved?.name ?? formLayer.name);
            }
          }}
          onRemove={() => {
            removeLayer(formLayer.key, formLayer.id);
            leaveToList();
          }}
          folders={sets}
          recipeLibrary={recipeLibrary}
        />
      ) : (
        <>
          <AutomationsBotTable
            desk="cnc"
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
                    deskType="cash_and_carry"
                    accountId={accountId}
                    templates={templates}
                    sets={sets}
                    onApplied={appendApplied}
                  />
                ) : null}
              </>
            }
            empty="No bots yet. Create a bot to start the engine, or leave this empty if you only trade by hand."
            onBulkStatus={async (ids, action) => {
              const data = new FormData();
              data.set("bulk", action);
              for (const id of ids) {
                data.append("id", id);
              }
              const result = await setPaperBotModesAction(data);
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
            rows={savedLayers.map((layer) => ({
              id: layer.id,
              name: layer.name || "Bot",
              pair: paperBotPair(),
              status: botModeLabel("cnc", layer.mode),
              statusKey: layer.mode,
              summary: paperBotSummary(layer),
              recipe: paperListRecipe(layer),
              config: paperBotConfig(layer),
              canRemove:
                botDeleteAllowed(layer.mode) &&
                !(
                  Number.isFinite(Number(layer.id)) &&
                  inUse.has(Number(layer.id))
                ),
              ownsOpen:
                Number.isFinite(Number(layer.id)) &&
                inUse.has(Number(layer.id)),
              removeBlocked: botDeleteAllowed(layer.mode)
                ? "This bot has an open position. Close that row before removing it."
                : "Disable this bot before deleting it.",
              onRemove: async () => {
                const data = new FormData();
                data.set("ruleId", layer.id);
                const result = await deletePaperRuleAction(data);
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
                CASH_AND_CARRY_POSITIONS_PATH,
                CASH_AND_CARRY_PERFORMANCE_PATH,
                CASH_AND_CARRY_ACTIVITY_PATH,
                accountId,
              ),
              editHref: automationsEditHref(listHref, layer.id),
              cloneHref: automationsNewHref(listHref, layer.id),
            }))}
          />
        </>
      )}
    </div>
  );
}

function resolvePaperDraft(
  layers: PaperLayerFormValues[],
  clone: string | null,
): PaperLayerFormValues {
  if (clone) {
    const source = layers.find((layer) => layer.id === clone);
    if (source) {
      return clonePaperLayerForm(source);
    }
  }
  return layerToForm(layers.length);
}

function layerToForm(index: number): PaperLayerFormValues {
  const layer = paperConfigToFormValues({
    enabled: false,
    layers: [defaultPaperLayer(index)],
  }).layers[0]!;
  return { ...layer, key: `new-${Date.now()}-${index}` };
}

function RuleRow({
  layer,
  inUse,
  accountReduceOnly,
  isAdmin,
  onRemove,
  onSaved,
  folders = [],
  recipeLibrary = [],
}: {
  layer: PaperLayerFormValues;
  inUse: boolean;
  accountReduceOnly: boolean;
  isAdmin: boolean;
  onRemove: () => void;
  onSaved: (result: SavePaperRulesResult) => void;
  folders?: AutomationTemplateSet[];
  recipeLibrary?: readonly {
    name: string;
    recipe: TemplateRecipe;
    visibility?: string;
  }[];
}) {
  const prefix = "r0_";
  const [dirty, setDirty] = useState(false);
  const [sizeType, setSizeType] = useState(layer.sizeType);
  const [exitSizeType, setExitSizeType] = useState(layer.exitSizeType);
  const [mode, setMode] = useState(layer.mode);
  const [maxOpenCount, setMaxOpenCount] = useState(layer.maxOpenCount || "1");
  const [orderSizeUsdt, setOrderSizeUsdt] = useState(String(layer.notionalUsdt));
  const missingCount = !maxOpenCount.trim();
  const missingSize = sizeType === "fixed" && !orderSizeUsdt.trim();
  const missing = missingCount || missingSize;

  const { confirm: askConfirm, dialog } = useConfirmDialog();

  return (
    <>
    <StayOnPageForm
      action={savePaperRules}
      onResult={(result) => {
        onSaved(result);
        if (result.ok) {
          setDirty(false);
        }
      }}
      onChange={() => setDirty(true)}
      guard={async () => {
        if (missing) {
          return false;
        }
        if (mode === "disabled" && disableNeedsConfirm(inUse)) {
          return askConfirm({
            title: disableConfirmTitle(),
            message: disableConfirmMessage("cnc"),
            confirmLabel: "Disable",
            danger: true,
          });
        }
        return true;
      }}
      className="space-y-5 scroll-mt-24"
      id={layer.id ? `bot-${layer.id}` : undefined}
    >
      <input type="hidden" name="saveScope" value="one" />
      <input type="hidden" name="ruleCount" value="1" />
      <input type="hidden" name={`${prefix}id`} value={layer.id} />
      <BotFormColumns>
      <BotFormCard>
      <BotFormStep title="General">
        <BotField label="Name" required>
          <input
            id={`${prefix}name`}
            name={`${prefix}name`}
            defaultValue={layer.name}
            maxLength={BOT_NAME_MAX}
            className={botFieldClass}
          />
        </BotField>
      </BotFormStep>
      <BotFormStep
        title="Entry Conditions"
        hint="All conditions must be true."
      >
        <div className={botRowClass}>
          <CarryNumber
            name={`${prefix}minApr`}
            label="Min APR %"
            defaultValue={layer.minApr}
            allowDecimal
          />
          <CarryNumber
            name={`${prefix}minDte`}
            label="Min DTE"
            defaultValue={layer.minDte}
          />
          <CarryNumber
            name={`${prefix}maxDte`}
            label="Max DTE"
            defaultValue={layer.maxDte}
          />
        </div>
      </BotFormStep>
      <BotFormStep title="Position Sizing">
      <BotFormGroup title="Position and Orders">
        <div className={botRowClass}>
          <CarryNumber
            name={`${prefix}maxOpenNotional`}
            label="Max Position Size"
            defaultValue={layer.maxOpenNotional}
          />
          <CarryNumber
            name={`${prefix}maxOpenCount`}
            label="Max pairs"
            value={maxOpenCount}
            onChange={setMaxOpenCount}
            required
          />
          <BotField label="Order Type" required>
            <AppSelect
              name={`${prefix}sizeType`}
              value={sizeType}
              onChange={(event) =>
                setSizeType(event.target.value === "dynamic" ? "dynamic" : "fixed")
              }
              className={botFieldClass}
            >
              <option value="dynamic">Dynamic (scale in)</option>
              <option value="fixed">Fixed</option>
            </AppSelect>
          </BotField>
          {sizeType === "fixed" ? (
            <>
              <CarryNumber
                name={`${prefix}notionalUsdt`}
                label="Order size (USDT)"
                value={orderSizeUsdt}
                onChange={setOrderSizeUsdt}
                required
              />
              <CarryNumber
                name={`${prefix}minCapacity`}
                label="Min usable book"
                defaultValue={layer.minCapacity}
              />
            </>
          ) : null}
          {sizeType === "dynamic" || exitSizeType === "dynamic" ? (
            <CarryNumber
              name={`${prefix}minSize`}
              label="Min Order Size"
              defaultValue={layer.minSize}
            />
          ) : null}
        </div>
      </BotFormGroup>
      </BotFormStep>
      <BotFormStep
        title="Exit Conditions"
        hint="Any condition can be true."
      >
      <BotFormGroup title="Exit" hint="Any condition can be true.">
        <div className={botRowClass}>
          <CarryNumber
            name={`${prefix}closeMaxDte`}
            label="DTE ≤"
            defaultValue={layer.closeMaxDte}
          />
          <CarryNumber
            name={`${prefix}closeMinApr`}
            label="APR % below"
            defaultValue={layer.closeMinApr}
            allowDecimal
          />
          <BotField label="Order Type" required>
            <AppSelect
              name={`${prefix}exitSizeType`}
              value={exitSizeType}
              onChange={(event) =>
                setExitSizeType(
                  event.target.value === "fixed" ? "fixed" : "dynamic",
                )
              }
              className={botFieldClass}
            >
              <option value="dynamic">Dynamic (scale out)</option>
              <option value="fixed">Fixed (entire position)</option>
            </AppSelect>
          </BotField>
        </div>
      </BotFormGroup>
      </BotFormStep>
      </BotFormCard>
      <BotFormSidebar
        status={
          <BotStatusField
            desk="cnc"
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
        error={missing ? completeRequiredNotice : undefined}
        save={
          <div className="space-y-2">
            <PendingSubmitButton
              pendingLabel="Saving…"
              deskAction="default"
              className={botSidebarSaveClass}
              disabled={!dirty || missing}
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
            kind="cash_and_carry"
            folders={folders}
            library={recipeLibrary}
            currentRecipe={(() => {
              const parsed = parsePaperRulesForm(
                paperFormToSnapshotSource({
                  ...layer,
                  mode,
                  sizeType,
                  exitSizeType,
                  maxOpenCount,
                  notionalUsdt: Number(orderSizeUsdt.replace(/,/g, "")) || 0,
                  takeProfit: "",
                  stopLoss: "",
                }),
              );
              return parsed.ok && parsed.config.layers[0]
                ? snapshotPaperRecipe(parsed.config.layers[0])
                : null;
            })()}
            buildForm={() =>
              paperFormToSnapshotSource({
                ...layer,
                mode,
                sizeType,
                exitSizeType,
                maxOpenCount,
                notionalUsdt: Number(orderSizeUsdt.replace(/,/g, "")) || 0,
                takeProfit: "",
                stopLoss: "",
              })
            }
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
      </BotFormColumns>
    </StayOnPageForm>
    {dialog}
    </>
  );
}

function CarryNumber({
  name,
  label,
  defaultValue,
  value,
  onChange,
  allowDecimal,
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (next: string) => void;
  allowDecimal?: boolean;
  required?: boolean;
}) {
  return (
    <BotField label={label} required={required}>
      <GroupedNumberInput
        name={name}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
        allowDecimal={allowDecimal}
        className={botFieldClass}
      />
    </BotField>
  );
}
