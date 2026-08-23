"use client";

import { useState, type ReactNode } from "react";
import { savePaperRules } from "@/lib/engine/actions";
import {
  defaultPaperLayer,
  paperConfigToFormValues,
  type PaperLayerFormValues,
  type PaperRulesFormValues,
} from "@/lib/engine/rules";
import { GroupedNumberInput } from "@/components/usdt-size-input";

export function PaperRulesForm({
  values,
  inUseRuleIds,
}: {
  values: PaperRulesFormValues;
  inUseRuleIds: number[];
}) {
  const [layers, setLayers] = useState(values.layers);
  const inUse = new Set(inUseRuleIds);
  const empty = layers.length === 0;

  function removeLayer(key: string, id: string) {
    const next = layers.filter((item) => item.key !== key);
    setLayers(next);
    if (next.length === 0 && id !== "") {
      const data = new FormData();
      data.set("ruleCount", "0");
      void savePaperRules(data);
    }
  }

  return (
    <form action={savePaperRules} className="space-y-4">
      <input type="hidden" name="ruleCount" value={layers.length} />

      {empty ? (
        <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
          No rule sets. Add a position to start, or leave this empty if you
          only trade by hand.
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
              onRemove={() => removeLayer(layer.key, layer.id)}
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
          className={
            empty
              ? "rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
              : "rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong"
          }
        >
          Add position
        </button>
        {empty ? null : (
          <button
            type="submit"
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            Save automations
          </button>
        )}
      </div>
    </form>
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
  onRemove,
}: {
  index: number;
  layer: PaperLayerFormValues;
  canRemove: boolean;
  inUse: boolean;
  onRemove: () => void;
}) {
  const prefix = `r${index}_`;
  const [sizeType, setSizeType] = useState(layer.sizeType);
  const [exitSizeType, setExitSizeType] = useState(layer.exitSizeType);
  return (
    <section className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="min-w-0 w-1/2 text-[11px] text-ink-muted">
          Name
          <input
            name={`${prefix}name`}
            defaultValue={layer.name}
            maxLength={40}
            placeholder={`Set ${index + 1}`}
            className="mt-0.5 w-full rounded-control border border-line bg-surface-raised px-1.5 py-1 text-sm font-semibold text-ink focus:border-line-strong focus:outline-none"
          />
        </label>
        {inUse ? (
          <span
            className="relative flex size-3.5 shrink-0"
            title="In use by an open position"
            aria-label="In use by an open position"
          >
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-3.5 rounded-full bg-success" />
          </span>
        ) : canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-ink-muted hover:text-danger"
          >
            Remove
          </button>
        ) : null}
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
