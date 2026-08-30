"use client";

import { useState, type ReactNode } from "react";
import {
  saveAccountReduceOnly,
  savePaperRules,
  type SavePaperRulesResult,
  type SaveReduceOnlyResult,
} from "@/lib/engine/actions";
import {
  parseAutomationMode,
  type AutomationMode,
} from "@/lib/engine/decide";
import {
  clonePaperLayerForm,
  defaultPaperLayer,
  paperConfigToFormValues,
  type PaperLayerFormValues,
  type PaperRulesFormValues,
} from "@/lib/engine/rules";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  DeskFormFlash,
  StayOnPageForm,
  keepFormKeys,
} from "@/components/stay-on-page-form";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { DeskTemplateBar, SaveAsTemplateButton } from "@/components/template-modals";
import { paperFormToSnapshotSource } from "@/lib/templates/recipe";
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
}: {
  values: PaperRulesFormValues;
  inUseRuleIds: number[];
  reduceOnly?: boolean;
  isAdmin?: boolean;
  accountId?: string;
  templates?: TemplateSummary[];
  sets?: AutomationTemplateSet[];
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
}: {
  values: PaperRulesFormValues;
  inUseRuleIds: number[];
  reduceOnly?: boolean;
  onHasSetsChange?: (hasSets: boolean) => void;
  isAdmin?: boolean;
  accountId?: string;
  templates?: TemplateSummary[];
  sets?: AutomationTemplateSet[];
}) {
  const [layers, setLayers] = useState(values.layers);
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
      setLayers((current) => keepFormKeys(current, result.layers ?? []));
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
      return fresh.length === 0 ? current : [...current, ...fresh];
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
    <StayOnPageForm
      action={savePaperRules}
      onResult={applySaveResult}
      className="space-y-4"
    >
      <input type="hidden" name="ruleCount" value={layers.length} />

      {reduceOnly && !empty ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Account Reduce only is on. Active bots will not open or add size.
          Exits still run unless a bot is Disabled. Manual Open, Close, and
          Unwind still work.
        </p>
      ) : null}

      {empty ? (
        <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
          No bots yet. Add a bot to start the engine, or leave this
          empty if you only trade by hand.
        </p>
      ) : (
        layers.map((layer, index) => {
          const id = Number(layer.id);
          const used = Number.isFinite(id) && inUse.has(id);
          return (
            <RuleRow
              key={layer.key}
              index={index}
              layer={layer}
              canRemove={!used}
              inUse={used}
              accountReduceOnly={reduceOnly}
              isAdmin={isAdmin}
              onRemove={() => removeLayer(layer.key, layer.id)}
              folders={sets}
            />
          );
        })
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setLayers((current) => [
              ...current,
              layerToForm(current.length),
            ])
          }
          className="rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong"
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
                ...current,
                clonePaperLayerForm(source),
              ]);
              onHasSetsChange?.(true);
              setCloneMenu((n) => n + 1);
            }}
            className="rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong"
          >
            <option value="">Clone existing bot</option>
            {cloneSources.map((item) => (
              <option key={item.key} value={item.key}>
                {item.name || "Bot"}
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

function layerToForm(index: number): PaperLayerFormValues {
  const layer = paperConfigToFormValues({
    enabled: false,
    layers: [defaultPaperLayer(index)],
  }).layers[0]!;
  return { ...layer, key: `new-${Date.now()}-${index}` };
}

function RuleRow({
  index,
  layer,
  canRemove,
  inUse,
  accountReduceOnly,
  isAdmin,
  onRemove,
  folders = [],
}: {
  index: number;
  layer: PaperLayerFormValues;
  canRemove: boolean;
  inUse: boolean;
  accountReduceOnly: boolean;
  isAdmin: boolean;
  onRemove: () => void;
  folders?: AutomationTemplateSet[];
}) {
  const prefix = `r${index}_`;
  const [sizeType, setSizeType] = useState(layer.sizeType);
  const [exitSizeType, setExitSizeType] = useState(layer.exitSizeType);
  const [mode, setMode] = useState(layer.mode);
  return (
    <section className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_13rem_auto] items-center gap-x-2 gap-y-0.5">
        <label
          htmlFor={`${prefix}name`}
          className="text-[11px] text-ink-muted"
        >
          Name
        </label>
        <label
          htmlFor={`${prefix}mode`}
          className="text-[11px] text-ink-muted"
        >
          Mode
        </label>
        <ModeLight
          mode={mode}
          inUse={inUse}
          accountReduceOnly={accountReduceOnly}
        />
        <input
          id={`${prefix}name`}
          name={`${prefix}name`}
          defaultValue={layer.name}
          maxLength={40}
          placeholder={`Bot ${index + 1}`}
          className="w-full rounded-control border border-line bg-surface-raised px-1.5 py-1 text-sm font-semibold text-ink focus:border-line-strong focus:outline-none"
        />
        <select
          id={`${prefix}mode`}
          name={`${prefix}mode`}
          value={mode}
          onChange={(event) => setMode(parseAutomationMode(event.target.value))}
          className="w-full rounded-control border border-line bg-surface-raised px-1.5 py-1 text-xs text-ink focus:border-line-strong focus:outline-none"
        >
          <option value="active">
            {accountReduceOnly ? "Active (Reduce only)" : "Active"}
          </option>
          <option value="reduce_only">Reduce only</option>
          <option value="disabled">Disabled</option>
        </select>
        <span />
      </div>
      <input type="hidden" name={`${prefix}id`} value={layer.id} />
      <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
        Entry
      </p>
      <div className="mt-1 grid gap-2 md:grid-cols-2">
        <FieldGroup title="Conditions (all must be true)">
          <Field
            name={`${prefix}minApr`}
            label="Min APR %"
            defaultValue={layer.minApr}
            allowDecimal
          />
          <Field
            name={`${prefix}minDte`}
            label="Min DTE"
            defaultValue={layer.minDte}
          />
          <Field
            name={`${prefix}maxDte`}
            label="Max DTE"
            defaultValue={layer.maxDte}
          />
        </FieldGroup>
        <FieldGroup title="Position and Orders">
          <Field
            name={`${prefix}maxOpenNotional`}
            label="Max Position Size"
            defaultValue={layer.maxOpenNotional}
          />
          <Field
            name={`${prefix}maxOpenCount`}
            label="Max pairs"
            defaultValue={layer.maxOpenCount || "1"}
          />
          <label className="block text-[11px] text-ink-muted">
            Order Type
            <select
              name={`${prefix}sizeType`}
              value={sizeType}
              onChange={(event) =>
                setSizeType(event.target.value === "dynamic" ? "dynamic" : "fixed")
              }
              className="mt-0.5 w-full rounded-control border border-line bg-surface-raised px-1.5 py-1 text-xs text-ink focus:border-line-strong focus:outline-none"
            >
              <option value="dynamic">Dynamic (scale in)</option>
              <option value="fixed">Fixed</option>
            </select>
          </label>
          {sizeType === "fixed" ? (
            <>
              <Field
                name={`${prefix}notionalUsdt`}
                label="Order size (USDT)"
                defaultValue={String(layer.notionalUsdt)}
              />
              <Field
                name={`${prefix}minCapacity`}
                label="Min usable book"
                defaultValue={layer.minCapacity}
              />
            </>
          ) : null}
          {sizeType === "dynamic" || exitSizeType === "dynamic" ? (
            <Field
              name={`${prefix}minSize`}
              label="Min Order Size"
              defaultValue={layer.minSize}
            />
          ) : null}
        </FieldGroup>
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
        Exit
      </p>
      <div className="mt-1 grid gap-2 md:grid-cols-3">
        <FieldGroup title="Conditions (any can be true)">
          <Field
            name={`${prefix}closeMaxDte`}
            label="DTE ≤"
            defaultValue={layer.closeMaxDte}
          />
          <Field
            name={`${prefix}closeMinApr`}
            label="APR % below"
            defaultValue={layer.closeMinApr}
            allowDecimal
          />
        </FieldGroup>
        <FieldGroup title="Position and Orders">
          <label className="block text-[11px] text-ink-muted">
            Order Type
            <select
              name={`${prefix}exitSizeType`}
              value={exitSizeType}
              onChange={(event) =>
                setExitSizeType(
                  event.target.value === "fixed" ? "fixed" : "dynamic",
                )
              }
              className="mt-0.5 w-full rounded-control border border-line bg-surface-raised px-1.5 py-1 text-xs text-ink focus:border-line-strong focus:outline-none"
            >
              <option value="dynamic">Dynamic (scale out)</option>
              <option value="fixed">Fixed (entire position)</option>
            </select>
          </label>
        </FieldGroup>
        <FieldGroup title="Stops">
          <Field
            name={`${prefix}takeProfit`}
            label="Take profit %"
            defaultValue={layer.takeProfit}
            allowDecimal
          />
          <Field
            name={`${prefix}stopLoss`}
            label="Stop loss %"
            defaultValue={layer.stopLoss}
            allowDecimal
          />
        </FieldGroup>
      </div>
      <div className="mt-3 flex items-end justify-end gap-3">
        <SaveAsTemplateButton
          isAdmin={isAdmin}
          defaultName={layer.name}
          kind="cash_and_carry"
          folders={folders}
          buildForm={() =>
            paperFormToSnapshotSource({
              ...layer,
              mode,
              sizeType,
              exitSizeType,
            })
          }
        />
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-control border border-line px-2 py-0.5 text-xs text-danger hover:bg-danger/10"
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
              className="pointer-events-none shrink-0 rounded-control border border-line px-2 py-0.5 text-xs text-danger opacity-40"
            >
              Remove
            </button>
          </span>
        )}
      </div>
    </section>
  );
}

