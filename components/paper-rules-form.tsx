"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AutomationsBotTable } from "@/components/automations-bot-table";
import {
  BotField,
  BotFormCard,
  BotFormColumns,
  BotFormGroup,
  BotFormStep,
  BotFormSidebar,
  BotStatusField,
  OptionalSection,
  botFieldClass,
  botRowClass,
  botSidebarActionClass,
  botSidebarRemoveClass,
  botSidebarSaveClass,
  deskActionBtnClass,
  deskActionSelectClass,
} from "@/components/bot-form-chrome";
import { AppCheck } from "@/components/app-check";
import {
  deletePaperRuleAction,
  saveAccountReduceOnly,
  savePaperRules,
  type SavePaperRulesResult,
  type SaveReduceOnlyResult,
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
  paperBotPair,
  paperBotSummary,
  type AutomationsBotBlotter,
} from "@/lib/bots/automations-list";
import {
  AUTOMATIONS_NEW,
  CASH_AND_CARRY_PERFORMANCE_PATH,
  CASH_AND_CARRY_POSITIONS_PATH,
  automationsEditHref,
  automationsNewHref,
  automationsSavedHref,
} from "@/lib/bots/automations-path";

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
}) {
  const [hasSets, setHasSets] = useState(values.layers.length > 0);
  const [accountReduceOnly, setAccountReduceOnly] = useState(reduceOnly);
  const showList = !edit;
  return (
    <div className="space-y-4">
      {hasSets && showList ? (
        <StayOnPageForm
          action={saveAccountReduceOnly}
          onResult={(result) => {
            const next = result as SaveReduceOnlyResult;
            if (next.ok && typeof next.reduceOnly === "boolean") {
              setAccountReduceOnly(next.reduceOnly);
            }
          }}
          className="max-w-md space-y-3 rounded-card border border-line bg-surface p-5"
        >
          <label className="flex items-start gap-3 text-sm text-ink">
            <AppCheck
              name="reduceOnly"
              value="on"
              defaultChecked={accountReduceOnly}
            />
            <span>
              Reduce only
              <span className="mt-1 block text-xs text-ink-muted">
                Stops every bot from opening or adding size. Automated
                exits still run unless a bot is Disabled. Manual Open,
                Close, and Unwind still work.
              </span>
            </span>
          </label>
          <DeskFormFlash />
          <PendingSubmitButton
            pendingLabel="Saving…"
            deskAction="default"
            className="rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink"
          >
            Save
          </PendingSubmitButton>
        </StayOnPageForm>
      ) : null}
      <PaperRulesForm
        values={values}
        inUseRuleIds={inUseRuleIds}
        reduceOnly={accountReduceOnly}
        onHasSetsChange={setHasSets}
        isAdmin={isAdmin}
        accountId={accountId}
        templates={templates}
        sets={sets}
        recipeLibrary={recipeLibrary}
        edit={edit}
        clone={clone}
        listHref={listHref}
        blotter={blotter}
      />
    </div>
  );
}

