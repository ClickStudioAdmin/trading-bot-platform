"use client";

import { useState } from "react";
import { AppCheck } from "@/components/app-check";
import { AppSelect, type AppSelectChangeEvent } from "@/components/app-select";
import {
  PLAN_VISIBILITIES,
  PLAN_VISIBILITY_LABELS,
  parsePlanVisibility,
  planIsDraft,
  type PlanVisibility,
} from "@/lib/membership/catalog";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function AdminPlanVisibilityFields({
  visibility = "draft",
  preview = false,
  isDefault = false,
}: {
  visibility?: PlanVisibility;
  preview?: boolean;
  isDefault?: boolean;
}) {
  const [current, setCurrent] = useState(visibility);
  const [previewOn, setPreviewOn] = useState(preview);
  const draft = planIsDraft({ visibility: current });

  function onVisibility(event: AppSelectChangeEvent) {
    const next = parsePlanVisibility(event.target.value);
    if (next) {
      setCurrent(next);
    }
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="block text-sm text-ink">
        Visibility
        <AppSelect
          name="visibility"
          value={current}
          onChange={onVisibility}
          className={fieldClass}
        >
          {PLAN_VISIBILITIES.map((value) => (
            <option key={value} value={value}>
              {PLAN_VISIBILITY_LABELS[value]}
            </option>
          ))}
        </AppSelect>
        <span className="mt-1 block text-hint text-ink-muted">
          Public is on the Plans page. Private is assign-only. Draft is not
          published.
        </span>
      </label>
      <div className="space-y-3 self-end pb-1 text-sm text-ink">
        {draft ? (
          <label className="inline-flex items-start gap-2">
            <AppCheck
              name="preview"
              value="1"
              checked={previewOn}
              onChange={(event) => setPreviewOn(event.target.checked)}
            />
            <span>
              Show this draft on the Plans page for preview
              <span className="mt-1 block text-hint text-ink-muted">
                Admins only.
              </span>
            </span>
          </label>
        ) : null}
        <label className="inline-flex items-center gap-2">
          <AppCheck
            name="isDefault"
            value="1"
            defaultChecked={isDefault}
            className=""
          />
          Default for new members
        </label>
      </div>
    </div>
  );
}
