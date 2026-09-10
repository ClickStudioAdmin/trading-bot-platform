"use client";

import { useState } from "react";
import {
  AdditionalActions,
  BotField,
  BotFormGroup,
  BotStatusField,
  DirtySaveBanner,
  OptionalSection,
  botFieldClass,
  botHeaderPrimaryClass,
  botHeaderRemoveClass,
  botRowClass,
  deskActionBtnClass,
} from "@/components/bot-form-chrome";
import {
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
import { disableConfirmMessage, disableNeedsConfirm } from "@/lib/bots/status";
import { PendingSubmitButton } from "@/components/pending-submit-button";
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

export function AutomationsDesk({
  values,
  inUseRuleIds,
  reduceOnly = false,
  isAdmin = false,
  accountId,
  templates = [],
  sets = [],
  recipeLibrary = [],
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
}) {
  const [hasSets, setHasSets] = useState(values.layers.length > 0);
  const [accountReduceOnly, setAccountReduceOnly] = useState(reduceOnly);
  return (
    <div className="space-y-4">
      {hasSets ? (
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
            <input
              type="checkbox"
              name="reduceOnly"
              value="on"
              defaultChecked={accountReduceOnly}
              className="mt-1 size-4"
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
}) {
  const [layers, setLayers] = useState(() => [...values.layers].reverse());
  const [cloneMenu, setCloneMenu] = useState(0);
  const [inUseIds, setInUseIds] = useState(inUseRuleIds);
  const inUse = new Set(inUseIds);
  const empty = layers.length === 0;
  const cloneSources = layers.filter((layer) => layer.id);

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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setLayers((current) => [
              layerToForm(current.length),
              ...current,
            ])
          }
          className={deskActionBtnClass}
        >
          Create New Bot
        </button>
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
                clonePaperLayerForm(source),
                ...current,
              ]);
              onHasSetsChange?.(true);
              setCloneMenu((n) => n + 1);
            }}
            className={deskActionBtnClass}
          >
            <option value="">Clone existing bot</option>
            {cloneSources.map((item) => (
              <option key={item.key} value={item.key}>
                {item.name || "Bot"}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {empty ? (
        <p className="rounded-card border border-line bg-canvas px-4 py-6 text-sm text-ink-muted">
          No bots yet. Add a bot to start the engine, or leave this
          empty if you only trade by hand.
        </p>
      ) : (
        layers.map((layer) => {
          const id = Number(layer.id);
          const used = Number.isFinite(id) && inUse.has(id);
          return (
            <RuleRow
              key={layer.key}
              layer={layer}
              canRemove={!used}
              inUse={used}
              accountReduceOnly={reduceOnly}
              isAdmin={isAdmin}
              onSaved={applySaveResult}
              onRemove={() => removeLayer(layer.key, layer.id)}
              folders={sets}
              recipeLibrary={recipeLibrary}
            />
          );
        })
      )}
    </div>
  );
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
  const [dirty, setDirty] = useState(!layer.id);
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

  return (
    <StayOnPageForm
      action={savePaperRules}
      onResult={(result) => {
        onSaved(result);
        if (result.ok) {
          setDirty(false);
        }
      }}
      onChange={() => setDirty(true)}
      guard={() => {
        if (missing) {
          return false;
        }
        if (mode === "disabled" && disableNeedsConfirm(inUse)) {
          return window.confirm(disableConfirmMessage("cnc"));
        }
        return true;
      }}
      className="flex flex-col scroll-mt-24 divide-y divide-line rounded-card border border-line bg-canvas px-5"
      id={layer.id ? `bot-${layer.id}` : undefined}
    >
      <input type="hidden" name="saveScope" value="one" />
      <input type="hidden" name="ruleCount" value="1" />
      <input type="hidden" name={`${prefix}id`} value={layer.id} />
      <DirtySaveBanner
        dirty={dirty}
        error={
          missing ? "Fill required fields before saving." : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <DeskFormFlash />
          <PendingSubmitButton
            pendingLabel="Saving…"
            deskAction="default"
            className={botHeaderPrimaryClass}
            disabled={missing}
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
            desk="cnc"
            name={`${prefix}mode`}
            value={mode}
            applied={layer.mode}
            onChange={(next) => setMode(parseAutomationMode(next))}
            inUse={inUse}
            accountReduceOnly={accountReduceOnly}
          />
        </div>
      </BotFormGroup>
      <BotFormGroup title="Entry" hint="All conditions must be true.">
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
      </BotFormGroup>
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
            <select
              name={`${prefix}sizeType`}
              value={sizeType}
              onChange={(event) =>
                setSizeType(event.target.value === "dynamic" ? "dynamic" : "fixed")
              }
              className={botFieldClass}
            >
              <option value="dynamic">Dynamic (scale in)</option>
              <option value="fixed">Fixed</option>
            </select>
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
            <select
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
            </select>
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
      <AdditionalActions>
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
        />
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className={botHeaderRemoveClass}
          >
            Remove
          </button>
        ) : (
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
        )}
      </AdditionalActions>
    </StayOnPageForm>
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
