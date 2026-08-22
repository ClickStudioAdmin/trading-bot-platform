"use client";

import { useState, type ReactNode } from "react";
import { savePaperRules } from "@/lib/engine/actions";
import {
  defaultPaperLayer,
  paperConfigToFormValues,
  type PaperLayerFormValues,
  type PaperRulesFormValues,
} from "@/lib/engine/rules";
import { UsdtSizeInput } from "@/components/usdt-size-input";

export function PaperRulesForm({ values }: { values: PaperRulesFormValues }) {
  const [enabled, setEnabled] = useState(values.enabled);
  const [layers, setLayers] = useState(values.layers);

  return (
    <form action={savePaperRules} className="space-y-4">
      <input type="hidden" name="ruleCount" value={layers.length} />
      <section className="rounded-card border border-line bg-surface px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="size-3.5"
          />
          Enable automations
        </label>
        <p className="mt-1 text-xs text-ink-muted">
          Stack rules to scale in: a higher min APR can use a different size.
          The engine picks the highest matching layer. Off means no auto
          open or close.
        </p>
      </section>

      {layers.map((layer, index) => (
        <RuleRow
          key={layer.key}
          index={index}
          layer={layer}
          canRemove={layers.length > 1}
          onRemove={() =>
            setLayers((current) => current.filter((item) => item.key !== layer.key))
          }
        />
      ))}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setLayers((current) => [
              ...current,
              layerToForm(current.length),
            ])
          }
          className="rounded-control border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-raised"
        >
          Add rule
        </button>
        <button
          type="submit"
          className="rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink"
        >
          Save automations
        </button>
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
  onRemove,
}: {
  index: number;
  layer: PaperLayerFormValues;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const prefix = `r${index}_`;
  const [sizeType, setSizeType] = useState(layer.sizeType);
  return (
    <section className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          Rule {index + 1}
        </h2>
        {canRemove ? (
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
        <FieldGroup title="Triggers">
          <Field
            name={`${prefix}minApr`}
            label="Min APR %"
            placeholder="10"
            defaultValue={layer.minApr}
          />
          <Field
            name={`${prefix}minDte`}
            label="Min DTE"
            placeholder="7"
            defaultValue={layer.minDte}
          />
          <Field
            name={`${prefix}maxDte`}
            label="Max DTE"
            placeholder="90"
            defaultValue={layer.maxDte}
          />
          {sizeType === "fixed" ? (
            <Field
              name={`${prefix}minCapacity`}
              label="Min book value"
              placeholder="5000"
              defaultValue={layer.minCapacity}
            />
          ) : null}
        </FieldGroup>
        <FieldGroup title="Position">
          <label className="block text-[11px] text-ink-muted">
            Order Type
            <select
              name={`${prefix}sizeType`}
              value={sizeType}
              onChange={(event) =>
                setSizeType(event.target.value === "dynamic" ? "dynamic" : "fixed")
              }
              className="mt-0.5 w-full rounded-control border border-line bg-canvas px-1.5 py-1 text-xs text-ink focus:border-line-strong focus:outline-none"
            >
              <option value="fixed">Fixed</option>
              <option value="dynamic">Dynamic</option>
            </select>
          </label>
          <label className="block text-[11px] text-ink-muted">
            Order size
            <div className="mt-0.5">
              <UsdtSizeInput
                name={`${prefix}notionalUsdt`}
                defaultValue={layer.notionalUsdt}
                ariaLabel={`Order size for rule ${index + 1}`}
                compact
              />
            </div>
          </label>
          <Field
            name={`${prefix}maxOpenNotional`}
            label="Max Position Size"
            placeholder="50000"
            defaultValue={layer.maxOpenNotional}
          />
          <Field
            name={`${prefix}maxOpenCount`}
            label="Max opens"
            placeholder="2"
            defaultValue={layer.maxOpenCount}
          />
          {sizeType === "dynamic" ? (
            <Field
              name={`${prefix}minSize`}
              label="Min Size"
              placeholder="5000"
              defaultValue={layer.minSize}
            />
          ) : null}
        </FieldGroup>
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
        Exit
      </p>
      <div className="mt-1 grid gap-2 md:grid-cols-2">
        <FieldGroup title="Triggers">
          <Field
            name={`${prefix}closeMaxDte`}
            label="Close DTE ≤"
            placeholder="3"
            defaultValue={layer.closeMaxDte}
          />
          <Field
            name={`${prefix}closeMinApr`}
            label="Close APR % below"
            placeholder="5"
            defaultValue={layer.closeMinApr}
          />
        </FieldGroup>
        <FieldGroup title="Stops">
          <Field
            name={`${prefix}takeProfit`}
            label="Take profit %"
            placeholder="1"
            defaultValue={layer.takeProfit}
          />
          <Field
            name={`${prefix}stopLoss`}
            label="Stop loss %"
            placeholder="2"
            defaultValue={layer.stopLoss}
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
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder: string;
  defaultValue: string;
}) {
  return (
    <label className="block text-[11px] text-ink-muted">
      {label}
      <input
        name={name}
        type="number"
        step="any"
        inputMode="decimal"
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-0.5 w-full rounded-control border border-line bg-canvas px-1.5 py-1 text-xs tabular-nums text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
      />
    </label>
  );
}
