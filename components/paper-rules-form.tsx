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
          Stack positions: a higher min APR can use a different size.
          The engine picks the highest matching position. Off means no auto
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
          Add position
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
  const [exitSizeType, setExitSizeType] = useState(layer.exitSizeType);
  return (
    <section className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          Position {index + 1}
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
            label="Max opens"
            defaultValue={layer.maxOpenCount}
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
                label="Min usable book value"
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