export function PaperRulesForm({
  values,
  inUseRuleIds,
  reduceOnly = false,
  onHasSetsChange,
  isAdmin = false,
  accountId,
  templates = [],
  sets = [],
  recipeLibrary = [],
  edit = null,
  clone = null,
  listHref,
  blotter,
}: {
  values: PaperRulesFormValues;
  inUseRuleIds: number[];
  reduceOnly?: boolean;
  onHasSetsChange?: (hasSets: boolean) => void;
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
}) {
  const router = useRouter();
  const [layers, setLayers] = useState(() => [...values.layers].reverse());
  const [cloneMenu, setCloneMenu] = useState(0);
  const [draft, setDraft] = useState(() =>
    edit === AUTOMATIONS_NEW
      ? resolvePaperDraft(values.layers, clone)
      : null,
  );
  const [draftEdit, setDraftEdit] = useState(edit);
  const [draftClone, setDraftClone] = useState(clone);
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
  const [inUseIds, setInUseIds] = useState(inUseRuleIds);
  const inUse = new Set(inUseIds);
  const savedLayers = layers.filter((layer) => layer.id);
  const empty = savedLayers.length === 0;
  const cloneSources = savedLayers;
  const formLayer =
    edit === AUTOMATIONS_NEW
      ? nextDraft
      : edit
        ? layers.find((layer) => layer.id === edit) ?? null
        : null;
  const showForm = Boolean(formLayer);

  function applySaveResult(result: SavePaperRulesResult) {
    if (!result.ok) {
      return;
    }
    if (result.layers) {
      setLayers((current) =>
        keepFormKeys(current, [...(result.layers ?? [])].reverse()),
      );
      onHasSetsChange?.(result.layers.length > 0);
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
    onHasSetsChange?.(true);
    router.refresh();
  }

  function leaveToList(saved = false) {
    router.push(saved ? automationsSavedHref(listHref) : listHref);
  }

  function removeLayer(key: string, id: string) {
    const next = layers.filter((item) => item.key !== key);
    setLayers(next);
    onHasSetsChange?.(next.length > 0);
    if (next.length === 0 && id !== "") {
      const data = new FormData();
      data.set("ruleCount", "0");
      void savePaperRules(data).then(applySaveResult);
    }
  }

  return (
    <div className="space-y-4">
      {reduceOnly && !empty ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Account Reduce only is on. Active bots will not open or add size.
          Exits still run unless a bot is Disabled. Manual Open, Close, and
          Unwind still work.
        </p>
      ) : null}

      {showForm && formLayer ? (
        <RuleRow
          key={formLayer.key}
          layer={formLayer}
          canRemove={!(Number.isFinite(Number(formLayer.id)) && inUse.has(Number(formLayer.id)))}
          inUse={Boolean(formLayer.id && inUse.has(Number(formLayer.id)))}
          accountReduceOnly={reduceOnly}
          isAdmin={isAdmin}
          onSaved={(result) => {
            applySaveResult(result);
            if (result.ok) {
              leaveToList(true);
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
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={automationsNewHref(listHref)}
              className={`inline-flex items-center ${deskActionBtnClass}`}
            >
              Create New Bot
            </Link>
            {accountId ? (
              <DeskTemplateBar
                deskType="cash_and_carry"
                accountId={accountId}
                templates={templates}
                sets={sets}
                onApplied={appendApplied}
              />
            ) : null}
            {cloneSources.length > 0 ? (
              <AppSelect variant="action"
                key={cloneMenu}
                aria-label="Clone existing bot"
                defaultValue=""
                onChange={(event) => {
                  const id = event.target.value;
                  const source = cloneSources.find((item) => item.id === id);
                  if (!source) {
                    return;
                  }
                  router.push(automationsNewHref(listHref, source.id));
                  setCloneMenu((n) => n + 1);
                }}
                className={deskActionSelectClass}
              >
                <option value="">Clone existing bot</option>
                {cloneSources.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name || "Bot"}
                  </option>
                ))}
              </AppSelect>
            ) : null}
          </div>
          <AutomationsBotTable
            empty="No bots yet. Create a bot to start the engine, or leave this empty if you only trade by hand."
            rows={savedLayers.map((layer) => ({
              id: layer.id,
              name: layer.name || "Bot",
              pair: paperBotPair(),
              status: botModeLabel("cnc", layer.mode),
              statusKey: layer.mode,
              summary: paperBotSummary(layer),
              canRemove: !(
                Number.isFinite(Number(layer.id)) &&
                inUse.has(Number(layer.id))
              ),
              removeBlocked:
                "This bot has an open position. Close that row before removing it.",
              onRemove: async () => {
                const data = new FormData();
                data.set("ruleId", layer.id);
                const result = await deletePaperRuleAction(data);
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
                CASH_AND_CARRY_POSITIONS_PATH,
                CASH_AND_CARRY_PERFORMANCE_PATH,
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
  canRemove,
  inUse,
  accountReduceOnly,
  isAdmin,
  onRemove,
  onSaved,
  folders = [],
  recipeLibrary = [],
}: {
  layer: PaperLayerFormValues;
  canRemove: boolean;
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
  const [tpOn, setTpOn] = useState(Boolean(layer.takeProfit.trim()));
  const [slOn, setSlOn] = useState(Boolean(layer.stopLoss.trim()));
  const [takeProfit, setTakeProfit] = useState(layer.takeProfit);
  const [stopLoss, setStopLoss] = useState(layer.stopLoss);
  const [maxOpenCount, setMaxOpenCount] = useState(layer.maxOpenCount || "1");
  const [orderSizeUsdt, setOrderSizeUsdt] = useState(String(layer.notionalUsdt));
  const missingTp = tpOn && !takeProfit.trim();
  const missingSl = slOn && !stopLoss.trim();
  const missingCount = !maxOpenCount.trim();
  const missingSize = sizeType === "fixed" && !orderSizeUsdt.trim();
  const missing = missingTp || missingSl || missingCount || missingSize;

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
            maxLength={40}
            className={botFieldClass}
          />
        </BotField>
      </BotFormStep>
      <BotFormStep title="Entry Conditions" hint="All conditions must be true.">
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
      <BotFormStep title="Exit Conditions" hint="Any condition can be true.">
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
      <OptionalSection
        title="Take profit"
        enabled={tpOn}
        onEnabled={setTpOn}
      >
        <input type="hidden" name={`${prefix}takeProfitOn`} value="1" />
        <div className={botRowClass}>
          <CarryNumber
            name={`${prefix}takeProfit`}
            label="Take profit %"
            value={takeProfit}
            onChange={setTakeProfit}
            allowDecimal
            required
          />
        </div>
      </OptionalSection>
      <OptionalSection
        title="Stop loss"
        enabled={slOn}
        onEnabled={setSlOn}
      >
        <input type="hidden" name={`${prefix}stopLossOn`} value="1" />
        <div className={botRowClass}>
          <CarryNumber
            name={`${prefix}stopLoss`}
            label="Stop loss %"
            value={stopLoss}
            onChange={setStopLoss}
            allowDecimal
            required
          />
        </div>
      </OptionalSection>
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
        dirty={dirty}
        error={
          dirty && missing ? "Fill required fields before saving." : undefined
        }
        save={
          <div className="space-y-2">
            <DeskFormFlash />
            <PendingSubmitButton
              pendingLabel="Saving…"
              deskAction="default"
              className={botSidebarSaveClass}
              disabled={!dirty || missing}
            >
              Save
            </PendingSubmitButton>
          </div>
        }
      >
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
                takeProfit: tpOn ? takeProfit : "",
                stopLoss: slOn ? stopLoss : "",
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
              takeProfit: tpOn ? takeProfit : "",
              stopLoss: slOn ? stopLoss : "",
            })
          }
          buttonClassName={botSidebarActionClass}
        />
        {layer.id ? null : (
          <button
            type="button"
            onClick={onRemove}
            className={botSidebarRemoveClass}
          >
            Remove
          </button>
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
