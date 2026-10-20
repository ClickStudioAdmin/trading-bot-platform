"use client";

import { useLayoutEffect, useState } from "react";
import { CONDITION_GROUP_HELPER, JoinWord } from "@/components/condition-join";
import {
  ParamSideFilter,
  type ParamSideChoice,
} from "@/components/param-side-filter";
import {
  filterParamSections,
  paramSectionsHaveBothSides,
  type ParamRow,
  type ParamSection,
  type ParamStack,
} from "@/lib/backtest/param-sections";

function ParamRows({
  rows,
  inset,
}: {
  rows: ParamRow[];
  inset: boolean;
}) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <dl className="divide-y divide-line">
      {rows.map((row, rowIndex) => (
        <div
          key={`${row.label}-${rowIndex}`}
          className={`flex items-baseline justify-between gap-4 py-2.5 ${
            inset ? "px-5" : ""
          }`}
        >
          <dt className="shrink-0 text-xs uppercase tracking-[0.12em] text-ink-muted">
            {row.label}
          </dt>
          <dd className="min-w-0 text-right text-sm font-medium tabular-nums">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function GroupSizing({ rows }: { rows: ParamRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className="border-t border-line pt-4">
      <p className="text-sm font-semibold text-ink">Position Sizing</p>
      <ParamRows rows={rows} inset={false} />
    </div>
  );
}

function ConditionStackView({ stack }: { stack: ParamStack }) {
  return (
    <div className="space-y-3 rounded-card border border-line bg-surface p-4">
      {stack.title ? (
        <p className="text-sm font-semibold text-ink">{stack.title}</p>
      ) : null}
      {stack.rows && stack.rows.length > 0 ? (
        <ParamRows rows={stack.rows} inset={false} />
      ) : null}
      {stack.groups.map((conditions, groupIndex) => {
        const sizing = stack.sizing?.[groupIndex] ?? [];
        return (
          <div key={`group-${groupIndex}`} className="space-y-3">
            {groupIndex > 0 ? <JoinWord label="Or" /> : null}
            <section className="space-y-3 rounded-card border border-line bg-canvas px-4 py-4">
              <h4 className="text-sm font-semibold text-ink">
                Group {groupIndex + 1}
                <span className="ml-2 text-hint font-normal text-ink-muted">
                  - {CONDITION_GROUP_HELPER}
                </span>
              </h4>
              {conditions.map((condition, conditionIndex) => (
                <div key={`condition-${conditionIndex}`} className="space-y-3">
                  {condition.join === "none" || conditionIndex === 0 ? null : (
                    <JoinWord label="And" />
                  )}
                  {condition.title ? (
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                      {condition.title}
                    </p>
                  ) : null}
                  <ParamRows rows={condition.rows} inset={false} />
                </div>
              ))}
              <GroupSizing rows={sizing} />
            </section>
          </div>
        );
      })}
    </div>
  );
}

export function BacktestParameterSections({
  sections,
}: {
  sections: ParamSection[];
}) {
  const both = paramSectionsHaveBothSides(sections);
  const [side, setSide] = useState<ParamSideChoice>("all");
  const shown = filterParamSections(sections, both ? side : "all");
  useLayoutEffect(() => {
    if (!both) {
      return;
    }
    window.dispatchEvent(new Event("resize"));
  }, [both, side]);
  return (
    <div>
      {both ? (
        <div className="sticky top-0 z-20 h-0">
          <div className="absolute top-0 right-0">
            <ParamSideFilter value={side} onChange={setSide} />
          </div>
        </div>
      ) : null}
      {shown.map((section, index) => {
        const hasBody =
          section.groups.length > 0 ||
          section.stack != null ||
          (section.stacks != null && section.stacks.length > 0);
        return (
          <section
            key={section.title}
            className={index < shown.length - 1 ? "pb-2" : undefined}
          >
            <h3
              className={`sticky top-0 z-10 bg-canvas text-sm font-semibold text-ink ${
                both ? "pt-2 pr-36 pb-4" : "py-2"
              }`}
            >
              {section.title}
            </h3>
            {hasBody ? (
              <div className="mt-2 space-y-4">
                {section.groups.length > 0 ? (
                  <div className="overflow-hidden rounded-card border border-line bg-surface">
                    {section.groups.map((group, groupIndex) => (
                      <div
                        key={`${group.title ?? "fields"}-${groupIndex}`}
                        className={groupIndex > 0 ? "border-t border-line" : undefined}
                      >
                        {group.title ? (
                          <p className="bg-surface-raised px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                            {group.title}
                          </p>
                        ) : null}
                        <ParamRows rows={group.rows} inset />
                      </div>
                    ))}
                    {section.sizing && section.sizing.length > 0 ? (
                      <div className="border-t border-line px-5 py-4">
                        <p className="text-sm font-semibold text-ink">Position Sizing</p>
                        <ParamRows rows={section.sizing} inset={false} />
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {section.stack ? <ConditionStackView stack={section.stack} /> : null}
                {section.stacks?.map((stack, stackIndex) => (
                  <div key={`${stack.title ?? "action"}-${stackIndex}`} className="space-y-3">
                    {stackIndex > 0 ? <JoinWord label="Or" /> : null}
                    <ConditionStackView stack={stack} />
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
