import { CONDITION_GROUP_HELPER, JoinWord } from "@/components/condition-join";
import type { ParamRow, ParamSection, ParamStack } from "@/lib/backtest/param-sections";

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

function ConditionStackView({ stack }: { stack: ParamStack }) {
  return (
    <div className="space-y-3 rounded-card border border-line bg-surface p-4">
      {stack.title ? (
        <p className="text-sm font-semibold text-ink">{stack.title}</p>
      ) : null}
      {stack.rows && stack.rows.length > 0 ? (
        <ParamRows rows={stack.rows} inset={false} />
      ) : null}
      {stack.groups.map((conditions, groupIndex) => (
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
                {conditionIndex > 0 ? <JoinWord label="And" /> : null}
                <ParamRows rows={condition.rows} inset={false} />
              </div>
            ))}
          </section>
        </div>
      ))}
    </div>
  );
}

export function BacktestParameterSections({
  sections,
}: {
  sections: ParamSection[];
}) {
  return (
    <div>
      {sections.map((section, index) => {
        const hasBody =
          section.groups.length > 0 ||
          section.stack != null ||
          (section.stacks != null && section.stacks.length > 0);
        return (
          <section
            key={section.title}
            className={index < sections.length - 1 ? "pb-2" : undefined}
          >
            <h3 className="sticky top-0 z-10 bg-canvas py-2 text-sm font-semibold text-ink">
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