function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-canvas px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
        {title}
      </p>
      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1.5">{children}</div>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  allowDecimal,
}: {
  name: string;
  label: string;
  defaultValue: string;
  allowDecimal?: boolean;
}) {
  return (
    <label className="block text-[11px] text-ink-muted">
      {label}
      <GroupedNumberInput
        name={name}
        defaultValue={defaultValue}
        allowDecimal={allowDecimal}
      />
    </label>
  );
}

function modeLightLabel(
  mode: AutomationMode,
  accountReduceOnly: boolean,
): string {
  if (mode === "reduce_only") {
    return "Reduce only";
  }
  if (mode === "disabled") {
    return "Disabled";
  }
  return accountReduceOnly
    ? "Active · account Reduce only has priority"
    : "Active";
}

function modeLightFill(
  mode: AutomationMode,
  accountReduceOnly: boolean,
): string {
  if (mode === "disabled") {
    return "bg-ink-faint";
  }
  if (mode === "reduce_only" || accountReduceOnly) {
    return "bg-warning";
  }
  return "bg-success";
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
  const fill = modeLightFill(mode, accountReduceOnly);
  const label = inUse
    ? `${modeLightLabel(mode, accountReduceOnly)} · in use by an open position`
    : modeLightLabel(mode, accountReduceOnly);
  return (
    <span
      className="relative flex size-3.5 shrink-0"
      title={label}
      aria-label={label}
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
